const encoder = new TextEncoder();
export function hex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, "0")).join("");
}
export async function tokenHash(token: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
}
export async function passwordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256"}, key, 256));
}
export function equalHashes(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
export function newSessionToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}
