import "dotenv/config";
import nodemailer from "nodemailer";
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: Number(process.env.MAIL_PORT || 587) === 465,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});
export async function sendMail(input) {
    return transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.attachment
            ? [
                {
                    filename: input.attachment.filename,
                    path: input.attachment.path,
                    contentType: input.attachment.contentType,
                },
            ]
            : [],
    });
}
//# sourceMappingURL=MailService.js.map