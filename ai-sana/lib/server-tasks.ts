import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import type { TaskPayload } from "./task-payload";
import { evaluateTaskQuality } from "./quality";

export type TaskRow = typeof tasks.$inferSelect;

export function taskData(task: TaskRow, viewerId?: string) {
  return {
    id: task.id,
    organization: task.organization,
    ownerName: task.ownerName,
    status: task.status,
    title: task.title,
    summary: task.summary,
    problem: task.problem,
    goal: task.goal,
    context: task.context,
    audience: task.audience,
    deliverables: task.deliverables,
    constraints: task.constraints,
    timeline: task.timeline,
    acceptanceCriteria: task.acceptanceCriteria,
    skills: parseSkills(task.skillsJson),
    qualityScore: evaluateTaskQuality(payloadFromTask(task)).score,
    selectedResponseId:
      viewerId === task.ownerId ? task.selectedResponseId : null,
    isOwner: viewerId === task.ownerId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    publishedAt: task.publishedAt,
  };
}

export function payloadFromTask(task: TaskRow): TaskPayload {
  return {
    organization: task.organization,
    title: task.title,
    summary: task.summary,
    problem: task.problem,
    goal: task.goal,
    context: task.context,
    audience: task.audience,
    deliverables: task.deliverables,
    constraints: task.constraints,
    timeline: task.timeline,
    acceptanceCriteria: task.acceptanceCriteria,
    skills: parseSkills(task.skillsJson),
  };
}

function parseSkills(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export { getDb };
