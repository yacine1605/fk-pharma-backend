/**
 * Builds and writes the comparison Excel for a given offer.
 * Fetches all required data from the DB, resolves moins/mieux disant flags,
 * and includes all spec columns: délai livraison, SAV, échéance, unité.
 */
export declare function buildAndExportComparisonExcel(offerId: string): Promise<{
    filePath: string;
    rowCount: number;
}>;
//# sourceMappingURL=Comparison.service.d.ts.map