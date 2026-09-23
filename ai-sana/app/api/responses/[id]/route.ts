import { getAppUser } from "@/lib/app-auth";
import { apiError, HttpError, json, readBody, unauthorized } from "@/lib/api";
import { selectResponse } from "@/lib/repository";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const viewer = await getAppUser();
    if (!viewer) return unauthorized();
    await readBody(request);
    const { id } = await context.params;
    const taskId = await selectResponse(id, viewer.userId);
    if (!taskId)
      throw new HttpError(
        409,
        "Выбор недоступен: команда уже выбрана или у вас нет доступа к задаче.",
      );
    return json({ taskId, selectedResponseId: id });
  } catch (error) {
    return apiError(error);
  }
}
