import { now } from "./utils.js";

const TABLES = [
  "projects",
  "builders",
  "builderLicences",
  "builderWebsiteSnapshots",
  "builderMemoryCards",
  "builderContactEvents",
  "briefs",
  "documents",
  "quoteDocuments",
  "approvals",
  "followUps",
  "agentThreads",
  "agentRuns",
  "agentMessages",
  "agentEvents",
  "screenCommands",
];

export function createMemoryRepository(initialData = {}) {
  const tables = new Map();
  const counters = new Map();

  for (const table of TABLES) {
    tables.set(table, new Map());
    counters.set(table, 0);
    for (const record of initialData[table] ?? []) {
      const id = record.id ?? nextId(table, counters);
      tables.get(table).set(id, { ...record, id });
      const generatedIdMatch = String(id).match(new RegExp(`^${table}:(\\d+)$`));
      if (generatedIdMatch) {
        counters.set(table, Math.max(counters.get(table), Number(generatedIdMatch[1])));
      }
    }
  }

  function nextId(table, source = counters) {
    const count = (source.get(table) ?? 0) + 1;
    source.set(table, count);
    return `${table}:${count}`;
  }

  function list(table, predicate = () => true) {
    return [...tables.get(table).values()].filter(predicate);
  }

  function get(table, id) {
    return tables.get(table).get(id);
  }

  function insert(table, record) {
    const timestamp = now();
    const id = record.id ?? nextId(table);
    const stored = {
      ...record,
      id,
      createdAt: record.createdAt ?? timestamp,
      updatedAt: record.updatedAt ?? timestamp,
    };
    tables.get(table).set(id, stored);
    return stored;
  }

  function patch(table, id, patch) {
    const current = get(table, id);
    if (!current) return undefined;
    const updated = { ...current, ...patch, id, updatedAt: now() };
    tables.get(table).set(id, updated);
    return updated;
  }

  function upsert(table, id, record) {
    return get(table, id) ? patch(table, id, record) : insert(table, { ...record, id });
  }

  return { list, get, insert, patch, upsert };
}
