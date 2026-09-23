import { useEffect, useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0) }, [location.pathname])
  const breadcrumb = location.pathname === '/' ? 'Обзор' : location.pathname.startsWith('/catalog') ? 'Каталог задач' : location.pathname === '/drafts' ? 'Рабочие задачи' : location.pathname.endsWith('/proposals') ? 'Предложения команд' : location.pathname === '/tasks/new' ? 'Новая задача' : 'Карточка задачи'
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Перейти к содержимому</a>
    {menuOpen && <button aria-label="Закрыть меню" className="menu-scrim" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <Link to="/" className="brand" aria-label="Практика — главная"><span className="brand-symbol"><svg width="23" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 21V4h16v17M12 4v17" stroke="currentColor" strokeWidth="3" /></svg></span>практика<span className="brand-period">.</span></Link>
      <div className="workspace-label"><span className="workspace-emblem"><Sprout size={18} /></span><div><strong>Пространство проектов</strong><span>Бизнес × студенты</span></div></div>
      <nav aria-label="Основная навигация">
        <NavLink to="/" end><LayoutDashboard size={19} />Обзор</NavLink>
        <NavLink to="/catalog"><Compass size={19} />Каталог задач</NavLink>
        {role === 'business' && <NavLink to="/drafts"><BookOpen size={19} />Рабочие задачи{knownIds.length > 0 && <span className="nav-count">{knownIds.length}</span>}</NavLink>}
      </nav>
      {role === 'business' && <Link to="/tasks/new" className="button primary sidebar-create"><Plus size={17} />Создать задачу</Link>}
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-icon"><Sprout size={21} /></span><h3>Маленький шаг.<br />Настоящий результат.</h3><p>Идеи бизнеса становятся опытом для команд.</p></div>
        <button className="help-button" onClick={() => setHelpOpen(value => !value)} aria-expanded={helpOpen}><CircleHelp size={18} />Как это работает<ChevronRight size={15} /></button>
        {helpOpen && <div className="help-content">Бизнес описывает задачу и публикует карточку. Команды предлагают решения. Бизнес выбирает команду вручную. Переключатель роли — сверху.</div>}
        <div className="demo-note"><span className="status-dot" />Демо-пространство</div>
      </div>
    </aside>
    <div className="app-main">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Открыть меню" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><span className="breadcrumb-root">Пространство</span><ChevronRight size={14} /><span>{breadcrumb}</span></div>
        <div className="topbar-right"><span className="role-caption">Ваша роль</span><div className="role-switch" aria-label="Роль в демонстрации"><button className={role === 'business' ? 'selected' : ''} aria-pressed={role === 'business'} onClick={() => setRole('business')}><BriefcaseBusiness size={15} /><span>Бизнес</span></button><button className={role === 'student' ? 'selected' : ''} aria-pressed={role === 'student'} onClick={() => setRole('student')}><GraduationCap size={17} /><span>Команда</span></button></div><span className="profile-avatar" aria-label={role === 'business' ? 'Роль: бизнес' : 'Роль: студенческая команда'}>{role === 'business' ? 'Б' : 'К'}</span></div>
      </header>
      <main id="main-content" tabIndex={-1} className="main-content"><Routes>
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
    {toast && <div className="toast" role="status"><Check size={19} />{toast}</div>}
  </div>
}
export default function App() { return <Shell /> }
