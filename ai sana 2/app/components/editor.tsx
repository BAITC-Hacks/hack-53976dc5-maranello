"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Save,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { fieldDefinitions, emptyTask } from "@/lib/fields";
import { evaluateTaskQuality, qualityLevels } from "@/lib/quality";
import { taskPayloadSchema, type TaskPayload } from "@/lib/task-payload";
import type { TaskRecord } from "@/lib/types";
import type { AssistantResult } from "@/lib/assistant";
import { requestJson } from "@/lib/client";
import { mergeAssistantDraft } from "@/lib/merge-assistant";

const steps = ["Суть задачи", "Ожидаемый результат", "Условия и публикация"];
const required = new Set(["title", "summary", "problem", "goal"]);
export function Editor({
  task,
  onSaved,
  onDirty,
  back,
}: {
  task: TaskRecord | null;
  onSaved: (task: TaskRecord, published: boolean) => void;
  onDirty: (dirty: boolean) => void;
  back: () => void;
}) {
  const initial = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(emptyTask).map((key) => [
          key,
          task?.[key as keyof TaskPayload] ??
            emptyTask[key as keyof TaskPayload],
        ]),
      ) as TaskPayload,
    [task],
  );
  const [form, setForm] = useState<TaskPayload>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [record, setRecord] = useState(task);
  const [draftId] = useState(() => task?.id ?? crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState(initial.skills.join(", "));
  const [configured, setConfigured] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [ai, setAi] = useState<AssistantResult | null>(null);
  const [questions, setQuestions] = useState<AssistantResult["questions"]>([]);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const quality = useMemo(() => evaluateTaskQuality(form), [form]);
  const [beforeAI, setBeforeAI] = useState<ReturnType<typeof evaluateTaskQuality> | null>(null);
  const previewQuality = ai ? evaluateTaskQuality(mergeAssistantDraft(form, ai.task)) : null;
  const dirty = JSON.stringify(form) !== saved;
  useEffect(() => {
    onDirty(dirty || !!description.trim() || aiBusy || !!busy);
  }, [dirty, description, aiBusy, busy, onDirty]);
  useEffect(() => {
    requestJson<{ configured: boolean }>("/api/assistant")
      .then((data) => setConfigured(data.configured))
      .catch(() => {});
  }, []);

  function change(key: keyof TaskPayload, value: string | string[]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setNotice("");
  }
  function goToField(key: string) {
    const field = fieldDefinitions.find((item) => item.key === key);
    setStep(field?.step ?? 2);
    setTimeout(() => document.getElementById(`field-${key}`)?.focus(), 50);
  }
  function goToStep(next: number) {
    setStep(next);
    requestAnimationFrame(() => document.getElementById("editor-steps")?.scrollIntoView({ block: "start" }));
  }
  async function save(publish: boolean) {
    setError("");
    setNotice("");
    if (description.trim()) {
      setError(
        "Примените предложение помощника или перенесите исходное описание в карточку перед сохранением.",
      );
      setStep(0);
      return;
    }
    const parsed = taskPayloadSchema.safeParse(form);
    const nextErrors: Record<string, string> = {};
    if (!parsed.success)
      parsed.error.issues.forEach((issue) => {
        nextErrors[String(issue.path[0])] = issue.message;
      });
    if (publish || record?.status === "published")
      quality.criteria
        .filter((item) => required.has(item.key) && item.earned < item.points)
        .forEach((item) => {
          nextErrors[item.key] = item.suggestion ?? "Добавьте подробности";
        });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !parsed.success) {
      setError("Уточните выделенные поля перед публикацией.");
      goToField(Object.keys(nextErrors)[0]);
      return;
    }
    setBusy(publish ? "publish" : "save");
    try {
      const data = await requestJson<{ task: TaskRecord }>(
        record ? `/api/tasks/${record.id}` : "/api/tasks",
        {
          method: record ? "PATCH" : "POST",
          body: JSON.stringify({
            ...parsed.data,
            id: draftId,
            expectedUpdatedAt: record?.updatedAt,
            action: publish ? "publish" : "save",
          }),
        },
      );
      setRecord(data.task);
      setForm(parsed.data);
      setSaved(JSON.stringify(parsed.data));
      setNotice(publish ? "Задача опубликована." : "Все изменения сохранены.");
      onDirty(false);
      onSaved(data.task, publish);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function askAI() {
    setAiBusy(true);
    setError("");
    setAi(null);
    try {
      setAi(
        await requestJson<AssistantResult>("/api/assistant", {
          method: "POST",
          body: JSON.stringify({ description, draft: form }),
        }),
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setAiBusy(false);
    }
  }
  function applyAI() {
    if (!ai) return;
    const merged = mergeAssistantDraft(form, ai.task);
    setBeforeAI(evaluateTaskQuality(form));
    setSkills(merged.skills.join(", "));
    setForm(merged);
    setDescription("");
    setQuestions(ai.questions);
    setAi(null);
    setNotice(
      "Предложения добавлены в пустые поля. Проверьте формулировки перед публикацией.",
    );
  }
  function transferDescription() {
    if (description.trim().length > 2000) {
      setError(
        "Для переноса сократите описание до 2000 символов. Для GPT можно оставить до 6000.",
      );
      return;
    }
    if (
      form.problem &&
      !window.confirm("Заменить поле «Проблема сегодня» исходным описанием?")
    )
      return;
    change("problem", description.trim());
    setDescription("");
    setNotice(
      "Описание перенесено в поле проблемы. Теперь уточните цель и ожидаемые результаты.",
    );
  }
  return (
    <>
      <button className="back" onClick={back}>
        <ArrowLeft size={16} /> Мои задачи
      </button>
      <div className="page-heading editor-heading">
        <div>
          <h1>
            {record ? "Доработайте свой бриф" : "От идеи — к понятной задаче"}
          </h1>
          <p>Чем точнее описание, тем легче команде предложить решение.</p>
        </div>
        <span className="save-status" aria-live="polite">
          {busy ? (
            "Сохраняем…"
          ) : dirty ? (
            "Есть несохранённые изменения"
          ) : record ? (
            <>
              <Check size={15} /> Сохранено
            </>
          ) : (
            "Новый черновик"
          )}
        </span>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      <div className="editor-layout">
        <div className="editor-main">
          <div className="mobile-quality">
            <span>Качество брифа <strong>{quality.score}<small> / 100</small></strong></span>
            <a href="#quality-panel">Как улучшить <ArrowRight size={15} /></a>
          </div>
          <nav className="stepper" id="editor-steps" aria-label="Этапы заполнения">
            {steps.map((title, index) => (
              <button
                key={title}
                className={step === index ? "current" : ""}
                aria-current={step === index ? "step" : undefined}
                onClick={() => goToStep(index)}
              >
                <span>{index + 1}</span>
                <strong>{title}<small>{fieldDefinitions.filter((field) => field.step === index && form[field.key].trim()).length + (index === 2 && form.skills.length > 0 ? 1 : 0)} из {fieldDefinitions.filter((field) => field.step === index).length + (index === 2 ? 1 : 0)} полей</small></strong>
              </button>
            ))}
          </nav>
          {step === 0 && (
            <section className="assistant-box">
              <div className="assistant-heading">
                <div className="assistant-icon">
                  <Sparkles size={21} />
                </div>
                <div>
                  <h2>Начните своими словами</h2>
                  <p>
                    Помощник разложит идею по полям и подскажет, что уточнить.
                  </p>
                </div>
                <span className="mini-label">
                  {configured ? "GPT подключён" : "ИИ не подключён"}
                </span>
              </div>
              <label className="field">
                <span className="sr-only">Исходное описание задачи</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={6000}
                  rows={4}
                  placeholder="У нас небольшая сервисная компания. Заявки приходят в разные таблицы, менеджеры теряют сроки. Хотим видеть все обращения и ответственных в одном месте…"
                />
              </label>
              <div className="assistant-footer">
                <small>
                  {configured
                    ? "По нажатию описание и поля карточки передаются OpenAI. Не добавляйте секретные данные."
                    : "Карточку можно заполнить вручную. Помощник станет доступен после подключения ключа."}
                </small>
                <button
                  className="primary"
                  disabled={
                    !configured ||
                    description.trim().length < 20 ||
                    aiBusy ||
                    !!busy
                  }
                  onClick={askAI}
                >
                  {aiBusy ? (
                    <>
                      <span className="spinner" /> Составляем бриф…
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Помочь с описанием
                    </>
                  )}
                </button>
              </div>
              {description.trim() && (
                <button
                  className="text-button"
                  disabled={aiBusy || !!busy}
                  onClick={transferDescription}
                >
                  <ArrowRight size={16} /> Перенести в поле проблемы
                </button>
              )}
              {ai && (
                <section
                  className="ai-preview"
                  aria-label="Предложение помощника"
                >
                  <div className="section-heading">
                    <h3>Предложение помощника</h3>
                    <button
                      className="icon-button"
                      onClick={() => setAi(null)}
                      aria-label="Закрыть предложение"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <p>{ai.note}</p>
                  {previewQuality && <p className="ai-score-preview">Качество карточки после заполнения пустых полей: <strong>{quality.score} → {previewQuality.score} / 100</strong>. Проверьте предложенные сведения.</p>}
                  <dl>
                    {fieldDefinitions
                      .filter((field) => ai.task[field.key])
                      .map((field) => (
                        <div key={field.key}>
                          <dt>
                            {field.label}
                            {form[field.key] && (
                              <small> · ваше поле уже заполнено</small>
                            )}
                          </dt>
                          <dd>{ai.task[field.key]}</dd>
                        </div>
                      ))}
                  </dl>
                  {ai.questions.length > 0 && (
                    <div className="ai-questions">
                      <h4>Стоит уточнить</h4>
                      <ul>
                        {ai.questions.map((q, i) => (
                          <li key={i}>{q.question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button className="secondary" onClick={applyAI}>
                    <Check size={17} /> Заполнить пустые поля
                  </button>
                </section>
              )}
            </section>
          )}
          <section className="editor-fields">
            <div className="section-heading">
              <h2>{steps[step]}</h2>
              <span>{step + 1} / 3</span>
            </div>
            <p className="field-note">
              {step === 0
                ? "Название, краткое описание и проблема обязательны для публикации."
                : step === 1
                  ? "Желаемый результат обязателен. Остальные детали помогут командам оценить задачу."
                  : "Условия делают ожидания прозрачными для обеих сторон."}
            </p>
            <div className="field-grid">
              {fieldDefinitions
                .filter((field) => field.step === step)
                .map((field) => (
                  <label
                    className={`field ${"long" in field ? "wide" : ""}`}
                    key={field.key}
                    htmlFor={`field-${field.key}`}
                  >
                    <span>
                      {field.label}
                      {required.has(field.key) && (
                        <b
                          className="required-mark"
                          aria-label="Обязательное поле"
                        >
                          {" "}
                          *
                        </b>
                      )}
                    </span>
                    {"long" in field ? (
                      <textarea
                        id={`field-${field.key}`}
                        value={form[field.key]}
                        onChange={(e) => change(field.key, e.target.value)}
                        maxLength={field.max}
                        rows={field.key === "problem" ? 4 : 3}
                        aria-invalid={!!errors[field.key]}
                        aria-describedby={`hint-${field.key}`}
                      />
                    ) : (
                      <input
                        id={`field-${field.key}`}
                        value={form[field.key]}
                        onChange={(e) => change(field.key, e.target.value)}
                        maxLength={field.max}
                        aria-invalid={!!errors[field.key]}
                        aria-describedby={`hint-${field.key}`}
                      />
                    )}
                    <div className="field-help" id={`hint-${field.key}`}>
                      <small className={errors[field.key] ? "field-error" : ""}>
                        {errors[field.key] || field.hint}
                      </small>
                      <small className="counter">
                        {form[field.key].length}/{field.max}
                      </small>
                    </div>
                  </label>
                ))}
              {step === 2 && (
                <label className="field wide" htmlFor="field-skills">
                  <span>Навыки команды</span>
                  <input
                    id="field-skills"
                    value={skills}
                    onChange={(e) => {
                      setSkills(e.target.value);
                      change(
                        "skills",
                        e.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                      );
                    }}
                    placeholder="Веб-разработка, UX/UI, анализ данных"
                    maxLength={510}
                    aria-invalid={!!errors.skills}
                  />
                  <small className={errors.skills ? "field-error" : ""}>
                    {errors.skills ||
                      "До 10 навыков, через запятую. Хотя бы два — ещё 5 баллов."}
                  </small>
                </label>
              )}
            </div>
            {questions.length > 0 && (
              <details className="followup-questions">
                <summary>
                  <CircleHelp size={16} /> Вопросы помощника ·{" "}
                  {questions.length}
                </summary>
                <ul>
                  {questions.map((item, index) => (
                    <li key={index}>{item.question}</li>
                  ))}
                </ul>
              </details>
            )}
            <div className="step-actions">
              <button
                className="text-button"
                onClick={() => goToStep(Math.max(0, step - 1))}
                disabled={step === 0}
              >
                <ArrowLeft size={16} /> Назад
              </button>
              {step < 2 ? (
                <button className="secondary" onClick={() => goToStep(step + 1)}>
                  Далее <ArrowRight size={17} />
                </button>
              ) : (
                <p className="small-note">
                  Проверьте бриф и опубликуйте задачу.
                </p>
              )}
            </div>
          </section>
          <div className="editor-actions">
            <button
              className="secondary"
              disabled={!!busy || aiBusy}
              onClick={() => save(false)}
            >
              <Save size={17} />
              {busy === "save"
                ? "Сохраняем…"
                : record?.status === "published"
                  ? "Сохранить изменения"
                  : "Сохранить черновик"}
            </button>
            <button
              className="primary"
              disabled={!!busy || aiBusy}
              onClick={() => save(true)}
            >
              <Send size={17} />
              {busy === "publish"
                ? "Публикуем…"
                : record?.status === "published"
                  ? "Обновить публикацию"
                  : "Опубликовать"}
            </button>
          </div>
        </div>
        <aside className="quality-panel" id="quality-panel">
          <h2 className="quality-title">Качество вашего брифа</h2>
          <div className="quality-number">
            <strong>{quality.score}</strong>
            <span>
              из 100
              <br />
              баллов качества
            </span>
          </div>
          <div
            className="quality-bar"
            role="progressbar"
            aria-label="Качество карточки"
            aria-valuenow={quality.score}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ transform: `scaleX(${quality.score / 100})` }} />
          </div>
          <h2>{qualityLevels[quality.level].label}</h2>
          {beforeAI && <section className="quality-change" aria-label="Изменение качества брифа" aria-live="polite">
            <h3>Что улучшилось</h3>
            <p>До помощи ИИ <strong>{beforeAI.score}</strong> → сейчас <strong>{quality.score}</strong></p>
            <ul>{quality.criteria.filter(item => item.earned > (beforeAI.criteria.find(old => old.key === item.key)?.earned ?? 0)).map(item => <li key={item.key}><span>{item.label}</span><b>+{item.earned - (beforeAI.criteria.find(old => old.key === item.key)?.earned ?? 0)}</b></li>)}</ul>
            <small>Баллы рассчитаны по заполненным полям. Факты и условия подтверждает бизнес.</small>
          </section>}
          <p>
            {quality.score === 100
              ? "Все разделы описаны. Проверьте факты — и можно публиковать."
              : `Ещё ${qualityLevels[quality.level].next - quality.score} баллов до следующего уровня.`}
          </p>
          <div className="quality-tip">
            <ArrowRight size={16} />
            <span>Чем выше рейтинг, тем выше задача в каталоге.</span>
          </div>
          <h3>{quality.score === 100 ? "Готово к работе" : "Следующий шаг"}</h3>
          <div className="quality-todos">
            {quality.criteria
              .filter((item) => item.earned < item.points)
              .sort((a, b) => b.points - b.earned - (a.points - a.earned))
              .slice(0, 3)
              .map((item) => (
                <button key={item.key} onClick={() => goToField(item.key)}>
                  <span>{item.suggestion}</span>
                  <b>+{item.points - item.earned}</b>
                </button>
              ))}
            {quality.score === 100 && (
              <p>
                <CheckCircle2 size={18} /> Все основные сведения заполнены.
              </p>
            )}
          </div>
          <details className="quality-details">
            <summary>
              Разбор оценки <ChevronDown size={15} />
            </summary>
            <div className="criteria">
              {quality.criteria.map((item) => (
                <button key={item.key} onClick={() => goToField(item.key)}>
                  <span>
                    {item.label}
                    <small>
                      {item.explanation || "Два разных навыка дают полный балл"}
                    </small>
                  </span>
                  <b>
                    {item.earned}/{item.points}
                  </b>
                </button>
              ))}
            </div>
          </details>
          <p className="score-disclaimer">
            Оценка по прозрачным правилам. Она проверяет полноту текста, но не
            подтверждает факты.
          </p>
        </aside>
      </div>
    </>
  );
}
