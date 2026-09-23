# Business × Students — backend MVP

FastAPI + SQLAlchemy + SQLite. Сквозной сценарий: описание задачи → три вопроса →
редактируемая карточка → подтверждение → рейтинг → каталог → предложения → ручной выбор.
Низкий рейтинг не блокирует публикацию и отклики. Frontend пока не реализован.

## Запуск

Python 3.9+, команды из корня проекта:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m database.seed
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

SQLite в database/app.db автоматически создаётся/обновляется без удаления записей.
Seed повторяемый, существующие записи не перезаписывает. .env необязателен,
настройки — в [.env.example](.env.example).

- [Swagger](http://127.0.0.1:8000/docs)
- [OpenAPI](http://127.0.0.1:8000/openapi.json)
- [Health](http://127.0.0.1:8000/health)

## AI

По умолчанию AI_PROVIDER=mock: демо полностью работает офлайн, без ключа.
Для содержательного анализа внешней моделью задайте в локальном .env:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your-local-key
OPENAI_MODEL=gpt-4o-mini
```

Ключ храните только локально. При включённом openai описание/карточка отправляются
в OpenAI. AI выбирает существующие фрагменты текста, не генерирует новые факты.
Неверный JSON, timeout или отсутствие ключа включают fallback. Режим виден в ai_analysis.

## Проверки

```bash
python -m pytest backend/tests -q
python -m database.migrate
```

[API_CONTRACT.md](docs/API_CONTRACT.md) содержит исполняемый пример полного сценария.
[HANDOFF.md](docs/HANDOFF.md) — результаты проверок и ограничения.
[SPEC.md](docs/SPEC.md) — бизнес-правила и защита от выдуманных фактов.

API предназначен для локального демо: авторизации и проверки владельцев пока нет.
