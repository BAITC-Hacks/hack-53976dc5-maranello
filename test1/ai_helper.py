import json
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "mock-key"))

def generate_clarifying_questions(draft_text: str) -> list[str]:
    if not os.getenv("OPENAI_API_KEY"):
        return [
            "Что происходит сейчас и что именно должно измениться после решения?",
            "Какие данные, примеры, материалы или доступы можно предоставить команде?",
            "Какой результат будет считаться успешным и какие есть сроки или ограничения?"
        ]

    prompt = f"""На основе следующего краткого описания задачи бизнеса сформулируй ровно 3 уточняющих вопроса.
Вопросы должны помочь раскрыть: контекст, доступные данные, ожидаемый результат, критерии успеха или ограничения.

Описание: "{draft_text}"

Верни строго JSON-массив из 3 строк, например: ["вопрос 1", "вопрос 2", "вопрос 3"]
Никакого лишнего текста, только JSON."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        questions = json.loads(response.choices[0].message.content.strip())
        if isinstance(questions, list) and len(questions) >= 3 and all(isinstance(q, str) and q.strip() for q in questions[:3]):
            return questions[:3]
        raise ValueError("AI вернул некорректный список вопросов")
    except Exception:
        return [
            "Каковы основные цели проекта и какую именно проблему бизнеса мы решаем?",
            "Какие исходные данные, API или материалы вы можете предоставить студентам?",
            "Как поймёте, что решение успешно? Есть ли измеримый критерий?"
        ]

def build_task_card_from_answers(draft_text: str, questions: list[str], answers: list[str]) -> dict:
    q_a_pairs = "\n".join([f"В: {q}\nО: {a}" for q, a in zip(questions, answers)])
    
    if not os.getenv("OPENAI_API_KEY"):
        first_answer = answers[0].strip() if len(answers) > 0 and answers[0] else ""
        data_answer = answers[1].strip() if len(answers) > 1 and answers[1] else ""
        success_answer = answers[2].strip() if len(answers) > 2 and answers[2] else ""
        return {
            "title": "",
            "industry": "",
            "context_and_need": "\n\n".join(part for part in (draft_text.strip(), first_answer) if part),
            "data_and_materials": data_answer,
            "expected_result": "",
            "success_criteria": success_answer,
            "constraints": "",
            "target_users": "",
            "contacts": ""
        }

    prompt = f"""Сформируй структурированную карточку задачи из первичного описания и ответов на вопросы.
ВАЖНО: Используй ТОЛЬКО факты, предоставленные пользователем. Ничего не выдумывай!

Первичное описание: {draft_text}
Вопросы и ответы:
{q_a_pairs}

Верни строго JSON следующей структуры:
{{
  "title": "Краткое название задачи",
  "industry": "Отрасль или тема, только если она явно следует из ответов",
  "context_and_need": "Контекст и потребность",
  "data_and_materials": "Данные и материалы",
  "expected_result": "Ожидаемый результат",
  "success_criteria": "Критерии успеха",
  "constraints": "Ограничения",
  "target_users": "Целевая аудитория/пользователи",
  "contacts": "Контакты и формат взаимодействия"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2
        )
        card = json.loads(response.choices[0].message.content.strip())
        if not isinstance(card, dict):
            raise ValueError("AI вернул некорректную карточку")
        fields = ("title", "industry", "context_and_need", "data_and_materials", "expected_result",
                  "success_criteria", "constraints", "target_users", "contacts")
        return {field: card.get(field, "") if isinstance(card.get(field, ""), str) else "" for field in fields}
    except Exception:
        return {
            "title": "",
            "industry": "",
            "context_and_need": draft_text,
            "data_and_materials": "",
            "expected_result": "",
            "success_criteria": "",
            "constraints": "",
            "target_users": "",
            "contacts": ""
        }
