import sqlite3

from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_existing_v1_database_upgrade_preserves_data(tmp_path):
    path = tmp_path / "legacy.db"
    with sqlite3.connect(path) as connection:
        connection.executescript("""
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY, description TEXT NOT NULL, title TEXT NOT NULL,
                context TEXT NOT NULL, need TEXT NOT NULL, users TEXT NOT NULL,
                data_materials TEXT NOT NULL, constraints TEXT NOT NULL, expected_result TEXT NOT NULL,
                success_criteria TEXT NOT NULL, contact TEXT NOT NULL, interaction_format TEXT NOT NULL,
                answers JSON NOT NULL, status TEXT NOT NULL, readiness_score INTEGER,
                readiness_level TEXT, score_breakdown JSON, created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL, confirmed_at DATETIME, published_at DATETIME
            );
            CREATE TABLE proposals (
                id INTEGER PRIMARY KEY, task_id INTEGER REFERENCES tasks(id), team_name TEXT NOT NULL,
                contact TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL,
                created_at DATETIME NOT NULL, decided_at DATETIME
            );
            INSERT INTO tasks VALUES (42, 'Исходный текст', 'Ручное название', 'Контекст', '', '', '', '',
                '', '', '', '', '{}', 'draft', NULL, NULL, NULL,
                '2026-01-01 00:00:00', '2026-01-02 00:00:00', NULL, NULL);
            INSERT INTO proposals VALUES (7, 42, 'Original Team', 'team@example.com',
                'Исходная идея', 'rejected', '2026-01-01 00:00:00', '2026-01-02 00:00:00');
        """)
    url = f"sqlite:///{path}"
    for _ in range(2):  # Startup is repeatable; migration doesn't overwrite later edits.
        with TestClient(create_app(url)) as client:
            response = client.get("/api/tasks/42")
            assert response.status_code == 200
            task = response.json()
            assert task["description"] == "Исходный текст"
            assert task["title"] == "Ручное название"
            assert task["rating"]["score"] == task["readiness_score"] == 10
            assert task["updated_at"] == "2026-01-02T00:00:00+00:00"
            assert task["topic"] == ""
            proposal = client.get("/api/tasks/42/proposals").json()[0]
            assert proposal["id"] == 7
            assert proposal["status"] == "rejected"
            assert proposal["solution_idea"] == proposal["message"] == "Исходная идея"
            assert proposal["plan"] == proposal["estimated_duration"] == proposal["prototype_url"] == ""
    with sqlite3.connect(path) as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
        assert connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 1
