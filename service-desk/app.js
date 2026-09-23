import {MANAGERS,STATUSES,isActive,isOverdue,importCSV,exportCSV,mergeRecords,selectRecords} from './core.js';
const $ = id => document.getElementById(id);
const KEY = 'maranello.service-desk.v1';
let records = [], view = 'all';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const managers = () => [...new Set([...MANAGERS,...records.map(r=>r.assignee)])];
const options = (items, selected) => items.map(x=>`<option ${x===selected?'selected':''} value="${escape(x)}">${escape(x)}</option>`).join('');
function notice(message, error=false) { $('notice').textContent=message; $('notice').className=error?'error':''; $('notice').hidden=false; }
function save(next) {
  try { localStorage.setItem(KEY,JSON.stringify(next)); records=next; $('save-state').textContent='Сохранено в этом браузере'; return true; }
  catch { notice('Не удалось сохранить изменения. Проверьте свободное место и разрешения браузера. Данные не изменены.',true); return false; }
}
function updateRecord(id, changes) {
  if(!records.some(r=>r.id===id)) throw new Error('Заявка не найдена.');
  if(changes.status && !STATUSES.includes(changes.status)) throw new Error('Недопустимый статус.');
  if(changes.assignee && !managers().includes(changes.assignee)) throw new Error('Неизвестный ответственный.');
  if(!save(records.map(r=>r.id===id?{...r,...changes}:r))) throw new Error('Сохранение недоступно.');
  render();
  return records.find(r=>r.id===id);
}
function render() {
  const now = new Date();
  $('nav-count').textContent=records.length;
  $('active-count').textContent=records.filter(isActive).length;
  $('overdue-count').textContent=records.filter(r=>isOverdue(r,now)).length;
  $('new-count').textContent=records.filter(r=>r.status==='Новая').length;
  $('done-count').textContent=records.filter(r=>r.status==='Решена').length;
  const filter = $('manager-filter').value;
  $('manager-filter').innerHTML='<option value="">Все ответственные</option>'+options(managers(),filter);
  $('team').innerHTML=managers().map((name,i)=>{
    const active=records.filter(r=>r.assignee===name&&isActive(r));
    const late=active.filter(r=>isOverdue(r,now)).length;
    return `<div class="team-member"><span class="avatar">${escape(name.split(' ').map(x=>x[0]).join('').slice(0,2))}</span><div><div class="team-name">${escape(name)}</div><div class="team-detail">${active.length} в работе · ${late} просрочено</div></div><div class="workload" aria-hidden="true"><span style="width:${Math.min(100,active.length/Math.max(1,records.filter(isActive).length)*100)}%"></span></div></div>`;
  }).join('');
  const rows=selectRecords(records,{view,search:$('search').value,manager:$('manager-filter').value,status:$('status-filter').value},now);
  $('result-count').textContent=`${rows.length} из ${records.length}`;
  $('empty').hidden=rows.length>0;
  $('rows').innerHTML=rows.map(r=>{
    const late=isOverdue(r,now), due=new Date(r.due);
    const statusClass=['new','progress','done','cancelled'][STATUSES.indexOf(r.status)];
    const date=due.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+' · '+due.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
    return `<tr class="${late?'late':''}"><td><div class="ticket-id">#${escape(r.id)}</div><div class="ticket-title">${escape(r.title)}</div></td><td class="category">${escape(r.category)}</td><td><select class="row-select" data-id="${escape(r.id)}" data-field="assignee" aria-label="Ответственный ${escape(r.id)}">${options(managers(),r.assignee)}</select></td><td><select class="row-select status-select status-${statusClass}" data-id="${escape(r.id)}" data-field="status" aria-label="Статус ${escape(r.id)}">${options(STATUSES,r.status)}</select></td><td class="due">${escape(date)}<small>${late?'Просрочена':isActive(r)?'Ожидает ответа':'Закрыта'}</small></td></tr>`;
  }).join('');
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
}
$('today').textContent=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
$('status-filter').innerHTML+=options(STATUSES,'');
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;render();}));
['search','manager-filter','status-filter'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
$('clear-filters').onclick=()=>{view='all';['search','manager-filter','status-filter'].forEach(id=>$(id).value='');render();};
$('rows').addEventListener('change',event=>{
  const select=event.target;
  if(!select.dataset.id)return;
  try { updateRecord(select.dataset.id,{[select.dataset.field]:select.value}); notice('Изменения сохранены.'); }
  catch(error) { notice(error.message,true); render(); }
});
$('import').onclick=()=>{ $('import-error').textContent=''; $('import-dialog').showModal(); };
$('close-import').onclick=$('cancel-import').onclick=()=>$('import-dialog').close();
$('import-form').onsubmit=async event=>{
  event.preventDefault(); const file=$('csv-file').files[0]; if(!file)return;
  try {
    if(file.size>2_000_000)throw new Error('Максимальный размер файла — 2 МБ.');
    const incoming=importCSV(await file.text());
    const added=incoming.filter(r=>!records.some(old=>old.id===r.id)).length;
    if(!save(mergeRecords(records,incoming)))return;
    $('import-dialog').close(); $('import-form').reset(); render();
    notice(`Импортировано: ${incoming.length}. Добавлено: ${added}, обновлено: ${incoming.length-added}.`);
  }catch(error){$('import-error').textContent=error.message;}
};
$('export').onclick=()=>{
  const url=URL.createObjectURL(new Blob([exportCSV(records)],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='service-desk-export.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
try {
  const stored=localStorage.getItem(KEY);
  if(stored!==null){
    const parsed=JSON.parse(stored);
    if(!Array.isArray(parsed))throw new Error('Хранилище повреждено.');
    records=parsed.length?importCSV(exportCSV(parsed)):[];
  } else {
    const response=await fetch('./example.csv');
    if(!response.ok)throw new Error('Пример CSV не загрузился.');
    const demo=importCSV(await response.text());
    if(save(demo))notice('Загружены 50 учебных заявок. Все данные обезличены.');
  }
}catch(error){notice(`Не удалось загрузить данные: ${error.message} Сохранённая копия не перезаписана. Можно импортировать CSV.`,true);}
render();
setInterval(render,60000);
window.addEventListener('storage',event=>{
  if(event.key!==KEY)return;
  try {const parsed=JSON.parse(event.newValue||'[]'); records=parsed.length?importCSV(exportCSV(parsed)):[];render();}catch{notice('Не удалось прочитать обновление из другой вкладки.',true);}
});
if(document.modelContext?.registerTool){
  const tools=[
    {name:'list_requests',description:'Прочитать заявки и их сроки, статусы и ответственных.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({requests:records})},
    {name:'update_request',description:'Сохранить новый статус и/или ответственного существующей заявки.',inputSchema:{type:'object',properties:{id:{type:'string'},status:{type:'string',enum:STATUSES},assignee:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>{
      if(!input||typeof input.id!=='string'||Object.keys(input).some(k=>!['id','status','assignee'].includes(k)))throw new Error('Некорректные параметры.');
      const changes={};if(input.status!==undefined){if(!STATUSES.includes(input.status))throw new Error('Недопустимый статус.');changes.status=input.status;}
      if(input.assignee!==undefined){if(!managers().includes(input.assignee))throw new Error('Неизвестный ответственный.');changes.assignee=input.assignee;}
      if(!Object.keys(changes).length)throw new Error('Укажите статус или ответственного.');
      return updateRecord(input.id,changes);
    }}
  ];
  for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch{}}
}
