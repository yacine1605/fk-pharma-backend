import nodemailer from "nodemailer";
import path from "path";
import type { Transporter } from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  signature?: string;
  attachments?: { filename: string; path: string }[]; // ✅ array, no longer single path/name
}

export function applyTemplateVariables(
  text: string,
  vars: { entityName?: string; contactPerson?: string; city?: string },
): string {
  return text
    .replace(/\{\{entityName\}\}/g, vars.entityName ?? "votre établissement")
    .replace(/\{\{contactPerson\}\}/g, vars.contactPerson ?? "Madame, Monsieur")
    .replace(/\{\{city\}\}/g, vars.city ?? "votre ville");
}

function createTransporter(): Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const transporter = createTransporter();

  const signature = opts.signature?.trim() ?? "";

  // ✅ HTML email with signature rendered properly
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">
      <div style="white-space: pre-line;">${opts.body}</div>
      ${
        signature
          ? `
        <br/>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <div style="white-space: pre-line; color: #555; font-size: 13px;">${signature}</div>
      `
          : ""
      }
    </div>
  `;

  // ✅ plain text fallback
  const textBody = signature ? `${opts.body}\n\n--\n${signature}` : opts.body;

  // ✅ map all attachments with correct MIME types
  const attachments = (opts.attachments ?? []).map((file) => {
    const ext = path.extname(file.filename).replace(".", "").toLowerCase();
    return {
      filename: file.filename,
      path: file.path,
      contentType: MIME_TYPES[ext] ?? "application/octet-stream",
    };
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: opts.to,
    subject: opts.subject,
    html: htmlBody,
    text: textBody,
    attachments, // ✅ nodemailer accepts an array natively
  });
}
