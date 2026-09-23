import json

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app.ai import TaskAI
from backend.app.ai.providers import OpenAIProvider
from backend.app.main import create_app


class StubProvider:
    def __init__(self, output):
        self.output = output

    def extract(self, sources, current_card=None):
        if isinstance(self.output, Exception):
            raise self.output
        return self.output(sources, current_card) if callable(self.output) else self.output


def output(assignments=None, question_fields=None):
    return json.dumps({"assignments": assignments or [],
                       "question_fields": question_fields or ["need", "expected_result", "success_criteria"]})


def test_mock_extracts_only_labelled_information():
    card, meta = TaskAI().prepare(
        "Контекст: Склад ведёт учёт вручную; Данные: CSV остатков; "
        "Результат: Отчёт по товарам; Контакт: warehouse@example.com"
    )
    assert card.context == "Склад ведёт учёт вручную"
    assert card.data_materials == "CSV остатков"
    assert card.expected_result == "Отчёт по товарам"
    assert card.contact == "warehouse@example.com"
    assert card.constraints == card.users == card.success_criteria == ""
    assert meta["provider"] == "mock"
    assert len(meta["question_fields"]) == 3


def test_valid_model_extraction_uses_whole_source_and_questions(tmp_path):
    description = "Мы ведём склад. Требуется сократить потери. Данных пока нет."
    ai = TaskAI(StubProvider(output([
        {"field": "context", "source_id": "description:0"},
        {"field": "need", "source_id": "description:1"},
    ], ["data_materials", "expected_result", "success_criteria"])))
    with TestClient(create_app(f"sqlite:///{tmp_path / 'ai.db'}", ai_service=ai)) as client:
        response = client.post("/api/tasks", json={"description": description})
        assert response.status_code == 201
        task = response.json()
        assert task["context"] == "Мы ведём склад."
        assert task["need"] == "Требуется сократить потери."
        assert task["data_materials"] == ""
        assert task["ai_analysis"]["provider"] == "openai"
        questions = client.get(f"/api/tasks/{task['id']}/questions").json()
        assert questions["questions"][0]["field"] == "data_materials"
        assert "CSV" not in str(questions)  # Model may not embed invented assumptions in questions.


@pytest.mark.parametrize("bad_output", [
    "not JSON", "```json\n{}\n```", "[]", "null", "{}",
    '{"assignments":[],"question_fields":["need"]}',
    output(question_fields=["need", "need", "need"]),
    output(question_fields=["need", "unknown_field", "users"]),
    output([{"field": "data_materials", "source_id": "invented-csv"}]),
    output([{"field": "need", "source_id": "description:0", "value": "Выдуманный бюджет"}]),
    output([{"field": "need", "source_id": "description:0"}, {"field": "users", "source_id": "description:0"}]),
    httpx.ReadTimeout("slow provider"), RuntimeError("provider unavailable"),
])
def test_invalid_ai_never_breaks_intake(tmp_path, bad_output):
    ai = TaskAI(StubProvider(bad_output))
    with TestClient(create_app(f"sqlite:///{tmp_path / 'fallback.db'}", ai_service=ai)) as client:
        response = client.post("/api/tasks", json={"description": "У нас маленький магазин."})
        assert response.status_code == 201
        task = response.json()
        assert task["context"] == "У нас маленький магазин."
        assert task["data_materials"] == task["constraints"] == task["contact"] == ""
        assert task["ai_analysis"]["provider"] == "fallback"
        assert task["ai_analysis"]["fallback_reason"] == "invalid_or_unavailable_ai"
        assert task["rating"]["score"] == 10
        assert len(client.get(f"/api/tasks/{task['id']}/questions").json()["questions"]) == 3


def test_model_cannot_reassign_labelled_fields_or_drop_them():
    for assignments in ([{"field": "data_materials", "source_id": "description:0"}], []):
        card, meta = TaskAI(StubProvider(output(assignments))).prepare("Ограничения: Не использовать внешние данные")
        assert card.constraints == "Не использовать внешние данные"
        assert card.data_materials == ""
        assert meta["provider"] == "fallback"


def test_model_cannot_strip_negation():
    card, _ = TaskAI(StubProvider(output([
        {"field": "data_materials", "source_id": "description:0"}
    ]))).prepare("Данные: CSV отсутствует")
    assert card.data_materials == "CSV отсутствует"
    assert card.data_materials != "CSV"


def test_answer_flow_preserves_manual_edits_and_unknowns(tmp_path):
    def valid_provider(sources, current_card):
        return output([{"field": s["field_hint"], "source_id": s["id"]} for s in sources if s["field_hint"]])

    ai = TaskAI(StubProvider(valid_provider))
    with TestClient(create_app(f"sqlite:///{tmp_path / 'answers.db'}", ai_service=ai)) as client:
        task = client.post("/api/tasks", json={"description": "Контекст: Магазин"}).json()
        path = f"/api/tasks/{task['id']}"
        client.patch(path, json={"title": "Моя карточка", "context": "", "constraints": "Не использовать облако"})
        response = client.post(path + "/answers", json={"answers": [
            {"field": "need", "answer": "Снизить потери"},
            {"field": "users", "answer": "Сотрудники"},
            {"field": "success_criteria", "answer": ""},
        ]})
        assert response.status_code == 200
        card = response.json()
        assert card["ai_analysis"]["provider"] == "openai"
        assert card["title"] == "Моя карточка"
        assert card["context"] == ""  # Never resurrect cleared fields from initial description.
        assert card["constraints"] == "Не использовать облако"
        assert card["success_criteria"] == ""
        # An external response trying to erase the answers is rejected as a whole.
        ai.provider = StubProvider(output())
        response = client.post(path + "/answers", json={"answers": [
            {"field": "need", "answer": "Обновлённая потребность"},
            {"field": "users", "answer": ""},
            {"field": "success_criteria", "answer": "Измеримый критерий"},
        ]})
        assert response.status_code == 200
        assert response.json()["need"] == "Обновлённая потребность"
        assert response.json()["ai_analysis"]["provider"] == "fallback"


def test_no_key_uses_fallback(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openai")
    card, metadata = TaskAI.from_env().prepare("Нужен отчёт")
    assert card.context == "Нужен отчёт"
    assert metadata["provider"] == "fallback"
    assert metadata["fallback_reason"] == "missing_api_key"


def test_openai_adapter_request_and_response():
    def handler(request):
        assert str(request.url) == "https://api.openai.com/v1/responses"
        assert request.headers["authorization"] == "Bearer test-key"
        body = json.loads(request.content)
        assert body["store"] is False
        assert body["text"]["format"]["strict"] is True
        assert body["text"]["format"]["schema"]["additionalProperties"] is False
        assert json.loads(body["input"])["sources"][0]["text"] == "Нужен отчёт"
        return httpx.Response(200, json={"status": "completed", "output": [{"type": "message", "content": [
            {"type": "output_text", "text": output([{"field": "need", "source_id": "description:0"}])}
        ]}]})

    ai = TaskAI(OpenAIProvider("test-key", "test-model", transport=httpx.MockTransport(handler)))
    card, meta = ai.prepare("Нужен отчёт")
    assert card.need == "Нужен отчёт"
    assert meta["provider"] == "openai"


@pytest.mark.parametrize("status,body", [
    (429, {"error": "rate limit"}), (500, {"error": "server error"}),
    (200, {"status": "incomplete", "output": []}),
    (200, {"status": "completed", "output": [{"type": "message", "content": [{"type": "refusal"}]}]}),
    (200, []), (200, {"status": "completed", "output": None}),
])
def test_http_errors_and_malformed_provider_envelope_fallback(status, body):
    transport = httpx.MockTransport(lambda request: httpx.Response(status, json=body))
    card, meta = TaskAI(OpenAIProvider("test-key", "test-model", transport)).prepare("Магазин")
    assert card.context == "Магазин"
    assert meta["provider"] == "fallback"
