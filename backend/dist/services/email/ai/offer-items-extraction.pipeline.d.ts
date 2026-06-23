type ProcessOfferItemsOptions = {
    overwrite?: boolean;
};
export declare function processOfferItemsFromAttachments(offerId: string, options?: ProcessOfferItemsOptions): Promise<{
    success: boolean;
    message: string;
    skipped?: undefined;
    itemsCount?: undefined;
    offerId?: undefined;
    confidence?: undefined;
    items?: undefined;
} | {
    success: boolean;
    skipped: boolean;
    message: string;
    itemsCount: number;
    offerId?: undefined;
    confidence?: undefined;
    items?: undefined;
} | {
    success: boolean;
    offerId: string;
    itemsCount: number;
    confidence: number;
    items: any[];
    message?: undefined;
    skipped?: undefined;
}>;
export declare function preCleanOcrText(text: string): string;
export {};
//# sourceMappingURL=offer-items-extraction.pipeline.d.ts.map