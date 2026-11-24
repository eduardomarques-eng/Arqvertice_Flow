import crypto from "node:crypto";
import { getStoredObject } from "@/server/storage";

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdfDocument {
  sha256: string;
  numPages: number;
  pages: ExtractedPdfPage[];
  fullText: string;
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Extrai texto página por página de um PDF binário usando `pdf-parse` v2 (`PDFParse`).
 * Mantém fallback seguro para texto puro caso o buffer não seja PDF binário (útil em testes/mocks).
 */
export async function extractPdfFromBuffer(buffer: Buffer): Promise<ExtractedPdfDocument> {
  const sha256 = computeSha256(buffer);
  const isPdfHeader = buffer.subarray(0, 5).toString("ascii") === "%PDF-";

  if (!isPdfHeader) {
    const rawText = buffer.toString("utf8");
    const splitPages = rawText.split(/\f+/);
    const pages: ExtractedPdfPage[] = splitPages.map((text, idx) => ({
      pageNumber: idx + 1,
      text: text.trim(),
    }));
    return {
      sha256,
      numPages: pages.length,
      pages,
      fullText: rawText,
    };
  }

  const pdfParseMod = (await import("pdf-parse")) as unknown as {
    PDFParse?: new (opts: { data: Uint8Array | Buffer }) => {
      getText: () => Promise<{
        text?: string;
        total?: number;
        pages?: Array<{ num?: number; text?: string }>;
      }>;
      destroy?: () => Promise<void>;
    };
  };

  if (typeof pdfParseMod.PDFParse === "function") {
    const parser = new pdfParseMod.PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const rawPages = Array.isArray(result.pages) ? result.pages : [];
      const pages: ExtractedPdfPage[] =
        rawPages.length > 0
          ? rawPages.map((p, idx) => ({
              pageNumber: typeof p.num === "number" ? p.num : idx + 1,
              text: String(p.text ?? "").trim(),
            }))
          : [{ pageNumber: 1, text: String(result.text ?? "").trim() }];

      return {
        sha256,
        numPages: pages.length,
        pages,
        fullText: result.text ?? pages.map((p) => p.text).join("\n\f\n"),
      };
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy().catch(() => {});
      }
    }
  }

  throw new Error("Driver pdf-parse indisponível neste ambiente.");
}

/**
 * Baixa o buffer de um arquivo do storage privado (R2/S3 ou local) ou de URL HTTP(S) e extrai o PDF.
 */
export async function readPdfFromSource(source: {
  storageKey?: string | null;
  url?: string | null;
}): Promise<ExtractedPdfDocument> {
  if (source.storageKey) {
    const bytes = await getStoredObject(source.storageKey);
    return extractPdfFromBuffer(bytes);
  }

  if (source.url && /^https?:\/\//i.test(source.url)) {
    const res = await fetch(source.url, { signal: AbortSignal.timeout(25_000) });
    if (!res.ok) {
      throw new Error(`Falha ao baixar PDF da URL (${res.status}).`);
    }
    const arrayBuf = await res.arrayBuffer();
    return extractPdfFromBuffer(Buffer.from(arrayBuf));
  }

  throw new Error("Fonte de PDF sem storageKey ou URL válida.");
}
