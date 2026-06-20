// image-ocr.ts

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function ocrImage(filePath: string) {
  const result = await execFileAsync("tesseract", [
    filePath,
    "stdout",
    "-l",
    "fra+eng",
  ]);

  return result.stdout ?? "";
}
