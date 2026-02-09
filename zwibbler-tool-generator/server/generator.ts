import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

import { SYSTEM_PROMPT } from "./SYSTEM_PROMPT.js";
import { validate, ValidationError, ValidationOutcome } from "./validate.js";

const client = new BedrockRuntimeClient({ region: AWS_REGION });

export type ToolSizeKey = "small" | "medium" | "large";

export interface ToolSize {
  width: number;
  height: number;
}

interface ParsedToolResponse {
  label: string;
  description?: string;
  html: string;
  css: string;
  js: string;
}

export interface GeneratedTool {
  label: string;
  description: string;
  html: string;
  css: string;
  js: string;
  width: number;
  height: number;
}

const SIZES = {
  small: { width: 300, height: 200 },
  medium: { width: 450, height: 350 },
  large: { width: 600, height: 500 },
} satisfies Record<ToolSizeKey, ToolSize>;

/**
 * Parse Claude's response text into a tool object.
 */
function parseToolResponse(text: string, size: ToolSize): GeneratedTool {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned) as ParsedToolResponse;
  const requiredFields = ["label", "html", "css", "js"] as const;

  for (const field of requiredFields) {
    if (typeof parsed[field] !== "string") {
      throw new Error(`Generated tool is missing required field: "${field}"`);
    }
  }

  if (parsed.description !== undefined && typeof parsed.description !== "string") {
    throw new Error('Generated tool has invalid field: "description"');
  }

  return {
    label: parsed.label,
    description: parsed.description || "",
    html: parsed.html,
    css: parsed.css,
    js: parsed.js,
    width: size.width,
    height: size.height,
  };
}

/**
 * Determine the target size from an optional key.
 */
function getSize(sizeKey?: string): ToolSize {
  if (sizeKey && sizeKey in SIZES) {
    return SIZES[sizeKey as ToolSizeKey];
  }

  return SIZES.medium;
}

/**
 * Decode the Bedrock InvokeModel response body into a parsed object.
 */
function decodeResponseBody(body: Uint8Array): { content: Array<{ type: string; text?: string }> } {
  const decoded = new TextDecoder().decode(body);
  return JSON.parse(decoded);
}

/**
 * Extract the first text block from a Claude-style response.
 */
function getFirstTextContent(response: { content: Array<{ type: string; text?: string }> }): string {
  const textBlock = response.content.find(
    (block): block is { type: "text"; text: string } =>
      block.type === "text" && typeof (block as { text?: unknown }).text === "string",
  );

  if (!textBlock) {
    throw new Error("Failed to parse generated tool response");
  }

  return textBlock.text;
}

/**
 * Generate a tool widget via Amazon Bedrock (Claude model).
 * Validates the output and retries once if validation fails.
 */
export async function generate(prompt: string, sizeKey?: string): Promise<GeneratedTool> {
  const size = getSize(sizeKey);

  const userMessage = `Create a widget for: ${prompt}\n\nTarget dimensions: ${size.width}px wide by ${size.height}px tall.\n\nRemember: return ONLY the JSON object, no markdown fencing or extra text.`;

  async function callClaude(): Promise<GeneratedTool> {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    };

    const command = new InvokeModelCommand({
      contentType: "application/json",
      body: JSON.stringify(payload),
      modelId: MODEL_ID,
    });

    const response = await client.send(command);
    const parsed = decodeResponseBody(response.body as Uint8Array);

    return parseToolResponse(getFirstTextContent(parsed), size);
  }

  // First attempt
  const tool = await callClaude();
  const result: ValidationOutcome = validate(tool);

  if (result.valid) {
    return tool;
  }

  // Automatic retry — the model sometimes slips on a single constraint
  const tool2 = await callClaude();
  const result2: ValidationOutcome = validate(tool2);

  if (!result2.valid) {
    throw new ValidationError("Generated tool failed safety validation", result2.reasons);
  }

  return tool2;
}