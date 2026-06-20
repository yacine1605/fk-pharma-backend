import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function ocrScannedPdf(filePath: string) {
  const outputDir = path.join(
    "uploads",
    "ocr",
    path.basename(filePath, path.extname(filePath)),
  );

  await fs.mkdir(outputDir, { recursive: true });

  const outputPrefix = path.join(outputDir, "page");

  await execFileAsync("pdftoppm", [
    "-png",
    "-r",
    "300",
    filePath,
    outputPrefix,
  ]);

  const files = await fs.readdir(outputDir);
  const imageFiles = files
    .filter((file) => file.endsWith(".png"))
    .sort()
    .map((file) => path.join(outputDir, file));

  const pages: string[] = [];

  for (const imageFile of imageFiles) {
    const result = await execFileAsync("tesseract", [
      imageFile,
      "stdout",
      "-l",
      "fra",
    ]);

    pages.push(result.stdout);
  }

  return {
    text: pages.join("\n\n"),
    pages: pages.length,
    method: "ocr" as const,
  };
}
