import { env } from "cloudflare:workers";
import type { TaskRow } from "./server-tasks";
import type { TaskPayload } from "./task-payload";
import type { TeamResponse } from "./types";
import { evaluateTaskQuality } from "./quality";

export function database() {
  if (!env.DB) throw new Error("D1 database binding is missing");
  return env.DB;
}
const columns =
  "t.id, t.owner_id AS ownerId, t.owner_name AS ownerName, t.owner_email AS ownerEmail, t.organization, t.status, t.title, t.summary, t.problem, t.goal, t.context, t.audience, t.deliverables, t.constraints, t.timeline, t.acceptance_criteria AS acceptanceCriteria, t.skills_json AS skillsJson, t.quality_score AS qualityScore, t.selected_response_id AS selectedResponseId, t.created_at AS createdAt, t.updated_at AS updatedAt, t.published_at AS publishedAt";
export async function findTask(id: string) {
  return database()
    .prepare(`SELECT ${columns} FROM tasks t WHERE t.id = ?`)
    .bind(id)
    .first<TaskRow>();
}
export async function listTasks(ownerId?: string) {
  const clause = ownerId
    ? "t.owner_id = ?"
    : "t.status IN ('published', 'selected')";
  const stmt = database().prepare(
    `SELECT ${columns}, (SELECT COUNT(*) FROM responses r WHERE r.task_id=t.id) AS responseCount FROM tasks t WHERE ${clause} ORDER BY t.updated_at DESC LIMIT 500`,
  );
  return (
    await (ownerId ? stmt.bind(ownerId) : stmt).all<
      TaskRow & { responseCount: number }
    >()
  ).results;
}
function values(payload: TaskPayload) {
  return [
    payload.organization,
    payload.title,
    payload.summary,
    payload.problem,
    payload.goal,
    payload.context,
    payload.audience,
    payload.deliverables,
    payload.constraints,
    payload.timeline,
    payload.acceptanceCriteria,
    JSON.stringify(payload.skills),
    evaluateTaskQuality(payload).score,
  ];
}
export async function createTask(
  id: string,
  viewer: { userId: string; displayName: string; email: string },
  payload: TaskPayload,
) {
  const now = Date.now();
  await database()
    .prepare(
      "INSERT INTO tasks (id,owner_id,owner_name,owner_email,organization,title,summary,problem,goal,context,audience,deliverables,constraints,timeline,acceptance_criteria,skills_json,quality_score,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
    )
    .bind(
      id,
      viewer.userId,
      viewer.displayName,
      viewer.email,
      ...values(payload),
      now,
      now,
    )
    .run();
  return findTask(id);
}
export async function updateTask(
  task: TaskRow,
  payload: TaskPayload,
  publish: boolean,
  expected: number,
) {
  const now = Math.max(Date.now(), task.updatedAt + 1);
  const result = await database()
    .prepare(
      "UPDATE tasks SET organization=?,title=?,summary=?,problem=?,goal=?,context=?,audience=?,deliverables=?,constraints=?,timeline=?,acceptance_criteria=?,skills_json=?,quality_score=?,status=?,published_at=?,updated_at=? WHERE id=? AND owner_id=? AND updated_at=? AND status!='selected'",
    )
    .bind(
      ...values(payload),
      publish ? "published" : task.status,
      publish ? (task.publishedAt ?? now) : task.publishedAt,
      now,
      task.id,
      task.ownerId,
      expected,
    )
    .run();
  return result.meta.changes ? findTask(task.id) : null;
}
const responseColumns =
  "r.id,r.task_id AS taskId,r.team_name AS teamName,r.team_members AS teamMembers,r.proposal,r.student_name AS studentName,r.student_email AS studentEmail,r.created_at AS createdAt,(t.selected_response_id=r.id) AS selected";
export async function listResponses(
  taskId: string,
  viewerId: string,
  isOwner: boolean,
) {
  const stmt = database().prepare(
    `SELECT ${responseColumns} FROM responses r JOIN tasks t ON t.id=r.task_id WHERE r.task_id=? ${isOwner ? "" : "AND r.student_id=?"} ORDER BY r.created_at DESC`,
  );
  const rows = await (
    isOwner ? stmt.bind(taskId) : stmt.bind(taskId, viewerId)
  ).all<TeamResponse>();
  return rows.results.map((row) => ({
    ...row,
    selected: Boolean(row.selected),
  }));
}
export async function myResponses(viewerId: string) {
  const rows = await database()
    .prepare(
      `SELECT ${responseColumns},t.title AS taskTitle,t.status AS taskStatus,t.organization FROM responses r JOIN tasks t ON t.id=r.task_id WHERE r.student_id=? ORDER BY r.created_at DESC`,
    )
    .bind(viewerId)
    .all<TeamResponse>();
  return rows.results.map((row) => ({
    ...row,
    selected: Boolean(row.selected),
  }));
}
export async function createResponse(
  taskId: string,
  viewer: { userId: string; displayName: string; email: string },
  payload: { teamName: string; teamMembers: string; proposal: string },
) {
  const id = crypto.randomUUID();
  const result = await database()
    .prepare(
      "INSERT INTO responses (id,task_id,student_id,student_name,student_email,team_name,team_members,proposal,created_at) SELECT ?,id,?,?,?,?,?,?,? FROM tasks WHERE id=? AND status='published' AND owner_id!=? ON CONFLICT(task_id,student_id) DO NOTHING",
    )
    .bind(
      id,
      viewer.userId,
      viewer.displayName,
      viewer.email,
      payload.teamName,
      payload.teamMembers,
      payload.proposal,
      Date.now(),
      taskId,
      viewer.userId,
    )
    .run();
  return result.meta.changes ? id : null;
}
export async function selectResponse(responseId: string, ownerId: string) {
  const response = await database()
    .prepare("SELECT task_id AS taskId FROM responses WHERE id=?")
    .bind(responseId)
    .first<{ taskId: string }>();
  if (!response) return null;
  const result = await database()
    .prepare(
      "UPDATE tasks SET status='selected',selected_response_id=?,updated_at=? WHERE id=? AND owner_id=? AND status='published'",
    )
    .bind(responseId, Date.now(), response.taskId, ownerId)
    .run();
  return result.meta.changes ? response.taskId : null;
}
