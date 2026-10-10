import { it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { seal, unseal, validSignature } from "../lib/whoop";
it("rejects changed or stale webhook payloads", () => {
  process.env.WHOOP_CLIENT_SECRET = "test-only-secret";
  const now = Date.now(),
    timestamp = String(now),
    body = '{"user_id":1}',
    signature = createHmac("sha256", process.env.WHOOP_CLIENT_SECRET)
      .update(timestamp + body)
      .digest("base64");
  expect(validSignature(body, timestamp, signature, now)).toBe(true);
  expect(validSignature(body + " ", timestamp, signature, now)).toBe(false);
  expect(validSignature(body, timestamp, signature, now + 600000)).toBe(false);
  expect(validSignature(body, "not-a-time", signature, now)).toBe(false);
});
it("encrypts provider tokens with authenticated encryption", () => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const tokens = {
    access_token: "test-token",
    refresh_token: "test-refresh",
    expires_in: 3600,
  };
  const encrypted = seal(tokens);
  expect(encrypted).not.toContain("test-token");
  expect(unseal(encrypted)).toEqual(tokens);
  const corrupt = Buffer.from(encrypted, "base64");
  corrupt[40] ^= 1;
  expect(() => unseal(corrupt.toString("base64"))).toThrow();
});
