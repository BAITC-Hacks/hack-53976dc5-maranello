import { env } from "cloudflare:workers";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { apiError, HttpError, json, readBody, unauthorized } from "@/lib/api";
import { suggestBrief } from "@/lib/assistant";
import { database } from "@/lib/repository";
import { taskPayloadSchema } from "@/lib/task-payload";
export async function GET() {
  return json({ configured: Boolean(env.OPENAI_API_KEY?.trim()) });
}
export async function POST(request: Request) {
  try {
    const viewer = await getChatGPTUser();
    if (!viewer) return unauthorized();
    const body = await readBody(request);
    const description = z
      .string()
      .trim()
      .min(20, "Расскажите о задаче подробнее — хотя бы 20 символов")
      .max(6000)
      .parse(body.description);
    const draft = taskPayloadSchema.parse(body.draft ?? {});
    const key = env.OPENAI_API_KEY?.trim();
    if (!key)
      throw new HttpError(
        503,
        "ИИ ещё не подключён. Заполните карточку вручную — рейтинг и публикация уже работают.",
      );
    const windowStart = Math.floor(Date.now() / 3600000) * 3600000;
    const usage = await database()
      .prepare(
        "INSERT INTO ai_usage(user_id,window_start,count) VALUES (?,?,1) ON CONFLICT(user_id) DO UPDATE SET window_start=excluded.window_start,count=CASE WHEN ai_usage.window_start=excluded.window_start THEN ai_usage.count+1 ELSE 1 END WHERE ai_usage.window_start!=excluded.window_start OR ai_usage.count<10 RETURNING count",
      )
      .bind(viewer.userId, windowStart)
      .first();
    if (!usage)
      throw new HttpError(
        429,
        "Вы использовали 10 запросов за этот час. Продолжайте вручную или вернитесь в следующем часу.",
      );
    return json(
      await suggestBrief(
        key,
        env.OPENAI_MODEL || "gpt-4.1-mini",
        description,
        draft,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
