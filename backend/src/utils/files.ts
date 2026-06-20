import fs from "node:fs";
import path from "node:path";
import { ENV } from "../config/env";

/**
 * Resolve a `/uploads/…` URL to an absolute local path.
 * Returns null when the file does not exist or the URL is unsafe.
 */
export function safeLocalPathFromUrl(url: string): string | null {
  const cleanUrl = url.split("?")[0];

  if (!cleanUrl.startsWith("/uploads/")) return null;

  const fileName = path.basename(cleanUrl);
  const filePath = path.join(ENV.UPLOADS_DIR, fileName);

  return fs.existsSync(filePath) ? filePath : null;
}

/**
 * Delete a list of file paths silently (best-effort).
 */
export function cleanupFiles(paths: (string | undefined | null)[]): void {
  for (const p of paths) {
    if (!p) continue;
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // best effort
    }
  }
}
