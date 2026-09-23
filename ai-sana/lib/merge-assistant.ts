import type { TaskPayload } from "./task-payload";

export function mergeAssistantDraft(current: TaskPayload, suggested: TaskPayload): TaskPayload {
  const merged = { ...current, skills: [...current.skills] };
  for (const key of Object.keys(current) as (keyof TaskPayload)[]) {
    if (key === "skills") {
      if (!current.skills.length) merged.skills = [...suggested.skills];
    } else if (!current[key].trim()) merged[key] = suggested[key];
  }
  return merged;
}
