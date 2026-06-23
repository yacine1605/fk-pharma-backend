import multer from "multer";
import path from "path";
import fs from "fs";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const ALLOWED_MIMES = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    },
});
function fileFilter(_req, file, cb) {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
        cb(new Error(`Type de fichier non autorisé : ${file.mimetype}`));
        return;
    }
    cb(null, true);
}
const multerInstance = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB per file
        files: 20, // max 20 files per request
    },
});
/**
 * Accepts any field whose name starts with "attachment_"
 * e.g. attachment_0, attachment_1, …
 * Used by the /send and /draft offer routes.
 */
export const upload = multerInstance.any();
/**
 * Single-file upload kept for routes that still expect one file.
 * Field name: "attachment"
 */
export const uploadSingle = multerInstance.single("attachment");
// ─── Helpers ──────────────────────────────────────────────────────────────────
export function toPublicUploadUrl(attachmentPath) {
    if (!attachmentPath)
        return null;
    return `/uploads/${path.basename(attachmentPath)}`;
}
/**
 * Extract all uploaded attachment files from req.files (after upload.any()).
 * Reads the matching label from req.body (attachment_label_0, etc.).
 */
export function extractUploadedAttachments(files, body) {
    return files
        .filter((f) => f.fieldname.startsWith("attachment_") && !f.fieldname.includes("label"))
        .map((f) => {
        const index = f.fieldname.replace("attachment_", "");
        const label = body[`attachment_label_${index}`]?.trim() || f.originalname;
        return {
            path: f.path,
            name: f.originalname,
            mimeType: f.mimetype,
            size: f.size,
            label,
        };
    });
}
//# sourceMappingURL=Upload.middleware.js.map