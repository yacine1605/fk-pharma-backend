/**
 * Option 2 Mapper
 *
 * The frontend ALWAYS renders from `lots[]`.
 * If the DB stores multi-lot data → return it as-is.
 * If the DB stores legacy single-lot data (global fields) → synthesize
 * a single lot so the frontend has a uniform structure.
 */

export interface NormalizedLot {
  id: string;
  lotNumber: string;
  lotObject: string;
  technicalDocuments: {
    hasTechnicalSheet: boolean;
    hasConformityCertificate: boolean;
    hasOriginCertificate: boolean;
    hasManufacturingCertificate: boolean;
    hasCatalog: boolean;
    hasUserManual: boolean;
    hasSample: boolean;
  };
  clientRequirements: {
    particularPrescriptions: string;
    warrantyDuration: string;
    deliveryDelay: string;
    savDuration: string;
    interventionDelay: string;
    savLocations: string;
    trainingDuration: string;
  };
  createdAt: Date | string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: safely parse jsonb that may come as string or object
// Drizzle jsonb sometimes returns strings depending on driver config
// ─────────────────────────────────────────────────────────────────────────────
export function safeParseJsonb<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeOfferLots(offer: any): NormalizedLot[] {
  // Multi-lot mode (Option 2)
  if (offer.lots && Array.isArray(offer.lots) && offer.lots.length > 0) {
    return offer.lots.map((lot: any) => {
      const techDocs = safeParseJsonb<{
        hasTechnicalSheet?: boolean;
        hasConformityCertificate?: boolean;
        hasOriginCertificate?: boolean;
        hasManufacturingCertificate?: boolean;
        hasCatalog?: boolean;
        hasUserManual?: boolean;
        hasSample?: boolean;
      }>(lot.technicalDocuments);

      const clientReqs = safeParseJsonb<{
        particularPrescriptions?: string;
        warrantyDuration?: string;
        deliveryDelay?: string;
        savDuration?: string;
        interventionDelay?: string;
        savLocations?: string;
        trainingDuration?: string;
      }>(lot.clientRequirements);

      return {
        id: lot.id,
        lotNumber: lot.lotNumber,
        lotObject: lot.lotObject,
        technicalDocuments: {
          hasTechnicalSheet: techDocs?.hasTechnicalSheet ?? false,
          hasConformityCertificate: techDocs?.hasConformityCertificate ?? false,
          hasOriginCertificate: techDocs?.hasOriginCertificate ?? false,
          hasManufacturingCertificate:
            techDocs?.hasManufacturingCertificate ?? false,
          hasCatalog: techDocs?.hasCatalog ?? false,
          hasUserManual: techDocs?.hasUserManual ?? false,
          hasSample: techDocs?.hasSample ?? false,
        },
        clientRequirements: {
          particularPrescriptions: clientReqs?.particularPrescriptions ?? "",
          warrantyDuration: clientReqs?.warrantyDuration ?? "",
          deliveryDelay: clientReqs?.deliveryDelay ?? "",
          savDuration: clientReqs?.savDuration ?? "",
          interventionDelay: clientReqs?.interventionDelay ?? "",
          savLocations: clientReqs?.savLocations ?? "",
          trainingDuration: clientReqs?.trainingDuration ?? "",
        },
        createdAt: lot.createdAt,
      };
    });
  }

  // Legacy / single-lot fallback: build a synthetic lot from global fields
  return [
    {
      id: offer.id ?? "legacy",
      lotNumber: "1",
      lotObject: offer.title || "Lot unique",
      technicalDocuments: {
        hasTechnicalSheet: offer.hasTechnicalSheet ?? false,
        hasConformityCertificate: offer.hasConformityCertificate ?? false,
        hasOriginCertificate: offer.hasOriginCertificate ?? false,
        hasManufacturingCertificate: offer.hasManufacturingCertificate ?? false,
        hasCatalog: offer.hasCatalog ?? false,
        hasUserManual: offer.hasUserManual ?? false,
        hasSample: offer.hasSample ?? false,
      },
      clientRequirements: {
        particularPrescriptions: "",
        warrantyDuration: offer.warrantyDuration || "",
        deliveryDelay: offer.deliveryDelay || "",
        savDuration: offer.savDuration || "",
        interventionDelay: offer.interventionDelay || "",
        savLocations: offer.savLocations || "",
        trainingDuration: offer.trainingDuration || "",
      },
      createdAt: offer.createdAt,
    },
  ];
}
