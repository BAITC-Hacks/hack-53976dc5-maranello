import { env } from "cloudflare:workers";
import { z } from "zod";
import { getAppUser } from "@/lib/app-auth";
import { apiError, json, notFound, readBody, unauthorized } from "@/lib/api";
import { database } from "@/lib/repository";

// Operator-configured, short-lived allowlist. Callers cannot choose task IDs,
// source owners or recipients. Existing response IDs and task links stay intact.
const transferSchema = z.object({
  expiresAt: z.number(),
  transfers: z.array(z.object({
    taskId: z.string().uuid(), fromOwnerId: z.string().min(10),
    toOwnerId: z.string().min(10),
  })).min(1).max(20),
});
export async function POST(request: Request) {
  try {
    if (!env.TASK_OWNER_TRANSFERS) return notFound();
    const config = transferSchema.parse(JSON.parse(env.TASK_OWNER_TRANSFERS));
    if (Date.now() >= config.expiresAt) return notFound();
    const viewer = await getAppUser();
    if (!viewer) return unauthorized();
    if (viewer.provider !== "password" || viewer.role !== "business") return notFound();
    await readBody(request);
    const approved = config.transfers.filter(t => t.toOwnerId === viewer.userId);
    if (!approved.length) return notFound();
    const results = await database().batch(approved.map(t => database().prepare(
      "UPDATE tasks SET owner_id=?,owner_name=?,owner_email=?,updated_at=MAX(updated_at+1,?) WHERE id=? AND owner_id=?",
    ).bind(viewer.userId, viewer.displayName, viewer.email, Date.now(), t.taskId, t.fromOwnerId)));
    return json({ transferred: results.reduce((n, result) => n + result.meta.changes, 0) });
  } catch (cause) { return apiError(cause); }
}
