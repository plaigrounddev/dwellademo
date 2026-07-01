import { createHash, timingSafeEqual } from "node:crypto";
import {
  extractBearerToken,
  localDev,
  routeAuth,
  verifyOidc,
  type AuthFn,
} from "eve/channels/auth";

export const MAX_AGENT_REQUEST_BYTES = 40 * 1024 * 1024;
export const MAX_VOICE_AUDIO_BYTES = 25 * 1024 * 1024;

const DEFAULT_CLERK_AUDIENCE = "convex";
const rateLimitBuckets = new Map<string, number[]>();

type DwellaAuthContext = {
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
  readonly authenticator: string;
  readonly issuer?: string;
  readonly principalId: string;
  readonly principalType: string;
  readonly subject?: string;
};

type RateLimitName = "runs" | "voice-session" | "voice-transcribe";

const RATE_LIMITS: Record<RateLimitName, { limit: number; windowMs: number }> = {
  runs: { limit: 30, windowMs: 60_000 },
  "voice-session": { limit: 20, windowMs: 60_000 },
  "voice-transcribe": { limit: 15, windowMs: 60_000 },
};

export async function authenticateDwellaRequest(request: Request) {
  const auth = await routeAuth(request, [
    dwellaRouteSecretAuth(),
    clerkOidcAuth(),
    localDev(),
  ]);
  if (auth instanceof Response) {
    return { ok: false as const, response: auth };
  }
  return { ok: true as const, auth: auth as DwellaAuthContext };
}

export function rejectOversizeRequest(request: Request, maxBytes = MAX_AGENT_REQUEST_BYTES) {
  const contentLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return Response.json(
      {
        status: "request_too_large",
        message: `Dwella can process up to ${Math.round(maxBytes / (1024 * 1024))} MB per request.`,
      },
      { status: 413 },
    );
  }
  return null;
}

export function rejectOversizeBlob(blob: Blob, maxBytes = MAX_VOICE_AUDIO_BYTES) {
  if (blob.size <= maxBytes) return null;
  return Response.json(
    {
      status: "request_too_large",
      message: `Dwella can transcribe up to ${Math.round(maxBytes / (1024 * 1024))} MB per voice note.`,
    },
    { status: 413 },
  );
}

export function checkDwellaRateLimit(auth: DwellaAuthContext, request: Request, name: RateLimitName) {
  const config = RATE_LIMITS[name];
  const key = `${name}:${principalHash(auth)}:${requestIp(request) ?? "unknown"}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const recent = (rateLimitBuckets.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
  if (recent.length >= config.limit) {
    rateLimitBuckets.set(key, recent);
    return Response.json(
      {
        status: "rate_limited",
        message: "Dwella is receiving too many requests for this session. Please try again shortly.",
      },
      { status: 429 },
    );
  }
  recent.push(now);
  rateLimitBuckets.set(key, recent);
  return null;
}

export function createScopedContinuationToken(threadId: string, auth: DwellaAuthContext) {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${continuationPrefix(threadId, auth)}${randomId}`;
}

export function cleanScopedContinuationToken(value: unknown, threadId: string, auth: DwellaAuthContext) {
  const token = String(value ?? "").trim();
  if (!token) return undefined;
  return token.startsWith(continuationPrefix(threadId, auth)) ? token : undefined;
}

export function createDwellaCorsConfig() {
  const configuredOrigins = splitEnvList(process.env.DWELLA_EVE_CORS_ORIGIN);
  return {
    origin: configuredOrigins.length ? configuredOrigins : "*",
    methods: ["POST", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "x-dwella-agent-secret"],
    exposeHeaders: ["content-type"],
    maxAge: 600,
  };
}

function dwellaRouteSecretAuth(): AuthFn<Request> {
  return (request) => {
    const secret = clean(process.env.DWELLA_EVE_ROUTE_SECRET ?? process.env.DWELLA_AGENT_ROUTE_SECRET);
    if (!secret) return null;
    const supplied = clean(request.headers.get("x-dwella-agent-secret"))
      ?? clean(extractBearerToken(request.headers.get("authorization")));
    if (!supplied || !safeEqual(supplied, secret)) return null;
    return {
      attributes: {},
      authenticator: "dwella-route-secret",
      issuer: "dwella",
      principalId: "dwella-internal-proxy",
      principalType: "service",
    };
  };
}

function clerkOidcAuth(): AuthFn<Request> {
  return async (request) => {
    const issuer = clean(process.env.CLERK_JWT_ISSUER_DOMAIN);
    if (!issuer) return null;
    const token = extractBearerToken(request.headers.get("authorization"));
    const result = await verifyOidc(token, {
      issuer,
      audiences: [clean(process.env.DWELLA_CLERK_JWT_AUDIENCE) ?? DEFAULT_CLERK_AUDIENCE],
    });
    if (!result.ok) return null;
    return {
      ...result.sessionAuth,
      authenticator: "clerk",
      principalType: "user",
    };
  };
}

function continuationPrefix(threadId: string, auth: DwellaAuthContext) {
  const safeThreadId = String(threadId)
    .replace(/[^a-zA-Z0-9_.:-]/g, "-")
    .slice(0, 80);
  return `dwella:${principalHash(auth)}:${safeThreadId}:run:`;
}

function principalHash(auth: DwellaAuthContext) {
  return createHash("sha256")
    .update(`${auth.principalType}:${auth.principalId}`)
    .digest("hex")
    .slice(0, 18);
}

function requestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || null;
}

function splitEnvList(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function clean(value: string | null | undefined) {
  const token = String(value ?? "").trim();
  return token || null;
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
