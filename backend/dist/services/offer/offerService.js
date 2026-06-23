import { and, eq, inArray } from "drizzle-orm";
import { medicalEntities, offerAttachments, offerRecipients, offerSuppliers, offers, users, offerLots, suppliers, } from "../../db/schema";
import { db } from "../../db/drizzle";
import { applyTemplateVariables, sendEmail } from "./emailService";
// ─── Helper : pièces jointes ────────────────────────────────────────────────
function buildEmailAttachments(dto) {
    const result = [];
    if (dto.attachments?.length) {
        for (const att of dto.attachments) {
            if (att.filePath) {
                result.push({
                    filename: att.fileName || "fichier",
                    path: att.filePath,
                });
            }
        }
    }
    if (!result.length && dto.attachmentPath) {
        result.push({
            filename: dto.attachmentName || "pièce-jointe",
            path: dto.attachmentPath,
        });
    }
    return result;
}
// ─── CREATE + SEND ──────────────────────────────────────────────────────────
export async function createAndSendOffer(dto) {
    // 1. UPSERT MEDICAL ENTITY
    const existing = await db
        .select()
        .from(medicalEntities)
        .where(eq(medicalEntities.email, dto.medicalEntity.email))
        .limit(1);
    let entityId;
    if (existing.length > 0) {
        entityId = existing[0].id;
        await db
            .update(medicalEntities)
            .set({
            name: dto.medicalEntity.name,
            type: dto.medicalEntity.type,
            address: dto.medicalEntity.address ?? null,
            city: dto.medicalEntity.city,
            phone: dto.medicalEntity.phone ?? null,
            contactPerson: dto.medicalEntity.contactPerson,
            updatedAt: new Date(),
        })
            .where(eq(medicalEntities.id, entityId));
    }
    else {
        const [inserted] = await db
            .insert(medicalEntities)
            .values({
            name: dto.medicalEntity.name,
            type: dto.medicalEntity.type,
            address: dto.medicalEntity.address ?? null,
            city: dto.medicalEntity.city,
            phone: dto.medicalEntity.phone ?? null,
            email: dto.medicalEntity.email,
            contactPerson: dto.medicalEntity.contactPerson,
        })
            .returning({ id: medicalEntities.id });
        entityId = inserted.id;
    }
    // 2. TEMPLATES
    const vars = {
        entityName: dto.medicalEntity.name,
        contactPerson: dto.medicalEntity.contactPerson,
        city: dto.medicalEntity.city,
    };
    const resolvedSubject = applyTemplateVariables(dto.emailSubject, vars);
    const resolvedBody = applyTemplateVariables(dto.emailBody, vars);
    // 3. CREATE OFFER
    const firstAtt = dto.attachments?.[0];
    const newOffer = {
        title: dto.offerTitle,
        medicalEntityId: entityId,
        sourceOfferId: dto.sourceOfferId ?? null,
        emailSubject: resolvedSubject,
        emailBody: resolvedBody,
        emailSignature: dto.emailSignature,
        attachmentName: firstAtt?.fileName ?? dto.attachmentName ?? null,
        attachmentPath: firstAtt?.filePath ?? dto.attachmentPath ?? null,
        attachmentMimeType: firstAtt?.mimeType ?? dto.attachmentMimeType ?? null,
        attachmentSize: firstAtt?.fileSize ?? dto.attachmentSize ?? null,
        commercialName: dto.commercialName ?? null,
        consultationNumber: dto.consultationNumber ?? null,
        establishment: dto.establishment ?? null,
        wilaya: dto.wilaya ?? null,
        depositLocation: dto.depositLocation ?? null,
        supplierCommercialAudit: dto.supplierCommercialAudit ?? null,
        procedureType: dto.procedureType ?? null,
        hospitalDepositDate: dto.hospitalDepositDate ?? null,
        technicalDepartmentDepositDate: dto.technicalDepartmentDepositDate ?? null,
        status: "pending",
    };
    const [offer] = await db.insert(offers).values(newOffer).returning();
    // 4. SAVE LOTS (has_* + exigences client)
    if (dto.lots?.length) {
        await db.insert(offerLots).values(dto.lots.map((lot) => ({
            offerId: offer.id,
            lotNumber: lot.number,
            lotObject: lot.object,
            technicalDocuments: lot.technicalDocuments,
            clientRequirements: lot.clientRequirements,
        })));
    }
    // 5. SAVE ATTACHMENTS
    if (dto.attachments?.length) {
        await db.insert(offerAttachments).values(dto.attachments.map((att) => ({
            offerId: offer.id,
            filePath: att.filePath,
            fileName: att.fileName,
            mimeType: att.mimeType,
            fileSize: att.fileSize,
            attachmentType: att.attachmentType ?? "other",
        })));
    }
    // 6. RECIPIENTS
    const selectedUsers = dto.recipientIds?.length
        ? await db.select().from(users).where(inArray(users.id, dto.recipientIds))
        : [];
    const selectedSuppliers = dto.supplierIds?.length
        ? await db
            .select()
            .from(suppliers)
            .where(inArray(suppliers.id, dto.supplierIds))
        : [];
    if (selectedUsers.length) {
        await db.insert(offerRecipients).values(selectedUsers.map((u) => ({
            offerId: offer.id,
            recipientId: u.id,
            status: "pending",
        })));
    }
    if (selectedSuppliers.length) {
        await db.insert(offerSuppliers).values(selectedSuppliers.map((s) => ({
            offerId: offer.id,
            supplierId: s.id,
            status: "pending",
        })));
    }
    // 7. SEND EMAILS
    const details = [];
    const emailAttachments = buildEmailAttachments(dto);
    let sentInternal = 0, failedInternal = 0;
    let sentSuppliers = 0, failedSuppliers = 0;
    await Promise.allSettled(selectedUsers.map(async (user) => {
        try {
            await sendEmail({
                to: user.email,
                subject: `[NOUVELLE OFFRE] ${resolvedSubject}`,
                body: resolvedBody,
                signature: dto.emailSignature,
                attachments: emailAttachments,
            });
            sentInternal++;
            await db
                .update(offerRecipients)
                .set({ status: "sent", sentAt: new Date() })
                .where(and(eq(offerRecipients.offerId, offer.id), eq(offerRecipients.recipientId, user.id)));
            details.push({
                type: "user",
                recipientId: user.id,
                recipientEmail: user.email,
                status: "sent",
            });
        }
        catch (error) {
            failedInternal++;
            const message = error instanceof Error ? error.message : "Unknown error";
            await db
                .update(offerRecipients)
                .set({ status: "failed", errorMessage: message })
                .where(and(eq(offerRecipients.offerId, offer.id), eq(offerRecipients.recipientId, user.id)));
            details.push({
                type: "user",
                recipientId: user.id,
                recipientEmail: user.email,
                status: "failed",
                error: message,
            });
        }
    }));
    await Promise.allSettled(selectedSuppliers.map(async (supplier) => {
        try {
            await sendEmail({
                to: supplier.email || "",
                subject: resolvedSubject,
                body: resolvedBody,
                signature: dto.emailSignature,
                attachments: emailAttachments,
            });
            sentSuppliers++;
            await db
                .update(offerSuppliers)
                .set({ status: "sent", sentAt: new Date() })
                .where(and(eq(offerSuppliers.offerId, offer.id), eq(offerSuppliers.supplierId, supplier.id)));
            details.push({
                type: "supplier",
                recipientId: supplier.id,
                recipientEmail: supplier.email || "",
                status: "sent",
            });
        }
        catch (error) {
            failedSuppliers++;
            const message = error instanceof Error ? error.message : "Unknown error";
            await db
                .update(offerSuppliers)
                .set({ status: "failed", errorMessage: message })
                .where(and(eq(offerSuppliers.offerId, offer.id), eq(offerSuppliers.supplierId, supplier.id)));
            details.push({
                type: "supplier",
                recipientId: supplier.id,
                recipientEmail: supplier.email || "",
                status: "failed",
                error: message,
            });
        }
    }));
    // 8. FINAL STATUS
    const totalSent = sentInternal + sentSuppliers;
    const totalFailed = failedInternal + failedSuppliers;
    const finalStatus = totalFailed === 0 ? "sent" : totalSent === 0 ? "failed" : "partial_failed";
    await db
        .update(offers)
        .set({ status: finalStatus, updatedAt: new Date() })
        .where(eq(offers.id, offer.id));
    return {
        offerId: offer.id,
        totalInternalRecipients: selectedUsers.length,
        totalSuppliers: selectedSuppliers.length,
        sentInternal,
        failedInternal,
        sentSuppliers,
        failedSuppliers,
        details,
    };
}
// ─── SAVE DRAFT ─────────────────────────────────────────────────────────────
export async function saveOfferDraft(dto) {
    const existing = await db
        .select()
        .from(medicalEntities)
        .where(eq(medicalEntities.email, dto.medicalEntity.email))
        .limit(1);
    let entityId;
    if (existing.length > 0) {
        entityId = existing[0].id;
    }
    else {
        const [inserted] = await db
            .insert(medicalEntities)
            .values({
            name: dto.medicalEntity.name,
            type: dto.medicalEntity.type,
            address: dto.medicalEntity.address ?? null,
            city: dto.medicalEntity.city,
            phone: dto.medicalEntity.phone ?? null,
            email: dto.medicalEntity.email,
            contactPerson: dto.medicalEntity.contactPerson,
        })
            .returning({ id: medicalEntities.id });
        entityId = inserted.id;
    }
    const firstAtt = dto.attachments?.[0];
    const [offer] = await db
        .insert(offers)
        .values({
        title: dto.offerTitle,
        medicalEntityId: entityId,
        sourceOfferId: dto.sourceOfferId ?? null,
        emailSubject: dto.emailSubject,
        emailBody: dto.emailBody,
        emailSignature: dto.emailSignature,
        attachmentPath: firstAtt?.filePath ?? dto.attachmentPath ?? null,
        attachmentName: firstAtt?.fileName ?? dto.attachmentName ?? null,
        attachmentSize: firstAtt?.fileSize ?? dto.attachmentSize ?? null,
        attachmentMimeType: firstAtt?.mimeType ?? dto.attachmentMimeType ?? null,
        status: "draft",
        commercialName: dto.commercialName ?? null,
        consultationNumber: dto.consultationNumber ?? null,
        establishment: dto.establishment ?? null,
        wilaya: dto.wilaya ?? null,
        depositLocation: dto.depositLocation ?? null,
        supplierCommercialAudit: dto.supplierCommercialAudit ?? null,
        procedureType: dto.procedureType ?? null,
        hospitalDepositDate: dto.hospitalDepositDate ?? null,
        technicalDepartmentDepositDate: dto.technicalDepartmentDepositDate ?? null,
    })
        .returning({ id: offers.id });
    // Lots
    if (dto.lots?.length) {
        await db.insert(offerLots).values(dto.lots.map((lot) => ({
            offerId: offer.id,
            lotNumber: lot.number,
            lotObject: lot.object,
            technicalDocuments: lot.technicalDocuments,
            clientRequirements: lot.clientRequirements,
        })));
    }
    // Attachments
    if (dto.attachments?.length) {
        await db.insert(offerAttachments).values(dto.attachments.map((att) => ({
            offerId: offer.id,
            filePath: att.filePath,
            fileName: att.fileName,
            mimeType: att.mimeType,
            fileSize: att.fileSize,
            attachmentType: att.attachmentType ?? "other",
        })));
    }
    if (dto.recipientIds?.length) {
        await db.insert(offerRecipients).values(dto.recipientIds.map((rId) => ({
            offerId: offer.id,
            recipientId: rId,
            status: "pending",
        })));
    }
    if (dto.supplierIds?.length) {
        await db.insert(offerSuppliers).values(dto.supplierIds.map((sId) => ({
            offerId: offer.id,
            supplierId: sId,
            status: "pending",
        })));
    }
    return offer.id;
}
// ─── GET / LIST ─────────────────────────────────────────────────────────────
export async function getOfferById(id) {
    return db.query.offers.findFirst({
        where: eq(offers.id, id),
        with: {
            medicalEntity: true,
            lots: true,
            offerRecipients: { with: { recipient: true } },
            offerSuppliers: { with: { supplier: true } },
            offerAttachments: true,
        },
    });
}
async function withRetry(fn, retries = 3) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        }
        catch (e) {
            lastError = e;
            if ((e?.cause?.code === "ECONNRESET" || e?.code === "ECONNRESET") &&
                i < retries - 1) {
                await new Promise((r) => setTimeout(r, 200 * (i + 1)));
                continue;
            }
            throw e;
        }
    }
    throw lastError;
}
export async function listOffers() {
    return withRetry(() => db.query.offers.findMany({
        with: {
            medicalEntity: true,
            offerRecipients: { with: { recipient: true } },
            offerSuppliers: { with: { supplier: true } },
            lots: true,
            offerAttachments: true,
        },
        orderBy: (offers, { desc }) => [desc(offers.createdAt)],
    }));
}
//# sourceMappingURL=offerService.js.map