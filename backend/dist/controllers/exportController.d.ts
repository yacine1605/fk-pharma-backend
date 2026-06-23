import { Request, Response } from "express";
/**
 * POST /api/exports/comparison-excel
 * Body: { offerTitle, generatedAt, suppliers }
 */
export declare function exportExcel(req: Request, res: Response): Promise<void>;
/**
 * POST /api/exports/comparison-pdf
 * Body: { offerTitle, generatedAt, suppliers }
 */
export declare function exportPDF(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=exportController.d.ts.map