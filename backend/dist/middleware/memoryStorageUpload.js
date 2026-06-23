import multer from "multer";
import path from "path";
import fs from "fs";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
// Créer le dossier si inexistant
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const storage = multer.memoryStorage();
function fileFilter(_req, file, cb) {
    const allowedMimes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowedMimes.includes(file.mimetype)) {
        cb(new Error("Type de fichier non autorisé."));
        return;
    }
    cb(null, true);
}
export const uploadMemory = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 10 MB max
    },
});
export const toPublicUploadUrl = (attachmentPath) => {
    if (!attachmentPath)
        return null;
    const filename = path.basename(attachmentPath);
    return `/uploads/${filename}`;
};
//# sourceMappingURL=memoryStorageUpload.js.map