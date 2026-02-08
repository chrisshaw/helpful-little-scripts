/**
 * Client-side API wrapper for the tool generation endpoint.
 * All AI generation happens server-side — this just sends the prompt.
 */

export async function generateTool(prompt, size = "medium") {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Server error (${response.status})`);
  }

  return response.json();
}
