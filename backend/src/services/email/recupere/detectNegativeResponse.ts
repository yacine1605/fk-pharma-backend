import { eq, sql } from "drizzle-orm";
import { db } from "../../../db/drizzle";
import { notifications, suppliers } from "../../../db/schema";

export function detectNegativeResponse(text: string): boolean {
  const normalized = text.toLowerCase();
  const keywords = [
    "nous ne pouvons pas",
    "nous ne sommes pas intéressés",
    "nous déclinons",
    "pas disponible",
    "indisponible",
    "nous regrettons",
    "impossible de répondre",
    "not available",
    "not interested",
    "we cannot",
    "unable to quote",
  ];
  return keywords.some((keyword) => normalized.includes(keyword));
}

export async function handleNegativeSupplierResponse(
  supplierId: string,
  offerId: string,
  supplierResponseId: string,
) {
  await db
    .update(suppliers)
    .set({
      doNotRecall: true,
      negativeResponseCount: sql`${suppliers.negativeResponseCount} + 1`,
      lastNegativeResponseAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(suppliers.id, supplierId));

  await db.insert(notifications).values({
    offerId,
    supplierId,
    type: "negative_response",
    supplierResponseId,
    title: "Réponse négative fournisseur",
    message:
      "Ce fournisseur a répondu négativement à la consultation. Il est recommandé de ne pas le rappeler pour cette offre.",
  });
}
