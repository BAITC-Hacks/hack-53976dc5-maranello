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
import { createResponse, findTask, listResponses } from "@/lib/repository";
import { responsePayloadSchema } from "@/lib/task-payload";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const viewer = await getAppUser();
    if (!viewer) return unauthorized();
    const task = await findTask((await context.params).id);
    if (!task || (task.status === "draft" && task.ownerId !== viewer.userId))
      return notFound();
    return json({
      responses: await listResponses(
        task.id,
        viewer.userId,
        task.ownerId === viewer.userId,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const viewer = await getAppUser();
    if (!viewer) return unauthorized();
    if (viewer.role === "business") return new Response(JSON.stringify({error:"Отправить предложение можно из аккаунта студента."}),{status:403,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
    const task = await findTask((await context.params).id);
    if (!task || task.status === "draft") return notFound();
    if (task.ownerId === viewer.userId) return forbidden();
    if (task.status !== "published")
      throw new HttpError(409, "Бизнес уже выбрал команду для этой задачи.");
    const payload = responsePayloadSchema.parse(await readBody(request));
    const id = await createResponse(task.id, viewer, payload);
    if (!id)
      throw new HttpError(
        409,
        "Вы уже откликнулись или приём откликов завершён.",
      );
    return json({ id }, 201);
  } catch (error) {
    return apiError(error);
  }
}
