import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/drizzle";
import { offers, offerSuppliers, suppliers } from "../../db/schema";
import { sendEmail } from "./emailService";
import { buildCompanySignature } from "../email/ai/signature-builder";
export async function sendCommercialOfferService({ offerId, userId, subject, body, supplierIds, 
//signature,
attachments, // ✅ array instead of single
 }) {
    // 1. Check offer exists
    const [offer] = await db.select().from(offers).where(eq(offers.id, offerId));
    if (!offer)
        throw new Error("Offer not found");
    // 2. Clean supplier ids
    const cleanSupplierIds = [...new Set(supplierIds.filter(Boolean))];
    if (cleanSupplierIds.length === 0)
        throw new Error("No suppliers selected");
    const trackedSubject = `${subject} [OFFER:${offerId}]`;
    // 3. Fetch valid suppliers
    const supplierList = await db
        .select()
        .from(suppliers)
        .where(inArray(suppliers.id, cleanSupplierIds));
    if (supplierList.length === 0)
        throw new Error("No valid suppliers found");
    // 4. Upsert into offerSuppliers as pending
    await db
        .insert(offerSuppliers)
        .values(supplierList.map((supplier) => ({
        offerId,
        supplierId: supplier.id,
        status: "pending",
        errorMessage: null,
        sentAt: null,
    })))
        .onConflictDoUpdate({
        target: [offerSuppliers.offerId, offerSuppliers.supplierId],
        set: { status: "pending", errorMessage: null, sentAt: null },
    });
    const signature = userId ? await buildCompanySignature(userId) : undefined;
    // 5. Build full email body with signature appended
    const fullBody = signature?.trim()
        ? `${body}\n\n--\n${signature.trim()}`
        : body;
    // 6. Send emails
    const results = [];
    for (const supplier of supplierList) {
        try {
            if (!supplier.email)
                throw new Error("Supplier email missing");
            await sendEmail({
                to: supplier.email,
                subject: trackedSubject,
                body: fullBody,
                signature, // full FK PHARM block rendered by sendEmail
                // ✅ body already includes signature
                attachments: attachments ?? [], // ✅ pass array
            });
            await db
                .update(offerSuppliers)
                .set({ status: "sent", sentAt: new Date(), errorMessage: null })
                .where(and(eq(offerSuppliers.offerId, offerId), eq(offerSuppliers.supplierId, supplier.id)));
            results.push({
                supplierId: supplier.id,
                supplierName: supplier.name,
                email: supplier.email,
                status: "sent",
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            await db
                .update(offerSuppliers)
                .set({ status: "failed", errorMessage })
                .where(and(eq(offerSuppliers.offerId, offerId), eq(offerSuppliers.supplierId, supplier.id)));
            results.push({
                supplierId: supplier.id,
                supplierName: supplier.name,
                email: supplier.email,
                status: "failed",
                error: errorMessage,
            });
        }
    }
    return {
        offerId,
        userId,
        total: supplierList.length,
        sent: results.filter((r) => r.status === "sent").length,
        failed: results.filter((r) => r.status === "failed").length,
        details: results,
    };
}
//# sourceMappingURL=sendCommercialOffer.service.js.map