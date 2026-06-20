import fs from "fs/promises";
import * as XLSX from "xlsx";

export async function extractTextFromPdf(filePath: string) {
  const { PDFParse } = require("pdf-parse");
  const parser = new PDFParse({ url: filePath });
  const result = await parser.getText();
  return result.text ?? "";
}

export async function extractTextSmart(filePath: string) {
  const { PDFParse } = require("pdf-parse");
  const parser = new PDFParse({ url: filePath });
  const result = await parser.getText();

  const directText = result.text?.trim() || "";

  if (directText.length > 100) {
    return {
      text: directText,
      method: "pdf_text" as const,
      ocrRequired: false,
      pages: result.numpages,
    };
  }

  const ocrResult = await ocrScannedPdf(filePath);

  return {
    text: ocrResult.text,
    method: "ocr" as const,
    ocrRequired: true,
    pages: ocrResult.pages,
  };
}
import mammoth from "mammoth";
import { ocrScannedPdf } from "./ocrnode";

export async function extractTextFromDocx(filePath: string) {
  const result = await mammoth.extractRawText({ path: filePath });

  return result.value;
}
export type ExtractedOfferData = {
  priceHT?: number;
  tva?: number;
  priceTTC?: number;
  currency?: string;
  deliveryDelayDays?: number;
  warrantyMonths?: number;
  validityDays?: number;
};

export async function extractTextFromExcel(filePath: string): Promise<string> {
  try {
    const workbook = XLSX.readFile(filePath);

    let extractedText = "";

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      // Convert sheet to 2D array
      const rows = XLSX.utils.sheet_to_json<
        (string | number | boolean | null)[]
      >(sheet, {
        header: 1,
        defval: "",
      });

      extractedText += `\n===== SHEET: ${sheetName} =====\n`;

      for (const row of rows) {
        const line = row
          .map((cell: any) => {
            if (cell === null || cell === undefined) {
              return "";
            }

            return String(cell).trim();
          })
          .filter(Boolean)
          .join(" | ");

        if (line.trim()) {
          extractedText += `${line}\n`;
        }
      }

      extractedText += "\n";
    }

    return extractedText.trim();
  } catch (error) {
    console.error("[EXCEL TEXT EXTRACTION ERROR]", error);

    return "";
  }
}
export function extractOfferData(text: string): ExtractedOfferData {
  const normalized = text.replace(/\s+/g, " ");

  const priceHT = findAmount(normalized, [
    "total ht",
    "montant ht",
    "prix ht",
    "subtotal",
  ]);

  const priceTTC = findAmount(normalized, [
    "total ttc",
    "montant ttc",
    "prix ttc",
    "grand total",
  ]);

  const tva = findPercentage(normalized, ["tva", "vat"]);

  const deliveryDelayDays = findDays(normalized, [
    "délai de livraison",
    "delai de livraison",
    "delivery time",
    "delivery delay",
  ]);

  const warrantyMonths = findMonths(normalized, ["garantie", "warranty"]);

  const validityDays = findDays(normalized, [
    "validité de l'offre",
    "validite de l'offre",
    "offer validity",
  ]);

  return {
    priceHT,
    tva,
    priceTTC,
    currency: detectCurrency(normalized),
    deliveryDelayDays,
    warrantyMonths,
    validityDays,
  };
}

function findAmount(text: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^0-9]{0,30}([0-9\\s.,]+)`, "i");

    const match = text.match(regex);

    if (match?.[1]) {
      return parseNumber(match[1]);
    }
  }

  return undefined;
}

function findPercentage(text: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^0-9]{0,20}([0-9]{1,2})\\s?%`, "i");
    const match = text.match(regex);

    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return undefined;
}

function findDays(text: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^0-9]{0,30}([0-9]{1,4})\\s?jours?`, "i");
    const match = text.match(regex);

    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return undefined;
}

function findMonths(text: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^0-9]{0,30}([0-9]{1,3})\\s?mois`, "i");
    const match = text.match(regex);

    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return undefined;
}

function detectCurrency(text: string) {
  if (text.includes("dzd") || text.includes("da")) return "DZD";
  if (text.includes("eur") || text.includes("€")) return "EUR";
  if (text.includes("usd") || text.includes("$")) return "USD";

  return undefined;
}

function parseNumber(value: string) {
  const cleaned = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");

  const number = Number(cleaned);

  return Number.isNaN(number) ? undefined : number;
}
