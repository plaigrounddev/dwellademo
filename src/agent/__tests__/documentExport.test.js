import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExportDocumentModel,
  createDocHtml,
  createDocumentExport,
  normalizeDocumentExportFormat,
  sanitizeExportFilename,
} from "../documentExport.js";

test("normalizes supported document export formats", () => {
  assert.equal(normalizeDocumentExportFormat("pdf"), "pdf");
  assert.equal(normalizeDocumentExportFormat("doc"), "doc");
  assert.equal(normalizeDocumentExportFormat("docx"), "doc");
  assert.equal(normalizeDocumentExportFormat("unknown"), "pdf");
});

test("sanitizes export filenames for browser downloads", () => {
  assert.equal(sanitizeExportFilename("Builder: Brief / Brisbane?", "pdf"), "Builder Brief Brisbane.pdf");
  assert.equal(sanitizeExportFilename("", "docx"), "Builder brief.doc");
});

test("creates a Word-compatible document export", async () => {
  const exported = await createDocumentExport({
    title: "Brisbane brief",
    content: "Scope: Custom home\nBudget: $900k",
    format: "doc",
  });
  const html = new TextDecoder().decode(exported.bytes);

  assert.equal(exported.filename, "Brisbane brief.doc");
  assert.equal(exported.mimeType, "application/msword");
  assert.match(html, /<h1>Brisbane brief<\/h1>/);
  assert.match(html, /Scope: Custom home/);
  assert.match(html, /Budget: \$900k/);
});

test("creates a real PDF export", async () => {
  const exported = await createDocumentExport({
    title: "Builder brief",
    content: "Prepare a builder-ready brief with site notes and quote questions.",
    format: "pdf",
  });

  assert.equal(exported.filename, "Builder brief.pdf");
  assert.equal(exported.mimeType, "application/pdf");
  assert.equal(Buffer.from(exported.bytes).subarray(0, 4).toString("utf8"), "%PDF");
  assert.ok(exported.size > 500, "PDF export should contain a generated document body");
});

test("parses markdown structure for styled document exports", () => {
  const model = buildExportDocumentModel({
    title: "Builder brief",
    content: [
      "# Urban Luxe Terrace, Builder Brief",
      "",
      "## Budget",
      "**Build budget:** Around AUD 500,000, subject to site costs.",
      "",
      "## Must-haves",
      "- **Higher ceilings** as a key luxury feature.",
      "- A layout that supports family living.",
      "",
      "## Questions for builders",
      "1. What is included in the base price?",
    ].join("\n"),
  });

  assert.equal(model.title, "Urban Luxe Terrace, Builder Brief");
  assert.deepEqual(model.blocks.map((block) => block.type), [
    "heading",
    "paragraph",
    "heading",
    "listItem",
    "listItem",
    "heading",
    "listItem",
  ]);
  assert.equal(model.blocks[1].segments[0].text, "Build budget:");
  assert.equal(model.blocks[1].segments[0].bold, true);
  assert.equal(model.blocks[3].segments[0].text, "Higher ceilings");
  assert.equal(model.blocks[3].segments[0].bold, true);
});

test("DOC export renders markdown as document styling instead of literal syntax", () => {
  const html = createDocHtml({
    title: "Builder brief",
    content: [
      "# Urban Luxe Terrace, Builder Brief",
      "",
      "## Budget",
      "**Build budget:** Around AUD 500,000.",
      "",
      "- **Higher ceilings** as a key luxury feature.",
      "1. What is included in the base price?",
    ].join("\n"),
  });

  assert.match(html, /<h1>Urban Luxe Terrace, Builder Brief<\/h1>/);
  assert.match(html, /<h2>Budget<\/h2>/);
  assert.match(html, /<strong>Build budget:<\/strong> Around AUD 500,000\./);
  assert.match(html, /<li><strong>Higher ceilings<\/strong> as a key luxury feature\.<\/li>/);
  assert.match(html, /<ol><li>What is included in the base price\?<\/li><\/ol>/);
  assert.doesNotMatch(html, /# Urban Luxe|## Budget|\*\*Build budget|\*\*Higher ceilings|<p>-\s/);
});

test("PDF export does not throw on non-WinAnsi characters", async () => {
  const exported = await createDocumentExport({
    title: "Brief – 測試",
    content: "Client notes include emoji 🏠 and accented café text.",
    format: "pdf",
  });

  assert.equal(exported.mimeType, "application/pdf");
  assert.equal(Buffer.from(exported.bytes).subarray(0, 4).toString("utf8"), "%PDF");
});

test("DOC export preserves Unicode text", async () => {
  const exported = await createDocumentExport({
    title: "Brief – 測試",
    content: "Client notes include emoji 🏠 and accented café text.",
    format: "doc",
  });
  const html = new TextDecoder().decode(exported.bytes);

  assert.match(html, /Brief – 測試/);
  assert.match(html, /emoji 🏠/);
  assert.match(html, /café/);
});

test("escapes HTML content in DOC exports", () => {
  const html = createDocHtml({
    title: "Brief <draft>",
    content: "Check <script>alert(1)</script> before sharing.",
  });

  assert.match(html, /Brief &lt;draft&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
