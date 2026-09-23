import test from "node:test";
import assert from "node:assert/strict";
import { equalHashes, newSessionToken, passwordHash, tokenHash } from "./auth-crypto.ts";
test("password verification depends on the full password and salt",async()=>{
  const hash=await passwordHash("test-password-A","0123456789abcdef0123456789abcdef");
  assert.equal(equalHashes(hash,await passwordHash("test-password-A","0123456789abcdef0123456789abcdef")),true);
  assert.equal(equalHashes(hash,await passwordHash("test-password-B","0123456789abcdef0123456789abcdef")),false);
  assert.equal(equalHashes(hash,await passwordHash("test-password-A","abcdef0123456789abcdef0123456789")),false);
  assert.equal(equalHashes(hash,hash+"00"),false);
});
test("session tokens are random, opaque, and stored through a one-way digest",async()=>{
  const a=newSessionToken(),b=newSessionToken();
  assert.match(a,/^[a-f0-9]{64}$/); assert.notEqual(a,b);
  assert.notEqual(await tokenHash(a),a); assert.equal(await tokenHash(a),await tokenHash(a));
});
