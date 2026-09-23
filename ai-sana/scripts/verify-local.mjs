import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
const origin = "http://localhost:5173";
const id = crypto.randomUUID();
const cookie = "__sites_local_auth=1";
const scratch = mkdtempSync(join(tmpdir(), "ai-sana-test-"));
function sql(statement) {
  const file = join(scratch, "fixture.sql");
  writeFileSync(file, statement);
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "dist/server/wrangler.json",
      "--persist-to",
      ".wrangler/state",
      "--file",
      file,
    ],
    { encoding: "utf8" },
  );
  if (run.status !== 0) throw new Error("Local fixture SQL failed");
}
async function call(
  path,
  method = "GET",
  body,
  authorized = true,
  headers = {},
) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      origin,
      ...(authorized ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { error: raw.slice(0, 100) };
  }
  return { status: response.status, ...data };
}
const brief = {
  organization: "Автотест · временная задача",
  title: "Панель для обработки обращений",
  summary:
    "Нужна панель обращений с фильтрами и назначением ответственных сотрудников.",
  problem:
    "Менеджеры вручную переносят обращения между несколькими таблицами, поэтому статусы теряются и клиентам отвечают с задержкой.",
  goal: "Все менеджеры видят актуальный статус обращения и ответственного, руководитель контролирует просроченные заявки.",
  context:
    "Есть тестовая таблица из пятидесяти обезличенных заявок с датами, категориями и ответственными.",
  audience: "Менеджеры клиентского сервиса и руководитель отдела поддержки.",
  deliverables:
    "Работающий прототип панели, исходный код и инструкция для повторного запуска.",
  constraints:
    "Использовать только обезличенные данные, интеграция с внешними CRM не требуется.",
  timeline: "Первый прототип нужен через три недели после старта.",
  acceptanceCriteria:
    "Импортируются все тестовые заявки, фильтры работают, изменения статуса сохраняются после перезагрузки.",
  skills: ["Веб-разработка", "UX/UI"],
};
try {
  assert.equal((await call("/api/tasks", "POST", { id }, false)).status, 401);
  assert.equal(
    (
      await call("/api/tasks", "POST", { id }, false, {
        "oai-authenticated-user-id": "forged",
        "oai-authenticated-user-email": "forged@example.test",
      })
    ).status,
    401,
  );
  let created = await call("/api/tasks", "POST", { ...brief, id });
  assert.equal(created.status, 201);
  assert.equal(created.task.status, "draft");
  assert.equal(
    (await call(`/api/tasks/${id}`, "GET", undefined, false)).status,
    404,
  );
  assert.equal(
    (await call("/api/tasks", "POST", { ...brief, id })).task.id,
    id,
  );
  const firstVersion = created.task.updatedAt;
  let published = await call(`/api/tasks/${id}`, "PATCH", {
    action: "publish",
    expectedUpdatedAt: firstVersion,
  });
  assert.equal(published.status, 200);
  assert.equal(published.task.qualityScore, 100);
  assert.equal(
    (
      await call(`/api/tasks/${id}`, "PATCH", {
        title: "Устаревшая версия",
        expectedUpdatedAt: firstVersion,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/api/tasks/${id}`,
        "PATCH",
        { expectedUpdatedAt: published.task.updatedAt },
        true,
        { origin: "https://other.test" },
      )
    ).status,
    403,
  );
  const owner = await call(`/api/tasks/${id}`);
  assert.equal(owner.task.isOwner, true);
  assert.equal("ownerEmail" in owner.task, false);
  const applicant = {
    teamName: "Тестовая команда",
    teamMembers: "Алия\nДанияр\nТимур",
    proposal:
      "Сначала изучим процесс, затем соберём прототип и проверим его на тестовых данных.",
  };
  assert.equal(
    (await call(`/api/tasks/${id}/responses`, "POST", applicant)).status,
    403,
  );
  sql(`UPDATE tasks SET owner_id='fixture-business' WHERE id='${id}';`);
  assert.equal(
    (
      await call(`/api/tasks/${id}`, "PATCH", {
        expectedUpdatedAt: published.task.updatedAt,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(`/api/tasks/${id}/responses`, "POST", {
        ...applicant,
        teamMembers: "Алия",
      })
    ).status,
    400,
  );
  const application = await call(
    `/api/tasks/${id}/responses`,
    "POST",
    applicant,
  );
  assert.equal(application.status, 201);
  assert.equal(
    (await call(`/api/tasks/${id}/responses`, "POST", applicant)).status,
    409,
  );
  assert.ok(
    (await call("/api/responses")).responses.some(
      (row) => row.id === application.id,
    ),
  );
  assert.equal(
    (await call(`/api/responses/${application.id}`, "PATCH", {})).status,
    409,
  );
  sql(`UPDATE tasks SET owner_id='local_seedy' WHERE id='${id}';`);
  assert.equal(
    (await call(`/api/responses/${application.id}`, "PATCH", {})).status,
    200,
  );
  assert.equal(
    (await call(`/api/responses/${application.id}`, "PATCH", {})).status,
    409,
  );
  assert.equal(
    (
      await call(`/api/tasks/${id}`, "PATCH", {
        expectedUpdatedAt: published.task.updatedAt,
      })
    ).status,
    409,
  );
  sql(`UPDATE tasks SET owner_id='fixture-business' WHERE id='${id}';`);
  assert.equal(
    (await call(`/api/tasks/${id}/responses`, "POST", applicant)).status,
    409,
  );
  assert.equal(
    (await call("/api/responses")).responses.find(
      (row) => row.id === application.id,
    ).selected,
    true,
  );
  const configuration = await call("/api/assistant");
  if (!configuration.configured)
    assert.equal(
      (
        await call("/api/assistant", "POST", {
          description: brief.problem,
          draft: {},
        })
      ).status,
      503,
    );
  console.log(
    "PASS: draft → publish → response → selection; access isolation, duplicate response, stale update, closed task, AI fallback. No live GPT calls.",
  );
} finally {
  sql(
    `DELETE FROM responses WHERE task_id='${id}'; DELETE FROM tasks WHERE id='${id}';`,
  );
  if (dirname(resolve(scratch)) !== resolve(tmpdir()) || !basename(scratch).startsWith("ai-sana-test-")) throw new Error("Unsafe temporary cleanup path");
  rmSync(scratch, { recursive: true, force: true });
}
