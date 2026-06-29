import path from "path";
import fs from "fs";
import { Router, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { createOfferSchema } from "../services/offer/offer.validator";
import {
  createAndSendOffer,
  saveOfferDraft,
  listOffers,
  getOfferById,
} from "../services/offer/offerService";
import { AuthRequest, authMiddleware, requireRole } from "../middleware/auth";
import { toPublicUploadUrl, upload } from "../middleware/upload";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/drizzle";
import { sendCommercialOfferService } from "../services/offer/sendCommercialOffer.service";
import {
  medicalEntities,
  offerAttachments,
  offerDocumentFolderFiles,
  offerDocumentFolders,
  offerExcelExports,
  offerItems,
  offerRecipients,
  offerSuppliers,
  offers,
  supplierGlobalAnalyses,
  supplierItemAnalyses,
  supplierProformaLines,
  supplierProformas,
  supplierResponseAttachments,
  supplierResponses,
  suppliers,
} from "../db/schema";
import {
  processOfferAnalysisPipeline,
  recomputeOfferSupplierRanking,
} from "../services/email/ai/analysis.pipeline";
import {
  generateBestOfferExport,
  selectBestOffersForCahier,
} from "../services/email/ai/best-offer.service";
import { processOfferItemsFromAttachments } from "../services/email/ai/offer-items-extraction.pipeline";
import { extractUploadedAttachments } from "../middleware/Upload.middleware";

const router: Router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const jobStore = new Map<
  string,
  { status: string; progress: number; error?: string }
>();

const ok = <T>(data: T) => ({ success: true as const, data });
const err = (message: string) => ({ success: false as const, error: message });

async function resolveSourceAttachment(sourceOfferId?: unknown) {
  if (typeof sourceOfferId !== "string" || sourceOfferId.trim().length === 0) {
    return null;
  }
  const offer = await getOfferById(sourceOfferId);
  if (!offer?.attachmentPath) return null;
  return {
    attachmentPath: offer.attachmentPath,
    attachmentName: offer.attachmentName,
    attachmentMimeType: offer.attachmentMimeType,
    attachmentSize: offer.attachmentSize,
  };
}
async function getOfferAttachments(offerId: string) {
  return db
    .select()
    .from(offerAttachments)
    .where(eq(offerAttachments.offerId, offerId));
}
function handleZodError(err: ZodError, res: Response) {
  const errors = err.errors.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));
  return res.status(422).json({ success: false, errors });
}
export async function getTechnicalSheetStatuses(
  responseIds: string[],
): Promise<Map<string, "existe" | "non_existe">> {
  if (responseIds.length === 0) return new Map();

  // Une seule query pour tous les responseIds
  const rows = await db
    .selectDistinct({
      supplierResponseId: supplierResponseAttachments.supplierResponseId,
    })
    .from(supplierResponseAttachments)
    .where(
      and(
        inArray(supplierResponseAttachments.supplierResponseId, responseIds),
        eq(supplierResponseAttachments.attachmentType, "technical_sheet"),
      ),
    );

  const statusMap = new Map<string, "existe" | "non_existe">();

  // Par défaut : non_existe pour tout le monde
  for (const id of responseIds) {
    statusMap.set(id, "non_existe");
  }

  // Écraser ceux qui ont une fiche technique
  for (const row of rows) {
    statusMap.set(row.supplierResponseId, "existe");
  }

  return statusMap;
}
// ─── Middleware: vérifie que l'utilisateur a accès à l'offre ───────────────
const requireOfferAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const offerId = req.params.offerId || req.params.id;
    const userId = req.userId!;
    const userRole = req.userRole!;

    if (!offerId) {
      res.status(400).json({ success: false, message: "Offer ID manquant" });
      return;
    }

    // Admin & agent_commercial: full access
    if (userRole === "admin" || userRole === "agent_commercial") {
      next();
      return;
    }

    // Vérifier si l'utilisateur est destinataire de cette offre
    const [recipient] = await db
      .select()
      .from(offerRecipients)
      .where(
        and(
          eq(offerRecipients.offerId, offerId),
          eq(offerRecipients.recipientId, userId),
        ),
      )
      .limit(1);

    if (recipient) {
      next();
      return;
    }

    // Vérifier si l'utilisateur est lié à un fournisseur de cette offre
    const [supplierLink] = await db
      .select()
      .from(offerSuppliers)
      .innerJoin(suppliers, eq(offerSuppliers.supplierId, suppliers.id))
      .where(
        and(
          eq(offerSuppliers.offerId, offerId) /*eq(suppliers.userId, userId)*/,
        ),
      )
      .limit(1);

    if (supplierLink) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: "Accès interdit à cette offre.",
    });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Routes ouvertes à tout utilisateur authentifié (listing personnel)
// ═══════════════════════════════════════════════════════════════════════════════
router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const userRole = req.userRole!;

    if (userRole === "admin" || userRole === "agent_commercial") {
      const result = await listOffers();
      return res.json({ success: true, data: result });
    }

    const myOffers = await db
      .select({
        offer: offers,
        medicalEntity: medicalEntities,
      })
      .from(offers)
      .innerJoin(offerRecipients, eq(offers.id, offerRecipients.offerId))
      .innerJoin(
        medicalEntities,
        eq(offers.medicalEntityId, medicalEntities.id),
      )
      .where(eq(offerRecipients.recipientId, userId))
      .orderBy(offers.createdAt);

    const formatted = myOffers.map((row) => ({
      ...row.offer,
      medicalEntity: row.medicalEntity,
    }));

    return res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Routes admin / agent_commercial uniquement
// ═══════════════════════════════════════════════════════════════════════════════
router.get(
  "/all",
  requireRole(["admin", "technique"]),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listOffers();
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/stats",
  requireRole(["admin", "agent_commercial", "technique"]),
  async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM offers
    `);
    res.json({ success: true, data: result[0] });
  },
);

router.get(
  "/document-folders",
  requireRole(["admin", "agent_commercial"]),
  async (req, res) => {
    try {
      const { search, offerId } = req.query;

      const conditions = [];
      if (typeof search === "string" && search.trim().length > 0) {
        conditions.push(
          sql`${offerDocumentFolders.name} ILIKE ${"%" + search.trim() + "%"}`,
        );
      }
      if (typeof offerId === "string" && offerId.trim().length > 0) {
        conditions.push(eq(offerDocumentFolders.offerId, offerId));
      }

      const folders = await db
        .select({
          folder: offerDocumentFolders,
          offerTitle: offers.title,
          offerStatus: offers.status,
        })
        .from(offerDocumentFolders)
        .innerJoin(offers, eq(offerDocumentFolders.offerId, offers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`${offerDocumentFolders.createdAt} desc`);

      const folderIds = folders.map((f) => f.folder.id);

      let fileCounts: { folderId: string; count: number }[] = [];
      if (folderIds.length > 0) {
        fileCounts = await db
          .select({
            folderId: offerDocumentFolderFiles.folderId,
            count: count(),
          })
          .from(offerDocumentFolderFiles)
          .where(inArray(offerDocumentFolderFiles.folderId, folderIds))
          .groupBy(offerDocumentFolderFiles.folderId);
      }

      const countMap = new Map(
        fileCounts.map((c) => [c.folderId, Number(c.count)]),
      );

      const result = folders.map((row) => ({
        id: row.folder.id,
        name: row.folder.name,
        parentId: row.folder.parentId,
        offerId: row.folder.offerId,
        offerTitle: row.offerTitle,
        offerStatus: row.offerStatus,
        fileCount: countMap.get(row.folder.id) || 0,
        createdAt: row.folder.createdAt,
      }));

      return res.json(ok(result));
    } catch (error) {
      console.error("[GET ALL DOCUMENT FOLDERS]", error);
      return res
        .status(500)
        .json(err("Erreur lors de la récupération des dossiers"));
    }
  },
);

router.post(
  "/send",
  requireRole(["admin", "agent_commercial", "technique", "distributor"]),
  upload.array("attachments", 20),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let rawData: Record<string, unknown>;
      try {
        rawData = JSON.parse(req.body.data ?? "{}");
      } catch {
        return res
          .status(400)
          .json({ success: false, message: 'Champ "data" JSON invalide.' });
      }

      const files = (req.files as Express.Multer.File[]) ?? [];
      const attachmentTypes = (req.body.attachmentTypes ?? []) as string[];

      if (files.length > 0) {
        const attachments = files.map((file, index) => ({
          filePath: file.path,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          attachmentType: attachmentTypes[index] ?? "other",
        }));
        rawData.attachments = attachments;
      } else if (rawData.sourceOfferId) {
        const sourceAttachments = await getOfferAttachments(
          rawData.sourceOfferId as string,
        );
        if (sourceAttachments && sourceAttachments.length > 0) {
          rawData.attachments = sourceAttachments.map((att: any) => ({
            filePath: att.filePath,
            fileName: att.fileName,
            mimeType: att.mimeType,
            fileSize: att.fileSize,
            attachmentType: att.attachmentType,
          }));
        } else {
          const sourceAttachment = await resolveSourceAttachment(
            rawData.sourceOfferId,
          );
          if (sourceAttachment) {
            rawData.attachments = [
              {
                filePath: sourceAttachment.attachmentPath,
                fileName: sourceAttachment.attachmentName,
                mimeType: sourceAttachment.attachmentMimeType,
                fileSize: sourceAttachment.attachmentSize,
                attachmentType: "other",
              },
            ];
          }
        }
      }

      const parsed = createOfferSchema.safeParse(rawData);
      if (!parsed.success) {
        console.error(
          "Zod errors:",
          JSON.stringify(parsed.error.errors, null, 2),
        );
        return handleZodError(parsed.error, res);
      }

      const result = await createAndSendOffer(parsed.data);

      return res.status(200).json({
        success: true,
        message: `Email(s) envoyé(s)`,
        data: {
          ...result,
          attachments: (parsed.data.attachments ?? []).map((att) => ({
            path: att.filePath,
            url: toPublicUploadUrl(att.filePath),
            name: att.fileName,
            size: att.fileSize,
            mimeType: att.mimeType,
            type: att.attachmentType,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/draft",
  requireRole(["admin", "agent_commercial", "technique", "distributor"]),
  upload.array("attachments", 20),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let rawData: Record<string, unknown>;
      try {
        rawData = JSON.parse(req.body.data ?? "{}");
      } catch {
        return res
          .status(400)
          .json({ success: false, message: 'Champ "data" JSON invalide.' });
      }

      const files = (req.files as Express.Multer.File[]) ?? [];
      const attachmentTypes = (req.body.attachmentTypes ?? []) as string[];

      if (files.length > 0) {
        rawData.attachments = files.map((file, index) => ({
          filePath: file.path,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          attachmentType: attachmentTypes[index] ?? "other",
        }));
      }

      const parsed = createOfferSchema.safeParse(rawData);
      if (!parsed.success) {
        return handleZodError(parsed.error, res);
      }

      const result = await saveOfferDraft(parsed.data);

      return res.status(200).json({
        success: true,
        message: "Brouillon sauvegardé",
        data: {
          offerId: result,
          attachments: (parsed.data.attachments ?? []).map((att) => ({
            path: att.filePath,
            url: toPublicUploadUrl(att.filePath),
            name: att.fileName,
            type: att.attachmentType,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/send-commercial",
  requireRole(["admin", "agent_commercial"]),
  upload.array("attachments", 10),
  async (req: Request, res: Response) => {
    try {
      const rawData = req.body.data;
      if (!rawData) {
        return res.status(400).json({ message: "Missing data payload" });
      }

      const data = JSON.parse(rawData);
      const files = (req.files as Express.Multer.File[]) ?? [];

      const attachments = files.map((file) => ({
        filename: file.originalname,
        path: file.path,
      }));

      const result = await sendCommercialOfferService({
        offerId: data.offerId,
        userId: data.userId,
        subject: data.subject,
        body: data.body,
        supplierIds: data.supplierIds,
        attachments,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error("[POST /offers/send-commercial]", error);
      return res.status(500).json({
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  Routes liées à une offre spécifique → auth + vérification d'accès
// ═══════════════════════════════════════════════════════════════════════════════

router.put(
  "/:offerId/status",
  requireOfferAccess,
  requireRole(["admin", "agent_commercial"]),
  async (req, res) => {
    try {
      const { offerId } = req.params;
      const { status } = req.body;

      const validStatuses = [
        "draft",
        "pending",
        "sent",
        "partial_failed",
        "failed",
        "completed",
      ] as const;

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Statut invalide. Valeurs acceptées: ${validStatuses.join(", ")}`,
        });
      }

      const offer = await db.query.offers.findFirst({
        where: eq(offers.id, offerId),
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Offre non trouvée",
        });
      }

      await db
        .update(offers)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(offers.id, offerId));

      return res.json({
        success: true,
        message: `Statut mis à jour : ${status}`,
        data: { offerId, status },
      });
    } catch (error) {
      console.error("[UPDATE-OFFER-STATUS]", error);
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour du statut",
      });
    }
  },
);

router.get("/:offerId/responses", requireOfferAccess, async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await db.query.offers.findFirst({
      where: eq(offers.id, offerId),
    });

    if (!offer) {
      return res
        .status(404)
        .json({ success: false, message: "Offre non trouvée" });
    }

    const suppliersContacted = await db
      .select({ count: count() })
      .from(offerSuppliers)
      .where(eq(offerSuppliers.offerId, offerId));

    const responses = await db
      .select({
        id: supplierResponses.id,
        supplierId: supplierResponses.supplierId,
        supplierName: suppliers.name,
        emailFrom: supplierResponses.emailFrom,
        emailSubject: supplierResponses.emailSubject,
        status: supplierResponses.status,
        isNegativeResponse: supplierResponses.isNegativeResponse,
        negativeReason: supplierResponses.negativeReason,
        receivedAt: supplierResponses.receivedAt,
        analyzedAt: supplierResponses.analyzedAt,
      })
      .from(supplierResponses)
      .innerJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
      .where(eq(supplierResponses.offerId, offerId))
      .orderBy(sql`${supplierResponses.receivedAt} desc`);

    const responseIds = responses.map((r) => r.id);

    let attachments: {
      id: string;
      supplierResponseId: string;
      attachmentType: string;
      originalFileName: string;
      storedFileName: string;
      mimeType: string | null;
      fileSize: number | null;
      createdAt: Date;
    }[] = [];

    if (responseIds.length > 0) {
      attachments = await db
        .select({
          id: supplierResponseAttachments.id,
          supplierResponseId: supplierResponseAttachments.supplierResponseId,
          attachmentType: supplierResponseAttachments.attachmentType,
          originalFileName: supplierResponseAttachments.originalFileName,
          storedFileName: supplierResponseAttachments.storedFileName,
          mimeType: supplierResponseAttachments.mimeType,
          fileSize: supplierResponseAttachments.fileSize,
          createdAt: supplierResponseAttachments.createdAt,
        })
        .from(supplierResponseAttachments)
        .where(
          inArray(supplierResponseAttachments.supplierResponseId, responseIds),
        )
        .orderBy(sql`${supplierResponseAttachments.createdAt} asc`);
    }

    const attachmentsByResponseId = new Map<string, typeof attachments>();

    for (const attachment of attachments) {
      const current = attachmentsByResponseId.get(
        attachment.supplierResponseId,
      );

      if (current) {
        current.push(attachment);
      } else {
        attachmentsByResponseId.set(attachment.supplierResponseId, [
          attachment,
        ]);
      }
    }

    const responsesWithAttachments = responses.map((response) => {
      const responseAttachments =
        attachmentsByResponseId.get(response.id) ?? [];

      return {
        ...response,
        attachmentCount: responseAttachments.length,
        attachments: responseAttachments,
      };
    });

    const supplierCount = Number(suppliersContacted[0]?.count || 0);
    const respondedCount = responses.length;

    // Nombre de fournisseurs ayant envoyé au moins une proforma
    const proformaReceivedCount = responsesWithAttachments.filter((r) =>
      r.attachments.some((a) => a.attachmentType === "proforma"),
    ).length;

    // Nombre de réponses négatives (non disponible)
    const negativeResponseCount = responses.filter(
      (r) => r.isNegativeResponse === true,
    ).length;

    // Fournisseurs contactés mais qui n'ont pas encore répondu
    const pendingCount = supplierCount - respondedCount;

    // Ajouter availabilityStatus sur chaque réponse
    const responsesWithAvailability = responsesWithAttachments.map((r) => ({
      ...r,
      // "disponible"     → a répondu et réponse positive (proforma attendue/reçue)
      // "non_disponible" → a répondu mais réponse négative
      availabilityStatus: r.isNegativeResponse
        ? "non_disponible"
        : "disponible",
    }));

    // ─────────────────────────────────────────────────────────
    // RÉPONSE FINALE
    // ─────────────────────────────────────────────────────────

    return res.json({
      success: true,
      offerId,
      offerTitle: offer.title,
      status: offer.status,
      sentAt: offer.sentAt,

      // Compteurs
      supplierCount, // total fournisseurs contactés
      respondedCount, // ont répondu (dispo + non-dispo)
      proformaReceivedCount, // proforma effectivement reçue
      negativeResponseCount, // non disponibles
      pendingCount, // pas encore répondu

      // Détail
      responses: responsesWithAvailability,
    });
  } catch (error) {
    console.error("[OFFER-RESPONSES]", error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des réponses",
    });
  }
});

router.get(
  "/:id/attachment",
  requireOfferAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const offer = await getOfferById(req.params.id);
      if (!offer) {
        return res
          .status(404)
          .json({ success: false, message: "Offre introuvable." });
      }
      if (!offer.attachmentPath) {
        return res.status(404).json({
          success: false,
          message: "Aucune pièce jointe pour cette offre.",
        });
      }
      const filePath = path.resolve(offer.attachmentPath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "Fichier introuvable sur le serveur.",
        });
      }
      return res.download(filePath, offer.attachmentName ?? "attachment.pdf");
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/:offerId/responses/:responseId/attachments/:attachmentId/download",
  requireOfferAccess,
  async (req: Request, res: Response) => {
    try {
      const { offerId, responseId, attachmentId } = req.params;

      const [attachment] = await db
        .select({
          id: supplierResponseAttachments.id,
          originalFileName: supplierResponseAttachments.originalFileName,
          filePath: supplierResponseAttachments.filePath,
          supplierResponseId: supplierResponseAttachments.supplierResponseId,
        })
        .from(supplierResponseAttachments)
        .innerJoin(
          supplierResponses,
          eq(
            supplierResponseAttachments.supplierResponseId,
            supplierResponses.id,
          ),
        )
        .where(
          and(
            eq(supplierResponses.offerId, offerId),
            eq(supplierResponses.id, responseId),
            eq(supplierResponseAttachments.id, attachmentId),
          ),
        );

      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: "Pièce jointe introuvable.",
        });
      }

      const filePath = path.resolve(attachment.filePath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "Fichier introuvable sur le serveur.",
        });
      }

      return res.download(filePath, attachment.originalFileName);
    } catch (error) {
      console.error("[DOWNLOAD RESPONSE ATTACHMENT]", error);

      return res.status(500).json({
        success: false,
        message: "Erreur lors du téléchargement de la pièce jointe.",
      });
    }
  },
);

router.get(
  "/:offerId/documents",
  requireOfferAccess,
  async (req: Request, res: Response) => {
    try {
      const { offerId } = req.params;

      const offer = await db.query.offers.findFirst({
        where: eq(offers.id, offerId),
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Offre introuvable.",
        });
      }

      const receivedAttachments = await db
        .select({
          attachmentId: supplierResponseAttachments.id,
          supplierResponseId: supplierResponseAttachments.supplierResponseId,
          originalFileName: supplierResponseAttachments.originalFileName,
          storedFileName: supplierResponseAttachments.storedFileName,
          filePath: supplierResponseAttachments.filePath,
          mimeType: supplierResponseAttachments.mimeType,
          fileSize: supplierResponseAttachments.fileSize,
          attachmentType: supplierResponseAttachments.attachmentType,
          createdAt: supplierResponseAttachments.createdAt,

          responseId: supplierResponses.id,
          receivedAt: supplierResponses.receivedAt,
          supplierId: suppliers.id,
          supplierName: suppliers.name,
        })
        .from(supplierResponseAttachments)
        .innerJoin(
          supplierResponses,
          eq(
            supplierResponseAttachments.supplierResponseId,
            supplierResponses.id,
          ),
        )
        .innerJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
        .where(eq(supplierResponses.offerId, offerId))
        .orderBy(sql`${supplierResponses.receivedAt} desc`);

      const sentFiles = offer.attachmentPath
        ? [
          {
            uid: `sent:${offer.id}`,
            id: offer.id,
            source: "sent",
            name: offer.attachmentName ?? "Pièce jointe offre",
            mimeType: offer.attachmentMimeType,
            size: offer.attachmentSize,
            downloadUrl: `/api/offers/${offerId}/attachment`,
            supplierId: null,
            supplierName: null,
            responseId: null,
            attachmentType: "cahier_charge",
            createdAt: offer.createdAt,
          },
        ]
        : [];

      const receivedBySupplier = new Map<
        string,
        {
          id: string;
          name: string;
          kind: "supplier";
          supplierId: string;
          responseId: string;
          receivedAt: Date;
          files: any[];
        }
      >();

      for (const attachment of receivedAttachments) {
        const folderId = `supplier:${attachment.supplierId}:response:${attachment.responseId}`;

        if (!receivedBySupplier.has(folderId)) {
          receivedBySupplier.set(folderId, {
            id: folderId,
            name: `${attachment.supplierName} - ${new Date(
              attachment.receivedAt,
            ).toLocaleDateString("fr-DZ")}`,
            kind: "supplier",
            supplierId: attachment.supplierId,
            responseId: attachment.responseId,
            receivedAt: attachment.receivedAt,
            files: [],
          });
        }

        receivedBySupplier.get(folderId)?.files.push({
          uid: `received:${attachment.attachmentId}`,
          id: attachment.attachmentId,
          source: "received",
          name: attachment.originalFileName,
          mimeType: attachment.mimeType,
          size: attachment.fileSize,
          attachmentType: attachment.attachmentType,
          supplierId: attachment.supplierId,
          supplierName: attachment.supplierName,
          responseId: attachment.responseId,
          createdAt: attachment.createdAt,
          downloadUrl: `/api/offers/${offerId}/responses/${attachment.responseId}/attachments/${attachment.attachmentId}/download`,
        });
      }

      return res.json({
        success: true,
        data: {
          offerId,
          offerTitle: offer.title,
          folders: [
            {
              id: "sent",
              name: "Fichiers envoyés aux fournisseurs",
              kind: "sent",
              files: sentFiles,
              children: [],
            },
            {
              id: "received",
              name: "Fichiers reçus des fournisseurs",
              kind: "received",
              files: [],
              children: Array.from(receivedBySupplier.values()),
            },
          ],
        },
      });
    } catch (error) {
      console.error("[GET OFFER DOCUMENTS]", error);

      return res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des documents.",
      });
    }
  },
);

router.get(
  "/:id",
  requireOfferAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const offer = await getOfferById(req.params.id);
      if (!offer) {
        return res
          .status(404)
          .json({ success: false, message: "Offre introuvable." });
      }
      return res.json({
        success: true,
        data: {
          ...offer,
          attachmentUrl: toPublicUploadUrl(offer.attachmentPath),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/:offerId/comparison", requireOfferAccess, async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await db.query.offers.findFirst({
      where: eq(offers.id, offerId),
      with: { medicalEntity: true, offerItems: true },
    });

    if (!offer) return res.status(404).json(err("Offre non trouvée"));

    const requestedItems = offer.offerItems || [];

    const globalAnalyses = await db
      .select({ global: supplierGlobalAnalyses, supplier: suppliers })
      .from(supplierGlobalAnalyses)
      .innerJoin(suppliers, eq(supplierGlobalAnalyses.supplierId, suppliers.id))
      .where(eq(supplierGlobalAnalyses.offerId, offerId))
      .orderBy(supplierGlobalAnalyses.rank);

    const itemAnalyses = await db
      .select({
        analysis: supplierItemAnalyses,
        supplier: suppliers,
        offerItem: offerItems,
        proformaLine: supplierProformaLines,
      })
      .from(supplierItemAnalyses)
      .innerJoin(
        supplierResponses,
        eq(supplierItemAnalyses.supplierResponseId, supplierResponses.id),
      )
      .innerJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
      .innerJoin(
        offerItems,
        eq(supplierItemAnalyses.offerItemId, offerItems.id),
      )
      .leftJoin(
        supplierProformaLines,
        eq(supplierItemAnalyses.proformaLineId, supplierProformaLines.id),
      )
      .where(
        and(
          eq(supplierResponses.offerId, offerId),
          inArray(supplierItemAnalyses.status, ["completed", "needs_review"]),
        ),
      );

    const rawLines = await db
      .select({
        line: supplierProformaLines,
        supplier: suppliers,
        offerItem: offerItems,
      })
      .from(supplierProformaLines)
      .innerJoin(
        supplierProformas,
        eq(supplierProformaLines.proformaId, supplierProformas.id),
      )
      .innerJoin(
        supplierResponses,
        eq(supplierProformas.supplierResponseId, supplierResponses.id),
      )
      .innerJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
      .leftJoin(
        offerItems,
        eq(supplierProformaLines.offerItemId, offerItems.id),
      )
      .where(eq(supplierResponses.offerId, offerId));

    const supplierMap = new Map<string, any>();

    for (const row of globalAnalyses) {
      supplierMap.set(row.supplier.id, {
        supplierId: row.supplier.id,
        supplierName: row.supplier.name,
        globalScore: row.global.globalScore,
        technicalScore: row.global.technicalScore,
        priceScore: row.global.priceScore,
        conditionsScore: row.global.conditionsScore,
        rank: row.global.rank,
        isBestSupplier: row.global.isBestSupplier,
        isEligible: row.global.isEligible,
        totalHT: Number(row.global.totalHT || 0),
        totalTTC: Number(row.global.totalTTC || 0),
        summary: row.global.summary,
        items: [],
      });
    }

    for (const row of itemAnalyses) {
      const sid = row.supplier.id;
      if (!supplierMap.has(sid)) {
        supplierMap.set(sid, {
          supplierId: sid,
          supplierName: row.supplier.name,
          globalScore: 0,
          technicalScore: 0,
          priceScore: 0,
          conditionsScore: 0,
          rank: null,
          isBestSupplier: false,
          isEligible: true,
          totalHT: 0,
          totalTTC: 0,
          summary: null,
          items: [],
        });
      }
      const entry = supplierMap.get(sid);
      entry.items.push({
        offerItemId: row.offerItem.id,
        itemNumber: row.offerItem.itemNumber,
        requestedName: row.offerItem.name,
        requestedQuantity: row.offerItem.requestedQuantity,
        technicalRequirements: row.offerItem.technicalRequirements,
        proposedName:
          row.proformaLine?.designation ||
          row.analysis.proposedProductName ||
          "Non spécifié",
        proposedBrand: row.analysis.proposedBrand || row.proformaLine?.brand,
        proposedCode:
          row.analysis.proposedProductCode ||
          row.proformaLine?.supplierProductCode,
        quantityOffered: row.analysis.quantityOffered,
        unitPriceHT: Number(row.analysis.unitPriceHT || 0),
        totalHT: Number(row.analysis.totalHT || 0),
        tvaPercentage: Number(row.analysis.tvaPercentage || 0),
        conformityPercentage: row.analysis.manualOverride
          ? Number(row.analysis.manualConformityPercentage || 0)
          : Number(row.analysis.conformityPercentage || 0),
        isTechnicallyCompliant: row.analysis.isTechnicallyCompliant,
        status: row.analysis.status,
        aiSummary: row.analysis.aiSummary,
        aiRecommendation: row.analysis.aiRecommendation,
        analysisDetails: row.analysis.analysisDetails,
        manualOverride: row.analysis.manualOverride,
      });
    }

    for (const row of rawLines) {
      const sid = row.supplier.id;
      if (!supplierMap.has(sid)) {
        supplierMap.set(sid, {
          supplierId: sid,
          supplierName: row.supplier.name,
          globalScore: 0,
          technicalScore: 0,
          priceScore: 0,
          conditionsScore: 0,
          rank: null,
          isBestSupplier: false,
          isEligible: true,
          totalHT: 0,
          totalTTC: 0,
          summary: null,
          items: [],
        });
      }
      const entry = supplierMap.get(sid);
      const exists = entry.items.find(
        (i: any) => i.offerItemId === row.offerItem?.id,
      );
      if (!exists) {
        entry.items.push({
          offerItemId: row.offerItem?.id || row.line.id,
          itemNumber: row.offerItem?.itemNumber || row.line.lineNumber,
          requestedName: row.offerItem?.name || "Produit inconnu",
          requestedQuantity: row.offerItem?.requestedQuantity,
          technicalRequirements: row.offerItem?.technicalRequirements || [],
          proposedName: row.line.designation || "Non spécifié",
          proposedBrand: row.line.brand,
          proposedCode: row.line.supplierProductCode,
          quantityOffered: row.line.quantity,
          unitPriceHT: Number(row.line.unitPriceHT || 0),
          totalHT: Number(row.line.totalHT || 0),
          tvaPercentage: Number(row.line.tvaPercentage || 0),
          conformityPercentage: null,
          isTechnicallyCompliant: null,
          status: "raw",
          aiSummary: null,
          aiRecommendation: null,
          analysisDetails: [],
          manualOverride: false,
        });
      }
    }

    const suppliersList = Array.from(supplierMap.values()).sort(
      (a: any, b: any) => (a.rank || 999) - (b.rank || 999),
    );
    const bestSupplier =
      suppliersList.find((s: any) => s.isBestSupplier) ||
      suppliersList[0] ||
      null;

    return res.json(
      ok({
        offerId,
        offerTitle: offer.title,
        offerDescription: offer.emailSubject,
        medicalEntity: offer.medicalEntity?.name,
        requestedItems: requestedItems.map((item) => ({
          id: item.id,
          itemNumber: item.itemNumber,
          name: item.name,
          code: item.code,
          description: item.description,
          requestedQuantity: item.requestedQuantity,
          technicalRequirements: item.technicalRequirements,
          minConformityPercentage: item.minConformityPercentage,
        })),
        suppliers: suppliersList,
        bestSupplier: bestSupplier
          ? {
            supplierId: bestSupplier.supplierId,
            supplierName: bestSupplier.supplierName,
            globalScore: bestSupplier.globalScore,
            totalHT: bestSupplier.totalHT,
            rank: bestSupplier.rank,
            summary: bestSupplier.summary,
          }
          : null,
      }),
    );
  } catch (error) {
    console.error("[OFFERS COMPARISON]", error);
    return res
      .status(500)
      .json(err("Erreur lors de la récupération de la comparaison"));
  }
});
// router.get("/:offerId/comparison", requireOfferAccess, async (req, res) => {
//   try {
//     const { offerId } = req.params;

//     const offer = await db.query.offers.findFirst({
//       where: eq(offers.id, offerId),
//       with: { medicalEntity: true, offerItems: true },
//     });

//     if (!offer) return res.status(404).json(err("Offre non trouvée"));

//     const requestedItems = offer.offerItems || [];

//     const globalAnalyses = await db
//       .select({ global: supplierGlobalAnalyses, supplier: suppliers })
//       .from(supplierGlobalAnalyses)
//       .innerJoin(suppliers, eq(supplierGlobalAnalyses.supplierId, suppliers.id))
//       .where(eq(supplierGlobalAnalyses.offerId, offerId))
//       .orderBy(supplierGlobalAnalyses.rank);

//     const itemAnalyses = await db
//       .select({
//         analysis: supplierItemAnalyses,
//         supplier: suppliers,
//         offerItem: offerItems,
//         proformaLine: supplierProformaLines,
//       })
//       .from(supplierItemAnalyses)
//       .innerJoin(
//         supplierResponses,
//         eq(supplierItemAnalyses.supplierResponseId, supplierResponses.id),
//       )
//       .innerJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
//       .innerJoin(
//         offerItems,
//         eq(supplierItemAnalyses.offerItemId, offerItems.id),
//       )
//       .leftJoin(
//         supplierProformaLines,
//         eq(supplierItemAnalyses.proformaLineId, supplierProformaLines.id),
//       )
//       .where(
//         and(
//           eq(supplierResponses.offerId, offerId),
//           inArray(supplierItemAnalyses.status, ["completed", "needs_review"]),
//         ),
//       );

//     const rawLines = await db
//       .select({
//         line: supplierProformaLines,
//         supplier: suppliers,
//         offerItem: offerItems,
//       })
//       .from(supplierProformaLines)
//       .innerJoin(
//         supplierProformas,
//         eq(supplierProformaLines.proformaId, supplierProformas.id),
//       )
//       .innerJoin(
//         supplierResponses,
//         eq(supplierProformas.supplierResponseId, supplierResponses.id),
//       )
//       .innerJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
//       .leftJoin(
//         offerItems,
//         eq(supplierProformaLines.offerItemId, offerItems.id),
//       )
//       .where(eq(supplierResponses.offerId, offerId));

//     const supplierMap = new Map<string, any>();

//     for (const row of globalAnalyses) {
//       supplierMap.set(row.supplier.id, {
//         supplierId: row.supplier.id,
//         supplierName: row.supplier.name,
//         globalScore: row.global.globalScore,
//         technicalScore: row.global.technicalScore,
//         priceScore: row.global.priceScore,
//         conditionsScore: row.global.conditionsScore,
//         rank: row.global.rank,
//         isBestSupplier: row.global.isBestSupplier,
//         isEligible: row.global.isEligible,
//         totalHT: Number(row.global.totalHT || 0),
//         totalTTC: Number(row.global.totalTTC || 0),
//         summary: row.global.summary,
//         items: [],
//       });
//     }

//     for (const row of itemAnalyses) {
//       const sid = row.supplier.id;
//       if (!supplierMap.has(sid)) {
//         supplierMap.set(sid, {
//           supplierId: sid,
//           supplierName: row.supplier.name,
//           globalScore: 0,
//           technicalScore: 0,
//           priceScore: 0,
//           conditionsScore: 0,
//           rank: null,
//           isBestSupplier: false,
//           isEligible: true,
//           totalHT: 0,
//           totalTTC: 0,
//           summary: null,
//           items: [],
//         });
//       }
//       const entry = supplierMap.get(sid);
//       entry.items.push({
//         offerItemId: row.offerItem.id,
//         itemNumber: row.offerItem.itemNumber,
//         requestedName: row.offerItem.name,
//         requestedQuantity: row.offerItem.requestedQuantity,
//         technicalRequirements: row.offerItem.technicalRequirements,
//         proposedName:
//           row.proformaLine?.designation ||
//           row.analysis.proposedProductName ||
//           "Non spécifié",
//         proposedBrand: row.analysis.proposedBrand || row.proformaLine?.brand,
//         proposedCode:
//           row.analysis.proposedProductCode ||
//           row.proformaLine?.supplierProductCode,
//         quantityOffered: row.analysis.quantityOffered,
//         unitPriceHT: Number(row.analysis.unitPriceHT || 0),
//         totalHT: Number(row.analysis.totalHT || 0),
//         tvaPercentage: Number(row.analysis.tvaPercentage || 0),
//         conformityPercentage: row.analysis.manualOverride
//           ? Number(row.analysis.manualConformityPercentage || 0)
//           : Number(row.analysis.conformityPercentage || 0),
//         isTechnicallyCompliant: row.analysis.isTechnicallyCompliant,
//         status: row.analysis.status,
//         aiSummary: row.analysis.aiSummary,
//         aiRecommendation: row.analysis.aiRecommendation,
//         analysisDetails: row.analysis.analysisDetails,
//         manualOverride: row.analysis.manualOverride,
//       });
//     }

//     for (const row of rawLines) {
//       const sid = row.supplier.id;
//       if (!supplierMap.has(sid)) {
//         supplierMap.set(sid, {
//           supplierId: sid,
//           supplierName: row.supplier.name,
//           globalScore: 0,
//           technicalScore: 0,
//           priceScore: 0,
//           conditionsScore: 0,
//           rank: null,
//           isBestSupplier: false,
//           isEligible: true,
//           totalHT: 0,
//           totalTTC: 0,
//           summary: null,
//           items: [],
//         });
//       }
//       const entry = supplierMap.get(sid);
//       const exists = entry.items.find(
//         (i: any) => i.offerItemId === row.offerItem?.id,
//       );
//       if (!exists) {
//         entry.items.push({
//           offerItemId: row.offerItem?.id || row.line.id,
//           itemNumber: row.offerItem?.itemNumber || row.line.lineNumber,
//           requestedName: row.offerItem?.name || "Produit inconnu",
//           requestedQuantity: row.offerItem?.requestedQuantity,
//           technicalRequirements: row.offerItem?.technicalRequirements || [],
//           proposedName: row.line.designation || "Non spécifié",
//           proposedBrand: row.line.brand,
//           proposedCode: row.line.supplierProductCode,
//           quantityOffered: row.line.quantity,
//           unitPriceHT: Number(row.line.unitPriceHT || 0),
//           totalHT: Number(row.line.totalHT || 0),
//           tvaPercentage: Number(row.line.tvaPercentage || 0),
//           conformityPercentage: null,
//           isTechnicallyCompliant: null,
//           status: "raw",
//           aiSummary: null,
//           aiRecommendation: null,
//           analysisDetails: [],
//           manualOverride: false,
//         });
//       }
//     }

//     const suppliersList = Array.from(supplierMap.values()).sort(
//       (a: any, b: any) => (a.rank || 999) - (b.rank || 999),
//     );
//     const bestSupplier =
//       suppliersList.find((s: any) => s.isBestSupplier) ||
//       suppliersList[0] ||
//       null;

//     return res.json(
//       ok({
//         offerId,
//         offerTitle: offer.title,
//         offerDescription: offer.emailSubject,
//         medicalEntity: offer.medicalEntity?.name,
//         requestedItems: requestedItems.map((item) => ({
//           id: item.id,
//           itemNumber: item.itemNumber,
//           name: item.name,
//           code: item.code,
//           description: item.description,
//           requestedQuantity: item.requestedQuantity,
//           technicalRequirements: item.technicalRequirements,
//           minConformityPercentage: item.minConformityPercentage,
//         })),
//         suppliers: suppliersList,
//         bestSupplier: bestSupplier
//           ? {
//               supplierId: bestSupplier.supplierId,
//               supplierName: bestSupplier.supplierName,
//               globalScore: bestSupplier.globalScore,
//               totalHT: bestSupplier.totalHT,
//               rank: bestSupplier.rank,
//               summary: bestSupplier.summary,
//             }
//           : null,
//       }),
//     );
//   } catch (error) {
//     console.error("[OFFERS COMPARISON]", error);
//     return res
//       .status(500)
//       .json(err("Erreur lors de la récupération de la comparaison"));
//   }
// });

router.post(
  "/:offerId/analyze",
  requireOfferAccess,
  requireRole(["admin", "agent_commercial"]),
  async (req, res) => {
    try {
      const { offerId } = req.params;
      const { force } = req.body || {};

      const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      jobStore.set(jobId, { status: "running", progress: 0 });

      (async () => {
        try {
          jobStore.set(jobId, { status: "running", progress: 10 });
          await processOfferItemsFromAttachments(offerId, {
            overwrite: !!force,
          });
          jobStore.set(jobId, { status: "running", progress: 40 });
          await processOfferAnalysisPipeline(offerId);
          jobStore.set(jobId, { status: "running", progress: 80 });
          await recomputeOfferSupplierRanking(offerId);
          jobStore.set(jobId, { status: "completed", progress: 100 });
        } catch (e: any) {
          jobStore.set(jobId, {
            status: "failed",
            progress: 0,
            error: e.message,
          });
        }
      })();

      return res.json(ok({ jobId, status: "running", progress: 0 }));
    } catch (error) {
      return res.status(500).json(err("Erreur pendant l'analyse"));
    }
  },
);

router.get(
  "/:offerId/analyze/:jobId/status",
  requireOfferAccess,
  async (req, res) => {
    const { jobId } = req.params;
    const job = jobStore.get(jobId);
    if (!job) return res.status(404).json(err("Job introuvable"));
    return res.json(ok({ jobId, status: job.status, progress: job.progress }));
  },
);

router.post("/:offerId/export", requireOfferAccess, async (req, res) => {
  try {
    const { offerId } = req.params;

    const result = await generateBestOfferExport(offerId);

    await db
      .delete(offerExcelExports)
      .where(
        and(
          eq(offerExcelExports.offerId, offerId),
          eq(offerExcelExports.fileName, result.fileName),
        ),
      );

    await db.insert(offerExcelExports).values({
      offerId,
      fileName: result.fileName,
      filePath: result.filePath,
    });

    return res.json(
      ok({
        fileName: result.fileName,
        fileUrl: result.fileUrl,
        summary: result.summary,
        missingItems: result.missingItems,
      }),
    );
  } catch (error) {
    console.error("[OFFERS EXPORT]", error);
    return res.status(500).json(err("Erreur lors de l'export"));
  }
});

router.post(
  "/:offerId/export/preview",
  requireOfferAccess,
  async (req, res) => {
    try {
      const { offerId } = req.params;
      const result = await selectBestOffersForCahier(offerId);
      return res.json(
        ok({
          lines: result.lines,
          missingCount: result.missingItems.length,
          totalHT: result.totalHT,
          missingItems: result.missingItems,
        }),
      );
    } catch (error) {
      console.error("[OFFERS PREVIEW]", error);
      return res.status(500).json(err("Erreur lors de la prévisualisation"));
    }
  },
);

router.get("/:offerId/missing-items", requireOfferAccess, async (req, res) => {
  try {
    const { offerId } = req.params;
    const result = await selectBestOffersForCahier(offerId);
    return res.json(
      ok({
        missingItemsCount: result.missingItems.length,
        missingItems: result.missingItems.map((item) => ({
          itemNumber: item.itemNumber,
          itemName: item.itemName,
          suggestedSuppliers: item.onlineSuppliers,
          searchQuery: `fournisseur ${item.itemName} biomedicale Algerie`,
        })),
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(err("Erreur lors de la récupération des items manquants"));
  }
});

router.post(
  "/:offerId/regenerate-missing",
  requireOfferAccess,
  async (req, res) => {
    try {
      const { offerId } = req.params;
      const result = await selectBestOffersForCahier(offerId);

      if (result.missingItems.length === 0) {
        return res.json(ok({ message: "Aucun item manquant à rechercher" }));
      }

      const enriched = await Promise.all(
        result.missingItems.map(async (item) => ({
          ...item,
          searchQuery: `${item.itemName} fournisseur medical Algerie prix`,
        })),
      );

      return res.json(
        ok({
          message: `${enriched.length} items recherchés en ligne`,
          data: enriched,
        }),
      );
    } catch (error) {
      return res.status(500).json(err("Erreur lors de la régénération"));
    }
  },
);

router.post(
  "/:offerId/document-folders",
  requireOfferAccess,
  async (req, res) => {
    try {
      const { offerId } = req.params;
      const { name, parentId, files } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json(err("Nom du dossier requis"));
      }

      const offer = await db.query.offers.findFirst({
        where: eq(offers.id, offerId),
      });
      if (!offer) return res.status(404).json(err("Offre non trouvée"));

      const [folder] = await db
        .insert(offerDocumentFolders)
        .values({
          offerId,
          name: name.trim(),
          parentId: parentId || null,
        })
        .returning();

      if (Array.isArray(files) && files.length > 0) {
        const rows = files.map((file: any) => {
          if (file.source === "received") {
            return {
              folderId: folder.id,
              offerId,
              source: "received" as const,
              supplierResponseAttachmentId:
                file.attachmentId || file.id || null,
              offerAttachmentPath: null,
            };
          }
          return {
            folderId: folder.id,
            offerId,
            source: "sent" as const,
            supplierResponseAttachmentId: null,
            offerAttachmentPath: offer.attachmentPath,
          };
        });

        await db.insert(offerDocumentFolderFiles).values(rows);
      }

      return res
        .status(201)
        .json(ok({ folderId: folder.id, message: "Dossier créé" }));
    } catch (error) {
      console.error("[POST DOCUMENT FOLDER]", error);
      return res.status(500).json(err("Erreur lors de la création du dossier"));
    }
  },
);

router.get(
  "/:offerId/document-folders",
  requireOfferAccess,
  async (req, res) => {
    try {
      const { offerId } = req.params;

      const offer = await db.query.offers.findFirst({
        where: eq(offers.id, offerId),
      });
      if (!offer) return res.status(404).json(err("Offre non trouvée"));

      const folders = await db
        .select()
        .from(offerDocumentFolders)
        .where(eq(offerDocumentFolders.offerId, offerId))
        .orderBy(offerDocumentFolders.createdAt);

      const folderIds = folders.map((f) => f.id);

      let files: any[] = [];
      if (folderIds.length > 0) {
        files = await db
          .select({
            folderFileId: offerDocumentFolderFiles.id,
            folderId: offerDocumentFolderFiles.folderId,
            source: offerDocumentFolderFiles.source,
            supplierResponseAttachmentId:
              offerDocumentFolderFiles.supplierResponseAttachmentId,
            offerAttachmentPath: offerDocumentFolderFiles.offerAttachmentPath,
            createdAt: offerDocumentFolderFiles.createdAt,

            attachmentId: supplierResponseAttachments.id,
            originalFileName: supplierResponseAttachments.originalFileName,
            mimeType: supplierResponseAttachments.mimeType,
            fileSize: supplierResponseAttachments.fileSize,
            attachmentType: supplierResponseAttachments.attachmentType,
            supplierResponseId: supplierResponseAttachments.supplierResponseId,

            responseId: supplierResponses.id,
            receivedAt: supplierResponses.receivedAt,
            supplierId: suppliers.id,
            supplierName: suppliers.name,
          })
          .from(offerDocumentFolderFiles)
          .leftJoin(
            supplierResponseAttachments,
            eq(
              offerDocumentFolderFiles.supplierResponseAttachmentId,
              supplierResponseAttachments.id,
            ),
          )
          .leftJoin(
            supplierResponses,
            eq(
              supplierResponseAttachments.supplierResponseId,
              supplierResponses.id,
            ),
          )
          .leftJoin(suppliers, eq(supplierResponses.supplierId, suppliers.id))
          .where(inArray(offerDocumentFolderFiles.folderId, folderIds));
      }

      const fileMap = new Map<string, typeof files>();
      for (const f of files) {
        const arr = fileMap.get(f.folderId) ?? [];
        arr.push(f);
        fileMap.set(f.folderId, arr);
      }

      const buildTree = (parentId: string | null): any[] => {
        return folders
          .filter((f) => f.parentId === parentId)
          .map((folder) => {
            const folderFiles = fileMap.get(folder.id) ?? [];
            return {
              id: folder.id,
              name: folder.name,
              parentId: folder.parentId,
              createdAt: folder.createdAt,
              files: folderFiles.map((f) => {
                const isSent = f.source === "sent";
                return {
                  uid: `folder:${folder.id}:file:${f.folderFileId}`,
                  id: isSent ? offerId : f.attachmentId,
                  folderFileId: f.folderFileId,
                  source: f.source,
                  name: isSent
                    ? (offer.attachmentName ?? "Pièce jointe offre")
                    : (f.originalFileName ?? "Fichier"),
                  mimeType: f.mimeType,
                  size: f.fileSize,
                  attachmentType: isSent ? "cahier_charge" : f.attachmentType,
                  supplierId: f.supplierId,
                  supplierName: f.supplierName,
                  responseId: f.supplierResponseId,
                  createdAt: f.createdAt,
                  downloadUrl: isSent
                    ? `/api/offers/${offerId}/attachment`
                    : `/api/offers/${offerId}/responses/${f.supplierResponseId}/attachments/${f.attachmentId}/download`,
                };
              }),
              children: buildTree(folder.id),
            };
          });
      };

      return res.json(ok(buildTree(null)));
    } catch (error) {
      console.error("[GET DOCUMENT FOLDERS]", error);
      return res
        .status(500)
        .json(err("Erreur lors de la récupération des dossiers"));
    }
  },
);

router.delete(
  "/:offerId/document-folders/:folderId",
  requireOfferAccess,
  async (req, res) => {
    try {
      const { offerId, folderId } = req.params;

      const [folder] = await db
        .select()
        .from(offerDocumentFolders)
        .where(
          and(
            eq(offerDocumentFolders.id, folderId),
            eq(offerDocumentFolders.offerId, offerId),
          ),
        );

      if (!folder) return res.status(404).json(err("Dossier non trouvé"));

      await db
        .delete(offerDocumentFolders)
        .where(eq(offerDocumentFolders.id, folderId));

      return res.json(ok({ message: "Dossier supprimé" }));
    } catch (error) {
      console.error("[DELETE DOCUMENT FOLDER]", error);
      return res.status(500).json(err("Erreur lors de la suppression"));
    }
  },
);

router.put(
  "/:offerId/document-folders/:folderId",
  requireOfferAccess,
  async (req, res) => {
    try {
      const { offerId, folderId } = req.params;
      const { name } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json(err("Nom requis"));
      }

      const [folder] = await db
        .select()
        .from(offerDocumentFolders)
        .where(
          and(
            eq(offerDocumentFolders.id, folderId),
            eq(offerDocumentFolders.offerId, offerId),
          ),
        );

      if (!folder) return res.status(404).json(err("Dossier non trouvé"));

      await db
        .update(offerDocumentFolders)
        .set({ name: name.trim() })
        .where(eq(offerDocumentFolders.id, folderId));

      return res.json(ok({ message: "Dossier renommé" }));
    } catch (error) {
      console.error("[PUT DOCUMENT FOLDER]", error);
      return res.status(500).json(err("Erreur lors du renommage"));
    }
  },
);

router.delete(
  "/:offerId/document-folders/:folderId/files/:fileId",
  requireOfferAccess,
  async (req, res) => {
    try {
      const { offerId, folderId, fileId } = req.params;

      const [file] = await db
        .select()
        .from(offerDocumentFolderFiles)
        .where(
          and(
            eq(offerDocumentFolderFiles.id, fileId),
            eq(offerDocumentFolderFiles.folderId, folderId),
            eq(offerDocumentFolderFiles.offerId, offerId),
          ),
        );

      if (!file) return res.status(404).json(err("Fichier non trouvé"));

      await db
        .delete(offerDocumentFolderFiles)
        .where(eq(offerDocumentFolderFiles.id, fileId));

      return res.json(ok({ message: "Fichier retiré du dossier" }));
    } catch (error) {
      console.error("[DELETE FOLDER FILE]", error);
      return res.status(500).json(err("Erreur lors du retrait du fichier"));
    }
  },
);

export default router;
