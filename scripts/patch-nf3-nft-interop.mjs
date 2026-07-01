import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.join(
  process.cwd(),
  "node_modules",
  "nf3",
  "dist",
  "node_modules",
  "@vercel",
  "nft",
  "out",
  "index.js",
);

const source = await readFile(target, "utf8");
if (source.includes("exports.nodeFileTrace = node_file_trace_1.nodeFileTrace;")) {
  process.exit(0);
}

let patched = source.replace(
  /Object\.defineProperty\(exports,\s*"nodeFileTrace",\s*\{\s*enumerable:\s*(?:!?0|true),\s*get:\s*function\s*\(\)\s*\{\s*return node_file_trace_1\.nodeFileTrace;?\s*\}\s*\}\);?/,
  "exports.nodeFileTrace = node_file_trace_1.nodeFileTrace;",
);

if (patched === source) {
  patched = source.replace(
    /Object\.defineProperty\(exports,"nodeFileTrace",\{enumerable:!0,get:function\(\)\{return node_file_trace_1\.nodeFileTrace\}\}\);?/,
    "exports.nodeFileTrace = node_file_trace_1.nodeFileTrace;",
  );
}

if (patched === source) {
  throw new Error(`Could not patch NF3 vendored @vercel/nft interop at ${target}`);
}

await writeFile(target, patched);
