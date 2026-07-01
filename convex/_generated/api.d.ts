/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentWorkspace from "../agentWorkspace.js";
import type * as dwellaAgent from "../dwellaAgent.js";
import type * as dwellaAgentApi from "../dwellaAgentApi.js";
import type * as dwellaAgentTools from "../dwellaAgentTools.js";
import type * as dwellaConversationContract from "../dwellaConversationContract.js";
import type * as http from "../http.js";
import type * as openaiRealtime from "../openaiRealtime.js";
import type * as prosemirrorSync from "../prosemirrorSync.js";
import type * as richDocuments from "../richDocuments.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentWorkspace: typeof agentWorkspace;
  dwellaAgent: typeof dwellaAgent;
  dwellaAgentApi: typeof dwellaAgentApi;
  dwellaAgentTools: typeof dwellaAgentTools;
  dwellaConversationContract: typeof dwellaConversationContract;
  http: typeof http;
  openaiRealtime: typeof openaiRealtime;
  prosemirrorSync: typeof prosemirrorSync;
  richDocuments: typeof richDocuments;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  durable_agents: import("convex-durable-agents/_generated/component.js").ComponentApi<"durable_agents">;
  prosemirrorSync: import("@convex-dev/prosemirror-sync/_generated/component.js").ComponentApi<"prosemirrorSync">;
};
