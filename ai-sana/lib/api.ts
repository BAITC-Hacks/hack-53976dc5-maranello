import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "Действие доступно только из приложения.");
  const raw = await request.text();
  if (raw.length > 30000)
    throw new HttpError(
      413,
      "Описание слишком большое. Сократите его и попробуйте снова.",
    );
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Не удалось прочитать данные формы.");
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function apiError(error: unknown): Response {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError) {
    return json(
      {
        error: error.issues[0]?.message || "Проверьте заполнение полей.",
        details: error.flatten(),
      },
      400,
    );
  }
  console.error(error);
  return json(
    { error: "Не удалось выполнить действие. Попробуйте ещё раз." },
    500,
  );
}

export function unauthorized(): Response {
  return json({ error: "Войдите, чтобы продолжить." }, 401);
}

export function forbidden(): Response {
  return json({ error: "У вас нет доступа к этому действию." }, 403);
}

export function notFound(): Response {
  return json({ error: "Задача не найдена." }, 404);
}
