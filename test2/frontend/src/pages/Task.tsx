import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, BriefcaseBusiness, Check, CheckCheck, Clock3, ExternalLink, FileText, GraduationCap, Mail, MessageSquare, Send, ShieldCheck, Users, X } from 'lucide-react'
import { allProposals, api } from '../api'
import { Badge, BusyLabel, EmptyState, ErrorNotice, Loading, PageHeading, RatingWidget } from '../components'
import { fields, formatDate, proposalCount, titleOf, topicOf } from '../content'
import { isStringRecord, readStorage, useResource, writeStorage } from '../hooks'
import { useWorkspace } from '../workspace'
import type { Proposal, ProposalInput, Task } from '../types'
import { BusinessOnly } from './Intake'

export function TaskDetails() {
  const id = Number(useParams().id)
  const resource = useResource(() => api.task(id), id)
  const { role, counts, loadCounts } = useWorkspace()
  useEffect(() => { void loadCounts([id], true) }, [id, loadCounts])
  if (resource.loading) return <Loading />
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.retry} />
  const task = resource.data
  if (!task) return null
  return <><Link to="/catalog" className="back-link"><ArrowLeft size={16} />В каталог задач</Link><div className="detail-heading"><div className="detail-meta"><span className="topic-label">{topicOf(task)}</span><span className="muted">№ {String(task.id).padStart(3, '0')}</span><span className="muted">{task.published_at ? `Опубликована ${formatDate(task.published_at)}` : 'Черновик'}</span></div><h1>{titleOf(task)}</h1><div className="detail-status"><Badge level={task.rating.level} /><span><MessageSquare size={15} />{typeof counts[id] === 'number' ? proposalCount(counts[id]!) : counts[id] === null ? 'Предложения не загружены' : 'Загружаем предложения…'}</span></div></div>
    <div className="detail-tabs"><span className="active"><FileText size={16} />О задаче</span>{role === 'business' && <Link to={`/tasks/${id}/proposals`}><Users size={17} />Предложения{typeof counts[id] === 'number' && <span className="tab-count">{counts[id]}</span>}</Link>}</div>
    <div className="editor-layout"><div className="detail-main">{task.status !== 'published' && <div className="inline-notice">Эта задача ещё не опубликована. {role === 'business' && <Link to={Object.keys(task.answers).length < 3 ? `/tasks/${id}/questions` : `/tasks/${id}/edit`}>Продолжить подготовку<ArrowRight size={15} /></Link>}</div>}
      <article className="detail-body">{fields.filter(field => field.key !== 'title').map(field => <section className={`detail-field ${!task[field.key] ? 'unfilled' : ''}`} key={field.key}><h2>{field.label}</h2><p>{task[field.key] || 'Пока не уточнено'}</p></section>)}</article>
      {role === 'student' && task.status === 'published' && <div className="detail-invitation"><div><h2>Есть идея решения?</h2><p>Расскажите о подходе вашей команды.</p></div><Link className="button primary" to={`/tasks/${id}/propose`}>Предложить решение<ArrowRight size={17} /></Link></div>}
    </div><div className="detail-aside">{task.status === 'published' && <div className="task-action-panel">{role === 'student' ? <><GraduationCap size={25} /><h2>Здесь пригодятся<br />ваши знания.</h2><p>Идея, план и немного смелости — всё, что нужно для первого шага.</p><Link className="button primary" to={`/tasks/${id}/propose`}>Предложить решение<ArrowUpRight size={17} /></Link><span>Можно откликнуться при любом количестве баллов</span></> : <><Users size={24} /><h2>Найдите свою команду</h2><p>Изучите предложения и выберите подход к решению.</p><Link className="button primary" to={`/tasks/${id}/proposals`}>Смотреть предложения<ArrowRight size={17} /></Link><span>Выбор всегда остаётся за вами</span></>}</div>}<RatingWidget rating={task.rating} /></div></div>
  </>
}

export function Propose() {
  const id = Number(useParams().id)
  const resource = useResource(() => api.task(id), id)
  const { role, setRole } = useWorkspace()
  if (resource.loading) return <Loading />
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.retry} />
  if (role !== 'student') return <EmptyState title="Предложение от студенческой команды" action={<button className="button primary" onClick={() => setRole('student')}>Переключиться на команду<ArrowRight size={17} /></button>}>Чтобы предложить решение, выберите роль команды.</EmptyState>
  if (!resource.data) return null
  if (resource.data.status !== 'published') return <EmptyState title="Задача ещё не опубликована" action={<Link className="button secondary" to={`/tasks/${id}`}>Вернуться к задаче</Link>}>Откликнуться можно после того, как бизнес опубликует карточку.</EmptyState>
  return <ProposalForm task={resource.data} key={id} />
}
function ProposalForm({ task }: { task: Task }) {
  const blank = { team_name: '', solution_idea: '', plan: '', estimated_duration: '', prototype_url: '', contact: '' }
  const [form, setForm] = useState<ProposalInput>(() => {
    const cached = readStorage<Record<string, string>>(`praktika-proposal-${task.id}`, blank, isStringRecord)
    const restored = { ...blank }
    for (const key of Object.keys(blank) as (keyof ProposalInput)[]) restored[key] = cached[key] ?? ''
    return restored
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<Proposal | null>(null)
  const { loadCounts } = useWorkspace()
  function change(field: keyof ProposalInput, value: string) { setForm(previous => { const next = { ...previous, [field]: value }; writeStorage(`praktika-proposal-${task.id}`, next); return next }) }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    if (['team_name', 'solution_idea', 'plan', 'estimated_duration'].some(key => !form[key as keyof ProposalInput].trim())) { setError('Заполните название команды, идею, план и оценку времени.'); return }
    setBusy(true); setError('')
    try { const proposal = await api.propose(task.id, form); setSent(proposal); writeStorage(`praktika-proposal-${task.id}`, blank); void loadCounts([task.id], true) }
    catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  if (sent) return <div className="submission-success"><div className="success-symbol"><CheckCheck size={34} /></div><h1>Ваше решение — в деле.</h1><p>Предложение команды «{sent.team_name}» отправлено.<br />Бизнес изучит его и примет решение.</p><span className="badge pending">Ожидает рассмотрения</span><div className="success-summary"><span>Задача</span><strong>{titleOf(task)}</strong><span>Предложение № {sent.id}</span></div><Link to={`/tasks/${task.id}`} className="button primary">Вернуться к задаче<ArrowRight size={17} /></Link><Link to="/catalog" className="text-link">Посмотреть другие задачи</Link></div>
  return <><Link to={`/tasks/${task.id}`} className="back-link"><ArrowLeft size={16} />К задаче</Link><PageHeading title="Покажите, как вы это видите" description="Расскажите о команде и предложите понятный подход к решению." />
    <div className="intake-layout"><form className="form-panel proposal-form" onSubmit={submit}><fieldset disabled={busy}>
      <div className="form-field"><label htmlFor="team">Название команды <span className="required-star">*</span></label><input id="team" value={form.team_name} onChange={event => change('team_name', event.target.value)} placeholder="Как вас представить бизнесу?" maxLength={200} required /></div>
      <div className="form-field"><label htmlFor="idea">Идея решения <span className="required-star">*</span></label><textarea id="idea" value={form.solution_idea} onChange={event => change('solution_idea', event.target.value)} rows={4} placeholder="Что предлагаете сделать и почему это поможет?" maxLength={10000} required /></div>
      <div className="form-field"><label htmlFor="plan">План работы <span className="required-star">*</span></label><textarea id="plan" value={form.plan} onChange={event => change('plan', event.target.value)} rows={4} placeholder="Опишите основные шаги — от изучения задачи до результата." maxLength={10000} required /></div>
      <div className="two-fields"><div className="form-field"><label htmlFor="duration">Оценка времени <span className="required-star">*</span></label><input id="duration" value={form.estimated_duration} onChange={event => change('estimated_duration', event.target.value)} placeholder="Например, 5 часов" maxLength={200} required /></div><div className="form-field"><label htmlFor="team-contact">Контакт команды <span className="optional-label">необязательно</span></label><input id="team-contact" value={form.contact} onChange={event => change('contact', event.target.value)} placeholder="Email или Telegram" maxLength={500} /></div></div>
      <div className="form-field"><label htmlFor="prototype">Ссылка на прототип <span className="optional-label">необязательно</span></label><input id="prototype" type="url" pattern="https?://.*" value={form.prototype_url} onChange={event => change('prototype_url', event.target.value)} placeholder="https://" maxLength={2000} /><p className="field-hint">Если прототип уже есть — покажите. Если нет, достаточно идеи и плана.</p></div>
      <ErrorNotice message={error} /><div className="form-bottom"><span><ShieldCheck size={16} />Решение принимает бизнес</span><button className="button primary" disabled={busy}><BusyLabel busy={busy}>{busy ? 'Отправляем…' : 'Отправить предложение'}</BusyLabel><Send size={16} /></button></div>
    </fieldset></form><aside className="source-note"><span className="topic-label">{topicOf(task)}</span><h2>{titleOf(task)}</h2><p>{task.need || task.context}</p><Badge level={task.rating.level} /><hr /><h3>Хорошее предложение</h3><ul className="plain-checklist"><li><Check size={15} />Отвечает на потребность бизнеса</li><li><Check size={15} />Описывает конкретный результат</li><li><Check size={15} />Содержит реалистичный план</li></ul></aside></div>
  </>
}

export function Proposals() {
  const id = Number(useParams().id)
  const resource = useResource(() => Promise.all([api.task(id), allProposals(id)]), id)
  const [decision, setDecision] = useState<{ id: number; status: 'accepted' | 'rejected' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { notify, loadCounts } = useWorkspace()
  async function confirmDecision() {
    if (!decision || busy) return
    setBusy(true); setError('')
    try {
      const updated = await api.decide(decision.id, decision.status)
      resource.setData(previous => previous ? [previous[0], previous[1].map(proposal => proposal.id === updated.id ? updated : proposal)] : null)
      setDecision(null); notify(updated.status === 'accepted' ? 'Команда выбрана. Решение сохранено.' : 'Предложение отклонено.'); void loadCounts([id], true)
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  if (resource.loading) return <Loading />
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.retry} />
  if (!resource.data) return null
  const [task, proposals] = resource.data
  const winner = proposals.find(proposal => proposal.status === 'accepted')
  return <BusinessOnly><Link to={`/tasks/${id}`} className="back-link"><ArrowLeft size={16} />К карточке задачи</Link><PageHeading title="Разные подходы. Ваш выбор." description={titleOf(task)} /><div className="detail-tabs"><Link to={`/tasks/${id}`}><FileText size={16} />О задаче</Link><span className="active"><Users size={17} />Предложения<span className="tab-count">{proposals.length}</span></span></div>
    {winner && <div className="success-notice"><CheckCheck size={22} /><div><strong>Вы выбрали команду «{winner.team_name}»</strong><p>Другие предложения можно отклонить вручную.</p></div></div>}
    <ErrorNotice message={error} retry={() => { setError(''); setDecision(null); resource.retry() }} />
    {!proposals.length ? <EmptyState title="У хорошей задачи всё впереди" action={<Link className="button secondary" to={`/tasks/${id}`}>Посмотреть карточку<ArrowRight size={16} /></Link>}>Здесь появятся идеи и планы студенческих команд. Выберите роль команды, чтобы отправить первое предложение в демо.</EmptyState> : <div className="proposals-list">{proposals.map(proposal => <article className={`proposal-card ${proposal.status}`} key={proposal.id}><header><span className="team-avatar"><Users size={23} /></span><div><h2>{proposal.team_name}</h2><p>Предложение от {formatDate(proposal.created_at)}</p></div><span className={`badge ${proposal.status}`}>{proposal.status === 'pending' ? 'На рассмотрении' : proposal.status === 'accepted' ? 'Команда выбрана' : 'Отклонено'}</span></header><div className="proposal-content"><section><h3>Идея решения</h3><p>{proposal.solution_idea || 'Не указана'}</p></section><section><h3>План работы</h3><p>{proposal.plan || 'Команда пока не указала план'}</p></section></div><div className="proposal-meta"><span><Clock3 size={16} />{proposal.estimated_duration || 'Срок не указан'}</span>{proposal.contact && <span><Mail size={16} />{proposal.contact}</span>}{/^https?:\/\//i.test(proposal.prototype_url) && <a href={proposal.prototype_url} target="_blank" rel="noopener noreferrer">Прототип<ExternalLink size={15} /></a>}</div>
      {proposal.status === 'pending' && (decision?.id === proposal.id ? <div className="decision-confirm"><div><strong>{decision.status === 'accepted' ? `Выбрать команду «${proposal.team_name}»?` : `Отклонить предложение «${proposal.team_name}»?`}</strong><p>Это окончательное решение. Изменить его будет нельзя.</p></div><div><button className="button secondary small" disabled={busy} onClick={() => setDecision(null)}>Отмена</button><button className={`button small ${decision.status === 'accepted' ? 'primary' : 'danger'}`} disabled={busy} onClick={() => void confirmDecision()}><BusyLabel busy={busy}>{decision.status === 'accepted' ? 'Да, принять' : 'Да, отклонить'}</BusyLabel></button></div></div> : <footer><span>Выберите подход, который подходит вашей задаче.</span><button className="button secondary small" disabled={busy} onClick={() => { setError(''); setDecision({ id: proposal.id, status: 'rejected' }) }}><X size={16} />Отклонить</button><button className="button primary small" disabled={!!winner || busy} title={winner ? 'Команда уже выбрана' : undefined} onClick={() => { setError(''); setDecision({ id: proposal.id, status: 'accepted' }) }}><Check size={16} />{winner ? 'Команда уже выбрана' : 'Принять команду'}</button></footer>)}
    </article>)}</div>}
  </BusinessOnly>
}
