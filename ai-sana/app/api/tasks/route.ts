import { z } from "zod";
import { getAppUser } from "@/lib/app-auth";
import { apiError, HttpError, json, readBody, unauthorized } from "@/lib/api";
import { createTask, listTasks, updateTask } from "@/lib/repository";
import { taskData } from "@/lib/server-tasks";
import { taskPayloadSchema, validatePublication } from "@/lib/task-payload";

export async function GET(request: Request) {
  try {
    const viewer = await getAppUser();
    const mine = new URL(request.url).searchParams.get("mine") === "1";
    if (mine && !viewer) return unauthorized();
    const rows = await listTasks(mine ? viewer?.userId : undefined);
    const tasks = rows.map((row) => ({
      ...taskData(row, viewer?.userId),
      responseCount: row.responseCount,
    }));
    if (!mine)
      tasks.sort(
        (a, b) =>
          b.qualityScore - a.qualityScore ||
          (b.publishedAt ?? 0) - (a.publishedAt ?? 0),
      );
    return json({ tasks });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await getAppUser();
    if (!viewer) return unauthorized();
    if (viewer.role === "student") return new Response(JSON.stringify({error:"Это действие доступно в аккаунте бизнеса."}),{status:403,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
    const body = await readBody(request);
    const payload = taskPayloadSchema.parse(body);
    const id = z
      .string()
      .uuid()
      .parse(body.id ?? crypto.randomUUID());
    if (body.action === "publish") validatePublication(payload);
    let task = await createTask(id, viewer, payload);
    if (!task || task.ownerId !== viewer.userId)
      throw new HttpError(
        409,
        "Не удалось сохранить задачу с этим идентификатором.",
      );
    if (body.action === "publish" && task.status === "draft")
      task = await updateTask(task, payload, true, task.updatedAt);
    if (!task)
      throw new HttpError(409, "Задача уже изменена. Обновите страницу.");
    return json({ task: taskData(task, viewer.userId) }, 201);
  } catch (error) {
    return apiError(error);
  }
}
