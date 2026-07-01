# Dwella Demo

Dwella uses Vite/React for the app shell and Convex for the durable workspace, agent thread store, HTTP bridge, and Realtime voice token route.

## Agent Runtime

The long-running agent is built with `convex-durable-agents`.

- `convex/convex.config.ts` registers the Durable Agents component.
- `convex/dwellaAgentApi.js` defines the AI SDK stream handler and workspace tools.
- `convex/dwellaAgent.js` maps browser thread ids to Convex durable-agent thread ids.
- `convex/http.js` preserves the shell-facing `/dwella/agent/*` routes.
- `convex/dwellaAgentTools.js` returns the `screenCommands` consumed by the existing React workspace shell.

The browser app calls the same-origin `/dwella/agent/*` path by default. Local Vite proxies that path to `VITE_CONVEX_SITE_URL`, or derives it from `VITE_CONVEX_URL` by replacing `.convex.cloud` with `.convex.site`.

Required server-side Convex env:

```bash
npx convex env set OPENAI_API_KEY sk-...
```

Optional:

```bash
npx convex env set OPENAI_TEXT_MODEL gpt-4.1-mini
npx convex env set OPENAI_TRANSCRIBE_MODEL gpt-4o-transcribe
```

Convex remains the durable store for documents, file entries, map state, browser state, and agent conversation state.
