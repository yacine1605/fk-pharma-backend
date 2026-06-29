// services/document-verification.service.ts
// AI-powered document stamp/signature verification using GPT-4o vision.

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { loadPdf, renderPageToBase64 } from "./email/ai/pdfExtract";

// ── OpenAI client ────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Use gpt-4o for vision tasks — best available model for image analysis.
const VISION_MODEL = "gpt-4o";

// ── Types ────────────────────────────────────────────────────────────────────

export type StampType =
  | "official_round"
  | "rectangular"
  | "ink_stamp"
  | "digital"
  | "none";

export type SignatureType = "handwritten" | "digital_typed" | "none";
export type DocumentQuality = "clear" | "blurry" | "unreadable";

export type DocumentVerificationResult = {
  isApproved: boolean;
  confidence: number;
  stampDetected: boolean;
  signatureDetected: boolean;
  stampType: StampType;
  signatureType: SignatureType;
  documentQuality: DocumentQuality;
  approvalReason: string;
  pagesAnalyzed: number;
  details: {
    stampLocation: string;
    signatureLocation: string;
    hasCompanyInfo: boolean;
    hasDate: boolean;
  };
};

export type VerificationOptions = {
  /** Which pages to analyze for PDFs: "all", "first", "last", "first_and_last" */
  pageStrategy?: "all" | "first" | "last" | "first_and_last";
  /** Minimum confidence threshold for auto-approval (default: 0.75) */
  approvalThreshold?: number;
  /** Max pages to analyze (prevents runaway costs on huge PDFs) */
  maxPages?: number;
};

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert AI system specialized in verifying official stamps, seals, and signatures on business documents, proformas, invoices, and government forms.

Your job is to analyze the provided image and determine:
1. STAMP/SEAL PRESENCE: Is there an official company stamp, round seal, rectangular stamp, or ink stamp?
2. STAMP TYPE: What kind of stamp is it? (official_round, rectangular, ink_stamp, digital, none)
3. SIGNATURE PRESENCE: Is there a handwritten signature?
4. SIGNATURE TYPE: handwritten (natural pen), digital_typed (computer font), or none
5. COMPANY INFO: Does the stamp/document contain company name, registration number, or address?
6. DATE: Is there a date on the document near the stamp/signature?
7. QUALITY: Is the image clear enough to verify (clear, blurry, unreadable)?

IMPORTANT RULES:
- A document is APPROVED (isApproved: true) if it contains a VISIBLE STAMP/SEAL with confidence >= 0.7
- A handwritten signature alone is NOT sufficient for approval — a stamp is required
- If the document is blank or has only typed text without any stamp/signature, it is NOT approved
- If the image is too blurry to determine stamp presence, mark as NOT approved with low confidence
- Be thorough: look at ALL areas of the image, especially corners and bottom sections

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "isApproved": true,
  "confidence": 0.95,
  "stampDetected": true,
  "signatureDetected": true,
  "stampType": "official_round",
  "signatureType": "handwritten",
  "documentQuality": "clear",
  "approvalReason": "Official round company stamp detected in bottom-right corner with high clarity. Handwritten signature present.",
  "details": {
    "stampLocation": "bottom-right corner",
    "signatureLocation": "bottom-center",
    "hasCompanyInfo": true,
    "hasDate": true
  }
}`;

// ── Core analysis function ───────────────────────────────────────────────────

async function analyzeImageForStamp(
  base64Image: string,
  mimeType: string,
): Promise<DocumentVerificationResult> {
  const response = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this document page for stamps, seals, and signatures. Determine if the document should be approved based on the presence of an official stamp.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(content);

    return {
      isApproved: Boolean(parsed.isApproved),
      confidence: clampConfidence(parsed.confidence),
      stampDetected: Boolean(parsed.stampDetected),
      signatureDetected: Boolean(parsed.signatureDetected),
      stampType: validateStampType(parsed.stampType),
      signatureType: validateSignatureType(parsed.signatureType),
      documentQuality: validateQuality(parsed.documentQuality),
      approvalReason: String(parsed.approvalReason ?? "No reason provided"),
      pagesAnalyzed: 1,
      details: {
        stampLocation: String(parsed.details?.stampLocation ?? "N/A"),
        signatureLocation: String(parsed.details?.signatureLocation ?? "N/A"),
        hasCompanyInfo: Boolean(parsed.details?.hasCompanyInfo),
        hasDate: Boolean(parsed.details?.hasDate),
      },
    };
  } catch (error) {
    console.error("[DOC-VERIFY] Failed to parse AI response:", content.slice(0, 500));

    return {
      isApproved: false,
      confidence: 0,
      stampDetected: false,
      signatureDetected: false,
      stampType: "none",
      signatureType: "none",
      documentQuality: "unreadable",
      approvalReason: "AI analysis failed — could not parse response.",
      pagesAnalyzed: 1,
      details: {
        stampLocation: "N/A",
        signatureLocation: "N/A",
        hasCompanyInfo: false,
        hasDate: false,
      },
    };
  }
}

// ── Multi-page PDF analysis ──────────────────────────────────────────────────

async function analyzeMultiplePages(
  pdfBuffer: Buffer,
  options: VerificationOptions = {},
): Promise<DocumentVerificationResult> {
  const { pageStrategy = "last", maxPages = 5 } = options;

  const pdf = await loadPdf(pdfBuffer);
  const numPages = pdf.numPages;

  // Determine which pages to analyze
  let targetPages: number[] = [];

  switch (pageStrategy) {
    case "first":
      targetPages = [1];
      break;
    case "last":
      targetPages = [numPages];
      break;
    case "first_and_last":
      targetPages = numPages > 1 ? [1, numPages] : [1];
      break;
    case "all":
      targetPages = Array.from({ length: Math.min(numPages, maxPages) }, (_, i) => i + 1);
      break;
    default:
      targetPages = [numPages];
  }

  let bestResult: DocumentVerificationResult | null = null;

  for (const pageNum of targetPages) {
    try {
      const base64 = await renderPageToBase64(pdf, pageNum);
      const result = await analyzeImageForStamp(base64, "image/png");

      // Keep the result with the highest confidence stamp detection
      if (
        !bestResult ||
        (result.stampDetected && !bestResult.stampDetected) ||
        (result.stampDetected === bestResult.stampDetected &&
          result.confidence > bestResult.confidence)
      ) {
        bestResult = result;
      }

      // Early exit if we found an approved stamp with high confidence
      if (result.isApproved && result.confidence >= 0.85) {
        bestResult.pagesAnalyzed = targetPages.indexOf(pageNum) + 1;
        return bestResult;
      }
    } catch (err) {
      console.error(`[DOC-VERIFY] Failed to analyze page ${pageNum}:`, err);
    }
  }

  if (bestResult) {
    bestResult.pagesAnalyzed = targetPages.length;
    return bestResult;
  }

  return {
    isApproved: false,
    confidence: 0,
    stampDetected: false,
    signatureDetected: false,
    stampType: "none",
    signatureType: "none",
    documentQuality: "unreadable",
    approvalReason: "No pages could be analyzed.",
    pagesAnalyzed: 0,
    details: {
      stampLocation: "N/A",
      signatureLocation: "N/A",
      hasCompanyInfo: false,
      hasDate: false,
    },
  };
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function analyzeDocumentForStamp(
  filePath: string,
  mimeType: string,
  options: VerificationOptions = {},
): Promise<DocumentVerificationResult> {
  const { approvalThreshold = 0.75 } = options;
  const ext = path.extname(filePath).toLowerCase();

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  let result: DocumentVerificationResult;

  if (ext === ".pdf" || mimeType === "application/pdf") {
    const pdfBuffer = fs.readFileSync(filePath);
    result = await analyzeMultiplePages(pdfBuffer, options);
  } else if (
    [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"].includes(ext) ||
    mimeType.startsWith("image/")
  ) {
    const imageBuffer = fs.readFileSync(filePath);
    const base64 = imageBuffer.toString("base64");
    const imageMime = mimeType || guessMimeType(ext);
    result = await analyzeImageForStamp(base64, imageMime);
  } else {
    throw new Error(
      `Unsupported file format for stamp verification: ${ext}. Supported: PDF, PNG, JPG, WebP, BMP, TIFF.`,
    );
  }

  // Apply approval threshold
  if (result.stampDetected && result.confidence >= approvalThreshold) {
    result.isApproved = true;
  } else {
    result.isApproved = false;
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clampConfidence(value: unknown): number {
  const num = Number(value);

  if (!Number.isFinite(num)) return 0;
  if (num > 1) return Math.min(num / 100, 1);

  return Math.max(0, Math.min(num, 1));
}

function validateStampType(value: unknown): StampType {
  const valid: StampType[] = [
    "official_round",
    "rectangular",
    "ink_stamp",
    "digital",
    "none",
  ];

  return valid.includes(value as StampType) ? (value as StampType) : "none";
}

function validateSignatureType(value: unknown): SignatureType {
  const valid: SignatureType[] = ["handwritten", "digital_typed", "none"];

  return valid.includes(value as SignatureType)
    ? (value as SignatureType)
    : "none";
}

function validateQuality(value: unknown): DocumentQuality {
  const valid: DocumentQuality[] = ["clear", "blurry", "unreadable"];

  return valid.includes(value as DocumentQuality)
    ? (value as DocumentQuality)
    : "unreadable";
}

function guessMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
  };

  return map[ext] || "image/png";
}
