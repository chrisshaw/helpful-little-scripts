/**
 * Client-side API wrapper for the tool generation endpoint.
 * All AI generation happens server-side — this just sends the prompt.
 */

import type { GeneratedTool, ToolSizeKey } from "../types/tool";

interface ErrorResponseBody {
  error?: string;
}

export async function generateTool(prompt: string, size: ToolSizeKey = "medium"): Promise<GeneratedTool> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorResponseBody;
    throw new Error(body.error || `Server error (${response.status})`);
  }

  return (await response.json()) as GeneratedTool;
}
