def calculate_score(card_data: dict) -> dict:
    score = 0
    breakdown = {}
    missing_fields = []

    # 1. Контекст и потребность (20 баллов)
    if card_data.get("context_and_need") and len(card_data["context_and_need"].strip()) > 20:
        score += 20
        breakdown["Контекст и потребность"] = 20
    else:
        breakdown["Контекст и потребность"] = 0
        missing_fields.append("Подробное описание контекста и проблемы (> 20 символов)")

    # 2. Данные и материалы (20 баллов)
    if card_data.get("data_and_materials") and len(card_data["data_and_materials"].strip()) > 5:
        score += 20
        breakdown["Данные и материалы"] = 20
    else:
        breakdown["Данные и материалы"] = 0
        missing_fields.append("Указание доступных данных, примеров или источников")

    # 3. Ожидаемый результат (15 баллов)
    if card_data.get("expected_result") and len(card_data["expected_result"].strip()) > 10:
        score += 15
        breakdown["Ожидаемый результат"] = 15
    else:
        breakdown["Ожидаемый результат"] = 0
        missing_fields.append("Конкретный ожидаемый результат работы")

    # 4. Критерии успеха (15 баллов)
    if card_data.get("success_criteria") and len(card_data["success_criteria"].strip()) > 10:
        score += 15
        breakdown["Критерии успеха"] = 15
    else:
        breakdown["Критерии успеха"] = 0
        missing_fields.append("Измеримые критерии приемки работы")

    # 5. Ограничения (10 баллов)
    if card_data.get("constraints") and len(card_data["constraints"].strip()) > 5:
        score += 10
        breakdown["Ограничения"] = 10
    else:
        breakdown["Ограничения"] = 0
        missing_fields.append("Сроки, технологии или иные ограничения")

    # 6. Пользователи (10 баллов)
    if card_data.get("target_users") and len(card_data["target_users"].strip()) > 5:
        score += 10
        breakdown["Пользователи"] = 10
    else:
        breakdown["Пользователи"] = 0
        missing_fields.append("Целевая аудитория решения")

    # 7. Связь с бизнесом (10 баллов)
    if card_data.get("contacts") and len(card_data["contacts"].strip()) > 5:
        score += 10
        breakdown["Связь с бизнесом"] = 10
    else:
        breakdown["Связь с бизнесом"] = 0
        missing_fields.append("Контактное лицо и формат обратной связи")

    if score >= 90:
        level = "Приоритетная 🌟"
        color = "green"
    elif score >= 70:
        level = "Готовая ✅"
        color = "blue"
    elif score >= 40:
        level = "Рабочая ⚙️"
        color = "orange"
    else:
        level = "Черновик ⚠️"
        color = "red"

    return {
        "score": score,
        "level": level,
        "color": color,
        "breakdown": breakdown,
        "missing_fields": missing_fields
    }
