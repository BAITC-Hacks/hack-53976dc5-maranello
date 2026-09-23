import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "./repository";
import { tokenHash } from "./auth-crypto";

export const SESSION_COOKIE = "sana_session";
export const SESSION_SECONDS = 8 * 60 * 60;
const accountSchema = z.object({
  id: z.string().min(10), username: z.string().min(3), displayName: z.string().min(1),
  email: z.string().email(), role: z.enum(["business", "student"]),
  salt: z.string().min(32), passwordHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type AppUser = { userId: string; displayName: string; email: string; role: "business" | "student" | "member"; provider: "password" | "chatgpt" };
export function accounts() {
  if (!env.APP_ACCOUNTS) return [];
  try { return z.array(accountSchema).max(20).parse(JSON.parse(env.APP_ACCOUNTS)); }
  catch { throw new Error("Invalid account configuration"); }
}
export function sessionCookieValue(cookie: string | null): string | null {
  return cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1) ?? null;
}
export function sessionCookie(value: string, request: Request, maxAge = SESSION_SECONDS): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}
export async function getAppUser(): Promise<AppUser | null> {
  const requestHeaders = await headers();
  const token = sessionCookieValue(requestHeaders.get("cookie"));
  // An explicit app logout/expired app session must not fall back to a different identity.
  if (token !== null) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const session = await database().prepare("SELECT user_id AS userId, credential_version AS credentialVersion FROM app_sessions WHERE token_hash=? AND expires_at>?")
      .bind(await tokenHash(token), Date.now()).first<{userId: string; credentialVersion: string}>();
    if (!session) return null;
    const account = accounts().find((item) => item.id === session.userId && item.passwordHash === session.credentialVersion);
    return account ? {userId: account.id, displayName: account.displayName, email: account.email, role: account.role, provider: "password"} : null;
  }
  const user = await getChatGPTUser();
  return user ? {...user, role: "member", provider: "chatgpt"} : null;
}
export async function revokeSession(request: Request) {
  const token = sessionCookieValue(request.headers.get("cookie"));
  if (token && /^[a-f0-9]{64}$/.test(token))
    await database().prepare("DELETE FROM app_sessions WHERE token_hash=?").bind(await tokenHash(token)).run();
}
