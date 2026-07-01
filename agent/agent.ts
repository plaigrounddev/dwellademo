import { openai } from "@ai-sdk/openai";
import { defineAgent } from "eve";

const directOpenAIModel = process.env.OPENAI_TEXT_MODEL ?? "gpt-5.5";
const gatewayModel = process.env.DWELLA_EVE_MODEL ?? process.env.AI_GATEWAY_MODEL;

export default defineAgent({
  model: gatewayModel ?? (process.env.AI_GATEWAY_API_KEY ? `openai/${directOpenAIModel}` : openai(directOpenAIModel)),
});
