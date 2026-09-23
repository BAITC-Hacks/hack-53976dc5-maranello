import { z } from "zod";
import { accounts, revokeSession, sessionCookie, SESSION_SECONDS } from "@/lib/app-auth";
import { equalHashes, newSessionToken, passwordHash, tokenHash } from "@/lib/auth-crypto";
import { apiError, HttpError, readBody } from "@/lib/api";
import { database } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = z.object({username: z.string().trim().toLowerCase().min(1).max(80), password: z.string().min(1).max(256)}).parse(await readBody(request));
    const configured = accounts();
    if (!configured.length) throw new HttpError(503, "Вход по паролю пока не настроен.");
    const windowStart = Math.floor(Date.now() / 900000) * 900000;
    const ip = request.headers.get("cf-connecting-ip") || "shared";
    const key = await tokenHash(`login:${ip}`);
    const attempt = await database().prepare("INSERT INTO login_limits(key,window_start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=CASE WHEN login_limits.window_start=excluded.window_start THEN login_limits.count+1 ELSE 1 END WHERE login_limits.window_start!=excluded.window_start OR login_limits.count<30 RETURNING count").bind(key,windowStart).first();
    if (!attempt) throw new HttpError(429,"Слишком много попыток входа. Повторите через 15 минут.");
    const account = configured.find((item) => item.username === body.username);
    const candidate = account ?? configured[0];
    const hash = await passwordHash(body.password,candidate.salt);
    if (!account || !equalHashes(hash,account.passwordHash)) throw new HttpError(401,"Неверный логин или пароль.");
    await revokeSession(request);
    const token = newSessionToken();
    await database().batch([
      database().prepare("DELETE FROM app_sessions WHERE expires_at<=?").bind(Date.now()),
      database().prepare("DELETE FROM login_limits WHERE window_start<?").bind(windowStart - 900000),
      database().prepare("INSERT INTO app_sessions(token_hash,user_id,credential_version,expires_at) VALUES (?,?,?,?)").bind(await tokenHash(token),account.id,account.passwordHash,Date.now()+SESSION_SECONDS*1000),
    ]);
    return Response.json({ok:true,role:account.role},{headers:{"Cache-Control":"no-store","Set-Cookie":sessionCookie(token,request)}});
  } catch(error) { return apiError(error); }
}
