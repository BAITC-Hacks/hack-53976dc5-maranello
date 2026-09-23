import { z } from "zod";
import type { TaskDraft } from "./quality";
import { evaluateTaskQuality } from "./quality.ts";
import { HttpError } from "./api.ts";

const text = (maximum: number) => z.string().trim().max(maximum);

export const taskPayloadSchema = z.object({
  organization: text(120).default(""),
  title: text(140).default(""),
  summary: text(400).default(""),
  problem: text(2000).default(""),
  goal: text(1200).default(""),
  context: text(1200).default(""),
  audience: text(600).default(""),
  deliverables: text(1200).default(""),
  constraints: text(1000).default(""),
  timeline: text(400).default(""),
  acceptanceCriteria: text(1200).default(""),
  skills: z
    .array(text(50).min(2))
    .max(10)
    .default([])
    .transform((values) => [
      ...new Map(
        values.map((value) => [value.toLocaleLowerCase("ru"), value]),
      ).values(),
    ]),
});

export type TaskPayload = z.infer<typeof taskPayloadSchema>;

export function validatePublication(payload: TaskPayload) {
  const quality = evaluateTaskQuality(payload);
  const missing = quality.criteria.filter(
    (item) =>
      ["title", "summary", "problem", "goal"].includes(item.key) &&
      item.earned < item.points,
  );
  if (missing.length)
    throw new HttpError(
      400,
      `Уточните обязательные поля: ${missing.map((item) => item.label.toLowerCase()).join(", ")}. Подсказки есть в оценке качества.`,
    );
}

export function toDraft(payload: TaskPayload): TaskDraft {
  return payload;
}

export const responsePayloadSchema = z.object({
  teamName: text(120).min(2, "Укажите название команды"),
  teamMembers: text(500)
    .min(3)
    .refine((value) => {
      const names = value
        .split(/[,;\n]+/)
        .map((name) => name.trim())
        .filter(Boolean);
      return (
        names.length >= 3 &&
        names.length <= 5 &&
        new Set(names.map((name) => name.toLocaleLowerCase())).size ===
          names.length
      );
    }, "Укажите 3–5 разных участников, по одному на строке"),
  proposal: text(2000).min(40, "Добавьте план работы — минимум 40 символов"),
});
