import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const DOCUMENT_EXPORT_FORMATS = Object.freeze({
  pdf: {
    extension: "pdf",
    mimeType: "application/pdf",
  },
  doc: {
    extension: "doc",
    mimeType: "application/msword",
  },
});

export function normalizeDocumentExportFormat(format) {
  const cleanFormat = String(format ?? "").trim().toLowerCase();
  return cleanFormat === "doc" || cleanFormat === "docx" ? "doc" : "pdf";
}

export function sanitizeExportFilename(title, format = "pdf") {
  const normalizedFormat = normalizeDocumentExportFormat(format);
  const extension = DOCUMENT_EXPORT_FORMATS[normalizedFormat].extension;
  const baseName = String(title ?? "Builder brief")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim() || "Builder brief";
  return `${baseName}.${extension}`;
}

export async function createDocumentExport({ title = "Builder brief", content = "", format = "pdf" } = {}) {
  const normalizedFormat = normalizeDocumentExportFormat(format);
  const filename = sanitizeExportFilename(title, normalizedFormat);
  const mimeType = DOCUMENT_EXPORT_FORMATS[normalizedFormat].mimeType;
  const bytes = normalizedFormat === "doc"
    ? new TextEncoder().encode(createDocHtml({ title, content }))
    : await createPdfBytes({ title, content });

  return {
    filename,
    mimeType,
    bytes,
    size: bytes.byteLength,
  };
}

export function downloadDocumentExport(exportFile) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("Document downloads require a browser environment.");
  }

  const blob = new Blob([exportFile.bytes], { type: exportFile.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exportFile.filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function createDocHtml({ title = "Builder brief", content = "" } = {}) {
  const safeTitle = escapeHtml(String(title || "Builder brief"));
  const body = renderPlainTextAsHtml(content);
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8">',
    `<title>${safeTitle}</title>`,
    "<style>",
    "body{font-family:Arial,sans-serif;line-height:1.45;color:#111827;margin:48px;}",
    "h1{font-size:24px;margin:0 0 20px;}",
    "p{margin:0 0 12px;}",
    "</style>",
    "</head>",
    "<body>",
    `<h1>${safeTitle}</h1>`,
    body,
    "</body>",
    "</html>",
  ].join("");
}

export async function createPdfBytes({ title = "Builder brief", content = "" } = {}) {
  const pdf = await PDFDocument.create();
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  const margin = 54;
  const pageWidth = 612;
  const pageHeight = 792;
  const titleSize = 18;
  const bodySize = 11;
  const titleLineHeight = 24;
  const bodyLineHeight = 15;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawLine = (line, { font, size, lineHeight, color = rgb(0.07, 0.09, 0.15) }) => {
    if (y < margin + lineHeight) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, { x: margin, y, size, font, color });
    y -= lineHeight;
  };

  for (const line of wrapPdfText(normalizePdfText(title || "Builder brief"), titleFont, titleSize, pageWidth - (margin * 2))) {
    drawLine(line, { font: titleFont, size: titleSize, lineHeight: titleLineHeight });
  }
  y -= 10;

  const paragraphs = splitParagraphs(content);
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      y -= bodyLineHeight;
      continue;
    }
    for (const line of wrapPdfText(normalizePdfText(paragraph), bodyFont, bodySize, pageWidth - (margin * 2))) {
      drawLine(line, { font: bodyFont, size: bodySize, lineHeight: bodyLineHeight });
    }
    y -= 6;
  }

  return await pdf.save();
}

function splitParagraphs(content) {
  const cleanContent = String(content ?? "").trim();
  if (!cleanContent) return ["No brief content was provided."];
  return cleanContent
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .flatMap((block) => block.split("\n"))
    .map((paragraph) => paragraph.trim());
}

function wrapPdfText(text, font, fontSize, maxWidth) {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [""];
  const lines = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(nextLine, fontSize) <= maxWidth) {
      line = nextLine;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }

  if (line) lines.push(line);
  return lines;
}

function normalizePdfText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function renderPlainTextAsHtml(content) {
  return splitParagraphs(content)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
