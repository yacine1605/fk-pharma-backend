import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import * as Canvas from "canvas";
import * as path from "path";
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
// ── Canvas factory required by pdfjs in Node.js ──────────────────────────
class NodeCanvasFactory {
    create(width, height) {
        const canvasEl = Canvas.createCanvas(width, height);
        return { canvas: canvasEl, context: canvasEl.getContext("2d") };
    }
    reset(canvasAndCtx, width, height) {
        canvasAndCtx.canvas.width = width;
        canvasAndCtx.canvas.height = height;
    }
    destroy(canvasAndCtx) {
        canvasAndCtx.canvas.width = 0;
        canvasAndCtx.canvas.height = 0;
    }
}
// ── Render one page → base64 PNG ─────────────────────────────────────────
async function renderPageToBase64(pdf, pageNum) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const factory = new NodeCanvasFactory();
    const canvasAndCtx = factory.create(viewport.width, viewport.height);
    await page.render({
        canvasContext: canvasAndCtx.context,
        viewport,
        canvasFactory: factory,
    }).promise;
    return canvasAndCtx.canvas
        .toDataURL("image/png")
        .split(",")[1];
}
// ── Main export ───────────────────────────────────────────────────────────
export async function loadPdf(buffer) {
    const canvasFactory = new NodeCanvasFactory();
    const loadingTask = pdfjsLib.getDocument({
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
//# sourceMappingURL=pdfExtract.js.map