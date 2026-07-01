import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadLocalEnv(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const filenames = options.filenames ?? [".env.local", ".env"];
  const loaded = [];

  for (const filename of filenames) {
    const filepath = path.join(cwd, filename);
    let content;
    try {
      content = await readFile(filepath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.value;
      }
    }
    loaded.push(filename);
  }

  return loaded;
}

export function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const separator = withoutExport.indexOf("=");
  if (separator <= 0) return null;

  const key = withoutExport.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  const rawValue = withoutExport.slice(separator + 1).trim();
  return {
    key,
    value: stripInlineComment(unquoteEnvValue(rawValue)),
  };
}

function unquoteEnvValue(value) {
  if (value.length >= 2 && value.startsWith('"')) {
    const end = findClosingQuote(value, '"');
    if (end > 0) return value.slice(1, end).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (value.length >= 2 && value.startsWith("'")) {
    const end = findClosingQuote(value, "'");
    if (end > 0) return value.slice(1, end);
  }
  return value;
}

function findClosingQuote(value, quote) {
  for (let index = 1; index < value.length; index += 1) {
    if (value[index] === quote && value[index - 1] !== "\\") return index;
  }
  return -1;
}

function stripInlineComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== "\\") {
      quote = quote === char ? null : quote ?? char;
    }
    if (char === "#" && quote === null && /\s/.test(value[index - 1] ?? "")) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
}
