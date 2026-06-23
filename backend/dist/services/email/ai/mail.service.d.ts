export declare function fetchSupplierEmails(): Promise<{
    fetched: number;
    createdResponses: number;
    skipped: boolean;
    createdResponseIds?: undefined;
} | {
    fetched: number;
    createdResponses: number;
    createdResponseIds: string[];
    skipped: boolean;
}>;
//# sourceMappingURL=mail.service.d.ts.map