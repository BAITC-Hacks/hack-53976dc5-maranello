# API contract v0.2.0

Base URL: http://127.0.0.1:8000. JSON, UTF-8. Авторизации нет.
Swagger: GET /docs. Машинный контракт: GET /openapi.json.

## Изменения относительно v0.1

- Rating доступен сразу и пересчитывается после ответов/редактирования; больше не null.
- Task получил topic, ai_analysis и rating; старые readiness_score/readiness_level/
  score_breakdown сохранены и согласованы с rating.
- Добавлен GET /api/tasks/{id}/rating с точной формой score/level/breakdown/
  missing_fields/recommendations.
- Каталог по умолчанию сортируется по рейтингу, добавлены фильтры.
- Изменён POST proposal: вместо message нужны solution_idea, plan, estimated_duration.
  Старые записи читаются, message в ответе сохранён. Старый формат POST теперь 422.

## Маршруты

| Метод | Путь | Успех | Ответ |
| --- | --- | --- | --- |
| GET | /health | 200 | {"status":"ok"}, с проверкой SQLite |
| GET | /api/teams | 200 | TeamProfile[] — демонстрационный справочник |
| POST | /api/tasks | 201 | Task |
| GET | /api/tasks | 200 | Task[] — опубликованные |
| GET | /api/tasks/{task_id} | 200 | Task любого статуса |
| GET | /api/tasks/{task_id}/questions | 200 | Questions |
| GET | /api/tasks/{task_id}/rating | 200 | Rating |
| POST | /api/tasks/{task_id}/answers | 200 | Task |
| PATCH | /api/tasks/{task_id} | 200 | Task |
| POST | /api/tasks/{task_id}/confirm | 200 | Task |
| POST | /api/tasks/{task_id}/publish | 200 | Task |
| POST | /api/tasks/{task_id}/proposals | 201 | Proposal |
| GET | /api/tasks/{task_id}/proposals | 200 | Proposal[] |
| PATCH | /api/proposals/{proposal_id} | 200 | Proposal |

Списки задач, предложений и профилей: limit=50 (1–100), offset=0 (≥0), ответ — массив без total.
Каталог дополнительно принимает:

| Параметр | Значения / поведение |
| --- | --- |
| sort | rating_desc (default), rating_asc, newest; равенство разрешает id DESC |
| topic | Точное совпадение после trim/casefold, максимум 100 символов |
| level | draft, workable, ready, priority |

Фильтры совмещаются через AND, затем сортировка и пагинация.
Пример: GET /api/tasks?sort=rating_desc&topic=аналитика&level=ready&limit=10.
Пустой результат = []. Список предложений сортируется по id ASC.

## Создание и редактирование

POST /api/tasks:

```json
{"description":"Контекст: Мы ведём склад; Данные: CSV остатков", "topic":"аналитика"}
```

Description обязателен, 1–2000 символов; topic необязателен, 0–100.
AI/mock выделяет только сведения из текста, возвращает draft и начальный рейтинг.
Режим AI задаётся сервером; клиент не может передать provider, score или status.

Поля карточки: title (0–200 символов), context, need, users, data_materials,
constraints, expected_result, success_criteria, contact, interaction_format
(каждое 0–10 000). Все строки обрезаются по краям; null и неизвестные ключи запрещены.

PATCH /api/tasks/{id} принимает любой непустой набор полей карточки и/или topic.
Пропущенные поля не меняются, пустая строка очищает поле. Description неизменяемо.
Правка сбрасывает confirmed_at, переводит в draft и сразу обновляет рейтинг.
Опубликованные карточки редактировать нельзя (409).

## Уточнение и structured card

GET .../questions:

```json
{
  "task_id":1,
  "missing_fields":["need","expected_result","success_criteria","constraints","users","contact","interaction_format","title"],
  "questions":[
    {"field":"need","question":"Какую проблему нужно решить?"},
    {"field":"expected_result","question":"Какой конкретный результат должна предоставить команда?"},
    {"field":"success_criteria","question":"Как вы проверите, что задача решена успешно?"}
  ],
  "ai_analysis":{"provider":"mock","fallback_reason":null,"question_fields":["need","expected_result","success_criteria"]}
}
```

Ровно три разных вопроса, незаполненные поля в приоритете. Даже при полностью
заполненной карточке остаются три вопроса для уточнения. GET не вызывает внешнее AI.

POST .../answers:

```json
{"answers":[
  {"field":"need","answer":"Выявлять товары с низким запасом"},
  {"field":"expected_result","answer":"Отчёт по товарам ниже порога"},
  {"field":"success_criteria","answer":"Все товары ниже порога есть в отчёте"}
]}
```

От 3 до 10 ответов с уникальными field из десяти полей карточки. Можно отвечать
на любые поля. Answer — строка до 10 000 (title до 200), пустое значение разрешено.
Ответы объединяются с сохранёнными по ключу field, соответствующие поля карточки
обновляются. Остальные поля, включая ручные правки и очищенные значения, сохраняются.
AI output валидируется; ошибки переводят обработку в fallback без потери ответов.
Рейтинг обновляется, подтверждение сбрасывается. Для published — 409.

## Подтверждение и публикация

POST .../confirm и POST .../publish не требуют тела.
Confirm требует минимум три сохранённых ответа (явно пустые тоже считаются).
Publish требует confirmed. Повторные операции возвращают текущую карточку.
Рейтинг не блокирует ни публикацию, ни отправку предложения, включая score=0.

## Rating

GET .../rating возвращает этот объект. Тот же объект находится в Task.rating:

```json
{
  "score":70,
  "level":"ready",
  "breakdown":[
    {"key":"context_need","score":20,"max_score":20,"fields":["context","need"],"missing_fields":[]},
    {"key":"data_materials","score":20,"max_score":20,"fields":["data_materials"],"missing_fields":[]},
    {"key":"expected_result","score":15,"max_score":15,"fields":["expected_result"],"missing_fields":[]},
    {"key":"success_criteria","score":15,"max_score":15,"fields":["success_criteria"],"missing_fields":[]},
    {"key":"constraints","score":0,"max_score":10,"fields":["constraints"],"missing_fields":["constraints"]},
    {"key":"users","score":0,"max_score":10,"fields":["users"],"missing_fields":["users"]},
    {"key":"contact_interaction","score":0,"max_score":10,"fields":["contact","interaction_format"],"missing_fields":["contact","interaction_format"]}
  ],
  "missing_fields":["constraints","users","contact","interaction_format"],
  "recommendations":[
    "Какие есть сроки, технические и другие ограничения?",
    "Кто будет пользоваться результатом?",
    "С кем команда может связаться по задаче?",
    "Как и насколько часто вы готовы общаться с командой?"
  ]
}
```

Пример предполагает заполненное title. Title может входить в missing_fields,
но веса не имеет. Context/need дают по 10, contact/interaction_format — по 5.
Уровни: 0–39 draft, 40–69 workable, 70–89 ready, 90–100 priority.
Неизвестное, пробелы, пунктуация и заглушки вроде «не знаю», TBD и N/A не оцениваются.
Полный список и ограничения эвристики — в [SPEC.md](SPEC.md).

## Task

Task всегда включает:

| Поля | Тип |
| --- | --- |
| id | integer |
| description, topic и десять полей карточки | string |
| answers | object: field → исходный ответ |
| status | draft / confirmed / published |
| rating | Rating, см. выше |
| readiness_score | integer 0–100, то же, что rating.score |
| readiness_level | тот же уровень, что rating.level |
| score_breakdown | object: ключ компонента → набранные баллы |
| ai_analysis | объект ниже |
| created_at, updated_at | ISO 8601 UTC, суффикс +00:00 |
| confirmed_at, published_at | ISO 8601 UTC либо null |

AI metadata:

```json
{"provider":"fallback","fallback_reason":"invalid_or_unavailable_ai","question_fields":["need","expected_result","success_criteria"]}
```

Provider: mock, openai, fallback или legacy (мигрированные/seed-записи без анализа).
Fallback_reason: null, missing_api_key или invalid_or_unavailable_ai.
Это сведения о последнем анализе при создании/ответах. После ручного PATCH
metadata не переопределяется, но GET questions и rating отражают текущую карточку.

## Профили команд (QA seed)

GET /api/teams — read-only справочник, сортировка id ASC, limit/offset.
В чистой seed-базе пять профилей. Формат элемента:

```json
{"id":1,"name":"Data Bakers","description":"Демонстрационная команда аналитиков: отчёты и визуализация продаж.","skills":["Python","CSV","React","Визуализация данных"],"contact":"bakers@example.com"}
```

Профили создаёт `python -m database.seed` из `database/team_profiles.json`.
Запись профилей через API и регистрация не входят в MVP. Поля предложений остаются
свободным вводом, профиль не назначает команду и не подтверждает её личность.

## Предложения команд

POST /api/tasks/{id}/proposals:

```json
{
  "team_name":"Data Team",
  "solution_idea":"Локальный отчёт из CSV",
  "plan":"Проверить колонки, посчитать остатки, сверить итоговый отчёт",
  "estimated_duration":"5 часов",
  "prototype_url":"https://example.com/prototype",
  "contact":"team@example.com"
}
```

Обязательные непустые поля: team_name (до 200), solution_idea и plan (до 10 000),
estimated_duration (до 200). Prototype_url (до 2000) и contact (до 500)
необязательны, default пустая строка. Непустой URL должен иметь схему HTTP(S);
сервер не загружает содержимое ссылки. Contact — свободный текст.

Ответ Proposal содержит все перечисленные поля плюс id, task_id, status=pending,
created_at, decided_at=null и message (дубль solution_idea для совместимости).
Старые предложения могут иметь пустые plan/duration/URL — миграция не выдумывает их.
Повторный POST создаёт новое предложение; команда никогда не назначается автоматически.
Отклик возможен только на published, независимо от рейтинга и других предложений.

PATCH /api/proposals/{id}: {"status":"accepted"} либо {"status":"rejected"}.
Сервер записывает decided_at. Только pending может перейти в новое состояние;
повтор того же решения возвращает прежний результат. Максимум одно accepted на
задачу. Остальные предложения остаются без изменений; решения принимает бизнес.

## Ошибки

- 404: задача или предложение не найдены.
- 409: запрещённый переход, мало ответов, публикация без подтверждения,
  редактирование published, отклик на неопубликованное, окончательное решение
  либо другая команда уже принята.
- 422: неверное тело/параметры, неизвестные поля, null, пустые обязательные значения,
  повторяющиеся field, неверный URL, превышение длины, неизвестный sort/level.

404/409: {"detail":"Task not found"}, сообщения на английском.
422: стандартный массив FastAPI в detail; пустой PATCH возвращает строковый detail.
Клиент должен поддерживать оба типа detail. Сбой внешнего AI сам по себе не даёт
HTTP 500: операция завершается с fallback и metadata.

## Полный сценарий для проверки

При работающем сервере выполните этот Python-код в активированном .venv.
Он создаёт одну опубликованную задачу и два предложения, принимая первое и отклоняя второе.

```python
import httpx

with httpx.Client(base_url="http://127.0.0.1:8000", timeout=30) as client:
    def request(method, path, **kwargs):
        response = client.request(method, path, **kwargs)
        response.raise_for_status()
        return response.json()

    task = request("POST", "/api/tasks", json={
        "description": "Контекст: Учебный центр ведёт учёт посещений",
        "topic": "аналитика",
    })
    path = f"/api/tasks/{task['id']}"
    print(request("GET", path + "/questions"))
    request("POST", path + "/answers", json={"answers": [
        {"field": "need", "answer": "Сравнивать посещаемость по дням"},
        {"field": "data_materials", "answer": "Обезличенный CSV посещений"},
        {"field": "expected_result", "answer": "Отчёт по дням"},
    ]})
    request("PATCH", path, json={"title": "Отчёт о посещаемости",
        "success_criteria": "Суммы в отчёте совпадают с исходным CSV"})
    rating = request("GET", path + "/rating")
    assert rating["score"] == 70 and rating["level"] == "ready"
    request("POST", path + "/confirm")
    request("POST", path + "/publish")
    catalog = request("GET", "/api/tasks", params={"topic": "аналитика", "level": "ready"})
    assert any(item["id"] == task["id"] for item in catalog)
    for name, decision in [("Demo Team A", "accepted"), ("Demo Team B", "rejected")]:
        proposal = request("POST", path + "/proposals", json={
            "team_name": name, "solution_idea": "Локальный отчёт из CSV",
            "plan": "Проверить CSV, построить отчёт и сверить суммы",
            "estimated_duration": "5 часов", "prototype_url": "https://example.com/demo",
        })
        assert proposal["status"] == "pending"
        result = request("PATCH", f"/api/proposals/{proposal['id']}", json={"status": decision})
        assert result["status"] == decision
    print({"task_id": task["id"], "rating": rating, "proposals": request("GET", path + "/proposals")})
```
