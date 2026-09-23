import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowUpRight, BookOpen, BriefcaseBusiness, Check, ChevronRight, CircleHelp, Compass, GraduationCap, LayoutDashboard, Menu, Plus, Sprout, X } from 'lucide-react'
import { useWorkspace } from './workspace'
import { Dashboard, Catalog, Drafts } from './pages/Explore'
import { CreateTask, Clarification, TaskEditor } from './pages/Intake'
import { TaskDetails, Propose, Proposals } from './pages/Task'
import { EmptyState } from './components'

function Shell() {
  const { role, setRole, knownIds, toast } = useWorkspace()
  const location = useLocation()
  const menuButton = useRef<HTMLButtonElement>(null)
  const helpButton = useRef<HTMLButtonElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const mainContent = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const breadcrumb = location.pathname === '/' ? 'Обзор'
    : location.pathname === '/catalog' ? 'Каталог задач'
    : location.pathname === '/drafts' ? 'Рабочие задачи'
    : location.pathname === '/tasks/new' ? 'Новая задача'
    : location.pathname.endsWith('/questions') ? 'Уточнение задачи'
    : location.pathname.endsWith('/edit') ? 'Редактирование задачи'
    : location.pathname.endsWith('/propose') ? 'Предложить решение'
    : location.pathname.endsWith('/proposals') ? 'Предложения команд'
    : /^\/tasks\/[^/]+$/.test(location.pathname) ? 'Карточка задачи'
    : 'Страница не найдена'
  useEffect(() => { document.title = `${breadcrumb} — Практика` }, [breadcrumb])
  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo(0, 0)
    if (previousPath.current === location.pathname) return
    previousPath.current = location.pathname
    const frame = window.requestAnimationFrame(() => mainContent.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname])
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 961px)')
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebar.current?.querySelector<HTMLElement>('.mobile-menu-close')?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false) }
      if (event.key !== 'Tab') return
      const items = Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [])
        .filter(item => item.getClientRects().length > 0)
      if (!items?.length) return
      const first = items[0], last = items[items.length - 1]
      if (!sidebar.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
      menuButton.current?.focus({ preventScroll: true })
    }
  }, [menuOpen])
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" tabIndex={menuOpen ? -1 : undefined} aria-hidden={menuOpen || undefined}>Перейти к содержимому</a>
    {menuOpen && <button aria-hidden="true" tabIndex={-1} className="menu-scrim" onClick={() => setMenuOpen(false)} />}
    <aside ref={sidebar} id="workspace-navigation" className={`sidebar ${menuOpen ? 'open' : ''}`} role={menuOpen ? 'dialog' : undefined} aria-modal={menuOpen || undefined} aria-label="Навигация по пространству" onClick={event => {
      if ((event.target as HTMLElement).closest('a[href]')) setMenuOpen(false)
    }} onKeyDown={event => {
      if (event.key === 'Escape' && helpOpen) {
        event.preventDefault()
        event.stopPropagation()
        setHelpOpen(false)
        helpButton.current?.focus()
      }
    }}>
      <button className="icon-button mobile-menu-close" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)}><X size={21} aria-hidden="true" /></button>
      <Link to="/" className="brand" aria-label="Практика — главная"><span className="brand-symbol"><svg width="23" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 21V4h16v17M12 4v17" stroke="currentColor" strokeWidth="3" /></svg></span>практика<span className="brand-period">.</span></Link>
      <div className="workspace-label"><span className="workspace-emblem"><Sprout size={18} aria-hidden="true" /></span><div><strong>Пространство проектов</strong><span>Бизнес × студенты</span></div></div>
      <nav aria-label="Основная навигация">
        <NavLink to="/" end><LayoutDashboard size={19} aria-hidden="true" />Обзор</NavLink>
        <NavLink to="/catalog"><Compass size={19} aria-hidden="true" />Каталог задач</NavLink>
        {role === 'business' && <NavLink to="/drafts"><BookOpen size={19} aria-hidden="true" />Рабочие задачи{knownIds.length > 0 && <span className="nav-count" aria-label={`Сохранённых задач: ${knownIds.length}`}>{knownIds.length}</span>}</NavLink>}
      </nav>
      {role === 'business' && <Link to="/tasks/new" className="button primary sidebar-create"><Plus size={17} aria-hidden="true" />Создать задачу</Link>}
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-icon"><Sprout size={21} aria-hidden="true" /></span><h3>Маленький шаг.<br />Настоящий результат.</h3><p>Идеи бизнеса становятся опытом для команд.</p></div>
        <button ref={helpButton} id="workspace-help-toggle" className="help-button" onClick={() => setHelpOpen(value => !value)} aria-expanded={helpOpen} aria-controls="workspace-help"><CircleHelp size={18} aria-hidden="true" />Как это работает<ChevronRight size={15} aria-hidden="true" /></button>
        <div id="workspace-help" className="help-content" hidden={!helpOpen} role="region" aria-labelledby="workspace-help-toggle">Бизнес описывает задачу и публикует карточку. Команды предлагают решения. Бизнес выбирает команду вручную. Переключатель роли — сверху.</div>
        <div className="demo-note"><span className="status-dot" />Демо-пространство</div>
      </div>
    </aside>
    <div className="app-main" inert={menuOpen}>
      <header className="topbar"><div className="breadcrumb"><button ref={menuButton} className="icon-button mobile-menu" aria-label="Открыть меню" aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(true)}><Menu size={21} aria-hidden="true" /></button><span className="breadcrumb-root">Пространство</span><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{breadcrumb}</span></div>
        <div className="topbar-right"><span className="role-caption">Ваша роль</span><div className="role-switch" role="group" aria-label="Роль в демонстрации"><button className={role === 'business' ? 'selected' : ''} aria-pressed={role === 'business'} onClick={() => setRole('business')}><BriefcaseBusiness size={15} aria-hidden="true" /><span>Бизнес</span></button><button className={role === 'student' ? 'selected' : ''} aria-pressed={role === 'student'} onClick={() => setRole('student')}><GraduationCap size={17} aria-hidden="true" /><span>Команда</span></button></div><span className="profile-avatar" aria-hidden="true">{role === 'business' ? 'Б' : 'К'}</span></div>
      </header>
      <main ref={mainContent} id="main-content" tabIndex={-1} className="main-content" aria-label={breadcrumb}><Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/drafts" element={<Drafts />} />
        <Route path="/tasks/new" element={<CreateTask />} />
        <Route path="/tasks/:id/questions" element={<Clarification />} />
        <Route path="/tasks/:id/edit" element={<TaskEditor />} />
        <Route path="/tasks/:id/propose" element={<Propose />} />
        <Route path="/tasks/:id/proposals" element={<Proposals />} />
        <Route path="/tasks/:id" element={<TaskDetails />} />
        <Route path="*" element={<EmptyState title="Здесь пока нет страницы" action={<Link className="button primary" to="/">На главную<ArrowUpRight size={16} /></Link>}>Вернитесь в пространство и выберите нужный раздел.</EmptyState>} />
      </Routes></main>
      <footer className="app-footer"><span>Практика — учиться, создавая.</span><span>Реальные задачи. Совместные решения.</span></footer>
    </div>
    <div role="status" aria-live="polite" aria-atomic="true">{toast && <div className="toast"><Check size={19} aria-hidden="true" />{toast}</div>}</div>
  </div>
}
export default function App() { return <Shell /> }
