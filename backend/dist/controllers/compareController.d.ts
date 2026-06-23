import { Request, Response } from "express";
/**
 * POST /api/ai/compare-proformas
 * Body: multipart/form-data
 *   - supplierNames[]: string[]
 *   - supplierFiles[]: File[]
 *   - referenceFile?: File
 *   - backendAttachmentId?: string
 *   - backendAttachmentUrl?: string
 */
export declare function compareProformas(req: Request, res: Response): Promise<Response>;
//# sourceMappingURL=compareController.d.ts.map