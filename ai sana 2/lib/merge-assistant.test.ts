import test from "node:test";
import assert from "node:assert/strict";
import { mergeAssistantDraft } from "./merge-assistant.ts";
import { exampleTask } from "./example.ts";
import { emptyTask } from "./fields.ts";
import { evaluateTaskQuality } from "./quality.ts";

test("AI preview and applied draft preserve business facts and use the same score", () => {
  const current = { ...emptyTask, title: "Мой проверенный заголовок", timeline: "Срок согласуем с командой", skills: ["SQL"] };
  const merged = mergeAssistantDraft(current, exampleTask);
  assert.equal(merged.title, current.title);
  assert.equal(merged.timeline, current.timeline);
  assert.deepEqual(merged.skills, ["SQL"]);
  assert.equal(merged.problem, exampleTask.problem);
  assert.ok(evaluateTaskQuality(merged).score > evaluateTaskQuality(current).score);
  assert.equal(current.problem, "");
});
