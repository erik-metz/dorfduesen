import OpenAI from "openai";

/**
 * xAI (Grok) Client configuration.
 * xAI provides an OpenAI-compatible REST API at https://api.x.ai/v1.
 */
export const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY || "dummy-key-pending-setup",
  baseURL: "https://api.x.ai/v1",
});

export const XAI_DEFAULT_MODEL = process.env.XAI_MODEL || "grok-3";
