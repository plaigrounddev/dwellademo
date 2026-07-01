export const OPENAI_REALTIME_MODEL = "gpt-realtime-2";
export const OPENAI_REALTIME_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

export function buildDwellaRealtimeSessionConfig({
  instructions,
  tools,
  transcriptionModel = "gpt-4o-transcribe",
}) {
  return {
    type: "realtime",
    model: OPENAI_REALTIME_MODEL,
    instructions,
    tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
    reasoning: { effort: "low" },
    audio: {
      input: {
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
          interrupt_response: true,
        },
        transcription: { model: transcriptionModel },
      },
      output: { voice: "marin" },
    },
  };
}

export async function createOpenAIRealtimeClientSecret({
  apiKey,
  instructions,
  tools,
  transcriptionModel,
  safetyIdentifier = "dwella-demo-user",
  fetcher = fetch,
  timeoutMs = 10_000,
}) {
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      error: "OPENAI_API_KEY is required to create a Realtime client secret.",
    };
  }

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetcher(OPENAI_REALTIME_CLIENT_SECRETS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safetyIdentifier,
      },
      body: JSON.stringify({
        session: buildDwellaRealtimeSessionConfig({
          instructions,
          tools,
          transcriptionModel,
        }),
      }),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error:
        error instanceof Error && error.name === "AbortError"
          ? `OpenAI Realtime request timed out after ${timeoutMs}ms.`
          : error instanceof Error
            ? error.message
            : "OpenAI Realtime request failed before a response was received.",
    };
  } finally {
    clearTimeout(timeout);
  }

  const data = await parseResponseJson(response);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data?.error?.message ?? `OpenAI Realtime request failed with status ${response.status}.`,
    };
  }

  const clientSecret = data?.value ?? data?.client_secret?.value;
  const expiresAt = data?.expires_at ?? data?.client_secret?.expires_at;
  if (!clientSecret) {
    return {
      ok: false,
      status: response.status,
      error: "OpenAI Realtime response did not include a client secret value.",
    };
  }

  return {
    ok: true,
    status: response.status,
    model: OPENAI_REALTIME_MODEL,
    clientSecret,
    expiresAt,
    sessionId: data?.session?.id,
  };
}

async function parseResponseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
