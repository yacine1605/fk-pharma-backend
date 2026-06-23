/**
 * Accepts any field whose name starts with "attachment_"
 * e.g. attachment_0, attachment_1, …
 * Used by the /send and /draft offer routes.
 */
export declare const upload: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Single-file upload kept for routes that still expect one file.
 * Field name: "attachment"
 */
export declare const uploadSingle: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare function toPublicUploadUrl(attachmentPath?: string | null): string | null;
/**
 * Extract all uploaded attachment files from req.files (after upload.any()).
 * Reads the matching label from req.body (attachment_label_0, etc.).
 */
export declare function extractUploadedAttachments(files: Express.Multer.File[], body: Record<string, string>): Array<{
    path: string;
    name: string;
    mimeType: string;
    size: number;
    label: string;
}>;
//# sourceMappingURL=Upload.middleware.d.ts.map