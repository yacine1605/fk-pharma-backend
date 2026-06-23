export declare function sendCommercialOfferService({ offerId, userId, subject, body, supplierIds, attachments, }: {
    offerId: string;
    userId?: string;
    subject: string;
    body: string;
    supplierIds: string[];
    attachments?: {
        filename: string;
        path: string;
    }[];
}): Promise<{
    offerId: string;
    userId: string | undefined;
    total: number;
    sent: number;
    failed: number;
    details: ({
        supplierId: string;
        supplierName: string;
        email: string;
        status: string;
        error?: undefined;
    } | {
        supplierId: string;
        supplierName: string;
        email: string | null;
        status: string;
        error: string;
    })[];
}>;
//# sourceMappingURL=sendCommercialOffer.service.d.ts.map