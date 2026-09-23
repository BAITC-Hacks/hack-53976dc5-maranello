import { z } from "zod";
import { getAppUser } from "@/lib/app-auth";
import {
  apiError,
  forbidden,
  HttpError,
  json,
  notFound,
  readBody,
  unauthorized,
} from "@/lib/api";
import { findTask, updateTask } from "@/lib/repository";
import { evaluateTaskQuality } from "@/lib/quality";
import { payloadFromTask, taskData } from "@/lib/server-tasks";
import { taskPayloadSchema, validatePublication } from "@/lib/task-payload";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await getAppUser();
    const task = await findTask((await context.params).id);
    if (!task || (task.status === "draft" && task.ownerId !== viewer?.userId))
      return notFound();
    return json({
      task: taskData(task, viewer?.userId),
      quality: evaluateTaskQuality(payloadFromTask(task)),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const viewer = await getAppUser();
    if (!viewer) return unauthorized();
    const task = await findTask((await context.params).id);
    if (!task) return notFound();
    if (task.ownerId !== viewer.userId) return forbidden();
    if (task.status === "selected")
      throw new HttpError(409, "Команда уже выбрана. Карточка зафиксирована.");
    const body = await readBody(request);
    const expected = z.number().int().positive().parse(body.expectedUpdatedAt);
    const payload = taskPayloadSchema.parse({
      ...payloadFromTask(task),
      ...body,
    });
    const publish = body.action === "publish";
    if (publish || task.status === "published") validatePublication(payload);
    const updated = await updateTask(task, payload, publish, expected);
    if (!updated)
      throw new HttpError(
        409,
        "Задача изменена в другой вкладке. Скопируйте правки и обновите страницу.",
      );
    return json({
      task: taskData(updated, viewer.userId),
      quality: evaluateTaskQuality(payload),
    });
  } catch (error) {
    return apiError(error);
  }
}
