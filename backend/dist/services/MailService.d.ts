import "dotenv/config";
type SendMailInput = {
    to: string;
    subject: string;
    text: string;
    html: string;
    attachment?: {
        filename: string;
        path: string;
        contentType: string;
    } | null;
};
export declare function sendMail(input: SendMailInput): Promise<import("nodemailer/lib/smtp-transport").SentMessageInfo>;
export {};
//# sourceMappingURL=MailService.d.ts.map