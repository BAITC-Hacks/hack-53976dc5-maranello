import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.schemas import Card
from backend.app.services import rating_for
from database.seed import seed


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(f"sqlite:///{tmp_path / 'v2.db'}")) as client:
        yield client


def test_rating_recalculates_answers_edits_and_clear(client):
    task = client.post("/api/tasks", json={"description": "Контекст: Мы ведём склад.", "topic": "Логистика"}).json()
    path = f"/api/tasks/{task['id']}"
    assert task["rating"]["score"] == 10
    result = client.post(path + "/answers", json={"answers": [
        {"field": "need", "answer": "Снизить потери"},
        {"field": "data_materials", "answer": "CSV остатков"},
        {"field": "success_criteria", "answer": "не знаю"},
    ]}).json()
    assert result["rating"]["score"] == 40
    assert result["rating"]["level"] == "workable"
    assert "success_criteria" in result["rating"]["missing_fields"]
    confirmed = client.post(path + "/confirm").json()
    assert confirmed["status"] == "confirmed"
    updated = client.patch(path, json={"success_criteria": "Итоги совпадают с CSV"}).json()
    assert updated["rating"]["score"] == 55
    assert updated["status"] == "draft"
    assert updated["confirmed_at"] is None
    assert updated["answers"]["success_criteria"] == "не знаю"
    cleared = client.patch(path, json={"data_materials": "TBD"}).json()
    assert cleared["rating"]["score"] == 35
    rating = client.get(path + "/rating").json()
    assert rating == cleared["rating"]
    assert set(rating) == {"score", "level", "breakdown", "missing_fields", "recommendations"}
    assert sum(item["max_score"] for item in rating["breakdown"]) == 100
    assert sum(item["score"] for item in rating["breakdown"]) == rating["score"]
    assert len(rating["recommendations"]) == len(rating["missing_fields"])


@pytest.mark.parametrize("placeholder", ["", "   ", "не знаю", "Неизвестно!", "TBD", "N/A", "???", "...", "—", "нет данных"])
def test_unknown_fields_do_not_earn_points(placeholder):
    card = Card(**dict.fromkeys(Card.model_fields, placeholder))
    assert rating_for(card)["score"] == 0


def test_explicit_constraints_and_zero_are_information():
    assert rating_for(Card(constraints="Без платных сервисов", users="0"))["score"] == 20


def test_catalog_filters_sort_and_pagination(tmp_path):
    url = f"sqlite:///{tmp_path / 'catalog.db'}"
    seed(url)
    with TestClient(create_app(url)) as client:
        tasks = client.get("/api/tasks").json()
        assert [task["rating"]["score"] for task in tasks] == [100, 100, 70, 45, 10]
        ascending = client.get("/api/tasks?sort=rating_asc").json()
        assert [task["rating"]["score"] for task in ascending] == [10, 45, 70, 100, 100]
        filtered = client.get("/api/tasks", params={"topic": "АНАЛИТИКА", "level": "ready"}).json()
        assert len(filtered) == 1
        assert filtered[0]["rating"]["score"] == 70
        assert all(task["status"] == "published" for task in tasks)
        assert client.get("/api/tasks?offset=1&limit=2").json() == tasks[1:3]
        assert client.get("/api/tasks?topic=unknown").json() == []
        assert client.get("/api/tasks?level=excellent").status_code == 422
        assert client.get("/api/tasks?sort=garbage").status_code == 422
        newest = client.get("/api/tasks?sort=newest").json()
        assert [task["id"] for task in newest] == sorted([task["id"] for task in newest], reverse=True)


def test_proposal_shape_url_validation_and_no_auto_assignment(client):
    task_id = client.post("/api/tasks", json={"description": "не знаю"}).json()["id"]
    path = f"/api/tasks/{task_id}"
    client.post(path + "/answers", json={"answers": [
        {"field": field, "answer": ""} for field in ("need", "users", "success_criteria")
    ]})
    assert client.post(path + "/confirm").json()["rating"]["score"] == 0
    assert client.post(path + "/publish").status_code == 200
    payload = {"team_name": "Prototype Lab", "solution_idea": "Исследуем задачу",
               "plan": "Интервью, согласование карточки, прототип", "estimated_duration": "5 часов",
               "prototype_url": "https://example.com/prototype"}
    response = client.post(path + "/proposals", json=payload)
    assert response.status_code == 201
    saved = response.json()
    assert all(saved[field] == value for field, value in payload.items())
    assert saved["status"] == "pending"
    assert saved["decided_at"] is None
    second = client.post(path + "/proposals", json={**payload, "team_name": "Other Team"}).json()
    assert second["status"] == "pending"
    for url in ("javascript:alert(1)", "file:///tmp/prototype", "not-a-url"):
        assert client.post(path + "/proposals", json={**payload, "prototype_url": url}).status_code == 422
    for field in ("team_name", "solution_idea", "plan", "estimated_duration"):
        assert client.post(path + "/proposals", json={**payload, field: " "}).status_code == 422
    assert client.post(path + "/proposals", json={**payload, "status": "accepted"}).status_code == 422
    assert client.patch(f"/api/proposals/{saved['id']}", json={"status": "rejected"}).status_code == 200
    assert client.get(path + "/proposals").json()[1]["status"] == "pending"


def test_openapi_exposes_new_contract(client):
    schema = client.get("/openapi.json").json()
    assert schema["info"]["version"] == "0.2.0"
    assert "/api/tasks/{task_id}/rating" in schema["paths"]
    assert set(schema["components"]["schemas"]["ProposalCreate"]["required"]) == {
        "team_name", "solution_idea", "plan", "estimated_duration"
    }
