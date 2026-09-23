import uuid

import streamlit as st

from ai_helper import build_task_card_from_answers, generate_clarifying_questions
from database import get_initial_tasks, get_initial_teams
from scoring import calculate_score



st.set_page_config(page_title="AI Sana — бизнес-задачи", page_icon="🚀", layout="wide")

TOPICS = ["Торговля", "Образование", "Сервис", "Экология", "Операции", "Другое"]
CARD_FIELDS = {
    "title": ("Название задачи", "Коротко сформулируйте задачу"),
    "context_and_need": ("Контекст и потребность", "Что происходит сейчас и что нужно изменить?"),
    "data_and_materials": ("Данные и материалы", "Какие данные, примеры или доступы доступны?"),
    "expected_result": ("Ожидаемый результат", "Что команда должна передать бизнесу?"),
    "success_criteria": ("Критерии успеха", "Как измерить, что результат подходит?"),
    "constraints": ("Ограничения", "Сроки, технологии, доступы и другие границы"),
    "target_users": ("Пользователи", "Для кого создаётся решение?"),
    "contacts": ("Контакт и формат взаимодействия", "Контактное лицо и как команда может задавать вопросы"),
}


def init_state():
    defaults = {
        "tasks": get_initial_tasks(),
        "teams": get_initial_teams(),
        "draft_step": 1,
        "current_draft": "",
        "questions": [],
        "generated_card": None,
        "draft_token": 0,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def render_score(score_result):
    st.metric("Готовность задачи", f"{score_result['score']} / 100")
    st.caption(f"Уровень: **{score_result['level']}**")
    st.markdown("**Детализация**")
    for criterion, points in score_result["breakdown"].items():
        st.write(f"{criterion}: **{points} б.**")
    if score_result["missing_fields"]:
        st.warning("Чтобы повысить рейтинг, дополните:")
        for field in score_result["missing_fields"]:
            st.write(f"• {field}")


def business_workspace():
    st.header("Рабочее место бизнеса")
    create_tab, tasks_tab = st.tabs(["➕ Создать задачу", "📋 Задачи и отклики"])

    with create_tab:
        st.subheader("1. Опишите потребность")
        token = st.session_state.draft_token
        draft = st.text_area(
            "Краткое описание",
            value=st.session_state.current_draft,
            key=f"draft_{token}",
            placeholder="Например: в магазине покупателям сложно найти подходящие товары...",
        )
        if st.button("Проанализировать описание", key=f"analyze_{token}"):
            if len(draft.strip()) < 10:
                st.warning("Добавьте немного подробностей (минимум 10 символов).")
            else:
                st.session_state.current_draft = draft.strip()
                with st.spinner("Подбираем уточняющие вопросы…"):
                    st.session_state.questions = generate_clarifying_questions(draft.strip())
                st.session_state.draft_step = 2
                st.rerun()

        if st.session_state.draft_step == 2:
            st.divider()
            st.subheader("2. Уточните задачу")
            st.info("Ответы помогают сформировать карточку. Можно оставить неизвестные сведения пустыми.")
            for index, question in enumerate(st.session_state.questions):
                st.text_area(question, key=f"answer_{token}_{index}", height=80)
            if st.button("Сформировать карточку", type="primary", key=f"make_card_{token}"):
                answers = [st.session_state.get(f"answer_{token}_{i}", "") for i in range(len(st.session_state.questions))]
                with st.spinner("Формируем черновик карточки…"):
                    card = build_task_card_from_answers(st.session_state.current_draft, st.session_state.questions, answers)
                card["_form_id"] = str(uuid.uuid4())
                st.session_state.generated_card = card
                st.session_state.draft_step = 3
                st.rerun()

        if st.session_state.draft_step == 3 and st.session_state.generated_card:
            st.divider()
            st.subheader("3. Проверьте карточку и подтвердите публикацию")
            card = st.session_state.generated_card
            card_id = card["_form_id"]
            left, right = st.columns([2, 1])
            with left:
                card["industry"] = st.selectbox(
                    "Отрасль или тема", TOPICS,
                    index=TOPICS.index(card.get("industry")) if card.get("industry") in TOPICS else len(TOPICS) - 1,
                    key=f"{card_id}_industry",
                )
                for field, (label, help_text) in CARD_FIELDS.items():
                    if field in ("title",):
                        card[field] = st.text_input(label, value=card.get(field, ""), key=f"{card_id}_{field}", help=help_text)
                    else:
                        card[field] = st.text_area(label, value=card.get(field, ""), key=f"{card_id}_{field}", help=help_text, height=95)
            score_result = calculate_score(card)
            with right:
                render_score(score_result)

            if st.button("🚀 Подтвердить и опубликовать", type="primary", key=f"publish_{card_id}"):
                if not card["title"].strip():
                    st.error("Добавьте название задачи перед публикацией.")
                else:
                    st.session_state.tasks.append({
                        "id": str(uuid.uuid4()),
                        "industry": card["industry"],
                        **{field: card.get(field, "") for field in CARD_FIELDS},
                        "title": card["title"],
                        "score": score_result["score"],
                        "level": score_result["level"],
                        "proposals": [],
                    })
                    st.success("Карточка опубликована в общем каталоге.")
                    st.session_state.draft_step = 1
                    st.session_state.current_draft = ""
                    st.session_state.questions = []
                    st.session_state.generated_card = None
                    st.session_state.draft_token += 1

            if st.button("Начать заново", key=f"reset_{card_id}"):
                st.session_state.draft_step = 1
                st.session_state.current_draft = ""
                st.session_state.questions = []
                st.session_state.generated_card = None
                st.session_state.draft_token += 1
                st.rerun()

    with tasks_tab:
        st.subheader("Опубликованные задачи и предложения команд")
        for task in st.session_state.tasks:
            with st.expander(f"{task['title']} · {task['score']} баллов · {task['level']} · откликов: {len(task.get('proposals', []))}"):
                st.write(f"**Тема:** {task.get('industry', 'Другое')}")
                st.write(f"**Контекст:** {task['context_and_need']}")
                proposals = task.get("proposals", [])
                if not proposals:
                    st.info("Пока нет откликов на эту задачу.")
                for proposal in proposals:
                    st.divider()
                    details, actions = st.columns([4, 1])
                    with details:
                        st.markdown(f"**{proposal['team_name']}** · {proposal.get('status', 'pending')}")
                        st.write(f"**Идея:** {proposal['idea']}")
                        st.write(f"**План:** {proposal['plan']}")
                        st.write(f"**Срок:** {proposal.get('timeline', 'Не указан')}")
                        if proposal.get("link"):
                            st.markdown(f"[Ссылка на решение или прототип]({proposal['link']})")
                    with actions:
                        if proposal.get("status") == "pending":
                            if st.button("Принять", key=f"accept_{proposal['id']}"):
                                proposal["status"] = "Принято ✅"
                                st.rerun()
                            if st.button("Отклонить", key=f"reject_{proposal['id']}"):
                                proposal["status"] = "Отклонено ❌"
                                st.rerun()


def team_profile_controls():
    if st.session_state.pop("profile_saved", False):
        st.success("Профиль команды добавлен.")
    teams = st.session_state.teams
    selected_name = st.selectbox("Профиль команды", [team["name"] for team in teams], key="selected_team")
    selected = next(team for team in teams if team["name"] == selected_name)
    st.caption(f"Интересы: {', '.join(selected['interests']) or 'не указаны'}")
    st.caption(f"Навыки и технологии: {selected['skills'] or 'не указаны'}")
    with st.expander("Создать профиль команды"):
        with st.form("team_profile_form"):
            name = st.text_input("Название команды")
            interests = st.multiselect("Интересующие темы", TOPICS)
            skills = st.text_area("Навыки и технологии")
            if st.form_submit_button("Сохранить профиль"):
                if not name.strip():
                    st.error("Укажите название команды.")
                elif any(team["name"].casefold() == name.strip().casefold() for team in st.session_state.teams):
                    st.error("Команда с таким названием уже есть.")
                else:
                    st.session_state.teams.append({"id": str(uuid.uuid4()), "name": name.strip(), "interests": interests, "skills": skills.strip()})
                    st.session_state.profile_saved = True
                    st.rerun()
    return selected


def student_catalog():
    st.header("Открытый каталог бизнес-задач")
    team = team_profile_controls()
    st.divider()
    col_topic, col_level, col_sort = st.columns(3)
    with col_topic:
        topic_filter = st.selectbox("Тема", ["Все темы", *TOPICS])
    with col_level:
        levels = ["Все уровни", "Черновик ⚠️", "Рабочая ⚙️", "Готовая ✅", "Приоритетная 🌟"]
        level_filter = st.selectbox("Готовность", levels)
    with col_sort:
        sort_order = st.selectbox("Сортировка", ["Сначала высокий рейтинг", "Сначала низкий рейтинг"])

    tasks = list(st.session_state.tasks)
    if topic_filter != "Все темы":
        tasks = [task for task in tasks if task.get("industry", "Другое") == topic_filter]
    if level_filter != "Все уровни":
        tasks = [task for task in tasks if task["level"] == level_filter]
    tasks.sort(key=lambda task: task["score"], reverse=sort_order == "Сначала высокий рейтинг")

    recommended = [task for task in tasks if task.get("industry") in team["interests"]]
    if recommended:
        st.success(f"Подходят интересам команды: {len(recommended)}. Остальные задачи также доступны ниже.")
    else:
        st.info("Пока нет задач по выбранным интересам команды. Просматривайте весь каталог ниже.")
    st.caption("Рейтинг показывает полноту описания. Низкий балл не скрывает задачу и не мешает откликнуться.")

    if not tasks:
        st.info("По выбранным фильтрам задач нет. Измените фильтры, чтобы увидеть каталог.")
    for task in tasks:
        is_recommended = task in recommended
        with st.container():
            badge = " · ✨ Подходит команде" if is_recommended else ""
            st.subheader(f"{task['title']}{badge}")
            summary, score_col = st.columns([4, 1])
            with summary:
                st.caption(f"{task.get('industry', 'Другое')} · {task['level']}")
                st.write(task["context_and_need"])
            with score_col:
                st.metric("Готовность", f"{task['score']} / 100")
            with st.expander("Подробности задачи"):
                for key, label in [
                    ("target_users", "Пользователи"), ("data_and_materials", "Данные и материалы"),
                    ("expected_result", "Ожидаемый результат"), ("success_criteria", "Критерии успеха"),
                    ("constraints", "Ограничения"), ("contacts", "Контакт и взаимодействие"),
                ]:
                    st.write(f"**{label}:** {task.get(key, '') or 'Не указано'}")
            with st.expander("📝 Подать предложение"):
                with st.form(f"proposal_form_{task['id']}"):
                    idea = st.text_area("Идея решения")
                    plan = st.text_area("План реализации")
                    timeline = st.text_input("Предполагаемый срок")
                    link = st.text_input("Ссылка на прототип / GitHub / Figma")
                    if st.form_submit_button("Отправить предложение"):
                        if not idea.strip() or not plan.strip():
                            st.error("Заполните идею решения и план реализации.")
                        else:
                            task["proposals"].append({
                                "id": str(uuid.uuid4()), "team_id": team["id"], "team_name": team["name"],
                                "idea": idea.strip(), "plan": plan.strip(), "timeline": timeline.strip(),
                                "link": link.strip(), "status": "pending",
                            })
                            st.success("Предложение отправлено бизнесу.")


init_state()
st.title("🚀 AI Sana")
st.markdown("Платформа бизнес-задач: уточняйте потребности, находите команды и выбирайте предложения.")
role = st.sidebar.radio("Режим", ["🏢 Бизнес", "🎓 Студенческая команда"])
if role == "🏢 Бизнес":
    business_workspace()
else:
    student_catalog()
