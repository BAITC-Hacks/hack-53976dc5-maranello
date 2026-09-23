"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Edit3,
  Mail,
  Send,
  Users,
} from "lucide-react";
import type { TaskRecord, TeamResponse } from "@/lib/types";
import { requestJson } from "@/lib/client";
import { responsePayloadSchema } from "@/lib/task-payload";
import { Status } from "./catalog";

export function TaskDetail({
  task,
  signedIn,
  signInHref,
  back,
  edit,
  refresh,
}: {
  task: TaskRecord;
  signedIn: boolean;
  signInHref: string;
  back: () => void;
  edit: () => void;
  refresh: () => Promise<void>;
}) {
  const [responses, setResponses] = useState<TeamResponse[]>([]);
  const [loading, setLoading] = useState(signedIn && task.id !== "example");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({
    teamName: "",
    teamMembers: "",
    proposal: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isExample = task.id === "example";
  async function load() {
    const data = await requestJson<{ responses: TeamResponse[] }>(
      `/api/tasks/${task.id}/responses`,
    );
    setResponses(data.responses);
  }
  useEffect(() => {
    if (!signedIn || isExample) return;
    let cancelled = false;
    requestJson<{ responses: TeamResponse[] }>(
      `/api/tasks/${task.id}/responses`,
    )
      .then((data) => {
        if (!cancelled) setResponses(data.responses);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.selectedResponseId, signedIn, isExample]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = responsePayloadSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await requestJson(`/api/tasks/${task.id}/responses`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      await load();
      setNotice(
        "Предложение отправлено. Следите за решением в разделе «Мои отклики».",
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choose(id: string) {
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/responses/${id}`, {
        method: "PATCH",
        body: "{}",
      });
      await refresh();
      await load();
      setConfirm(null);
      setNotice(
        "Команда выбрана. Свяжитесь с представителем по почте, чтобы обсудить начало работы.",
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      setNotice("Ссылка на задачу скопирована.");
    } catch {
      setError(
        "Не удалось скопировать ссылку. Вы можете скопировать адрес из строки браузера.",
      );
    }
  }
  const sections = [
    ["01", "Проблема сегодня", task.problem],
    ["02", "Желаемый результат", task.goal],
    ["03", "Данные и контекст", task.context],
    ["04", "Пользователи", task.audience],
    ["05", "Что передать бизнесу", task.deliverables],
    ["06", "Условия и ограничения", task.constraints],
    ["07", "Срок", task.timeline],
    ["08", "Критерии готовности", task.acceptanceCriteria],
  ];
  return (
    <>
      <div className="detail-toolbar">
        <button className="back" onClick={back}>
          <ArrowLeft size={16} />
          {task.isOwner ? "Мои задачи" : "Каталог задач"}
        </button>
        {!isExample && task.status !== "draft" && (
          <button className="text-button" onClick={copy}>
            <Copy size={16} /> Поделиться
          </button>
        )}
      </div>
      {isExample && (
        <div className="alert neutral">
          Учебный пример карточки. Это вымышленная компания; отклики здесь не
          принимаются.
        </div>
      )}
      <div className="detail-heading">
        <div>
          <div className="task-kicker">
            {task.organization || task.ownerName}
            <Status status={task.status} />
          </div>
          <h1>{task.title || "Новая задача без названия"}</h1>
          <p>{task.summary || "Краткое описание пока не добавлено."}</p>
          <div className="tag-line">
            {task.skills.map((skill) => (
              <span className="tag" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div className="detail-score">
          <strong>
            {task.qualityScore}
            <small>/100</small>
          </strong>
          <span>Качество описания</span>
        </div>
      </div>
      <div className="detail-layout">
        <article className="detail-body">
          {sections.map(([number, label, value]) => (
            <section key={number}>
              <span className="section-number">{number}</span>
              <div>
                <h2>{label}</h2>
                <p className={!value ? "not-filled" : ""}>
                  {value || "Бизнес пока не уточнил этот раздел."}
                </p>
              </div>
            </section>
          ))}
        </article>
        <aside className="action-panel">
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button
                className="text-button"
                onClick={() => {
                  setError("");
                  load().catch((cause) => setError(cause.message));
                }}
              >
                Повторить загрузку откликов
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
            </div>
          )}
          {isExample ? (
            <>
              <div className="panel-icon">
                <Users size={22} />
              </div>
              <h2>Так выглядит готовый бриф</h2>
              <p>
                Понятные ожидания помогают командам оценить свои силы и
                предложить план работы.
              </p>
              <button className="secondary full" onClick={back}>
                Вернуться в каталог
              </button>
            </>
          ) : task.isOwner ? (
            <>
              <div className="section-heading">
                <h2>Ваша задача</h2>
                <Users size={20} />
              </div>
              <p>Вы решаете, с кем продолжить работу.</p>
              {task.status !== "selected" && (
                <button className="secondary full" onClick={edit}>
                  <Edit3 size={16} /> Редактировать бриф
                </button>
              )}
              {task.status === "draft" ? (
                <div className="panel-note">
                  Черновик виден только вам. Завершите описание и опубликуйте
                  задачу.
                </div>
              ) : (
                <>
                  <h3>
                    Отклики команд{" "}
                    <span className="count-badge">{responses.length}</span>
                  </h3>
                  {loading ? (
                    <p role="status">Загружаем отклики…</p>
                  ) : !responses.length ? (
                    <div className="panel-note">
                      Пока нет откликов. Поделитесь ссылкой на задачу со
                      студентами.
                    </div>
                  ) : (
                    responses.map((response) => (
                      <div
                        className={`response-card ${response.selected ? "is-selected" : ""}`}
                        key={response.id}
                      >
                        <h4>{response.teamName}</h4>
                        <p className="members">{response.teamMembers}</p>
                        <p>{response.proposal}</p>
                        <a
                          className="contact-link"
                          href={`mailto:${response.studentEmail}`}
                        >
                          <Mail size={15} />
                          {response.studentEmail}
                        </a>
                        {response.selected ? (
                          <strong className="selected-label">
                            <CheckCircle2 size={17} /> Команда выбрана
                          </strong>
                        ) : (
                          task.status === "published" &&
                          (confirm === response.id ? (
                            <div className="selection-confirm">
                              <p>
                                Выбрать «{response.teamName}»? Приём новых
                                откликов завершится. Изменить выбор в MVP
                                нельзя.
                              </p>
                              <div className="button-row">
                                <button
                                  className="primary"
                                  disabled={busy}
                                  onClick={() => choose(response.id)}
                                >
                                  {busy ? "Выбираем…" : "Подтвердить"}
                                </button>
                                <button
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() => setConfirm(null)}
                                >
                                  Отмена
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="primary full"
                              disabled={busy}
                              onClick={() => setConfirm(response.id)}
                            >
                              Выбрать эту команду
                            </button>
                          ))
                        )}
                      </div>
                    ))
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <div className="panel-icon">
                <Users size={22} />
              </div>
              <h2>
                {responses[0]?.selected
                  ? "Ваша команда выбрана!"
                  : "Предложите своё решение"}
              </h2>
              <p>Расскажите, как команда из 3–5 участников выполнит задачу.</p>
              {!signedIn ? (
                <>
                  <a className="primary full" href={signInHref} target="_top">
                    Войти и откликнуться
                  </a>
                  <p className="small-note">
                    Представитель бизнеса увидит ваше предложение и контактную
                    почту.
                  </p>
                </>
              ) : loading ? (
                <p role="status">Проверяем ваши отклики…</p>
              ) : responses.length ? (
                <div className="response-card">
                  <strong className="application-status">
                    {responses[0].selected
                      ? "Можно обсудить начало работы"
                      : task.status === "selected"
                        ? "Бизнес выбрал другую команду"
                        : "Ваш отклик на рассмотрении"}
                  </strong>
                  <h4>{responses[0].teamName}</h4>
                  <p>{responses[0].proposal}</p>
                </div>
              ) : task.status === "selected" ? (
                <div className="panel-note">
                  Бизнес уже выбрал команду. Найдите другую интересную задачу в
                  каталоге.
                </div>
              ) : (
                <form className="response-form" onSubmit={submit} noValidate>
                  {(
                    [
                      {
                        key: "teamName",
                        label: "Название команды",
                        hint: "Как вас представить бизнесу",
                        max: 120,
                        rows: 0,
                      },
                      {
                        key: "teamMembers",
                        label: "Участники · от 3 до 5",
                        hint: "Каждое имя на новой строке",
                        max: 500,
                        rows: 3,
                      },
                      {
                        key: "proposal",
                        label: "Как вы решите задачу",
                        hint: "Ваш подход, этапы работы и опыт команды. От 40 символов.",
                        max: 2000,
                        rows: 5,
                      },
                    ] as const
                  ).map((field) => (
                    <label className="field" key={field.key}>
                      <span>{field.label}</span>
                      {field.rows ? (
                        <textarea
                          rows={field.rows}
                          value={form[field.key]}
                          onChange={(e) =>
                            setForm({ ...form, [field.key]: e.target.value })
                          }
                          maxLength={field.max}
                          aria-invalid={!!errors[field.key]}
                          aria-describedby={`response-hint-${field.key}`}
                        />
                      ) : (
                        <input
                          value={form[field.key]}
                          onChange={(e) =>
                            setForm({ ...form, [field.key]: e.target.value })
                          }
                          maxLength={field.max}
                          aria-invalid={!!errors[field.key]}
                          aria-describedby={`response-hint-${field.key}`}
                        />
                      )}
                      <small
                        id={`response-hint-${field.key}`}
                        className={errors[field.key] ? "field-error" : ""}
                      >
                        {errors[field.key] || field.hint}
                      </small>
                    </label>
                  ))}
                  <p className="small-note">
                    Бизнес получит имена участников и вашу контактную почту.
                  </p>
                  <button className="primary full" disabled={busy}>
                    <Send size={16} />
                    {busy ? "Отправляем…" : "Отправить предложение"}
                  </button>
                </form>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
