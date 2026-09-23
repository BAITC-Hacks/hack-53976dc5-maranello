"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  LayoutGrid,
  LogOut,
  Plus,
  Send,
  X,
} from "lucide-react";
import { requestJson } from "@/lib/client";
import type { TaskRecord, TeamResponse } from "@/lib/types";
import { exampleTask } from "@/lib/example";
import { Catalog, Empty, MyResponses, TaskList } from "./components/catalog";
import { Editor } from "./components/editor";
import { TaskDetail } from "./components/task-detail";
type View = "catalog" | "mine" | "responses" | "editor" | "detail";
function routeUrl(view: View, id?: string) {
  const params = new URLSearchParams();
  if (view !== "catalog") params.set("view", view);
  if (id) params.set("task", id);
  return `/${params.size ? `?${params}` : ""}`;
}
export default function Workspace({
  user,
  signInHref,
  signOutHref,
}: {
  user: { name: string; email: string } | null;
  signInHref: string;
  signOutHref: string;
}) {
  const [view, setView] = useState<View>("catalog");
  const [catalog, setCatalog] = useState<TaskRecord[]>([]);
  const [mine, setMine] = useState<TaskRecord[]>([]);
  const [responses, setResponses] = useState<TeamResponse[]>([]);
  const [active, setActive] = useState<TaskRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const dirty = useRef(false);
  const route = useRef("/");
  const ticket = useRef(0);
  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const loadCatalog = useCallback(async () => {
    const data = await requestJson<{ tasks: TaskRecord[] }>("/api/tasks");
    setCatalog(data.tasks);
  }, []);
  const navigate = useCallback(
    async (next: View, id?: string, fromHistory = false) => {
      if (
        dirty.current &&
        !window.confirm("Есть несохранённые изменения. Уйти без сохранения?")
      ) {
        if (fromHistory) history.pushState(null, "", route.current);
        return;
      }
      dirty.current = false;
      setError("");
      setLoading(true);
      const current = ++ticket.current;
      try {
        let task: TaskRecord | null = null;
        if (
          (next === "editor" || next === "mine" || next === "responses") &&
          !user
        ) {
          location.assign(signInHref);
          return;
        }
        if (next === "catalog") await loadCatalog();
        else if (next === "mine") {
          const data = await requestJson<{ tasks: TaskRecord[] }>(
            "/api/tasks?mine=1",
          );
          if (current === ticket.current) setMine(data.tasks);
        } else if (next === "responses") {
          const data = await requestJson<{ responses: TeamResponse[] }>(
            "/api/responses",
          );
          if (current === ticket.current) setResponses(data.responses);
        } else if (id)
          task =
            id === "example"
              ? exampleTask
              : (
                  await requestJson<{ task: TaskRecord }>(
                    `/api/tasks/${encodeURIComponent(id)}`,
                  )
                ).task;
        if (next === "detail" && !task)
          throw new Error("Задача не найдена. Вернитесь в каталог.");
        if (
          next === "editor" &&
          task &&
          (!task.isOwner || task.status === "selected")
        )
          throw new Error("Редактирование этой задачи недоступно.");
        if (current !== ticket.current) return;
        setActive(task);
        setView(next);
        if (next === "editor") setEditorKey((value) => value + 1);
        route.current = routeUrl(next, id);
        if (!fromHistory) history.pushState(null, "", route.current);
        window.scrollTo({ top: 0, behavior: "instant" });
      } catch (cause) {
        if (current === ticket.current) setError((cause as Error).message);
      } finally {
        if (current === ticket.current) { setLoading(false); setInitialized(true); }
      }
    },
    [user, signInHref, loadCatalog],
  );
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(location.search);
      const requested = params.get("view");
      const next: View =
        requested &&
        ["mine", "responses", "editor", "detail"].includes(requested)
          ? (requested as View)
          : "catalog";
      void navigate(next, params.get("task") ?? undefined, true);
    };
    restore();
    window.addEventListener("popstate", restore);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [navigate]);
  function saved(task: TaskRecord, published: boolean) {
    dirty.current = false;
    if (published) {
      void navigate("detail", task.id);
      void loadCatalog().catch(() => {});
    } else {
      route.current = routeUrl("editor", task.id);
      history.replaceState(null, "", route.current);
    }
  }
  async function refreshActive() {
    if (!active) return;
    const data = await requestJson<{ task: TaskRecord }>(
      `/api/tasks/${active.id}`,
    );
    setActive(data.task);
    await loadCatalog();
  }
  const open = (id: string) => {
    void navigate("detail", id);
  };
  const create = () => {
    void navigate("editor");
  };
  const activeNav = view === "editor" ? "mine" : view === "detail" ? (active?.isOwner ? "mine" : "catalog") : view;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => navigate("catalog")}
          aria-label="AI Sana — каталог"
        >
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>
            AI Sana<span className="brand-caption">Практика со смыслом</span>
          </span>
        </button>
        <nav className="nav" aria-label="Основная навигация">
          {(
            [
              { key: "catalog", label: "Каталог задач", Icon: LayoutGrid },
              { key: "mine", label: "Мои задачи", Icon: BriefcaseBusiness },
              { key: "responses", label: "Мои отклики", Icon: Send },
            ] as const
          )
            .filter((item) => user || item.key === "catalog")
            .map(({ key, label, Icon }) => (
              <button
                key={key}
                className={
                  activeNav === key
                    ? "active"
                    : ""
                }
                aria-current={activeNav === key ? "page" : undefined}
                onClick={() => navigate(key)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
        </nav>
        <div className="account">
          {user ? (
            <>
              <span className="avatar" aria-hidden="true">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="account-name" title={user.email}>
                {user.name}
              </span>
              <a
                href={signOutHref}
                target="_top"
                aria-label="Выйти"
                onClick={(e) => {
                  if (dirty.current && !window.confirm("Уйти без сохранения?"))
                    e.preventDefault();
                }}
              >
                <LogOut size={17} />
              </a>
            </>
          ) : (
            <a className="sign-in" href={signInHref} target="_top">
              Войти <ArrowRight size={16} />
            </a>
          )}
        </div>
      </header>
      <main className="main" id="main">
        {error && (
          <div className="alert error" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Закрыть сообщение"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {loading && (!initialized || view !== "catalog") ? (
          <div className="loading-state" role="status">
            <span className="spinner" /> Загружаем…
          </div>
        ) : (
          <>
            {view === "catalog" && (
              <Catalog
                tasks={catalog}
                loading={loading}
                create={create}
                open={open}
                retry={() => navigate("catalog")}
              />
            )}
            {view === "mine" && (
              <>
                <div className="page-heading">
                  <div>
                    <h1>Мои задачи</h1>
                    <p>
                      От первого черновика до команды, готовой взяться за дело.
                    </p>
                  </div>
                  <button className="primary" onClick={create}>
                    <Plus size={18} /> Новая задача
                  </button>
                </div>
                {mine.length ? (
                  <TaskList tasks={mine} open={open} personal />
                ) : (
                  <Empty title="У вас есть задача. У студентов — идеи.">
                    <p>
                      Опишите потребность бизнеса. Мы поможем превратить её в
                      понятный бриф.
                    </p>
                    <button className="primary" onClick={create}>
                      <Plus size={17} /> Создать первую задачу
                    </button>
                  </Empty>
                )}
              </>
            )}
            {view === "responses" && (
              <MyResponses responses={responses} open={open} browse={() => navigate("catalog")} />
            )}
            {view === "editor" && (
              <Editor
                key={editorKey}
                task={active}
                onSaved={saved}
                onDirty={onDirty}
                back={() => navigate("mine")}
              />
            )}
            {view === "detail" && active && (
              <TaskDetail
                key={active.id}
                task={active}
                signedIn={!!user}
                signInHref={signInHref}
                back={() => navigate(active.isOwner ? "mine" : "catalog")}
                edit={() => navigate("editor", active.id)}
                refresh={refreshActive}
              />
            )}
          </>
        )}
      </main>
      <footer className="footer">
        <span>
          AI Sana <span className="footer-dot">·</span> Практика, которая решает
          задачи
        </span>
        <span>Бизнес формулирует. Студенты выбирают.</span>
      </footer>
    </div>
  );
}
