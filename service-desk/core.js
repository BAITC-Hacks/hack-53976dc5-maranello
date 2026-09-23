export const MANAGERS = ['Менеджер А', 'Менеджер Б', 'Менеджер В'];
export const STATUSES = ['Новая', 'В работе', 'Решена', 'Отменена'];
export const isActive = r => !['Решена', 'Отменена'].includes(r.status);
export const isOverdue = (r, now = new Date()) => isActive(r) && new Date(r.due) < now;
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0];
  const delimiter = first.includes(';') ? ';' : ',';
  const rows = []; let row = [], value = '', quoted = false, closed = false;
  const field = () => { row.push(value.trim()); value = ''; closed = false; };
  const line = () => { field(); if (row.some(Boolean)) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i+1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else value += c;
    } else if (c === delimiter) field();
    else if (c === '\n' || c === '\r') { if(c === '\r' && text[i+1] === '\n') i++; line(); }
    else if (c === '"' && !value && !closed) quoted = true;
    else if (closed && c.trim()) throw new Error('Недопустимый символ после кавычек.');
    else if (c === '"') throw new Error('Кавычки внутри поля нужно удвоить.');
    else value += c;
  }
  if (quoted) throw new Error('В CSV не закрыты кавычки.');
  if(value || row.length || closed) line();
  return rows;
}
export function localDate(value, name) {
  if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(value)) throw new Error(`${name}: используйте ГГГГ-ММ-ДД или ГГГГ-ММ-ДДTЧЧ:ММ.`);
  const d = new Date(value.length === 10 ? value + 'T00:00' : value);
  const [year, month, day] = value.slice(0,10).split('-').map(Number);
  if(!Number.isFinite(+d) || d.getFullYear() !== year || d.getMonth()+1 !== month || d.getDate() !== day) throw new Error(`${name}: некорректная дата.`);
  return d;
}
export function dateString(d) {
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function importCSV(text) {
  const rows = parseCSV(text); if(rows.length < 2) throw new Error('Файл пуст или не содержит заявок.');
  const aliases = { 'номер':'id', 'дата':'date', 'тема':'title', 'категория':'category', 'ответственный':'assignee', 'статус':'status', 'срок ответа':'due' };
  const headers = rows.shift().map(h => aliases[h.toLowerCase()] || h.toLowerCase());
  if(new Set(headers).size !== headers.length) throw new Error('Заголовки столбцов не должны повторяться.');
  for(const key of ['date','category','assignee','status']) if(!headers.includes(key)) throw new Error(`Не найден обязательный столбец: ${key}.`);
  const ids = new Set();
  return rows.map((values, index) => {
    try {
      if(values.length !== headers.length) throw new Error('Количество полей не совпадает с заголовком.');
      const r = Object.fromEntries(headers.map((h,i) => [h,values[i]]));
      const created = localDate(r.date,'Дата');
      if(!r.category || r.category.length > 120) throw new Error('Категория обязательна, не более 120 символов.');
      if(!r.assignee || r.assignee.length > 120) throw new Error('Ответственный обязателен, не более 120 символов.');
      if(!STATUSES.includes(r.status)) throw new Error(`Статус должен быть одним из: ${STATUSES.join(', ')}.`);
      if(!r.due) { const d = new Date(created); d.setDate(d.getDate()+1); d.setHours(18,0,0,0); r.due = dateString(d); }
      const due = localDate(r.due,'Срок ответа');
      if(due < created) throw new Error('Срок ответа раньше даты заявки.');
      const id = r.id || `CSV-${r.date.replace(/\D/g,'')}-${index+1}`;
      if(id.length > 80 || ids.has(id)) throw new Error('Номер повторяется или длиннее 80 символов.');
      ids.add(id);
      const title = r.title || `${r.category} · обращение ${index+1}`;
      if(title.length > 300) throw new Error('Тема длиннее 300 символов.');
      return {id,date:dateString(created),title,category:r.category,assignee:r.assignee,status:r.status,due:dateString(due)};
    } catch(error) { throw new Error(`Строка ${index+2}: ${error.message}`); }
  });
}
export function mergeRecords(current, incoming) {
  const map = new Map(current.map(r=>[r.id,r])); incoming.forEach(r=>map.set(r.id,r)); return [...map.values()];
}
export function exportCSV(records) {
  const keys = ['id','date','title','category','assignee','status','due'];
  const safe = value => '"' + String(value).replace(/^[=+@\-\t\r]/, m => "'"+m).replaceAll('"','""') + '"';
  return '\uFEFF' + [keys.join(','), ...records.map(r=>keys.map(k=>safe(r[k])).join(','))].join('\r\n');
}
export function selectRecords(records, {view='all',search='',manager='',status=''}={}, now=new Date()) {
  const query = search.toLocaleLowerCase('ru');
  return records.filter(r => (view !== 'active' || isActive(r)) && (view !== 'overdue' || isOverdue(r,now)) && (!manager || r.assignee===manager) && (!status || r.status===status) && `${r.id} ${r.title} ${r.category}`.toLocaleLowerCase('ru').includes(query)).sort((a,b)=>Number(isActive(b))-Number(isActive(a)) || new Date(a.due)-new Date(b.due) || a.id.localeCompare(b.id));
}
