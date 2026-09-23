"use client";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Plus,
  SlidersHorizontal,
  FileText,
  Inbox,
  X,
  ArrowDownWideNarrow,
} from "lucide-react";
import type { TaskRecord, TeamResponse } from "@/lib/types";
import { qualityLevels } from "@/lib/quality";
import { exampleTask } from "@/lib/example";

export function Status({ status }: { status: TaskRecord["status"] }) {
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true" />
      {status === "draft"
        ? "Черновик"
        : status === "selected"
          ? "Команда выбрана"
          : "Принимает отклики"}
    </span>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Inbox size={28} />
      </div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function TaskList({
  tasks,
  open,
  personal = false,
}: {
  tasks: TaskRecord[];
  open: (id: string) => void;
  personal?: boolean;
}) {
  return (
    <div className="task-list">
      {tasks.map((task, index) => (
        <button
          className="task-row"
          key={task.id}
          onClick={() => open(task.id)}
        >
          {!personal && (
            <span className="rank" aria-label={`Место ${index + 1}`}>
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          <div className="task-main">
            <div className="task-kicker">
              {task.organization || task.ownerName}
              <Status status={task.status} />
            </div>
            <h2>{task.title || "Новая задача без названия"}</h2>
            <p>
              {task.summary ||
                "Добавьте описание, чтобы команда могла оценить задачу."}
            </p>
            <div className="task-bottom">
              <div className="tag-line">
                {task.skills.slice(0, 4).map((skill) => (
                  <span className="tag" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
              <span className="response-count">
                Отклики: {task.responseCount ?? 0}
              </span>
            </div>
          </div>
          <div className="task-trailing">
            <div className="score">
              <strong>{task.qualityScore}</strong>
              <span>/ 100</span>
            </div>
            <span className="score-caption">качество брифа</span>
            <span className="task-score-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${task.qualityScore / 100})` }} />
            </span>
            <ArrowUpRight size={22} className="row-arrow" />
          </div>
        </button>
      ))}
    </div>
  );
}
export function Catalog({
  tasks,
  loading,
  create,
  open,
  retry,
}: {
  tasks: TaskRecord[];
  loading: boolean;
  create: () => void;
  open: (id: string) => void;
  retry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("published");
  const [skill, setSkill] = useState("");
  const skills = useMemo(
    () =>
      [...new Set(tasks.flatMap((task) => task.skills))].sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [tasks],
  );
  const filtered = tasks.filter(
    (task) =>
      (status === "all" || task.status === status) &&
      (!skill || task.skills.includes(skill)) &&
      `${task.title} ${task.summary} ${task.organization} ${task.skills.join(" ")}`
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru")),
  );
  return (
    <>
      <div className="page-heading catalog-heading">
        <div>
          <h1>Найдите свою задачу.</h1>
          <p>
            Выбирайте интересный проект и предлагайте решение своей командой.
          </p>
        </div>
        <button className="primary" onClick={create}>
          <Plus size={18} /> Разместить задачу
        </button>
      </div>
      <div className="catalog-layout">
        <section aria-label="Каталог задач">
          {(tasks.length > 0 || loading) && <>
          <div className="catalog-tools">
            <label className="search-field">
              <Search size={19} />
              <span className="sr-only">Поиск задач</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Задача, компания или навык"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Очистить поиск"
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <div className="filters">
              <div className="segmented" aria-label="Статус задач">
                {[
                  ["published", "Открытые"],
                  ["all", "Все задачи"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={status === value}
                    className={status === value ? "active" : ""}
                    onClick={() => setStatus(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="skill-filter">
                <SlidersHorizontal size={15} />
                <span className="sr-only">Фильтр по навыку</span>
                <select
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                >
                  <option value="">Все навыки</option>
                  {skills.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="list-caption">
            <span>Найдено: {filtered.length}</span>
            <span><ArrowDownWideNarrow size={16} /> По качеству описания</span>
          </div>
          </>}
          {loading ? (
            <div className="loading-state" role="status">
              <span className="spinner" /> Загружаем каталог…
            </div>
          ) : filtered.length ? (
            <TaskList tasks={filtered} open={open} />
          ) : !tasks.length ? (
            <div className="catalog-empty">
              <div className="catalog-empty-intro">
                <h2>Первый проект начинается с вас</h2>
                <p>Разместите задачу для бизнеса или посмотрите, как выглядит готовый бриф.</p>
                <button className="primary" onClick={create}><Plus size={18} /> Создать задачу</button>
              </div>
              <button className="example-preview" onClick={() => open("example")}>
                <span className="example-label"><FileText size={16} /> Учебный пример · не принимает отклики</span>
                <h3>{exampleTask.title}</h3>
                <p>{exampleTask.summary}</p>
                <span className="example-preview-bottom"><span>Посмотреть готовый бриф</span><ArrowUpRight size={21} /></span>
              </button>
              <button className="text-button" onClick={retry}>Обновить каталог</button>
            </div>
          ) : (
            <Empty title="Таких задач пока нет">
              <p>Попробуйте другой запрос или сбросьте фильтры.</p>
              <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() => {
                      setQuery("");
                      setSkill("");
                      setStatus("all");
                    }}
                  >
                    Сбросить фильтры
                  </button>
                <button className="text-button" onClick={retry}>
                  Обновить каталог
                </button>
              </div>
            </Empty>
          )}
        </section>
        <aside className="catalog-aside">
          <section className="business-note">
            <h2>
              Хороший бриф
              <br />
              заметят первым.
            </h2>
            <p>Уточняйте задачу, получайте баллы и поднимайтесь в каталоге.</p>
            <div className="rating-scale" aria-label="Рейтинг качества: от 0 до 100 баллов">
              <div aria-hidden="true"><span /><span /><span /><span /></div>
              <span>Первый набросок</span><strong>100 баллов</strong>
            </div>
            <button onClick={create}>
              Создать карточку <ArrowRight size={18} />
            </button>
          </section>
          <section className="how-it-works">
            <h3>Как всё устроено</h3>
            {[
              [
                "01",
                "Бизнес описывает задачу",
                "Рейтинг показывает полноту брифа.",
              ],
              [
                "02",
                "Команда предлагает решение",
                "Студенты сами выбирают проекты.",
              ],
              [
                "03",
                "Бизнес выбирает команду",
                "Решение всегда остаётся за человеком.",
              ],
            ].map(([number, title, text]) => (
              <div key={number}>
                <span>{number}</span>
                <p>
                  <strong>{title}</strong>
                  {text}
                </p>
              </div>
            ))}
          </section>
          <details className="rating-explainer">
            <summary>Что означает рейтинг?</summary>
            <p>
              До 100 баллов за полноту полей, конкретику и отсутствие повторов.
              Это проверка описания по правилам, а не гарантия ценности проекта.
            </p>
            {Object.values(qualityLevels).map((level, i) => (
              <div key={level.label}>
                <span>{["0–39", "40–69", "70–84", "85–100"][i]}</span>
                {level.label}
              </div>
            ))}
          </details>
        </aside>
      </div>
    </>
  );
}
export function MyResponses({
  responses,
  open,
  browse,
}: {
  responses: TeamResponse[];
  open: (id: string) => void;
  browse: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Мои отклики</h1>
          <p>Следите за решениями бизнеса по вашим предложениям.</p>
        </div>
      </div>
      {!responses.length ? (
        <Empty title="Первый отклик — впереди">
          <p>
            Найдите интересную задачу в каталоге и расскажите, как ваша команда
            её решит.
          </p>
          <button className="primary" onClick={browse}>Найти задачу <ArrowRight size={17} /></button>
        </Empty>
      ) : (
        <div className="application-list">
          {responses.map((response) => (
            <button
              className="application-row"
              key={response.id}
              onClick={() => open(response.taskId)}
            >
              <span className="muted">
                {response.organization || "Бизнес-задача"}
              </span>
              <h2>{response.taskTitle}</h2>
              <p>{response.teamName}</p>
              <span
                className={`application-status ${response.selected ? "chosen" : ""}`}
              >
                {response.selected
                  ? "Ваша команда выбрана"
                  : response.taskStatus === "selected"
                    ? "Выбрана другая команда"
                    : "На рассмотрении"}
              </span>
              <ArrowUpRight size={20} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
