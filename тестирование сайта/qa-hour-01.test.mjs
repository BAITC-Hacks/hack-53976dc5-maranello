import test from 'node:test';
import assert from 'node:assert/strict';
import { importCSV, exportCSV, isOverdue, selectRecords, mergeRecords } from '../service-desk/core.js';

const header = 'id,date,title,category,assignee,status,due';
const base = {id:'QA-001',date:'2026-09-23T09:00',title:'Проверка ремонта',category:'Ремонт',assignee:'Менеджер А',status:'Новая',due:'2026-09-23T12:00'};
// CSV fixtures are authored independently of the production exporter.
const csv = (overrides={}) => header+'\n'+Object.values({...base,...overrides}).join(',');

test('QA-01: empty file and header-only file are rejected',()=>{
  for(const text of ['', '\uFEFF\r\n', header])assert.throws(()=>importCSV(text),/Файл пуст/);
});
test('QA-02: every mandatory header is required',()=>{
  for(const missing of ['date','category','assignee','status']){
    const fields=Object.keys(base).filter(k=>k!==missing);
    assert.throws(()=>importCSV(fields.join(',')+'\n'+fields.map(k=>base[k]).join(',')),new RegExp(missing));
  }
});
test('QA-03: duplicate headers, including Russian aliases, are rejected',()=>{
  assert.throws(()=>importCSV(csv().replace('id,date','дата,date')),/Заголовки/);
});
test('QA-04: too few and too many fields identify the invalid row',()=>{
  assert.throws(()=>importCSV(csv()+',extra'),/Строка 2: Количество полей/);
  assert.throws(()=>importCSV(header+'\nQA-001,2026-09-23'),/Строка 2: Количество полей/);
});
test('QA-05: empty category and manager are rejected',()=>{
  assert.throws(()=>importCSV(csv({category:''})),/Категория обязательна/);
  assert.throws(()=>importCSV(csv({assignee:''})),/Ответственный обязателен/);
});
test('QA-06: text length limits accept boundary and reject overflow',()=>{
  for(const [field,limit] of [['id',80],['title',300],['category',120],['assignee',120]]){
    assert.equal(importCSV(csv({[field]:'x'.repeat(limit)}))[0][field].length,limit);
    assert.throws(()=>importCSV(csv({[field]:'x'.repeat(limit+1)})),/Строка 2:/);
  }
});
test('QA-07: impossible dates and times are rejected',()=>{
  for(const date of ['2026-02-29','2026-04-31','2026-13-01','2026-09-23T25:00','2026-09-23T10:60']){
    assert.throws(()=>importCSV(csv({date})),/Строка 2:/);
  }
});
test('QA-08: leap day and next-day deadline cross month/year correctly',()=>{
  for(const [date,expected] of [['2024-02-29','2024-03-01T18:00'],['2026-12-31','2027-01-01T18:00']]){
    assert.equal(importCSV(csv({date,due:''}))[0].due,expected);
  }
});
test('QA-09: deadline before creation is rejected; equal deadline is accepted',()=>{
  assert.throws(()=>importCSV(csv({due:'2026-09-23T08:59'})),/Срок ответа раньше/);
  assert.equal(importCSV(csv({due:base.date}))[0].due,base.date);
});
test('QA-10: deadline becomes overdue strictly after its boundary',()=>{
  const due=new Date(base.due);
  assert.equal(isOverdue(base,new Date(+due-1)),false);
  assert.equal(isOverdue(base,due),false);
  assert.equal(isOverdue(base,new Date(+due+1)),true);
});
test('QA-11: resolved and cancelled records never enter overdue results',()=>{
  const records=['Новая','В работе','Решена','Отменена'].map((status,i)=>({...base,id:String(i),status}));
  assert.deepEqual(selectRecords(records,{view:'overdue'},new Date('2026-09-24T12:00')).map(r=>r.status),['Новая','В работе']);
});
test('QA-12: Cyrillic case-insensitive search and combined filters',()=>{
  const records=[base,{...base,id:'QA-002',assignee:'Менеджер Б'},{...base,id:'QA-003',status:'Решена'}];
  assert.deepEqual(selectRecords(records,{view:'active',search:'ПРОВЕРКА',manager:'Менеджер А',status:'Новая'}).map(r=>r.id),['QA-001']);
  assert.equal(selectRecords(records,{search:'нет такой заявки'}).length,0);
});
test('QA-13: active records sort before closed; inputs remain unchanged',()=>{
  const records=[{...base,id:'closed',status:'Решена',due:'2026-09-20T12:00'},{...base,id:'later',due:'2026-09-25T12:00'},base];
  const snapshot=structuredClone(records);
  assert.deepEqual(selectRecords(records).map(r=>r.id),['QA-001','later','closed']);
  assert.deepEqual(records,snapshot);
});
test('QA-14: merge inserts new ids, updates matching ids and preserves sources',()=>{
  const current=[base];const incoming=[{...base,status:'В работе'},{...base,id:'QA-002'}];
  const snapshot=structuredClone({current,incoming});const result=mergeRecords(current,incoming);
  assert.equal(result.length,2);assert.equal(result[0].status,'В работе');
  assert.deepEqual({current,incoming},snapshot);
});
test('QA-15: valid rows followed by invalid row do not modify existing records',()=>{
  let current=[structuredClone(base)];const snapshot=structuredClone(current);
  const input=csv({id:'QA-002'})+'\n'+Object.values({...base,id:'QA-003',status:'BAD'}).join(',');
  assert.throws(()=>{current=mergeRecords(current,importCSV(input));},/Строка 3:/);
  assert.deepEqual(current,snapshot);
});
test('QA-16: semicolon CSV with reordered Russian headers is accepted',()=>{
  const [r]=importCSV('\uFEFFстатус;ответственный;категория;дата;тема\r\nНовая;Менеджер А;Ремонт;2026-09-23;"Ремонт; проверка"\r\n');
  assert.equal(r.title,'Ремонт; проверка');assert.equal(r.due,'2026-09-24T18:00');
});
test('QA-17: formula-like values are escaped in exported spreadsheet cells',()=>{
  for(const title of ['=1+1','+1+1','-1+1','@SUM(A1:A2)']){
    assert.ok(exportCSV([{...base,title}]).includes('"\''+title+'"'));
  }
});
test('QA-18: quotes and multiline descriptions survive import/export',()=>{
  const title='Проверить "датчик", затем\nпозвонить';
  const [r]=importCSV(exportCSV([{...base,title}]));assert.equal(r.title,title);
});
