import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const GLOVO_TRACKING_TOKEN_METADATA_KEY = "anfa_glovo_tracking_token_hash";

export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidTrackingToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
}

export function safeTokenHashMatches(candidateHash: string, storedHash: unknown): boolean {
  if (typeof storedHash !== "string" || !/^[a-f0-9]{64}$/i.test(storedHash)) {
    return false;
  }
  // Both values are fixed-width SHA-256 hex digests, so this comparison is constant-time.
  const left = Buffer.from(candidateHash, "hex");
  const right = Buffer.from(storedHash, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Stable, unguessable account tracking token. The secret remains server-side;
 * only its SHA-256 digest is persisted with the delivery record.
 */
export function createAccountTrackingToken(orderId: string): string {
  const secret = process.env.GLOVO_TRACKING_TOKEN_SECRET?.trim();

  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error(
      "GLOVO_TRACKING_TOKEN_SECRET must be configured with at least 32 bytes."
    );
  }

  return createHmac("sha256", secret)
    .update(`anfa-glovo-account-tracking:v1:${orderId}`, "utf8")
    .digest("hex");
}
