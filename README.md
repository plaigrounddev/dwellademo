# Dwella Demo

Dwella uses Vite/React for the app shell, Convex as the durable workspace store, and Eve as the single long-running agent runtime.

## Agent Runtime

The Eve-authored agent lives under `agent/`:

- `agent/instructions.md` contains the Dwella system instructions.
- `agent/skills/` contains reusable playbooks for intake, builder outreach, and quote review.
- `agent/tools/` contains the typed workspace tools that return Dwella `screenCommands`.
- `agent/channels/dwella.ts` exposes the compatibility HTTP routes used by the existing shell.

Run the agent runtime with:

```bash
npm run eve:dev
```

The browser app calls the same-origin `/dwella/agent/*` path. Local Vite proxies that path to a local Eve server (`VITE_DWELLA_EVE_URL` or `http://127.0.0.1:3000`). Vercel mounts the Vite shell and Eve runtime as services in the same project, then rewrites `/dwella/agent/*` directly to Eve.

Eve uses `DWELLA_EVE_MODEL` or `AI_GATEWAY_MODEL` through Vercel AI Gateway when configured. Otherwise it uses the OpenAI AI SDK provider with the existing `OPENAI_API_KEY`. The sandbox uses Eve's default backend selection with `microsandbox` installed for file/shell workspace support.

Convex remains the durable store for documents, file entries, map state, browser state, and builder data. It no longer owns the agent HTTP or Realtime voice routes.
