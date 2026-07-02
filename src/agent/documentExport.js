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
  const documentModel = buildExportDocumentModel({ title, content });
  const filename = sanitizeExportFilename(documentModel.title, normalizedFormat);
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
  const documentModel = buildExportDocumentModel({ title, content });
  const safeTitle = escapeHtml(documentModel.title);
  const body = renderDocumentBlocksAsHtml(documentModel.blocks);
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8">',
    `<title>${safeTitle}</title>`,
    "<style>",
    "body{font-family:Arial,sans-serif;line-height:1.5;color:#111827;margin:48px;max-width:760px;}",
    "h1{font-size:26px;line-height:1.15;margin:0 0 10px;color:#111827;}",
    ".rule{border-top:2px solid #d8b46a;margin:0 0 26px;width:100%;}",
    "h2{font-size:16px;line-height:1.25;margin:22px 0 8px;color:#111827;}",
    "h3{font-size:13px;line-height:1.3;margin:18px 0 7px;color:#374151;text-transform:uppercase;letter-spacing:.06em;}",
    "p{margin:0 0 12px;}",
    "ul,ol{margin:0 0 14px 22px;padding:0;}",
    "li{margin:0 0 7px;padding-left:2px;}",
    "strong{font-weight:700;}",
    "</style>",
    "</head>",
    "<body>",
    `<h1>${safeTitle}</h1>`,
    '<div class="rule"></div>',
    body,
    "</body>",
    "</html>",
  ].join("");
}

export async function createPdfBytes({ title = "Builder brief", content = "" } = {}) {
  const pdf = await PDFDocument.create();
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const headingFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 54;
  const pageWidth = 612;
  const pageHeight = 792;
  const contentWidth = pageWidth - (margin * 2);
  const titleSize = 21;
  const bodySize = 10.75;
  const titleLineHeight = 26;
  const bodyLineHeight = 15;
  const colors = {
    title: rgb(0.07, 0.09, 0.15),
    heading: rgb(0.09, 0.12, 0.19),
    body: rgb(0.11, 0.13, 0.18),
    muted: rgb(0.29, 0.34, 0.43),
    accent: rgb(0.85, 0.68, 0.36),
  };
  const documentModel = buildExportDocumentModel({ title, content });
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawPageBackground = () => {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(1, 1, 1),
    });
  };

  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    drawPageBackground();
    y = pageHeight - margin;
  };

  const ensureSpace = (height) => {
    if (y < margin + height) {
      addPage();
    }
  };

  const addVerticalSpace = (height) => {
    if (y - height < margin) {
      addPage();
      return;
    }
    y -= height;
  };

  const drawPlainLine = (line, { font, size, lineHeight, color = colors.body }) => {
    ensureSpace(lineHeight);
    page.drawText(line, { x: margin, y, size, font, color });
    y -= lineHeight;
  };

  const drawInlineBlock = (segments, {
    x = margin,
    maxWidth = contentWidth,
    size = bodySize,
    lineHeight = bodyLineHeight,
    color = colors.body,
    after = 6,
  } = {}) => {
    const lines = wrapInlineSegments(segments, { regular: bodyFont, bold: boldFont }, size, maxWidth);
    for (const line of lines) {
      ensureSpace(lineHeight);
      let cursorX = x;
      for (const segment of line) {
        const font = segment.bold ? boldFont : bodyFont;
        if (segment.leadingSpace) {
          cursorX += font.widthOfTextAtSize(" ", size);
        }
        page.drawText(segment.text, { x: cursorX, y, size, font, color });
        cursorX += font.widthOfTextAtSize(segment.text, size);
      }
      y -= lineHeight;
    }
    addVerticalSpace(after);
  };

  const drawListItem = (block) => {
    const prefix = block.ordered ? `${block.number}.` : String.fromCharCode(8226);
    const prefixFont = block.ordered ? bodyFont : boldFont;
    const prefixSize = block.ordered ? bodySize : 12;
    const prefixWidth = prefixFont.widthOfTextAtSize(prefix, prefixSize);
    const textX = margin + Math.max(22, prefixWidth + 10);
    const maxWidth = pageWidth - margin - textX;
    const lines = wrapInlineSegments(block.segments, { regular: bodyFont, bold: boldFont }, bodySize, maxWidth);

    lines.forEach((line, index) => {
      ensureSpace(bodyLineHeight);
      if (index === 0) {
        page.drawText(prefix, { x: margin, y, size: prefixSize, font: prefixFont, color: colors.muted });
      }
      let cursorX = textX;
      for (const segment of line) {
        const font = segment.bold ? boldFont : bodyFont;
        if (segment.leadingSpace) {
          cursorX += font.widthOfTextAtSize(" ", bodySize);
        }
        page.drawText(segment.text, { x: cursorX, y, size: bodySize, font, color: colors.body });
        cursorX += font.widthOfTextAtSize(segment.text, bodySize);
      }
      y -= bodyLineHeight;
    });

    addVerticalSpace(3);
  };

  drawPageBackground();

  for (const line of wrapPdfText(normalizePdfText(documentModel.title), titleFont, titleSize, contentWidth)) {
    drawPlainLine(line, { font: titleFont, size: titleSize, lineHeight: titleLineHeight, color: colors.title });
  }

  ensureSpace(12);
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1.4,
    color: colors.accent,
  });
  addVerticalSpace(20);

  for (const block of documentModel.blocks) {
    if (block.type === "heading") {
      const isMinorHeading = block.level >= 3;
      const size = block.level <= 1 ? 16 : isMinorHeading ? 11.5 : 13.5;
      const lineHeight = block.level <= 1 ? 21 : isMinorHeading ? 15 : 18;
      const before = block.level <= 1 ? 10 : isMinorHeading ? 8 : 9;
      const after = isMinorHeading ? 4 : 5;
      addVerticalSpace(before);
      for (const line of wrapPdfText(normalizePdfText(block.text), headingFont, size, contentWidth)) {
        drawPlainLine(line, {
          font: headingFont,
          size,
          lineHeight,
          color: isMinorHeading ? colors.muted : colors.heading,
        });
      }
      addVerticalSpace(after);
      continue;
    }

    if (block.type === "listItem") {
      drawListItem(block);
      continue;
    }

    drawInlineBlock(block.segments);
  }

  return await pdf.save();
}

export function buildExportDocumentModel({ title = "Builder brief", content = "" } = {}) {
  const fallbackTitle = String(title || "Builder brief").trim() || "Builder brief";
  const lines = String(content ?? "").replace(/\r\n/g, "\n").split("\n");
  let displayTitle = fallbackTitle;
  const firstTextLineIndex = lines.findIndex((line) => line.trim());

  if (firstTextLineIndex >= 0) {
    const firstHeading = lines[firstTextLineIndex].trim().match(/^#\s+(.+)$/);
    if (firstHeading) {
      displayTitle = plainInlineText(parseInlineContent(firstHeading[1])).trim() || displayTitle;
      lines.splice(firstTextLineIndex, 1);
    }
  }

  return {
    title: displayTitle,
    blocks: parseDocumentBlocks(lines.join("\n")),
  };
}

function parseDocumentBlocks(content) {
  const cleanContent = String(content ?? "").replace(/\r\n/g, "\n").trim();
  if (!cleanContent) {
    return [{ type: "paragraph", segments: parseInlineContent("No brief content was provided.") }];
  }

  const blocks = [];
  const paragraphLines = [];
  const flushParagraph = () => {
    const text = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    paragraphLines.length = 0;
    if (text) {
      blocks.push({ type: "paragraph", segments: parseInlineContent(text) });
    }
  };

  for (const rawLine of cleanContent.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: plainInlineText(parseInlineContent(heading[2])),
      });
      continue;
    }

    const unorderedListItem = line.match(/^[-*]\s+(.+)$/);
    if (unorderedListItem) {
      flushParagraph();
      blocks.push({
        type: "listItem",
        ordered: false,
        segments: parseInlineContent(unorderedListItem[1]),
      });
      continue;
    }

    const orderedListItem = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (orderedListItem) {
      flushParagraph();
      blocks.push({
        type: "listItem",
        ordered: true,
        number: Number.parseInt(orderedListItem[1], 10),
        segments: parseInlineContent(orderedListItem[2]),
      });
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  return blocks.length ? blocks : [{ type: "paragraph", segments: parseInlineContent("No brief content was provided.") }];
}

function parseInlineContent(value) {
  const source = String(value ?? "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
  const segments = [];
  const boldPattern = /(\*\*|__)(.+?)\1/g;
  let cursor = 0;
  let match;

  while ((match = boldPattern.exec(source)) !== null) {
    pushInlineSegment(segments, source.slice(cursor, match.index), false);
    pushInlineSegment(segments, match[2], true);
    cursor = match.index + match[0].length;
  }

  pushInlineSegment(segments, source.slice(cursor), false);
  return segments.length ? segments : [{ text: "", bold: false }];
}

function pushInlineSegment(segments, value, bold) {
  const text = cleanInlineText(value);
  if (!text) return;
  const previous = segments[segments.length - 1];
  if (previous?.bold === bold) {
    previous.text = `${previous.text}${text}`;
    return;
  }
  segments.push({ text, bold });
}

function cleanInlineText(value) {
  return String(value ?? "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\s+/g, " ");
}

function plainInlineText(segments) {
  return segments.map((segment) => segment.text).join("").replace(/\s+/g, " ").trim();
}

function wrapInlineSegments(segments, fonts, fontSize, maxWidth) {
  const tokens = [];
  for (const segment of segments) {
    const words = normalizePdfText(segment.text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    for (const word of words) {
      tokens.push({ text: word, bold: segment.bold });
    }
  }

  if (tokens.length === 0) return [[{ text: "", bold: false, leadingSpace: false }]];

  const lines = [];
  let currentLine = [];
  let currentWidth = 0;

  for (const token of tokens) {
    const font = token.bold ? fonts.bold : fonts.regular;
    const spaceWidth = currentLine.length ? font.widthOfTextAtSize(" ", fontSize) : 0;
    const tokenWidth = font.widthOfTextAtSize(token.text, fontSize);

    if (currentLine.length && currentWidth + spaceWidth + tokenWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    }

    const leadingSpace = currentLine.length > 0;
    currentLine.push({ ...token, leadingSpace });
    currentWidth += (leadingSpace ? spaceWidth : 0) + tokenWidth;
  }

  if (currentLine.length) lines.push(currentLine);
  return lines;
}

function renderDocumentBlocksAsHtml(blocks) {
  const html = [];
  let activeListType = null;

  const closeList = () => {
    if (!activeListType) return;
    html.push(`</${activeListType}>`);
    activeListType = null;
  };

  for (const block of blocks) {
    if (block.type !== "listItem") {
      closeList();
    }

    if (block.type === "heading") {
      const tag = block.level >= 3 ? "h3" : "h2";
      html.push(`<${tag}>${escapeHtml(block.text)}</${tag}>`);
      continue;
    }

    if (block.type === "listItem") {
      const listType = block.ordered ? "ol" : "ul";
      if (activeListType !== listType) {
        closeList();
        html.push(`<${listType}>`);
        activeListType = listType;
      }
      html.push(`<li>${renderInlineHtml(block.segments)}</li>`);
      continue;
    }

    html.push(`<p>${renderInlineHtml(block.segments)}</p>`);
  }

  closeList();
  return html.join("");
}

function renderInlineHtml(segments) {
  return segments
    .map((segment) => {
      const text = escapeHtml(segment.text);
      return segment.bold ? `<strong>${text}</strong>` : text;
    })
    .join("");
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
