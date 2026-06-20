import { eq, inArray } from "drizzle-orm";

import { sendEmail, applyTemplateVariables } from "./email.service";
import {
  medicalEntities,
  NewOffer,
  offerRecipients,
  offers,
  suppliers,
  type NewMedicalEntity,
} from "../../db/schema";
import { db } from "../../db/drizzle";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateOfferDTO {
  offerTitle: string;
  medicalEntity: {
    name: string;
    type: string;
    speciality: string;
    address?: string;
    city: string;
    phone?: string;
    email: string;
    contactPerson: string;
  };
  selectedTemplateId: string | null;
  emailSubject: string;
  emailBody: string;
  emailSignature: string;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  recipientIds: string[]; // IDs des destinataires sélectionnés
}

export interface SendOfferResult {
  offerId: string;
  total: number;
  sent: number;
  failed: number;
  details: Array<{
    recipientId: string;
    recipientEmail: string;
    status: "sent" | "failed";
    error?: string;
  }>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * 1. Upsert l'entité médicale (par email)
 * 2. Crée l'offre en base
 * 3. Lie les destinataires à l'offre
 * 4. Envoie les emails un par un
 * 5. Met à jour les statuts d'envoi
 */
export async function createAndSendOffer(
  dto: CreateOfferDTO,
): Promise<SendOfferResult> {
  // ── 1. Upsert MedicalEntity ──────────────────────────────────────────────
  const existingEntities = await db
    .select()
    .from(medicalEntities)
    .where(eq(medicalEntities.email, dto.medicalEntity.email))
    .limit(1);

  let entityId: string;

  if (existingEntities.length > 0) {
    entityId = existingEntities[0].id;
    await db
      .update(medicalEntities)
      .set({
        name: dto.medicalEntity.name,
        type: dto.medicalEntity.type,
        speciality: dto.medicalEntity.speciality,
        address: dto.medicalEntity.address ?? null,
        city: dto.medicalEntity.city,
        phone: dto.medicalEntity.phone ?? null,
        contactPerson: dto.medicalEntity.contactPerson,
        updatedAt: new Date(),
      })
      .where(eq(medicalEntities.id, entityId));
  } else {
    const newEntity: NewMedicalEntity = {
      name: dto.medicalEntity.name,
      type: dto.medicalEntity.type,
      speciality: dto.medicalEntity.speciality,
      address: dto.medicalEntity.address ?? null,
      city: dto.medicalEntity.city,
      phone: dto.medicalEntity.phone ?? null,
      email: dto.medicalEntity.email,
      contactPerson: dto.medicalEntity.contactPerson,
    };
    const [inserted] = await db
      .insert(medicalEntities)
      .values(newEntity)
      .returning({ id: medicalEntities.id });
    entityId = inserted.id;
  }

  // ── 2. Résoudre les variables du template ─────────────────────────────────
  const vars = {
    entityName: dto.medicalEntity.name,
    contactPerson: dto.medicalEntity.contactPerson,
    city: dto.medicalEntity.city,
  };

  const resolvedSubject = applyTemplateVariables(dto.emailSubject, vars);
  const resolvedBody = applyTemplateVariables(dto.emailBody, vars);

  // ── 3. Créer l'offre ──────────────────────────────────────────────────────
  const newOffer: NewOffer = {
    title: dto.offerTitle,
    medicalEntityId: entityId,
    sourceOfferId: dto.sourceOfferId ?? null,
    selectedTemplateId: dto.selectedTemplateId ?? null,
    emailSubject: resolvedSubject,
    emailBody: resolvedBody,
    emailSignature: dto.emailSignature,
    attachmentPath: dto.attachmentPath ?? null,
    attachmentMimeType: dto.attachmentMimeType ?? null,
    attachmentName: dto.attachmentName ?? null,
    attachmentSize: dto.attachmentSize ?? null,
    status: "pending",
  };

  const [offer] = await db.insert(offers).values(newOffer).returning();

  // ── 4. Récupérer les destinataires sélectionnés ───────────────────────────
  const selectedRecipients =
    dto.recipientIds.length > 0
      ? await db
          .select()
          .from(suppliers)
          .where(inArray(suppliers.id, dto.recipientIds))
      : [];

  if (selectedRecipients.length === 0) {
    throw new Error("Aucun destinataire valide trouvé.");
  }

  // ── 5. Créer les lignes offer_recipients (status = pending) ───────────────
  await db.insert(offerRecipients).values(
    selectedRecipients.map((r) => ({
      offerId: offer.id,
      recipientId: r.id,
      emailStatus: "pending" as const,
    })),
  );

  // ── 6. Envoyer les emails un par un ──────────────────────────────────────
  const details: SendOfferResult["details"] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of selectedRecipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: resolvedSubject,
        body: resolvedBody,
        signature: dto.emailSignature,
        attachmentPath: dto.attachmentPath,
        attachmentName: dto.attachmentName,
      });

      // Mise à jour statut → sent
      await db
        .update(offerRecipients)
        .set({ status: "sent", sentAt: new Date() })
        .where(
          eq(offerRecipients.offerId, offer.id) &&
            eq(offerRecipients.recipientId, recipient.id),
        );

      details.push({
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        status: "sent",
      });
      sent++;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur inconnue";

      // Mise à jour statut → failed
      await db
        .update(offerRecipients)
        .set({ status: "failed", errorMessage })
        .where(
          eq(offerRecipients.offerId, offer.id) &&
            eq(offerRecipients.recipientId, recipient.id),
        );

      details.push({
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        status: "failed",
        error: errorMessage,
      });
      failed++;
    }
  }

  // ── 7. Mettre à jour le statut global de l'offre ─────────────────────────
  const finalStatus = failed === 0 ? "sent" : sent === 0 ? "failed" : "sent";
  await db
    .update(offers)
    .set({ status: finalStatus, updatedAt: new Date() })
    .where(eq(offers.id, offer.id));

  return {
    offerId: offer.id,
    total: selectedRecipients.length,
    sent,
    failed,
    details,
  };
}

/**
 * Sauvegarde un brouillon sans envoi
 */
export async function saveOfferDraft(dto: CreateOfferDTO): Promise<string> {
  const existingEntities = await db
    .select()
    .from(medicalEntities)
    .where(eq(medicalEntities.email, dto.medicalEntity.email))
    .limit(1);

  let entityId: string;

  if (existingEntities.length > 0) {
    entityId = existingEntities[0].id;
  } else {
    const [inserted] = await db
      .insert(medicalEntities)
      .values({
        name: dto.medicalEntity.name,
        type: dto.medicalEntity.type,
        speciality: dto.medicalEntity.speciality,
        address: dto.medicalEntity.address ?? null,
        city: dto.medicalEntity.city,
        phone: dto.medicalEntity.phone ?? null,
        email: dto.medicalEntity.email,
        contactPerson: dto.medicalEntity.contactPerson,
      })
      .returning({ id: medicalEntities.id });
    entityId = inserted.id;
  }

  const [offer] = await db
    .insert(offers)
    .values({
      title: dto.offerTitle,
      medicalEntityId: entityId,
      selectedTemplateId: dto.selectedTemplateId ?? null,
      emailSubject: dto.emailSubject,
      emailBody: dto.emailBody,
      emailSignature: dto.emailSignature,
      attachmentPath: dto.attachmentPath ?? null,
      attachmentName: dto.attachmentName ?? null,
      attachmentSize: dto.attachmentSize ?? null,
      status: "draft",
    })
    .returning({ id: offers.id });

  if (dto.recipientIds.length > 0) {
    await db.insert(offerRecipients).values(
      dto.recipientIds.map((rId) => ({
        offerId: offer.id,
        recipientId: rId,
        status: "pending" as const,
      })),
    );
  }

  return offer.id;
}

/**
 * Liste toutes les offres avec leurs stats d'envoi
 */
export async function listOffers() {
  return db.query.offers.findMany({
    with: {
      medicalEntity: true,
      offerRecipients: {
        with: { recipient: true },
      },
    },
    orderBy: (offers, { desc }) => [desc(offers.createdAt)],
  });
}

/**
 * Détail d'une offre par ID
 */
export async function getOfferById(id: string) {
  return db.query.offers.findFirst({
    where: eq(offers.id, id),
    with: {
      medicalEntity: true,
      // template: true,
      offerRecipients: {
        with: { recipient: true },
      },
    },
  });
}
