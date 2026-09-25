// Reproduction suite: intentionally RED until the documented defects are fixed.
// Run separately: node --test qa-known-bugs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {importCSV,isOverdue} from './core.js';

test('BUG-001: accepted seconds must not make a deadline overdue early',()=>{
  const [record]=importCSV('id,date,title,category,assignee,status,due\nQA-SECONDS,2026-09-23T09:00:00,Проверка,Ремонт,Менеджер А,Новая,2026-09-23T12:00:30');
  // The actual deadline is 12:00:30, so at 12:00:15 it is still in the future.
  assert.equal(isOverdue(record,new Date('2026-09-23T12:00:15')),false,
    `Deadline was truncated during import to ${record.due}`);
});
