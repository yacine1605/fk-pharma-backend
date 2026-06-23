import { eq, and, lte, gte, isNull, or, lt } from "drizzle-orm";
import { db } from "../../../db/drizzle";
import { offers, offerDeadlines, notifications, medicalEntities, } from "../../../db/schema";
/** Retourne le début de la journée en UTC (aligné avec PostgreSQL timestamptz) */
function startOfDay(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}
// ─────────────────────────────────────────────────────────────────────────────
// 1. Échéances à venir (minuit)
// ─────────────────────────────────────────────────────────────────────────────
export async function checkUpcomingDeadlines() {
    const now = new Date();
    const today = startOfDay(now);
    const in3Days = startOfDay(now);
    in3Days.setUTCDate(in3Days.getUTCDate() + 3);
    const in7Days = startOfDay(now);
    in7Days.setUTCDate(in7Days.getUTCDate() + 7);
    const notificationsCreated = [];
    // ── Offres avec dates de dépôt technique ou hôpital ──
    const offersWithDeadlines = await db
        .select({ offer: offers, entity: medicalEntities })
        .from(offers)
        .leftJoin(medicalEntities, eq(offers.medicalEntityId, medicalEntities.id))
        .where(or(and(gte(offers.technicalDepartmentDepositDate, today), lte(offers.technicalDepartmentDepositDate, in3Days)), and(gte(offers.hospitalDepositDate, today), lte(offers.hospitalDepositDate, in7Days))));
    for (const { offer, entity } of offersWithDeadlines) {
        // Dépôt technique
        if (offer.technicalDepartmentDepositDate) {
            const deadline = startOfDay(new Date(offer.technicalDepartmentDepositDate));
            const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil >= 0 && daysUntil <= 3) {
                const existing = await db
                    .select()
                    .from(notifications)
                    .where(and(eq(notifications.offerId, offer.id), eq(notifications.type, "deadline_reminder"), eq(notifications.title, "Dépôt technique imminent")));
                if (existing.length === 0) {
                    await db.insert(notifications).values({
                        type: "deadline_reminder",
                        offerId: offer.id,
                        title: "Dépôt technique imminent",
                        message: `L'offre "${offer.title}" pour ${entity?.name ?? "l'hôpital"} doit être déposée au service technique ${daysUntil === 0 ? "aujourd'hui" : `dans ${daysUntil} jour(s)`} (${offer.technicalDepartmentDepositDate.toLocaleDateString("fr-FR")}).`,
                        isRead: false,
                    });
                    notificationsCreated.push(`tech-${offer.id}`);
                }
            }
        }
        // Dépôt hôpital
        if (offer.hospitalDepositDate) {
            const deadline = startOfDay(new Date(offer.hospitalDepositDate));
            const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil >= 0 && daysUntil <= 7) {
                const existing = await db
                    .select()
                    .from(notifications)
                    .where(and(eq(notifications.offerId, offer.id), eq(notifications.type, "deadline_reminder"), eq(notifications.title, "Dépôt hôpital imminent")));
                if (existing.length === 0) {
                    await db.insert(notifications).values({
                        type: "deadline_reminder",
                        offerId: offer.id,
                        title: "Dépôt hôpital imminent",
                        message: `L'offre "${offer.title}" pour ${entity?.name ?? "l'hôpital"} doit être déposée à l'hôpital ${daysUntil === 0 ? "aujourd'hui" : `dans ${daysUntil} jour(s)`} (${offer.hospitalDepositDate.toLocaleDateString("fr-FR")}).`,
                        isRead: false,
                    });
                    notificationsCreated.push(`hospital-${offer.id}`);
                }
            }
        }
    }
    // ── Proformas proches de l'expiration ──
    const { supplierProformas, supplierResponses, suppliers } = await import("../../../db/schema");
    const proformasNearExpiry = await db
        .select({
        proforma: supplierProformas,
        response: supplierResponses,
        suppliers,
    })
        .from(supplierProformas)
        .innerJoin(supplierResponses, eq(supplierProformas.supplierResponseId, supplierResponses.id))
        .innerJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
        .where(and(gte(supplierProformas.validityDays, 1), lte(supplierProformas.validityDays, 7)));
    for (const { proforma, response, suppliers } of proformasNearExpiry) {
        const existing = await db
            .select()
            .from(notifications)
            .where(and(eq(notifications.supplierResponseId, response.id), eq(notifications.type, "deadline_reminder"), eq(notifications.title, "Proforma bientôt périmée")));
        if (existing.length === 0) {
            await db.insert(notifications).values({
                type: "deadline_reminder",
                offerId: response.offerId,
                supplierId: suppliers.id,
                supplierResponseId: response.id,
                title: "Proforma bientôt périmée",
                message: `La proforma ${proforma.proformaNumber ?? "N/A"} de ${suppliers.name} expire dans ${proforma.validityDays} jour(s). Renouvellement recommandé.`,
                isRead: false,
            });
            notificationsCreated.push(`proforma-${response.id}`);
        }
    }
    // ── Dates butoir personnalisées ──
    const customDeadlines = await db
        .select({ deadline: offerDeadlines, offer: offers })
        .from(offerDeadlines)
        .innerJoin(offers, eq(offerDeadlines.offerId, offers.id))
        .where(and(lte(offerDeadlines.date, in3Days), gte(offerDeadlines.date, today), isNull(offerDeadlines.notifiedAt)));
    for (const { deadline, offer } of customDeadlines) {
        const deadlineDay = startOfDay(new Date(deadline.date));
        const daysUntil = Math.ceil((deadlineDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        await db.insert(notifications).values({
            type: "deadline_reminder",
            offerId: offer.id,
            title: `Échéance: ${deadline.type}`,
            message: `L'offre "${offer.title}" - ${deadline.type} ${daysUntil === 0 ? "aujourd'hui" : `dans ${daysUntil} jour(s)`} (${deadline.date.toLocaleDateString("fr-FR")}).`,
            isRead: false,
        });
        await db
            .update(offerDeadlines)
            .set({ notifiedAt: now })
            .where(eq(offerDeadlines.id, deadline.id));
        notificationsCreated.push(`custom-${deadline.id}`);
    }
    return {
        checkedAt: now,
        notificationsCreated: notificationsCreated.length,
        details: notificationsCreated,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// 2. Dates dépassées (1h du matin)
// ─────────────────────────────────────────────────────────────────────────────
export async function checkExpiredDeadlines() {
    const now = new Date();
    const today = startOfDay(now);
    const expiredNotifications = [];
    // ── Dépôts techniques dépassés (strictement < aujourd'hui) ──
    const expiredTechnical = await db
        .select({ offer: offers, entity: medicalEntities })
        .from(offers)
        .leftJoin(medicalEntities, eq(offers.medicalEntityId, medicalEntities.id))
        .where(lt(offers.technicalDepartmentDepositDate, today));
    for (const { offer, entity } of expiredTechnical) {
        const existing = await db
            .select()
            .from(notifications)
            .where(and(eq(notifications.offerId, offer.id), eq(notifications.type, "deadline_expired"), eq(notifications.title, "Date dépôt technique dépassée")));
        if (existing.length === 0) {
            await db.insert(notifications).values({
                type: "deadline_expired",
                offerId: offer.id,
                title: "Date dépôt technique dépassée",
                message: `⚠️ URGENT: La date de dépôt technique pour "${offer.title}" (${entity?.name ?? "hôpital"}) est dépassée depuis le ${offer.technicalDepartmentDepositDate?.toLocaleDateString("fr-FR")}. Action immédiate requise.`,
                isRead: false,
            });
            expiredNotifications.push(`tech-${offer.id}`);
        }
    }
    // ── Dépôts hôpital dépassés ──
    const expiredHospital = await db
        .select({ offer: offers, entity: medicalEntities })
        .from(offers)
        .leftJoin(medicalEntities, eq(offers.medicalEntityId, medicalEntities.id))
        .where(lt(offers.hospitalDepositDate, today));
    for (const { offer, entity } of expiredHospital) {
        const existing = await db
            .select()
            .from(notifications)
            .where(and(eq(notifications.offerId, offer.id), eq(notifications.type, "deadline_expired"), eq(notifications.title, "Date dépôt hôpital dépassée")));
        if (existing.length === 0) {
            await db.insert(notifications).values({
                type: "deadline_expired",
                offerId: offer.id,
                title: "Date dépôt hôpital dépassée",
                message: `⚠️ URGENT: La date de dépôt à l'hôpital pour "${offer.title}" (${entity?.name ?? "hôpital"}) est dépassée depuis le ${offer.hospitalDepositDate?.toLocaleDateString("fr-FR")}. Action immédiate requise.`,
                isRead: false,
            });
            expiredNotifications.push(`hospital-${offer.id}`);
        }
    }
    // ── Dates personnalisées dépassées ──
    const expiredCustom = await db
        .select({ deadline: offerDeadlines, offer: offers })
        .from(offerDeadlines)
        .innerJoin(offers, eq(offerDeadlines.offerId, offers.id))
        .where(and(lt(offerDeadlines.date, today), isNull(offerDeadlines.notifiedAt)));
    for (const { deadline, offer } of expiredCustom) {
        await db.insert(notifications).values({
            type: "deadline_expired",
            offerId: offer.id,
            title: `Échéance dépassée: ${deadline.type}`,
            message: `⚠️ URGENT: L'échéance "${deadline.type}" pour l'offre "${offer.title}" est dépassée depuis le ${deadline.date.toLocaleDateString("fr-FR")}.`,
            isRead: false,
        });
        await db
            .update(offerDeadlines)
            .set({ notifiedAt: now })
            .where(eq(offerDeadlines.id, deadline.id));
        expiredNotifications.push(`custom-${deadline.id}`);
    }
    return {
        expiredCount: expiredNotifications.length,
        expiredIds: expiredNotifications,
    };
}
//# sourceMappingURL=deadline-notifications.service.js.map