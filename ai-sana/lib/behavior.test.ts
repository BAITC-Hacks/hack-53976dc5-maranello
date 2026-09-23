import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTaskQuality } from "./quality.ts";
import {
  responsePayloadSchema,
  taskPayloadSchema,
  validatePublication,
} from "./task-payload.ts";
import { suggestBrief } from "./assistant.ts";
import { readBody } from "./api.ts";

test("повторы и заглушки не дают высокий рейтинг", () => {
  assert.equal(
    evaluateTaskQuality({ problem: "тест", goal: "аааааааааааааааа" }).score,
    0,
  );
  const repeated =
    "Нужно создать приложение для обработки обращений пользователей и контроля результата работы менеджера.";
  const q = evaluateTaskQuality({
    problem: repeated,
    goal: repeated,
    acceptanceCriteria: repeated,
  });
  assert.ok(
    q.criteria
      .filter((item) =>
        ["problem", "goal", "acceptanceCriteria"].includes(item.key),
      )
      .every((item) => item.earned < item.points),
  );
});
test("пустой и поверхностный бриф нельзя публиковать", () => {
  assert.throws(
    () =>
      validatePublication(
        taskPayloadSchema.parse({
          title: "MVP",
          summary: "Нужен MVP",
          problem: "тест",
          goal: "test",
        }),
      ),
    /Уточните/,
  );
});
test("в команде от 3 до 5 разных участников", () => {
  const base = {
    teamName: "Команда",
    proposal:
      "Мы начнём с исследования процесса и подготовим работающий прототип для проверки.",
  };
  assert.equal(
    responsePayloadSchema.safeParse({
      ...base,
      teamMembers: "Алия\nДанияр\nТимур",
    }).success,
    true,
  );
  for (const members of [
    "Алия, Данияр",
    "Алия, Алия, Тимур",
    "А, Б, В, Г, Д, Е",
  ])
    assert.equal(
      responsePayloadSchema.safeParse({ ...base, teamMembers: members })
        .success,
      false,
    );
});
test("сервер отклоняет некорректный JSON и чужой origin", async () => {
  await assert.rejects(
    readBody(
      new Request("http://localhost/api", { method: "POST", body: "{" }),
    ),
    /прочитать/,
  );
  await assert.rejects(
    readBody(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { origin: "https://other.test" },
        body: "{}",
      }),
    ),
    /приложения/,
  );
});
test("GPT вызывается со строгой схемой, без сохранения, результат проверяется", async () => {
  const draft = taskPayloadSchema.parse({});
  const expected = {
    task: { ...draft, title: "Панель обработки заявок" },
    questions: [{ field: "timeline", question: "Когда нужен прототип?" }],
    note: "Уточните срок.",
  };
  const fetcher: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    return Response.json({
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: JSON.stringify(expected) }] },
      ],
    });
  };
  assert.deepEqual(
    await suggestBrief(
      "test-key",
      "test-model",
      "Описание бизнес-задачи",
      draft,
      fetcher,
    ),
    expected,
  );
});
test("GPT отказ, неверная схема и лимиты превращаются в понятную ошибку", async () => {
  const draft = taskPayloadSchema.parse({});
  for (const response of [
    Response.json({ output: [] }),
    Response.json({
      output: [{ content: [{ type: "output_text", text: '{"task":false}' }] }],
    }),
    new Response("rate limit", { status: 429 }),
  ]) {
    await assert.rejects(
      suggestBrief(
        "test-key",
        "test-model",
        "Описание задачи",
        draft,
        async () => response,
      ),
    );
  }
});
