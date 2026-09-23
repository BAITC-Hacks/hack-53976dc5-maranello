export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(60000),
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error(
      "Нет ответа от сервера. Проверьте подключение и повторите действие.",
    );
  }
  let data: { error?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error("Сервер вернул неожиданный ответ. Попробуйте ещё раз.");
  }
  if (!response.ok)
    throw new Error(data.error ?? "Не удалось выполнить действие.");
  return data as T;
}
