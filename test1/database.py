"""Synthetic demo data for the AI Sana hackathon MVP."""

from copy import deepcopy


INITIAL_TASKS = [
    {
        "id": "task-1", "title": "Рекомендации для интернет-магазина", "industry": "Торговля",
        "context_and_need": "Покупатели теряются в большом каталоге, а магазин не использует историю просмотров для подбора товаров.",
        "data_and_materials": "CSV с продажами за 6 месяцев (около 10 000 строк), описание каталога товаров.",
        "expected_result": "Прототип сервиса рекомендаций и виджет для карточки товара.",
        "success_criteria": "Время ответа до 200 мс; в тестовой выборке рекомендации попадают в Top-3 не менее чем в 15% случаев.",
        "constraints": "Python, Docker; прототип должен запускаться на сервере заказчика.",
        "target_users": "Покупатели интернет-магазина и менеджер каталога.",
        "contacts": "Алексей, консультации в Telegram по предварительной договорённости.",
        "score": 100, "level": "Приоритетная 🌟", "proposals": [],
    },
    {
        "id": "task-2", "title": "Прогнозирование загрузки учебных аудиторий", "industry": "Образование",
        "context_and_need": "Расписание составляется вручную, поэтому в одни часы аудитории перегружены, а в другие простаивают.",
        "data_and_materials": "Доступны обезличенное расписание и журнал занятости аудиторий за прошлый семестр.",
        "expected_result": "Дашборд с прогнозом загрузки по дням и временным интервалам.",
        "success_criteria": "На тестовых неделях прогноз загрузки отличается от факта не более чем на 20%.",
        "constraints": "Демо на синтетических данных; без интеграции с действующей системой расписания.",
        "target_users": "",
        "contacts": "",
        "score": 80, "level": "Готовая ✅", "proposals": [],
    },
    {
        "id": "task-3", "title": "Снижение очередей в сервисном центре", "industry": "Сервис",
        "context_and_need": "Посетители не знают ожидаемое время обслуживания и приходят одновременно в часы пик.",
        "data_and_materials": "",
        "expected_result": "Интерактивный макет информирования о текущей загрузке и подходящем времени визита.",
        "success_criteria": "На демо пользователь за три шага видит прогноз загруженности выбранного дня.",
        "constraints": "Не использовать персональные данные; прототип работает в браузере.",
        "target_users": "",
        "contacts": "",
        "score": 60, "level": "Рабочая ⚙️", "proposals": [],
    },
    {
        "id": "task-4", "title": "Панель контроля расхода воды", "industry": "Экология",
        "context_and_need": "Небольшие организации получают показания счётчиков раз в месяц и поздно замечают необычный расход.",
        "data_and_materials": "",
        "expected_result": "",
        "success_criteria": "",
        "constraints": "Без подключения к физическим датчикам; допустим CSV импорт.",
        "target_users": "",
        "contacts": "",
        "score": 30, "level": "Черновик ⚠️", "proposals": [],
    },
    {
        "id": "task-5", "title": "Помощник для обработки заявок", "industry": "Операции",
        "context_and_need": "Сотрудники вручную распределяют входящие обращения и иногда пропускают срочные запросы.",
        "data_and_materials": "Можем предоставить десять обезличенных примеров обращений после согласования формата.",
        "expected_result": "Демо-интерфейс сортировки заявок по теме и предполагаемой срочности.",
        "success_criteria": "Для каждого примера видны предложенная категория и объяснение решения.",
        "constraints": "",
        "target_users": "",
        "contacts": "",
        "score": 70, "level": "Готовая ✅", "proposals": [],
    },
]


INITIAL_TEAMS = [
    {"id": "team-1", "name": "AI Dynamos", "interests": ["Торговля", "Операции"], "skills": "Python, рекомендательные системы, FastAPI"},
    {"id": "team-2", "name": "Data Campus", "interests": ["Образование", "Экология"], "skills": "аналитика данных, Python, Streamlit"},
    {"id": "team-3", "name": "Pixel Pioneers", "interests": ["Сервис", "Торговля"], "skills": "UX/UI, React, прототипирование"},
    {"id": "team-4", "name": "Green Bytes", "interests": ["Экология", "Операции"], "skills": "дашборды, визуализация, обработка CSV"},
    {"id": "team-5", "name": "Rapid Prototypers", "interests": ["Сервис", "Образование"], "skills": "Python, автоматизация, веб-разработка"},
]


_INITIAL_PROPOSALS = [
    ("task-1", "team-1", "Подберём товары по совместным просмотрам и покупкам.", "Очистка CSV; базовый алгоритм; API и виджет.", "5 часов", "https://github.com/demo/recommendations"),
    ("task-2", "team-2", "Покажем прогноз загрузки на основе истории расписания.", "Подготовка данных; расчёт прогноза; дашборд.", "1 неделя", "https://github.com/demo/classroom-load"),
    ("task-3", "team-3", "Сделаем понятный экран текущей и ожидаемой загрузки.", "Сценарии посетителя; кликабельный макет; проверка на примерах.", "3 дня", "https://figma.com/design/demo-queue"),
    ("task-4", "team-4", "Добавим пороговые оповещения по скачкам расхода.", "Импорт CSV; поиск изменений; панель показателей.", "5 часов", "https://github.com/demo/water-watch"),
    ("task-5", "team-5", "Создадим очередь заявок с объяснимой сортировкой.", "Разметка примеров; правила категоризации; веб-демо.", "1 неделя", "https://github.com/demo/request-helper"),
]


def get_initial_tasks():
    tasks = deepcopy(INITIAL_TASKS)
    teams = {team["id"]: team for team in INITIAL_TEAMS}
    for index, (task_id, team_id, idea, plan, timeline, link) in enumerate(_INITIAL_PROPOSALS, start=1):
        next(task for task in tasks if task["id"] == task_id)["proposals"].append({
            "id": f"prop-{index}", "team_id": team_id, "team_name": teams[team_id]["name"],
            "idea": idea, "plan": plan, "timeline": timeline, "link": link, "status": "pending",
        })
    return tasks


def get_initial_teams():
    return deepcopy(INITIAL_TEAMS)
