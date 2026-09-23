import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text

from backend.app.main import create_app
from backend.app.models import Proposal, Task
from backend.app.services import calculate_readiness, readiness_level
from database.seed import seed


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(f"sqlite:///{tmp_path / 'test.db'}")) as client:
        yield client


def create_task(client):
    response = client.post("/api/tasks", json={"description": "Нужен отчёт о продажах"})
    assert response.status_code == 201
    return response.json()["id"]


def answer(client, task_id):
    response = client.post(f"/api/tasks/{task_id}/answers", json={"answers": [
        {"field": field, "answer": ""} for field in ("need", "expected_result", "success_criteria")
    ]})
    assert response.status_code == 200
    return response.json()


def publish(client, task_id):
    answer(client, task_id)
    assert client.post(f"/api/tasks/{task_id}/confirm").status_code == 200
    response = client.post(f"/api/tasks/{task_id}/publish")
    assert response.status_code == 200
    return response.json()


def proposal(client, task_id, team="Students"):
    return client.post(f"/api/tasks/{task_id}/proposals", json={
        "team_name": team, "contact": "team@example.com", "solution_idea": "Сделаем прототип",
        "plan": "Уточним данные, соберём отчёт, проверим итоги", "estimated_duration": "5 часов"
    })


def test_complete_low_score_workflow(client):
    assert client.get("/health").json() == {"status": "ok"}
    task_id = create_task(client)
    assert client.get("/api/tasks").json() == []
    questions = client.get(f"/api/tasks/{task_id}/questions").json()
    assert len(questions["questions"]) == 3
    assert "context" not in questions["missing_fields"]
    assert client.post(f"/api/tasks/{task_id}/confirm").status_code == 409
    assert client.post(f"/api/tasks/{task_id}/publish").status_code == 409
    assert proposal(client, task_id).status_code == 409
    published = publish(client, task_id)
    assert published["readiness_score"] == 10
    assert published["readiness_level"] == "draft"
    assert published["status"] == "published"
    assert client.get("/api/tasks").json()[0]["id"] == task_id
    assert client.post(f"/api/tasks/{task_id}/publish").json() == published
    assert client.post(f"/api/tasks/{task_id}/confirm").json() == published
    response = proposal(client, task_id)
    assert response.status_code == 201
    proposal_id = response.json()["id"]
    accepted = client.patch(f"/api/proposals/{proposal_id}", json={"status": "accepted"})
    assert accepted.status_code == 200
    assert accepted.json()["decided_at"].endswith("+00:00")
    assert client.patch(f"/api/tasks/{task_id}", json={"title": "Changed"}).status_code == 409
    assert client.post(f"/api/tasks/{task_id}/answers", json={"answers": [
        {"field": field, "answer": "x"} for field in ("need", "users", "constraints")
    ]}).status_code == 409


def test_edit_invalidates_confirmation_and_allows_zero_score(client):
    task_id = create_task(client)
    answer(client, task_id)
    client.post(f"/api/tasks/{task_id}/confirm")
    edited = client.patch(f"/api/tasks/{task_id}", json={"context": "   "}).json()
    assert edited["status"] == "draft"
    assert edited["readiness_score"] == 0
    assert edited["rating"]["score"] == 0
    assert edited["confirmed_at"] is None
    assert client.post(f"/api/tasks/{task_id}/publish").status_code == 409
    assert client.post(f"/api/tasks/{task_id}/confirm").json()["readiness_score"] == 0
    assert client.post(f"/api/tasks/{task_id}/publish").status_code == 200
    assert proposal(client, task_id).status_code == 201


def test_full_card_and_partial_update(client):
    task_id = create_task(client)
    answer(client, task_id)
    fields = ("title", "context", "need", "users", "data_materials", "constraints",
              "expected_result", "success_criteria", "contact", "interaction_format")
    assert client.patch(f"/api/tasks/{task_id}", json=dict.fromkeys(fields, "Заполнено")).status_code == 200
    edited = client.patch(f"/api/tasks/{task_id}", json={"title": "Новое название"}).json()
    assert edited["need"] == "Заполнено"
    confirmed = client.post(f"/api/tasks/{task_id}/confirm").json()
    assert confirmed["readiness_score"] == 100
    assert confirmed["readiness_level"] == "priority"
    assert sum(confirmed["score_breakdown"].values()) == 100
    assert len(client.get(f"/api/tasks/{task_id}/questions").json()["questions"]) == 3


def test_manual_decisions_single_winner(client):
    task_id = create_task(client)
    publish(client, task_id)
    ids = [proposal(client, task_id, team).json()["id"] for team in ("A", "B", "C")]
    assert client.patch(f"/api/proposals/{ids[0]}", json={"status": "accepted"}).status_code == 200
    assert client.patch(f"/api/proposals/{ids[0]}", json={"status": "accepted"}).status_code == 200
    assert client.patch(f"/api/proposals/{ids[1]}", json={"status": "accepted"}).status_code == 409
    assert client.patch(f"/api/proposals/{ids[1]}", json={"status": "rejected"}).status_code == 200
    assert client.patch(f"/api/proposals/{ids[1]}", json={"status": "accepted"}).status_code == 409
    statuses = [p["status"] for p in client.get(f"/api/tasks/{task_id}/proposals").json()]
    assert statuses == ["accepted", "rejected", "pending"]


def test_validation_and_not_found(client):
    assert client.post("/api/tasks", json={"description": "  "}).status_code == 422
    assert client.post("/api/tasks", json={"description": "x", "status": "published"}).status_code == 422
    assert client.get("/api/tasks/999").status_code == 404
    assert client.get("/api/tasks/999/proposals").status_code == 404
    assert client.patch("/api/proposals/999", json={"status": "accepted"}).status_code == 404
    assert client.get("/api/tasks?limit=101").status_code == 422
    task_id = create_task(client)
    for payload in ({}, {"need": None}, {"readiness_score": 100}, {"title": "x" * 201}):
        assert client.patch(f"/api/tasks/{task_id}", json=payload).status_code == 422
    for answers in ([], [{"field": "need", "answer": "x"}] * 3,
                    [{"field": field, "answer": "x"} for field in ("need", "users", "invalid")]):
        assert client.post(f"/api/tasks/{task_id}/answers", json={"answers": answers}).status_code == 422


@pytest.mark.parametrize("score,level", [(0, "draft"), (39, "draft"), (40, "workable"),
    (69, "workable"), (70, "ready"), (89, "ready"), (90, "priority"), (100, "priority")])
def test_readiness_boundaries(score, level):
    assert readiness_level(score) == level


@pytest.mark.parametrize("field,weight", [("title", 0), ("context", 10), ("need", 10),
    ("users", 10), ("data_materials", 20), ("constraints", 10), ("expected_result", 15),
    ("success_criteria", 15), ("contact", 5), ("interaction_format", 5)])
def test_each_score_weight(field, weight):
    from backend.app.schemas import Card
    card = Card(**{field: "present"})
    assert calculate_readiness(card)[0] == weight


def test_seed_idempotency_persistence_and_foreign_keys(tmp_path):
    url = f"sqlite:///{tmp_path / 'seed.db'}"
    assert seed(url) == {"added_tasks": 8, "added_proposals": 5, "added_teams": 5}
    assert seed(url) == {"added_tasks": 0, "added_proposals": 0, "added_teams": 0}
    with TestClient(create_app(url)) as client:
        assert len(client.get("/api/tasks").json()) == 5
        with client.app.state.session_factory() as db:
            assert db.scalar(select(func.count()).select_from(Task)) == 8
            assert db.scalar(select(func.count()).select_from(Proposal)) == 5
            assert db.scalar(text("PRAGMA foreign_keys")) == 1
        new_id = create_task(client)
    with TestClient(create_app(url)) as restarted:
        assert restarted.get(f"/api/tasks/{new_id}").status_code == 200
