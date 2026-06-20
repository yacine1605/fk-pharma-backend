/**
 * Lowercase + strip diacritics + collapse whitespace.
 * Used everywhere for fuzzy comparison.
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a French-formatted number string (spaces as thousands separator,
 * comma as decimal) into a JS number.
 */
export function parseNumber(value: string): number | undefined {
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/[^\d,.]/g, "")
    .replace(",", ".");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Extract all numbers found in a raw text line.
 */
export function extractNumbers(line: string): number[] {
  const matches = line.match(/\d+(?:[\s.,]\d{3})*(?:[,.]\d+)?|\d+/g) ?? [];
  return matches
    .map((m) => parseNumber(m))
    .filter((v): v is number => typeof v === "number");
}

/**
 * Convert req.body field that may be a single string or an array of strings
 * into a guaranteed string[].
 */
export function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}
