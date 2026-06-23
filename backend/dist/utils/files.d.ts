/**
 * Resolve a `/uploads/…` URL to an absolute local path.
 * Returns null when the file does not exist or the URL is unsafe.
 */
export declare function safeLocalPathFromUrl(url: string): string | null;
/**
 * Delete a list of file paths silently (best-effort).
 */
export declare function cleanupFiles(paths: (string | undefined | null)[]): void;
//# sourceMappingURL=files.d.ts.map