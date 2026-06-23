import fs from "node:fs";
import path from "path";
import multer from "multer";
import { ENV } from "../config/env";
// Ensure directories exist at startup
fs.mkdirSync(ENV.UPLOADS_DIR, { recursive: true });
fs.mkdirSync(ENV.TEMP_DIR, { recursive: true });
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, ENV.UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^\w.-]/g, "_");
        cb(null, `${Date.now()}-${safeName}`);
    },
});
const pdfOnly = (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
        cb(new Error("Only PDF files are allowed"));
        return;
    }
    cb(null, true);
};
/** Used by POST /api/ai/compare-proformas */
export const compareUpload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: pdfOnly,
}).fields([
    { name: "supplierFiles", maxCount: 20 },
    { name: "referenceFile", maxCount: 1 },
]);
export const toPublicUploadUrl = (attachmentPath) => {
    if (!attachmentPath)
        return null;
    const filename = path.basename(attachmentPath);
    return `/uploads/${filename}`;
};
//# sourceMappingURL=newUpload.js.map