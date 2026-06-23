export interface SendEmailOptions {
    to: string;
    subject: string;
    body: string;
    signature?: string;
    attachments?: {
        filename: string;
        path: string;
    }[];
}
export declare function applyTemplateVariables(text: string, vars: {
    entityName?: string;
    contactPerson?: string;
    city?: string;
}): string;
export declare function sendEmail(opts: SendEmailOptions): Promise<void>;
//# sourceMappingURL=emailService.d.ts.map