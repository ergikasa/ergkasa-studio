/**
 * Hashes of the package. The identity fingerprint is the sha256 of the identity's canonical JSON (keys sorted at
 * every level, no whitespace), so it does not depend on how a builder ordered the keys.
 */
import { createHash } from "node:crypto";

export const sha256 = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

/** JSON with object keys sorted at every level and no whitespace. Arrays keep their order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export const identityFingerprint = (identity: unknown): string => sha256(canonicalJson(identity));
