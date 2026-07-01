import { createHash } from "node:crypto";
import { AUSTRALIAN_STATES } from "./policies.js";
import { BackendError } from "./errors.js";

export function now() {
  return Date.now();
}

export function normalizeState(state) {
  if (!state) return undefined;
  const normalized = String(state).trim().toUpperCase();
  return AUSTRALIAN_STATES.includes(normalized) ? normalized : undefined;
}

export function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function compactArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null && item !== "") : [];
}

export function mergeFacts(existing, incoming) {
  return Object.fromEntries(
    Object.entries({ ...existing, ...incoming }).filter(([, value]) => value !== undefined)
  );
}

export function payloadHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function requireEntity(entity, table, id) {
  if (!entity) {
    throw new BackendError("not_found", `${table} record not found`, { table, id });
  }
  return entity;
}

export function formatDate(timestamp, timezone = "UTC") {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp);
}

export function getLocalParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return {
    weekday: parts.find((part) => part.type === "weekday")?.value,
    hour: Number(parts.find((part) => part.type === "hour")?.value),
    minute: Number(parts.find((part) => part.type === "minute")?.value),
  };
}

export function minutesSinceMidnight({ hour, minute }) {
  return hour * 60 + minute;
}
