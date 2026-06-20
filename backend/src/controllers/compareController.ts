import fs from "fs";
import { Request, Response } from "express";

/**
 * POST /api/ai/compare-proformas
 * Body: multipart/form-data
 *   - supplierNames[]: string[]
 *   - supplierFiles[]: File[]
 *   - referenceFile?: File
 *   - backendAttachmentId?: string
 *   - backendAttachmentUrl?: string
 */
export async function compareProformas(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const supplierNames: string[] = req.body.supplierNames || [];
    const supplierFiles: Express.Multer.File[] =
      req.files?.["supplierFiles"] || [];
    const referenceFile: Express.Multer.File | undefined =
      req.files?.["referenceFile"]?.[0];
    const backendAttachmentUrl: string | undefined =
      req.body.backendAttachmentUrl;

    console.log(
      "[Compare] Début comparaison pour",
      supplierNames.length,
      "fournisseurs",
    );

    // === 1. RÉCUPÉRATION DU CAHIER DE CHARGE ===
    let referenceItems: any[] = [];

    if (referenceFile) {
      console.log(
        "[Compare] Cahier de charge uploadé directement:",
        referenceFile.originalname,
      );
      referenceItems = await extractProductsFromPDF(
        fs.readFileSync(referenceFile.path),
        "CAHIER_DE_CHARGE",
      );
    } else if (backendAttachmentUrl) {
      console.log(
        "[Compare] Cahier de charge depuis URL:",
        backendAttachmentUrl,
      );
      try {
        const response = await fetch(backendAttachmentUrl);
        if (!response.ok)
          throw new Error("Impossible de télécharger le cahier de charge");
        const buffer = Buffer.from(await response.arrayBuffer());
        referenceItems = await extractProductsFromPDF(
          buffer,
          "CAHIER_DE_CHARGE",
        );
      } catch (err: any) {
        console.error(
          "[Compare] Erreur téléchargement cahier de charge:",
          err.message,
        );
        return res
          .status(400)
          .json({
            error: "Impossible de récupérer le cahier de charge depuis l'URL",
          });
      }
    } else {
      return res.status(400).json({
        error:
          "Aucun cahier de charge fourni (referenceFile ou backendAttachmentUrl requis)",
      });
    }

    console.log(
      `[Compare] ${referenceItems.length} produits extraits du cahier de charge`,
    );

    if (referenceItems.length === 0) {
      return res
        .status(400)
        .json({ error: "Aucun produit trouvé dans le cahier de charge" });
    }

    // === 2. TRAITEMENT DES FOURNISSEURS ===
    const suppliers: any[] = [];

    for (let i = 0; i < supplierNames.length; i++) {
      const name = supplierNames[i];
      const file = supplierFiles[i];

      if (!file) {
        console.warn(`[Compare] Fichier manquant pour ${name}`);
        continue;
      }

      console.log(`[Compare] Traitement ${name}: ${file.originalname}`);

      try {
        const pdfBuffer = fs.readFileSync(file.path);
        const supplierItems = await extractProductsFromPDF(pdfBuffer, name);
        console.log(
          `[Compare] ${name}: ${supplierItems.length} produits extraits`,
        );

        const matches = matchSupplier(referenceItems, supplierItems);
        console.log(`[Compare] ${name}: ${matches.length} matches calculés`);

        suppliers.push({
          supplierName: name,
          fileName: file.originalname,
          matches,
        });
      } catch (err: any) {
        console.error(`[Compare] Erreur traitement ${name}:`, err.message);
        suppliers.push({
          supplierName: name,
          fileName: file.originalname,
          matches: referenceItems.map((ref) => ({
            referenceItem: ref,
            supplierItem: null,
            compatibility: 0,
            status: "missing",
            reasons: [`Erreur d'analyse: ${err.message}`],
          })),
        });
      }
    }

    // === 3. NETTOYAGE DES FICHIERS TEMPORAIRES ===
    supplierFiles.forEach((f) => {
      try {
        fs.unlinkSync(f.path);
      } catch (_) {}
    });
    if (referenceFile) {
      try {
        fs.unlinkSync(referenceFile.path);
      } catch (_) {}
    }

    // === 4. RÉPONSE ===
    return res.json({ suppliers });
  } catch (error: any) {
    console.error("[Compare] Erreur globale:", error);
    return res.status(500).json({
      error: "Erreur pendant l'analyse OCR/IA",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
