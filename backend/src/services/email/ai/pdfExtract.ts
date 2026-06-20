import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import * as Canvas from "canvas";
import * as path from "path";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = path.join(
  process.cwd(),
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
);

// ── Canvas factory required by pdfjs in Node.js ──────────────────────────
class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvasEl = Canvas.createCanvas(width, height);
    return { canvas: canvasEl, context: canvasEl.getContext("2d") };
  }
  reset(canvasAndCtx: any, width: number, height: number) {
    canvasAndCtx.canvas.width = width;
    canvasAndCtx.canvas.height = height;
  }
  destroy(canvasAndCtx: any) {
    canvasAndCtx.canvas.width = 0;
    canvasAndCtx.canvas.height = 0;
  }
}

// ── Render one page → base64 PNG ─────────────────────────────────────────
async function renderPageToBase64(pdf: any, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.5 });
  const factory = new NodeCanvasFactory();
  const canvasAndCtx = factory.create(viewport.width, viewport.height);

  await page.render({
    canvasContext: canvasAndCtx.context,
    viewport,
    canvasFactory: factory,
  }).promise;

  return (canvasAndCtx.canvas as Canvas.Canvas)
    .toDataURL("image/png")
    .split(",")[1];
}

// ── Main export ───────────────────────────────────────────────────────────
export async function loadPdf(buffer: Buffer) {
  const canvasFactory = new NodeCanvasFactory();

  const loadingTask = (pdfjsLib as any).getDocument({
    data: new Uint8Array(buffer),
    canvasFactory, // ← this is the critical fix
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });

  return loadingTask.promise;
}

export { renderPageToBase64 };
