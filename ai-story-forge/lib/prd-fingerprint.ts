
import { createHash } from "crypto";

export function normalizePrdForFingerprint(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function createPrdFingerprint(input: string) {
  const normalized = normalizePrdForFingerprint(input);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
