import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CheckCheck, FileText, Lightbulb, LoaderCircle, Plus, Save, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { api } from '../api'
import { BusyLabel, EmptyState, ErrorNotice, Loading, PageHeading, RatingWidget, Stepper } from '../components'
import { fields, labels } from '../content'
import { readStorage, useResource, writeStorage } from '../hooks'
import { useWorkspace } from '../workspace'
import type { Card, CardField, Questions, Task } from '../types'

export function BusinessOnly({ children }: { children: ReactNode }) {
  const { role, setRole } = useWorkspace()
  return role === 'business' ? <>{children}</> : <EmptyState title="Это пространство бизнеса" action={<button className="button primary" onClick={() => setRole('business')}>Переключиться на бизнес<ArrowRight size={17} /></button>}>В роли команды можно изучать задачи и предлагать решения. Создание и редактирование доступны в роли бизнеса.</EmptyState>
}

export function CreateTask() {
  const initial = readStorage<{ description: string; topic: string }>('praktika-description', { description: '', topic: '' })
  const [description, setDescription] = useState(initial.description || '')
  const [topic, setTopic] = useState(initial.topic || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { tasks, remember } = useWorkspace()
  const navigate = useNavigate()
  useEffect(() => { writeStorage('praktika-description', { description, topic }) }, [description, topic])
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !description.trim()) return
    setBusy(true); setError('')
    try { const task = await api.createTask(description.trim(), topic.trim()); remember(task); writeStorage('praktika-description', { description: '', topic: '' }); navigate(`/tasks/${task.id}/questions`) }
    catch (error) { setError((error as Error).message); setBusy(false) }
  }
  return <BusinessOnly><Stepper current={0} /><PageHeading title="С чего начнём?" description="Расскажите о задаче своими словами. Поможем превратить идею в понятный план." />
    <div className="intake-layout"><form className="form-panel create-panel" onSubmit={submit}><fieldset disabled={busy}><label className="field-label" htmlFor="description">Опишите задачу или проблему</label><p className="field-hint">Что сейчас не получается? Что хочется сделать лучше?</p><textarea id="description" className="description-input" value={description} onChange={event => setDescription(event.target.value)} placeholder="Например, мы ведём продажи в таблицах и тратим много времени на отчёты. Хотим видеть, какие товары покупают чаще и как меняется спрос…" maxLength={2000} required rows={7} /><div className="field-meta"><span>Не нужно сразу знать все ответы</span><span>{description.length} / 2000</span></div>
      <label className="field-label topic-input-label" htmlFor="new-topic">Тема задачи <span>необязательно</span></label><input id="new-topic" value={topic} onChange={event => setTopic(event.target.value)} list="new-topics" placeholder="Например, аналитика или образование" maxLength={100} /><datalist id="new-topics">{Array.from(new Set(tasks.map(task => task.topic).filter(Boolean))).map(topic => <option value={topic} key={topic} />)}</datalist>
      <ErrorNotice message={error} /><div className="form-bottom"><span><ShieldCheck size={16} />Публикация — только с вашего согласия</span><button className="button primary" disabled={!description.trim() || busy}><BusyLabel busy={busy}>{busy ? 'Анализируем описание…' : 'Разобрать задачу'}</BusyLabel>{!busy && <ArrowRight size={17} />}</button></div></fieldset></form>
      <aside className="intake-aside"><div className="aside-icon"><Lightbulb size={23} /></div><h2>Хорошее начало —<br />даже пара предложений.</h2><p>Не ищите идеальную формулировку. Важнее рассказать, что происходит в вашем бизнесе.</p><h3>Что будет дальше</h3><ol className="aside-steps"><li><span>1</span><div><strong>Разберём описание</strong><p>Выделим известные факты</p></div></li><li><span>2</span><div><strong>Зададим три вопроса</strong><p>Уточним самое важное</p></div></li><li><span>3</span><div><strong>Соберём карточку</strong><p>Вы проверите и отредактируете её</p></div></li></ol><p className="aside-disclaimer">Добавляем только то, что вы сообщили. Недостающие сведения остаются пустыми.</p></aside>
    </div>
  </BusinessOnly>
}

export function Clarification() {
  const id = Number(useParams().id)
  const resource = useResource(() => Promise.all([api.task(id), api.questions(id)]), id)
  if (resource.loading) return <Loading />
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.retry} />
  if (!resource.data) return null
  if (resource.data[0].status === 'published') return <Navigate to={`/tasks/${id}`} replace />
  return <BusinessOnly><ClarificationForm key={id} task={resource.data[0]} questions={resource.data[1]} /></BusinessOnly>
}
function ClarificationForm({ task, questions }: { task: Task; questions: Questions }) {
  const navigate = useNavigate()
  const { remember } = useWorkspace()
  const [answers, setAnswers] = useState<Partial<Card>>(() => readStorage(`praktika-answers-${task.id}`, task.answers))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const populated = fields.filter(field => !questions.missing_fields.includes(field.key))
  function change(field: CardField, value: string) { setAnswers(previous => { const next = { ...previous, [field]: value }; writeStorage(`praktika-answers-${task.id}`, next); return next }) }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try { const updated = await api.answer(task.id, questions.questions.map(item => ({ field: item.field, answer: answers[item.field] || '' }))); remember(updated); writeStorage(`praktika-answers-${task.id}`, {}); navigate(`/tasks/${task.id}/edit`) }
    catch (error) { setError((error as Error).message); setBusy(false) }
  }
  return <><Stepper current={1} /><PageHeading title="Добавим немного ясности" description="Три ответа помогут команде лучше понять вашу задачу." />
    <div className="clarification-layout"><div><section className="analysis-panel"><div className="analysis-icon"><Sparkles size={21} /></div><div><div className="analysis-title"><h2>Анализ описания готов</h2><span className="subtle-badge">{task.ai_analysis.provider === 'openai' ? 'AI-анализ' : task.ai_analysis.provider === 'fallback' ? 'Резервный анализ' : 'Базовый анализ'}</span></div><p>{populated.length ? `Нашли сведения: ${populated.map(field => field.label.toLowerCase()).join(', ')}.` : 'Пока не хватает конкретики. Начнём с главных вопросов.'} Остальное уточним вместе.</p>{task.ai_analysis.provider !== 'openai' && <p className="analysis-note">Описание разобрано по правилам, без внешней модели. Все шаги доступны.</p>}</div></section>
      <form onSubmit={submit} className="questions-form"><fieldset disabled={busy}>{questions.questions.map((question, index) => <div className="question-block" key={question.field}><div className="question-number">{index + 1}</div><div className="question-content"><label htmlFor={`answer-${question.field}`}>{question.question}</label><textarea id={`answer-${question.field}`} value={answers[question.field] || ''} onChange={event => change(question.field, event.target.value)} rows={3} maxLength={question.field === 'title' ? 200 : 10000} placeholder={fields.find(field => field.key === question.field)?.hint} /><span className="question-optional">Пока не знаете? Можно оставить пустым.</span></div></div>)}<ErrorNotice message={error} /><div className="form-bottom"><Link to="/drafts" className="text-button"><ArrowLeft size={16} />Вернуться позже</Link><button className="button primary" disabled={busy}><BusyLabel busy={busy}>{busy ? 'Собираем карточку…' : 'Собрать карточку'}</BusyLabel>{!busy && <ArrowRight size={17} />}</button></div></fieldset></form>
    </div><aside className="source-note"><span className="aside-icon"><FileText size={21} /></span><h3>Ваша исходная идея</h3><p>{task.description}</p><div className="source-note-bottom"><Check size={15} />Сохраняем ваши формулировки</div></aside></div>
  </>
}

export function TaskEditor() {
  const id = Number(useParams().id)
  const resource = useResource(() => api.task(id), id)
  if (resource.loading) return <Loading />
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.retry} />
  if (!resource.data) return null
  if (resource.data.status === 'published') return <Navigate to={`/tasks/${id}`} replace />
  return <BusinessOnly><EditorForm key={id} initial={resource.data} /></BusinessOnly>
}
function EditorForm({ initial }: { initial: Task }) {
  const [task, setTask] = useState(initial)
  const toForm = (value: Task) => Object.fromEntries([...fields.map(field => [field.key, value[field.key]]), ['topic', value.topic]]) as Card & { topic: string }
  const [form, setForm] = useState(() => {
    const cached = readStorage<{ updated: string; values: Card & { topic: string } } | null>(`praktika-editor-${initial.id}`, null)
    return cached?.updated === initial.updated_at ? cached.values : toForm(initial)
  })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const { remember, notify, refresh } = useWorkspace()
  const navigate = useNavigate()
  const changes = Object.fromEntries(Object.entries(form).filter(([field, value]) => value !== task[field as keyof Task]))
  const dirty = Object.keys(changes).length > 0
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty])
  function change(field: string, value: string) { setForm(previous => { const next = { ...previous, [field]: value }; writeStorage(`praktika-editor-${task.id}`, { updated: task.updated_at, values: next }); return next }) }
  function focusField(field: CardField) { document.getElementById(`card-${field}`)?.focus(); document.getElementById(`card-${field}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  async function act(action: 'save' | 'confirm' | 'publish') {
    if (busy) return
    setBusy(action); setError('')
    try {
      let updated = task
      if (dirty) { updated = await api.edit(task.id, changes); setTask(updated); setForm(toForm(updated)); writeStorage(`praktika-editor-${task.id}`, null) }
      if (action === 'confirm') { updated = await api.confirm(task.id); setTask(updated); notify('Карточка подтверждена. Теперь её можно опубликовать.') }
      if (action === 'publish') { updated = await api.publish(task.id); remember(updated); void refresh(); notify('Задача опубликована. Команды могут предложить решение.'); navigate(`/tasks/${task.id}`); return }
      remember(updated)
      if (action === 'save') notify('Изменения сохранены. Рейтинг обновлён.')
    } catch (error) { setError((error as Error).message) } finally { setBusy('') }
  }
  const groups = [
    { title: 'Суть задачи', keys: ['title', 'context', 'need', 'users'] },
    { title: 'Результат и ресурсы', keys: ['data_materials', 'constraints', 'expected_result', 'success_criteria'] },
    { title: 'На связи с командой', keys: ['contact', 'interaction_format'] },
  ]
  return <><Stepper current={task.status === 'confirmed' && !dirty ? 3 : 2} /><PageHeading title="Ваша задача обретает форму" description="Проверьте формулировки и добавьте детали. Здесь всё можно отредактировать." />
    <div className="editor-layout"><div>
      {task.status === 'confirmed' && !dirty && <div className="success-notice"><CheckCheck size={21} /><div><strong>Карточка подтверждена</strong><p>Всё готово. Опубликуйте задачу, чтобы команды могли откликнуться.</p></div></div>}
      <form onSubmit={event => { event.preventDefault(); void act('save') }}><fieldset disabled={!!busy}>
        {groups.map(group => <section className="editor-section" key={group.title}><h2>{group.title}</h2><div className="editor-fields">{group.keys.map(key => { const field = fields.find(item => item.key === key)!; return <div key={key} className={`form-field ${['title', 'context', 'need'].includes(key) ? 'full-width' : ''}`}><label htmlFor={`card-${key}`}>{field.label}</label>{key === 'title' ? <input id={`card-${key}`} value={form[field.key]} onChange={event => change(key, event.target.value)} placeholder={field.hint} maxLength={200} /> : <textarea id={`card-${key}`} value={form[field.key]} onChange={event => change(key, event.target.value)} placeholder={field.hint} rows={key === 'context' || key === 'need' ? 3 : 4} maxLength={10000} />}</div>})}{group.title === 'Суть задачи' && <div className="form-field full-width"><label htmlFor="card-topic">Тема задачи <span className="optional-label">необязательно</span></label><input id="card-topic" value={form.topic} onChange={event => change('topic', event.target.value)} maxLength={100} placeholder="Например, аналитика" /></div>}</div></section>)}
        <ErrorNotice message={error} />
        {Object.keys(task.answers).length < 3 && <div className="inline-notice">Перед подтверждением ответьте на три вопроса. <Link to={`/tasks/${task.id}/questions`}>Перейти к уточнению<ArrowRight size={14} /></Link></div>}
        <div className="editor-actions"><span className={dirty ? 'save-state unsaved' : 'save-state'}>{dirty ? <><span className="status-dot" />Есть изменения</> : <><Check size={15} />Сохранено</>}</span><button type="submit" className="button secondary" disabled={!dirty || !!busy}><BusyLabel busy={busy === 'save'}><Save size={16} />Сохранить</BusyLabel></button>{task.status === 'confirmed' && !dirty ? <button type="button" className="button primary" disabled={!!busy} onClick={() => void act('publish')}><BusyLabel busy={busy === 'publish'}>Опубликовать задачу<Send size={16} /></BusyLabel></button> : <button type="button" className="button primary" disabled={!!busy || Object.keys(task.answers).length < 3} onClick={() => void act('confirm')}><BusyLabel busy={busy === 'confirm'}>Подтвердить карточку<Check size={17} /></BusyLabel></button>}</div>
      </fieldset></form><p className="publication-note">Подтверждение не публикует задачу. Вы сделаете это отдельным действием.</p>
    </div><RatingWidget rating={task.rating} dirty={dirty} onField={focusField} /></div>
  </>
}
