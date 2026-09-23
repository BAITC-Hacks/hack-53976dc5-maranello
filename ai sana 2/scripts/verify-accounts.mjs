import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { exampleTask } from '../lib/example.ts';
const [base, credentialFile] = process.argv.slice(2);
if (!base || !credentialFile) throw new Error('Usage: node scripts/verify-accounts.mjs BASE_URL PRIVATE_CREDENTIALS_JSON');
const credentials=JSON.parse(readFileSync(credentialFile,'utf8'));
const results=[];
async function call(path, cookie='', method='GET', body) {
  const response=await fetch(new URL(path,base),{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json',Origin:new URL(base).origin}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await response.json(); return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]??''};
}
const business=credentials.find(c=>c.username==='business'), student=credentials.find(c=>c.username==='student');
assert.equal((await call('/api/auth/login','','POST',{username:business.username,password:'incorrect-password'})).status,401);
results.push('wrong-password-rejected');
async function login(c) { const r=await call('/api/auth/login','','POST',{username:c.username,password:c.password});assert.equal(r.status,200,JSON.stringify(r.data));assert.ok(r.cookie);return r.cookie; }
const businessCookie=await login(business),studentCookie=await login(student);
assert.notEqual(businessCookie,studentCookie); results.push('two-independent-sessions');
const {id:_,ownerName,isOwner,status,qualityScore,selectedResponseId,createdAt,updatedAt,publishedAt,responseCount,...payload}=exampleTask;
payload.title='[ТЕСТ] Два аккаунта — полный сценарий AI Sana';
payload.organization='Учебная компания · проверка аккаунтов';
payload.summary='Тестовая задача, не реальный заказ. '+payload.summary;
const id=randomUUID();
const created=await call('/api/tasks',businessCookie,'POST',{...payload,id,action:'save'});
assert.equal(created.status,201,JSON.stringify(created.data));assert.equal(created.data.task.status,'draft');
assert.equal((await call(`/api/tasks/${id}`,studentCookie)).status,404);results.push('private-draft-hidden-from-student');
const restored=await call(`/api/tasks/${id}`,businessCookie);assert.equal(restored.data.task.title,payload.title);results.push('draft-persists-on-new-request');
assert.equal((await call('/api/tasks',studentCookie,'POST',{...payload,id:randomUUID(),action:'save'})).status,403);results.push('student-cannot-create-business-task');
const published=await call(`/api/tasks/${id}`,businessCookie,'PATCH',{...payload,action:'publish',expectedUpdatedAt:restored.data.task.updatedAt});
assert.equal(published.status,200,JSON.stringify(published.data));assert.equal(published.data.task.status,'published');
const shown=await call(`/api/tasks/${id}`,studentCookie);assert.equal(shown.data.task.status,'published');assert.equal(shown.data.task.isOwner,false);results.push('published-task-visible-to-student');
const proposal={teamName:'Тестовая команда AI Sana',teamMembers:'Тестовый участник 1\nТестовый участник 2\nТестовый участник 3',proposal:'Проверочный отклик, не реальное обязательство. Подготовим макет панели, импорт тестового CSV и список обращений. Проверим фильтрацию, смену статуса и сохранение данных после перезагрузки.'};
assert.equal((await call(`/api/tasks/${id}/responses`,businessCookie,'POST',proposal)).status,403);results.push('business-cannot-send-student-response');
const submitted=await call(`/api/tasks/${id}/responses`,studentCookie,'POST',proposal);assert.equal(submitted.status,201,JSON.stringify(submitted.data));
assert.equal((await call(`/api/tasks/${id}/responses`,studentCookie,'POST',proposal)).status,409);results.push('duplicate-response-rejected');
const studentResponses=await call(`/api/tasks/${id}/responses`,studentCookie);assert.equal(studentResponses.data.responses.length,1);
const responseId=studentResponses.data.responses[0].id;
const ownerResponses=await call(`/api/tasks/${id}/responses`,businessCookie);assert.equal(ownerResponses.data.responses[0].id,responseId);results.push('response-persists-for-both-accounts');
const denied=await call(`/api/responses/${responseId}`,studentCookie,'PATCH',{});assert.ok([403,409].includes(denied.status));results.push('student-cannot-select-team');
const chosen=await call(`/api/responses/${responseId}`,businessCookie,'PATCH',{});assert.equal(chosen.status,200,JSON.stringify(chosen.data));
for(const cookie of [businessCookie,studentCookie]) {const r=await call(`/api/tasks/${id}`,cookie);assert.equal(r.data.task.status,'selected');if(cookie===businessCookie)assert.equal(r.data.task.selectedResponseId,responseId);}
const my=await call('/api/responses',studentCookie);assert.equal(my.data.responses.find(r=>r.id===responseId).selected,true);results.push('selection-persists-for-both-accounts');
for(const cookie of [businessCookie,studentCookie]) {assert.equal((await call('/api/auth/logout',cookie,'POST',{})).status,200);assert.equal((await call('/api/tasks?mine=1',cookie)).status,401);}
results.push('logout-revokes-server-sessions');
console.log(JSON.stringify({passed:results.length,checks:results,taskUrl:new URL(`/?view=detail&task=${id}`,base).href},null,2));
