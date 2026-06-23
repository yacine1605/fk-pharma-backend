import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { simpleParser } from "mailparser";
import { ImapFlow } from "imapflow";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/drizzle";
import { offerSuppliers, offers, supplierResponseAttachments, supplierResponses, suppliers, } from "../../../db/schema";
const attachmentsDir = process.env.SUPPLIER_ATTACHMENTS_DIR ?? "uploads/supplier-responses";
export async function fetchSupplierEmails() {
    const config = getImapConfig();
    if (!config) {
        console.warn("[mail] IMAP config missing. Skipping email fetch.");
        return {
            fetched: 0,
            createdResponses: 0,
            skipped: true,
        };
    }
    const client = new ImapFlow({
        ...config,
        logger: false,
        socketTimeout: 10 * 60 * 1000,
    });
    client.on("error", (error) => {
        console.error("[mail] IMAP error", error);
    });
    let fetched = 0;
    let createdResponses = 0;
    const createdResponseIds = [];
    try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");
        try {
            const unseenUids = await client.search({
                seen: false,
            }, {
                uid: true,
            });
            console.log("[mail] Unseen UIDs", unseenUids);
            if (unseenUids && Array.isArray(unseenUids)) {
                for (const uid of unseenUids) {
                    try {
                        const message = await client.fetchOne(uid, {
                            envelope: true,
                            source: true,
                            uid: true,
                        }, {
                            uid: true,
                        });
                        if (!message || message === false || !message.source) {
                            console.warn("[mail] Empty message source", {
                                uid,
                            });
                            continue;
                        }
                        fetched += 1;
                        const parsed = await simpleParser(message.source);
                        const created = await handleParsedEmail({
                            uid: String(uid),
                            messageId: parsed.messageId ?? createMessageIdFallback(uid, parsed.date),
                            from: parsed.from?.text ?? "",
                            subject: parsed.subject ?? "",
                            text: parsed.text ?? (typeof parsed.html === "string" ? parsed.html.replace(/<[^>]+>/g, " ") : "") ?? "",
                            attachments: parsed.attachments.map((attachment) => ({
                                filename: attachment.filename,
                                contentType: attachment.contentType,
                                size: attachment.size,
                                content: Buffer.from(attachment.content),
                            })),
                        });
                        if (created) {
                            createdResponses += 1;
                            createdResponseIds.push(created);
                            await client.messageFlagsAdd(uid, ["\\Seen"], {
                                uid: true,
                            });
                        }
                    }
                    catch (error) {
                        console.error("[mail] Failed to handle email", {
                            uid,
                            error,
                        });
                    }
                }
            }
        }
        finally {
            lock.release();
        }
        return {
            fetched,
            createdResponses,
            createdResponseIds,
            skipped: false,
        };
    }
    finally {
        await client.logout().catch(() => undefined);
    }
}
async function handleParsedEmail(params) {
    const existing = await db.query.supplierResponses.findFirst({
        where: eq(supplierResponses.emailMessageId, params.messageId),
    });
    if (existing) {
        return false;
    }
    const supplier = await findSupplierFromEmail(params.from);
    if (!supplier) {
        console.warn("[mail] Supplier not found for email", {
            from: params.from,
            subject: params.subject,
        });
        return false;
    }
    const offer = await findOfferFromEmail({
        subject: params.subject,
        text: params.text,
    });
    if (!offer) {
        console.warn("[mail] Offer not found for email", {
            from: params.from,
            subject: params.subject,
        });
        return false;
    }
    const offerSupplier = await db.query.offerSuppliers.findFirst({
        where: and(eq(offerSuppliers.offerId, offer.id), eq(offerSuppliers.supplierId, supplier.id)),
    });
    const negative = isNegativeSupplierResponse(`${params.subject}\n${params.text}`);
    const [response] = await db
        .insert(supplierResponses)
        .values({
        offerId: offer.id,
        supplierId: supplier.id,
        offerSupplierId: offerSupplier?.id ?? null,
        emailMessageId: params.messageId,
        emailFrom: params.from,
        emailSubject: params.subject,
        emailText: params.text,
        status: negative ? "negative" : "received",
        isNegativeResponse: negative,
        negativeReason: negative ? "Detected from email text" : null,
        receivedAt: new Date(),
        updatedAt: new Date(),
    })
        .returning();
    if (offerSupplier) {
        await db
            .update(offerSuppliers)
            .set({
            quotationReceived: !negative,
            respondedAt: new Date(),
        })
            .where(eq(offerSuppliers.id, offerSupplier.id));
    }
    await saveAttachments(response.id, params.attachments);
    return response.id;
}
async function saveAttachments(supplierResponseId, attachments) {
    await fs.mkdir(attachmentsDir, {
        recursive: true,
    });
    for (const attachment of attachments) {
        const originalFileName = sanitizeFileName(attachment.filename) || "attachment.bin";
        const storedFileName = `${crypto.randomUUID()}-${originalFileName}`;
        const filePath = path.join(attachmentsDir, storedFileName);
        await fs.writeFile(filePath, attachment.content);
        await db.insert(supplierResponseAttachments).values({
            supplierResponseId,
            attachmentType: "other",
            originalFileName,
            storedFileName,
            filePath,
            mimeType: attachment.contentType ?? null,
            fileSize: attachment.size ?? attachment.content.length,
        });
    }
}
async function findSupplierFromEmail(from) {
    const email = extractEmail(from);
    if (!email) {
        return null;
    }
    const allSuppliers = await db.select().from(suppliers);
    return (allSuppliers.find((supplier) => supplier.email?.toLowerCase() === email.toLowerCase()) ?? null);
}
async function findOfferFromEmail(params) {
    const haystack = `${params.subject}\n${params.text}`.toLowerCase();
    const uuid = haystack.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
    if (uuid) {
        const byId = await db.query.offers.findFirst({
            where: eq(offers.id, uuid),
        });
        if (byId) {
            return byId;
        }
    }
    const allOffers = await db.select().from(offers);
    return (allOffers.find((offer) => {
        if (offer.consultationNumber) {
            return haystack.includes(offer.consultationNumber.toLowerCase());
        }
        if (offer.title) {
            return haystack.includes(offer.title.toLowerCase());
        }
        return false;
    }) ?? null);
}
function getImapConfig() {
    const host = process.env.IMAP_HOST;
    const user = process.env.IMAP_USER;
    const pass = process.env.IMAP_PASSWORD;
    if (!host || !user || !pass) {
        return null;
    }
    return {
        host,
        port: Number(process.env.IMAP_PORT ?? 993),
        secure: process.env.IMAP_TLS !== "false",
        auth: {
            user,
            pass,
        },
    };
}
function extractEmail(value) {
    return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}
function sanitizeFileName(value) {
    if (!value) {
        return "";
    }
    return value
        .replace(/[^\w.\-() ]+/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);
}
function createMessageIdFallback(uid, date) {
    return `fallback-${uid}-${date?.getTime() ?? Date.now()}`;
}
function isNegativeSupplierResponse(value) {
    const normalized = value.toLowerCase();
    const negativeKeywords = [
        "nous ne pouvons pas",
        "ne pouvons pas répondre",
        "pas disponible",
        "indisponible",
        "non disponible",
        "désolé",
        "desole",
        "not available",
        "cannot quote",
        "unable to quote",
        "no quote",
        "decline",
    ];
    return negativeKeywords.some((keyword) => normalized.includes(keyword));
}
//# sourceMappingURL=mail.service.js.map