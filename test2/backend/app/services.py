import re

from .models import Task, utcnow

QUESTIONS = {
    "need": "Какую проблему нужно решить?",
    "expected_result": "Какой конкретный результат должна предоставить команда?",
    "success_criteria": "Как вы проверите, что задача решена успешно?",
    "data_materials": "Какие данные и материалы доступны команде?",
    "constraints": "Какие есть сроки, технические и другие ограничения?",
    "users": "Кто будет пользоваться результатом?",
    "contact": "С кем команда может связаться по задаче?",
    "interaction_format": "Как и насколько часто вы готовы общаться с командой?",
    "context": "В каком бизнес-процессе возникла задача?",
    "title": "Как кратко назвать задачу?",
}


UNKNOWN = {"не знаю", "неизвестно", "пока неизвестно", "не определено", "не указано",
           "нет информации", "нет данных", "уточняется", "будет позже", "позже", "tbd",
           "todo", "unknown", "n/a", "na", "none", "null", "нет", "no", "-", "—"}


def is_filled(value):
    normalized = " ".join((value or "").casefold().split()).strip(" .!?;:")
    return normalized not in UNKNOWN and bool(re.search(r"[^\W_]", normalized))


def missing_fields(card):
    return [field for field in QUESTIONS if not is_filled(getattr(card, field))]


def question_fields_for(card, preferred=()):
    missing = missing_fields(card)
    ordered = list(dict.fromkeys([field for field in preferred if field in QUESTIONS] + list(QUESTIONS)))
    return ([field for field in ordered if field in missing] +
            [field for field in ordered if field not in missing])[:3]


def questions_for(task: Task):
    analysis = task.ai_analysis or {}
    fields = question_fields_for(task, analysis.get("question_fields", []))
    return {
        "task_id": task.id,
        "missing_fields": missing_fields(task),
        "questions": [{"field": field, "question": QUESTIONS[field]} for field in fields],
        "ai_analysis": analysis,
    }


def readiness_level(score: int):
    if score < 40:
        return "draft"
    if score < 70:
        return "workable"
    if score < 90:
        return "ready"
    return "priority"


COMPONENTS = {
    "context_need": {"context": 10, "need": 10},
    "data_materials": {"data_materials": 20},
    "expected_result": {"expected_result": 15},
    "success_criteria": {"success_criteria": 15},
    "constraints": {"constraints": 10},
    "users": {"users": 10},
    "contact_interaction": {"contact": 5, "interaction_format": 5},
}


def rating_for(card):
    missing = missing_fields(card)
    breakdown = [{
        "key": key,
        "score": sum(weight for field, weight in fields.items() if field not in missing),
        "max_score": sum(fields.values()),
        "fields": list(fields),
        "missing_fields": [field for field in fields if field in missing],
    } for key, fields in COMPONENTS.items()]
    score = sum(item["score"] for item in breakdown)
    return {"score": score, "level": readiness_level(score), "breakdown": breakdown,
            "missing_fields": missing, "recommendations": [QUESTIONS[field] for field in missing]}


def calculate_readiness(task: Task):
    rating = rating_for(task)
    return rating["score"], rating["level"], {item["key"]: item["score"] for item in rating["breakdown"]}


def refresh_rating(task: Task):
    task.readiness_score, task.readiness_level, task.score_breakdown = calculate_readiness(task)


def reset_confirmation(task: Task):
    task.status = "draft"
    task.confirmed_at = None
    refresh_rating(task)
    task.updated_at = utcnow()


def confirm_task(task: Task):
    refresh_rating(task)
    task.status = "confirmed"
    task.confirmed_at = utcnow()
