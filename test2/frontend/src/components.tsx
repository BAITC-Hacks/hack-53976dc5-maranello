import { ArrowDown, ArrowRight, ArrowUpRight, Check, CircleAlert, Compass, LoaderCircle, MessageSquare, RotateCcw, Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'
import { componentLabels, labels, levels, proposalCount, titleOf, topicOf } from './content'
import { useWorkspace } from './workspace'
import type { CardField, Rating, Task } from './types'
import type { ReactNode } from 'react'

export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  if (!message) return null
  return <div className="error-notice" role="alert"><CircleAlert size={19} /><div><strong>Не всё получилось</strong><p>{message}</p></div>{retry && <button type="button" className="button secondary small" onClick={retry}><RotateCcw size={15} />Повторить</button>}</div>
}
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Compass size={28} /></div><h3>{title}</h3><p>{children}</p>{action}</div>
}
export function Loading({ cards = false }: { cards?: boolean }) {
  return <div aria-busy="true" aria-label="Загрузка данных" role="status" className={cards ? 'task-grid' : 'loading-stack'}>{[0, 1, 2].map(i => <div className={`skeleton ${cards ? 'skeleton-card' : 'skeleton-row'}`} key={i}><span /><span /><span /></div>)}<span className="sr-only">Загрузка данных…</span></div>
}
export function BusyLabel({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <>{busy && <LoaderCircle className="spin" size={17} />}{children}</>
}
export function Badge({ level }: { level: Rating['level'] }) {
  return <span className={`badge ${level}`}>{level === 'priority' ? <Sprout size={13} /> : <span className="status-dot" />}{levels[level].label}</span>
}
export function TaskCard({ task, compact = false }: { task: Task; compact?: boolean }) {
  const { counts } = useWorkspace()
  const count = counts[task.id]
  return <Link className={`task-card ${task.rating.level === 'priority' ? 'task-priority' : ''} ${compact ? 'compact' : ''}`} to={`/tasks/${task.id}`}>
    <div className="task-card-top"><span className="topic-label">{topicOf(task)}</span><ArrowUpRight size={19} className="card-arrow" /></div>
    <h3>{titleOf(task)}</h3><p className="task-excerpt">{task.need || task.context || task.description}</p>
    <div className="task-card-status"><Badge level={task.rating.level} /><span className="sr-only">Полнота описания: {task.rating.score} из 100.</span><span className="small-score" aria-hidden="true">{task.rating.score}<span>/100</span></span></div>
    <div className="score-track" aria-hidden="true"><span style={{ transform: `scaleX(${task.rating.score / 100})` }} /></div>
    <div className="task-card-footer"><span><MessageSquare size={14} />{count === undefined ? 'Считаем предложения…' : count === null ? 'Отклики не загружены' : proposalCount(count)}</span><span className="task-id">№ {String(task.id).padStart(3, '0')}</span></div>
  </Link>
}
export function PageHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}
export function Stepper({ current }: { current: number }) {
  return <ol className="stepper" aria-label="Этапы создания задачи">{['Описание', 'Уточнение', 'Карточка', 'Публикация'].map((step, index) => <li key={step} className={index === current ? 'current' : index < current ? 'complete' : ''} aria-current={index === current ? 'step' : undefined}><span>{index < current ? <Check size={13} /> : index + 1}</span>{step}</li>)}</ol>
}
export function RatingWidget({ rating, dirty = false, onField }: { rating: Rating; dirty?: boolean; onField?: (field: CardField) => void }) {
  return <aside className="rating-widget">
    <div className="widget-heading"><h2>Полнота описания</h2><Sprout size={19} /></div>
    <div className="rating-total"><span className="sr-only">Полнота описания: {rating.score} из 100.</span><strong aria-hidden="true">{rating.score}<span> / 100</span></strong><span className={`rating-level ${rating.level}`}>{levels[rating.level].label}</span></div>
    <div className="score-track large" aria-hidden="true"><span style={{ transform: `scaleX(${rating.score / 100})` }} /></div>
    <p className="rating-explainer">Баллы учитывают заполненные разделы. Ценность и реализуемость идеи здесь не оцениваются.</p>
    {dirty && <p className="rating-explainer" role="status">Показаны последние сохранённые данные. Сохраните изменения, чтобы обновить баллы и подсказки.</p>}
    <div className="breakdown">{rating.breakdown.map(item => <div key={item.key}><div className="breakdown-label"><span>{componentLabels[item.key] || item.key}</span><span>{item.score}<span className="muted"><span aria-hidden="true"> / </span><span className="sr-only"> из </span>{item.max_score}</span></span></div><div className="score-track mini" aria-hidden="true"><span style={{ transform: `scaleX(${item.score / item.max_score})` }} /></div></div>)}</div>
    <div className="rating-tips"><h3>{rating.missing_fields.length ? 'Что ещё уточнить' : 'Все разделы заполнены'}</h3>{rating.missing_fields.length ? <ul>{rating.missing_fields.map(field => <li key={field}>{onField ? <button type="button" onClick={() => onField(field)}><span>Уточните: {labels[field]}</span><ArrowRight size={14} /></button> : <span>{rating.recommendations[rating.missing_fields.indexOf(field)] || labels[field]}</span>}</li>)}</ul> : <p>Проверьте формулировки: достаточно ли команде сведений, чтобы предложить решение?</p>}</div>
    <p className="rating-footnote">Для публикации подходит любое количество баллов.</p>
  </aside>
}
export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="text-link" to={to}>{children}<ArrowRight size={16} /></Link>
}
export function SortIcon() { return <><ArrowDown size={13} /><ArrowUpRight size={13} /></> }
