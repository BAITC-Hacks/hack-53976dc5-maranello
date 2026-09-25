// Generate anonymized files for the manual browser checklist in QA-STAGE-02.md.
// Usage: node qa-stage-02-fixtures.mjs [output-directory]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const output = path.resolve(process.argv[2] || '.qa-stage-02');
await mkdir(output, { recursive: true });
const header = 'id,date,title,category,assignee,status,due\n';
const valid = header +
  'SD-001,2026-09-23T09:00,QA: обновлённая заявка,Проверка,Менеджер В,В работе,2026-09-24T18:00\n' +
  'QA-UI-001,2026-09-23T09:00,QA: новая заявка,Проверка,QA Менеджер,Новая,2026-09-24T18:00\n';
const fixtures = {
  'valid.csv': valid,
  // First row is valid but must not be partially imported when the second fails.
  'invalid-status.csv': header +
    'SD-001,2026-09-23T09:00,НЕ ДОЛЖНО СОХРАНИТЬСЯ,Проверка,Менеджер А,Решена,2026-09-24T18:00\n' +
    'QA-BAD,2026-09-23T09:00,Некорректная строка,Проверка,Менеджер А,UNKNOWN,2026-09-24T18:00\n',
  'duplicate-id.csv': header + valid.slice(header.length).replace('QA-UI-001','SD-001'),
  'missing-header.csv': 'id,date,title,category,assignee\nQA-MISSING,2026-09-23,Нет статуса,Проверка,Менеджер А\n',
  'broken-quotes.csv': header + 'QA-QUOTE,2026-09-23,"Не закрытая кавычка,Проверка,Менеджер А,Новая,2026-09-24\n',
  'oversize.csv': header + 'x'.repeat(2_000_001),
  'literal-text.csv': header + 'QA-TEXT,2026-09-23T09:00,<b>QA literal text</b>,Проверка,QA Менеджер,Новая,2026-09-24T18:00\n',
  'formula-like.csv': header + '=QA-FORMULA,2026-09-23T09:00,=1+1,Проверка,QA Менеджер,Новая,2026-09-24T18:00\n',
};
for(const [name, content] of Object.entries(fixtures)) {
  await writeFile(path.join(output,name),content,'utf8');
  console.log(`${name}: ${Buffer.byteLength(content,'utf8')} bytes`);
}
console.log(`Fixtures: ${output}`);
