import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Check, ChevronDown, Compass, FileText, GraduationCap, Plus, Search, SlidersHorizontal, Sprout, Users, X } from 'lucide-react'
import { api } from '../api'
import { Badge, EmptyState, ErrorNotice, Loading, PageHeading, SectionLink, TaskCard } from '../components'
import { formatDate, levels, plural, titleOf } from '../content'
import { useResource } from '../hooks'
import { useWorkspace } from '../workspace'
import type { Level, Task } from '../types'

export function Dashboard() {
  const { tasks, loading, error, refresh, counts, setRole } = useWorkspace()
  const navigate = useNavigate()
  const countsComplete = tasks.every(task => typeof counts[task.id] === 'number')
  const totalProposals = countsComplete ? tasks.reduce((sum, task) => sum + (counts[task.id] || 0), 0) : null
  return <>
    <PageHeading title="От задачи — к результату." description="Место встречи реальных задач бизнеса и студенческих команд." />
    <div className="welcome-grid">
      <section className="business-welcome"><div className="welcome-title"><BriefcaseBusiness size={21} /><span>Для бизнеса</span></div><h2>Вашей идее нужна<br /><span>сильная команда.</span></h2><p>Опишите задачу. Мы поможем уточнить детали<br className="desktop-break" /> и подготовить её к работе со студентами.</p><button className="button light" onClick={() => { setRole('business'); navigate('/tasks/new') }}>Создать задачу<ArrowUpRight size={19} /></button><div className="welcome-process" aria-label="Описание, уточнение, результат"><span><span className="process-dot" />Идея</span><i /><span><span className="process-dot" />Понятная задача</span><i /><span><Check size={12} />Результат</span></div></section>
      <section className="student-welcome"><div className="welcome-title"><GraduationCap size={24} /><span>Для студенческих команд</span></div><h2>Знания —<br />в дело.</h2><p>Выберите задачу, предложите подход<br className="desktop-break" /> и создайте полезное решение.</p><button className="button secondary" onClick={() => { setRole('student'); navigate('/catalog') }}>Найти задачу<ArrowRight size={18} /></button><div className="student-note"><Users size={17} />Опыт начинается с первой задачи</div></section>
    </div>
    <div className="overview-stats" aria-label="Статистика каталога"><div><span className="stat-icon"><FileText size={20} /></span><strong>{loading || error ? '—' : tasks.length}</strong><span>задач в каталоге</span></div><div><span className="stat-icon"><Sprout size={20} /></span><strong>{loading || error ? '—' : tasks.filter(task => task.rating.score >= 70).length}</strong><span>подробно описаны</span></div><div><span className="stat-icon"><Users size={20} /></span><strong>{loading || error || totalProposals === null ? '—' : totalProposals}</strong><span>предложений от команд</span></div></div>
    <section className="dashboard-catalog"><div className="section-heading"><div><h2>Задачи, с которых можно начать</h2><p>Сначала — самые подробно описанные. Откликнуться можно на любую.</p></div><SectionLink to="/catalog">Весь каталог</SectionLink></div>
      {loading ? <Loading cards /> : error ? <ErrorNotice message={error} retry={() => void refresh()} /> : tasks.length ? <div className="task-grid">{tasks.slice(0, 3).map(task => <TaskCard key={task.id} task={task} compact />)}</div> : <EmptyState title="Здесь появятся первые задачи" action={<Link to="/tasks/new" className="button primary">Создать задачу<Plus size={16} /></Link>}>Опубликуйте задачу бизнеса, чтобы студенческие команды могли предложить решение.</EmptyState>}
    </section>
    <section className="workflow-strip"><div><h3>От короткого описания<br />до совместной работы</h3><p>Три понятных шага.</p></div><ol><li><span>1</span><div><strong>Опишите задачу</strong><p>Достаточно нескольких предложений</p></div></li><li><span>2</span><div><strong>Уточните детали</strong><p>Соберите понятную карточку</p></div></li><li><span>3</span><div><strong>Выберите команду</strong><p>Решение всегда за бизнесом</p></div></li></ol></section>
  </>
}

export function Catalog() {
  const { tasks, role, loadCounts } = useWorkspace()
  const [search, setSearch] = useSearchParams()
  const topic = search.get('topic') || ''
  const level = (search.get('level') || '') as Level | ''
  const sort = search.get('sort') || 'rating_desc'
  const [topicInput, setTopicInput] = useState(topic)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [more, setMore] = useState<Task[]>([])
  const [moreBusy, setMoreBusy] = useState(false)
  const [moreError, setMoreError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const activeQuery = useRef(search.toString())
  activeQuery.current = search.toString()
  const resource = useResource(() => api.tasks({ topic, level, sort, limit: 12 }), search.toString())
  useEffect(() => { setMore([]); setMoreBusy(false); setMoreError(''); setHasMore(false) }, [topic, level, sort])
  useEffect(() => { setTopicInput(topic) }, [topic])
  useEffect(() => { if (resource.data) { setHasMore(resource.data.length === 12); void loadCounts(resource.data.map(task => task.id)) } }, [resource.data, loadCounts])
  const topics = Array.from(new Set(tasks.map(task => task.topic).filter(Boolean)))
  function filter(key: string, value: string) {
    // Router transitions can leave this render's search stale during a quick second edit.
    const next = new URLSearchParams(window.location.search)
    value ? next.set(key, value) : next.delete(key)
    setSearch(next)
  }
  async function loadMore() {
    if (moreBusy) return
    const query = search.toString()
    setMoreBusy(true); setMoreError('')
    try { const page = await api.tasks({ topic, level, sort, limit: 12, offset: (resource.data?.length || 0) + more.length }); if (activeQuery.current !== query) return; setMore(previous => [...previous, ...page]); setHasMore(page.length === 12); void loadCounts(page.map(task => task.id)) }
    catch (error) { if (activeQuery.current === query) setMoreError((error as Error).message) } finally { if (activeQuery.current === query) setMoreBusy(false) }
  }
  const shown = [...(resource.data || []), ...more]
  const additionalFilters = Number(!!level) + Number(sort !== 'rating_desc')
  function resetFilters() { setSearch({}); setTopicInput('') }
  return <>
    <div className="catalog-heading"><PageHeading title="Найдите свою задачу" description="Выберите задачу бизнеса и предложите решение." action={role === 'business' ? <Link className="button primary" to="/tasks/new"><Plus size={17} />Создать задачу</Link> : undefined} /></div>
    <form className="catalog-filters" onSubmit={event => { event.preventDefault(); filter('topic', topicInput.trim()) }}>
      <div className="catalog-search"><div className="search-field"><Search size={18} aria-hidden="true" /><input aria-label="Тема задачи" aria-describedby="topic-hint" placeholder="Выберите тему" list="catalog-topics" value={topicInput} maxLength={100} onChange={event => setTopicInput(event.target.value)} /><datalist id="catalog-topics">{topics.map(topic => <option value={topic} key={topic} />)}</datalist><button className="search-submit" aria-label="Применить тему" type="submit"><ArrowRight size={18} /></button></div><span className="sr-only" id="topic-hint">Выберите тему из подсказок или введите её полное название.</span></div>
      <button className="button secondary filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="catalog-options" onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={17} aria-hidden="true" />Фильтры{additionalFilters > 0 && <span className="filter-count">{additionalFilters}</span>}<ChevronDown size={15} aria-hidden="true" /></button>
      <div id="catalog-options" className={`catalog-options${filtersOpen ? ' is-open' : ''}`}>
        <label className="select-field"><span className="sr-only" id="completeness-label">Полнота описания</span><select aria-labelledby="completeness-label" value={level} onChange={event => filter('level', event.target.value)}><option value="">Любая полнота описания</option>{Object.entries(levels).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label>
        <label className="select-field"><span className="sr-only" id="sort-label">Сортировка</span><select aria-labelledby="sort-label" value={sort} onChange={event => filter('sort', event.target.value)}><option value="rating_desc">Сначала подробнее описанные</option><option value="rating_asc">Сначала с меньшим числом деталей</option><option value="newest">Сначала новые</option></select><ChevronDown size={14} aria-hidden="true" /></label>
      </div>
    </form>
    <p className="catalog-explainer">Баллы показывают полноту описания. Откликнуться можно на любую задачу.</p>
    <div className="catalog-meta"><span role="status" aria-live="polite">{resource.loading ? 'Загружаем задачи…' : resource.error ? 'Задачи не загружены' : `${plural(shown.length, ['задача', 'задачи', 'задач'])}${hasMore ? ' показано' : ''}`}</span>{(topic || additionalFilters > 0) && <button className="text-button" onClick={resetFilters}>Сбросить фильтры<X size={14} aria-hidden="true" /></button>}</div>
    {(topic || level) && <div className="active-filters" aria-label="Применённые фильтры">{topic && <button type="button" onClick={() => { filter('topic', ''); setTopicInput('') }} aria-label={`Убрать тему: ${topic}`}><span>Тема: {topic}</span><X size={14} aria-hidden="true" /></button>}{level && <button type="button" onClick={() => filter('level', '')} aria-label="Убрать фильтр полноты описания"><span>{levels[level]?.label || 'Неизвестный уровень'}</span><X size={14} aria-hidden="true" /></button>}</div>}
    {resource.loading ? <Loading cards /> : resource.error ? <ErrorNotice message={resource.error} retry={resource.retry} /> : shown.length ? <div className="task-grid">{shown.map(task => <TaskCard task={task} key={task.id} />)}</div> : <EmptyState title={topic || level ? 'По этим условиям задач пока нет' : 'Первые задачи ещё впереди'} action={topic || level ? <button className="button secondary" onClick={resetFilters}>Показать все задачи</button> : role === 'business' ? <Link className="button primary" to="/tasks/new">Создать задачу</Link> : undefined}>{topic || level ? 'Выберите тему из подсказок, введите её полное название или уберите фильтр полноты описания.' : 'Как только бизнес опубликует задачу, вы увидите её здесь.'}</EmptyState>}
    <ErrorNotice message={moreError} retry={() => void loadMore()} />
    {hasMore && !resource.loading && <div className="load-more"><button className="button secondary" disabled={moreBusy} onClick={() => void loadMore()}>{moreBusy ? 'Загружаем…' : 'Показать ещё задачи'}</button></div>}
  </>
}

export function Drafts() {
  const { knownIds, role, setRole } = useWorkspace()
  const resource = useResource(async () => {
    const results = await Promise.allSettled(knownIds.map(id => api.task(id)))
    const failed = results.filter(result => result.status === 'rejected')
    if (failed.length) throw new Error('Не удалось загрузить часть рабочих задач. Проверьте подключение и повторите попытку.')
    return results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
  }, knownIds.join(','))
  return <><PageHeading title="Рабочие задачи" description="Задачи, созданные в этом браузере. Вернитесь к ним в любой момент." action={resource.data?.length ? <Link to="/tasks/new" className="button primary" onClick={() => setRole('business')}><Plus size={17} />Создать задачу</Link> : undefined} />
    {resource.loading ? <Loading /> : resource.error ? <ErrorNotice message={resource.error} retry={resource.retry} /> : !resource.data?.length ? <EmptyState title="Начните с вашей первой задачи" action={<Link to="/tasks/new" className="button primary" onClick={() => setRole('business')}>Описать задачу<ArrowRight size={17} /></Link>}>Здесь сохранятся ссылки на ваши черновики и опубликованные карточки.</EmptyState> : <div className="working-list">{resource.data.map(task => <Link className="working-row" to={task.status === 'published' ? `/tasks/${task.id}` : Object.keys(task.answers).length >= 3 ? `/tasks/${task.id}/edit` : `/tasks/${task.id}/questions`} key={task.id}><span className="working-icon"><FileText size={22} /></span><div><h3>{titleOf(task)}</h3><p>{task.status === 'published' ? 'Опубликована' : task.status === 'confirmed' ? 'Готова к публикации' : 'Черновик'} · Изменена {formatDate(task.updated_at)}</p></div><Badge level={task.rating.level} /><strong>{task.rating.score}<span>/100</span></strong><ArrowUpRight size={20} /></Link>)}</div>}
    {role === 'student' && <p className="helper-text">Для редактирования переключитесь на роль бизнеса.</p>}
  </>
}
