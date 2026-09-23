import json
import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.ai import TaskAI
from backend.app.main import create_app
from backend.app.models import Task, TeamProfile
from database.seed import seed


class BrokenProvider:
    def __init__(self, raw):
        self.raw = raw

    def extract(self, sources, current_card=None):
        return self.raw


@pytest.mark.parametrize("raw", ["not JSON", "null", json.dumps({
    "assignments": [{"field": "data_materials", "source_id": "invented"}],
    "question_fields": ["need", "expected_result", "success_criteria"],
})])
def test_bad_ai_full_flow_and_restart(tmp_path, caplog, raw):
    url = f"sqlite:///{tmp_path / 'invalid-ai.db'}"
    with caplog.at_level(logging.WARNING), TestClient(create_app(url, TaskAI(BrokenProvider(raw)))) as client:
        response = client.post('/api/tasks', json={'description': 'Заявки теряются в чатах'})
        assert response.status_code == 201
        task = response.json()
        path = f"/api/tasks/{task['id']}"
        assert task['ai_analysis']['provider'] == 'fallback'
        assert task['data_materials'] == task['contact'] == ''
        questions = client.get(path + '/questions').json()['questions']
        assert [q['field'] for q in questions] == ['need', 'expected_result', 'success_criteria']
        response = client.post(path + '/answers', json={'answers': [
            {'field': 'need', 'answer': 'Единый реестр'},
            {'field': 'expected_result', 'answer': 'Поиск по номеру'},
            {'field': 'success_criteria', 'answer': 'Все тестовые заявки находятся'},
        ]})
        assert response.status_code == 200
        assert response.json()['ai_analysis']['provider'] == 'fallback'
        assert response.json()['need'] == 'Единый реестр'
        assert response.json()['rating']['score'] == 50
        assert client.patch(path, json={'data_materials': 'CSV заявок'}).json()['rating']['score'] == 70
        assert client.post(path + '/confirm').status_code == 200
        assert client.post(path + '/publish').status_code == 200
        proposal = client.post(path + '/proposals', json={
            'team_name': 'QA Team', 'solution_idea': 'Локальный реестр',
            'plan': 'Импорт и поиск', 'estimated_duration': '5 часов',
        }).json()
        assert proposal['status'] == 'pending'
        assert client.patch(f"/api/proposals/{proposal['id']}", json={'status': 'accepted'}).status_code == 200
    # New engine/application, same SQLite file: no in-memory state can satisfy these checks.
    with TestClient(create_app(url)) as restarted:
        persisted = restarted.get(path).json()
        assert persisted['status'] == 'published'
        assert persisted['rating']['score'] == 70
        assert restarted.get(path + '/proposals').json()[0]['status'] == 'accepted'
    assert not [record for record in caplog.records if record.levelno >= logging.ERROR or record.exc_info]


def test_team_seed_read_api_and_user_edits_survive_reseed(tmp_path):
    url = f"sqlite:///{tmp_path / 'seed.db'}"
    assert seed(url) == {'added_tasks': 8, 'added_proposals': 5, 'added_teams': 5}
    with TestClient(create_app(url)) as client:
        teams = client.get('/api/teams').json()
        assert len(teams) == 5
        assert all(team['skills'] and team['description'] and team['contact'] for team in teams)
        assert client.get('/api/teams?offset=1&limit=2').json() == teams[1:3]
        assert client.get('/api/teams?limit=0').status_code == 422
        assert client.get('/api/teams?offset=100').json() == []
        with client.app.state.session_factory() as db:
            db.get(TeamProfile, teams[0]['id']).description = 'Отредактированный профиль'
            task = db.scalar(select(Task).order_by(Task.id))
            task.title = 'Сохранить ручное название'
            task_id = task.id
            db.commit()
    assert seed(url) == {'added_tasks': 0, 'added_proposals': 0, 'added_teams': 0}
    with TestClient(create_app(url)) as client:
        assert client.get('/api/teams').json()[0]['description'] == 'Отредактированный профиль'
        assert client.get(f'/api/tasks/{task_id}').json()['title'] == 'Сохранить ручное название'
