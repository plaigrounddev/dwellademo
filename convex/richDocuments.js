import { BlockNoteEditor } from "@blocknote/core";

const DEFAULT_BLOCK_PROPS = {
  backgroundColor: "default",
  textColor: "default",
  textAlignment: "left",
};

let blockNoteSchema = null;

export function getBlockNoteSchema() {
  if (!blockNoteSchema) {
    blockNoteSchema = BlockNoteEditor.create().pmSchema;
  }
  return blockNoteSchema;
}

export function createBlockNoteDocumentFromText(text = "") {
  const blocks = textToBlockContainers(text);
  return {
    type: "doc",
    content: blocks.length
      ? [
          {
            type: "blockGroup",
            content: blocks,
          },
        ]
      : [],
  };
}

export function textToBlockContainers(text = "") {
  return splitTextBlocks(text).map((block, index) => createBlockContainer(block, index));
}

export function extractTextFromSnapshot(snapshot) {
  try {
    const parsed = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot;
    const lines = [];
    collectTextLines(parsed, lines);
    return lines
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  } catch {
    return "";
  }
}

export function extractTextFromNode(node) {
  if (!node) return "";
  return String(node.textContent ?? "").trim();
}

function createBlockContainer(block, index) {
  return {
    type: "blockContainer",
    attrs: { id: createBlockId(index) },
    content: [createBlockContent(block)],
  };
}

function createBlockContent(block) {
  const inlineNodes = block.text ? parseInlineMarkdown(block.text) : [];
  const content = inlineNodes.length ? inlineNodes : undefined;
  if (block.kind === "heading") {
    return {
      type: "heading",
      attrs: {
        ...DEFAULT_BLOCK_PROPS,
        level: block.level,
        isToggleable: false,
      },
      ...(content ? { content } : {}),
    };
  }
  if (block.kind === "bullet") {
    return {
      type: "bulletListItem",
      attrs: DEFAULT_BLOCK_PROPS,
      ...(content ? { content } : {}),
    };
  }
  if (block.kind === "numbered") {
    return {
      type: "numberedListItem",
      attrs: DEFAULT_BLOCK_PROPS,
      ...(content ? { content } : {}),
    };
  }
  return {
    type: "paragraph",
    attrs: DEFAULT_BLOCK_PROPS,
    ...(content ? { content } : {}),
  };
}

export function parseInlineMarkdown(text) {
  const source = String(text ?? "");
  if (!source) return [];
  const nodes = [];
  // Unwrap markdown links to their label text, then walk bold/italic/code spans.
  const unlinked = source.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const pattern = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|__([^_]+)__|_([^_\n]+)_|`([^`\n]+)`)/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(unlinked)) !== null) {
    if (match.index > cursor) {
      nodes.push({ type: "text", text: unlinked.slice(cursor, match.index) });
    }
    if (match[2] !== undefined || match[4] !== undefined) {
      nodes.push({ type: "text", text: match[2] ?? match[4], marks: [{ type: "bold" }] });
    } else if (match[3] !== undefined || match[5] !== undefined) {
      nodes.push({ type: "text", text: match[3] ?? match[5], marks: [{ type: "italic" }] });
    } else {
      nodes.push({ type: "text", text: match[6], marks: [{ type: "code" }] });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < unlinked.length) {
    nodes.push({ type: "text", text: unlinked.slice(cursor) });
  }
  return nodes.filter((node) => node.text);
}

function splitTextBlocks(text) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  return normalized
    .split(/\n{2,}/)
    .flatMap((section) => section.split("\n"))
    .map(parseTextLine)
    .filter((block) => block.text);
}

function parseTextLine(line) {
  const trimmed = String(line ?? "").trim();
  const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    return {
      kind: "heading",
      level: Math.min(3, heading[1].length),
      text: heading[2].trim(),
    };
  }
  const bullet = trimmed.match(/^[-*]\s+(.+)$/);
  if (bullet) {
    return { kind: "bullet", text: bullet[1].trim() };
  }
  const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
  if (numbered) {
    return { kind: "numbered", text: numbered[1].trim() };
  }
  return { kind: "paragraph", text: trimmed };
}

function createBlockId(index) {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return randomId;
  return `server-block-${Date.now().toString(36)}-${index}`;
}

function collectTextLines(node, lines) {
  if (!node || typeof node !== "object") return;
  if (node.type === "text" && typeof node.text === "string") {
    lines.push(node.text);
    return;
  }
  if (Array.isArray(node.content)) {
    const before = lines.length;
    for (const child of node.content) collectTextLines(child, lines);
    if (isBlockLikeNode(node) && lines.length > before) {
      lines.push("\n");
    }
  }
}

function isBlockLikeNode(node) {
  return [
    "paragraph",
    "heading",
    "bulletListItem",
    "numberedListItem",
    "checkListItem",
    "quote",
    "codeBlock",
    "table",
    "tableRow",
  ].includes(node?.type);
}
