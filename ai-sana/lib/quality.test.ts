import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTaskQuality } from "./quality.ts";

test("пустой черновик получает ноль и конкретные подсказки", () => {
  const result = evaluateTaskQuality({});
  assert.equal(result.score, 0);
  assert.equal(result.level, "draft");
  assert.equal(result.nextSteps.length, 3);
});

test("заполненная карточка получает максимум", () => {
  const result = evaluateTaskQuality({
    title: "Аналитическая панель для заявок клиентов",
    summary:
      "Создать панель, которая показывает этапы обработки заявок и помогает менеджерам быстрее замечать задержки.",
    problem:
      "Менеджеры ведут заявки в нескольких таблицах. Руководитель не видит, сколько заявок зависло на каждом этапе и где возникает задержка.",
    goal: "Руководитель видит актуальный статус каждой заявки и причины задержек в одном интерфейсе.",
    context:
      "Сейчас отдел использует общую таблицу на 12 колонок; новые заявки появляются ежедневно.",
    audience:
      "Руководитель отдела продаж и пять менеджеров по работе с клиентами.",
    deliverables:
      "Рабочая панель, описание структуры данных и короткая инструкция для сотрудников.",
    constraints:
      "Персональные данные клиентов нельзя публиковать; для демо использовать обезличенный набор.",
    timeline: "Демонстрация через четыре недели.",
    acceptanceCriteria:
      "Панель показывает число заявок по этапам и позволяет за два клика открыть список задержанных заявок.",
    skills: ["Веб-разработка", "Аналитика"],
  });
  assert.equal(result.score, 100);
  assert.equal(result.level, "strong");
  assert.deepEqual(result.nextSteps, []);
});

test("пробелы и повторённые навыки не повышают оценку", () => {
  const result = evaluateTaskQuality({
    title: "   ",
    skills: ["Аналитика", " аналитика "],
  });
  assert.equal(result.score, 3);
});
