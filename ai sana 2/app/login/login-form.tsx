"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Users, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { requestJson } from "@/lib/client";

export default function LoginForm() {
  const [username,setUsername] = useState("business");
  const [password,setPassword] = useState("");
  const [visible,setVisible] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  function destination() {
    const next = new URLSearchParams(location.search).get("returnTo");
    return next === "/" || next?.startsWith("/?") ? next : "/";
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await requestJson("/api/auth/login",{method:"POST",body:JSON.stringify({username,password})}); location.assign(destination()); }
    catch(cause) { setError((cause as Error).message); setBusy(false); }
  }
  async function chatgpt() {
    setBusy(true); setError("");
    try { await requestJson("/api/auth/chatgpt",{method:"POST",body:"{}"}); location.assign(`/signin-with-chatgpt?return_to=${encodeURIComponent(destination())}`); }
    catch(cause) { setError((cause as Error).message); setBusy(false); }
  }
  return <main className="login-page">
    <a className="back" href="/"><ArrowLeft size={17}/> В каталог задач</a>
    <div className="login-layout">
      <section className="login-intro">
        <a href="/" className="brand login-brand"><span className="brand-mark" aria-hidden="true">S</span>AI Sana</a>
        <h1>Одна задача.<br/>{" "}Две стороны.<br/>{" "}Общий результат.</h1>
        <p>Бизнес формулирует задачу. Студенты предлагают решение. Начните со своего аккаунта.</p>
        <div className="login-roles">
          <div><BriefcaseBusiness size={22}/><p><strong>Для бизнеса</strong>Создавайте задачи, улучшайте бриф и выбирайте команду.</p></div>
          <div><Users size={22}/><p><strong>Для студентов</strong>Находите интересные проекты и отправляйте предложения.</p></div>
        </div>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <h2 id="login-title">Вход в AI Sana</h2>
        <p>Два отдельных тестовых аккаунта для проверки MVP. Аккаунт ChatGPT не нужен.</p>
        <form onSubmit={submit}>
          <fieldset className="login-account-choice" disabled={busy}>
            <legend>Выберите аккаунт</legend>
            <div>{[{id:"business",label:"Бизнес",Icon:BriefcaseBusiness},{id:"student",label:"Студент",Icon:Users}].map(({id,label,Icon})=><button key={id} type="button" aria-pressed={username===id} className={username===id?"selected":""} onClick={()=>{setUsername(id);setPassword("");setError("");}}><Icon size={20}/>{label}</button>)}</div>
          </fieldset>
          <label className="field"><span>Логин</span><input name="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required maxLength={80} disabled={busy}/></label>
          <label className="field"><span>Пароль</span><div className="password-field"><input name="password" type={visible?"text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={256} disabled={busy} aria-describedby={error?"login-error":"password-help"}/><button type="button" className="icon-button" onClick={()=>setVisible(!visible)} aria-label={visible?"Скрыть пароль":"Показать пароль"}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></div><small id="password-help">Используйте пароль, выданный для этого тестового аккаунта.</small></label>
          {error && <div id="login-error" className="alert error" role="alert">{error}</div>}
          <button className="primary full" disabled={busy}>{busy?<><span className="spinner"/>Входим…</>:<>Войти в аккаунт<ArrowRight size={18}/></>}</button>
        </form>
        <p className="login-session-note"><LockKeyhole size={16}/>Вход сохраняется на 8 часов. Выйдите из аккаунта, если устройство общее.</p>
        <div className="login-alternative"><span>Уже работали через ChatGPT?</span><button className="text-button" disabled={busy} onClick={chatgpt}>Продолжить с ChatGPT <ArrowRight size={16}/></button></div>
      </section>
    </div>
  </main>;
}
