/**
 * Lowercase + strip diacritics + collapse whitespace.
 * Used everywhere for fuzzy comparison.
 */
export declare function normalizeText(value: string): string;
/**
 * Parse a French-formatted number string (spaces as thousands separator,
 * comma as decimal) into a JS number.
 */
export declare function parseNumber(value: string): number | undefined;
/**
 * Extract all numbers found in a raw text line.
 */
export declare function extractNumbers(line: string): number[];
/**
 * Convert req.body field that may be a single string or an array of strings
 * into a guaranteed string[].
 */
export declare function asArray(value: unknown): string[];
//# sourceMappingURL=strings.d.ts.map