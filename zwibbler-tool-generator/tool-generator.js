/**
 * tool-generator.js
 *
 * Calls the Claude API to generate self-contained HTML/CSS/JS widgets
 * that can be registered as Zwibbler components and placed on the canvas.
 *
 * The generation uses a structured system prompt that constrains output to
 * safe, academic-context HTML widgets — no external network requests, no
 * arbitrary code execution, no dangerous APIs.
 */

const ToolGenerator = (() => {

  // ── Configuration ────────────────────────────────────────

  const SIZES = {
    small:  { width: 300, height: 200 },
    medium: { width: 450, height: 350 },
    large:  { width: 600, height: 500 },
  };

  // ── System prompt ────────────────────────────────────────
  //
  // This is the core of the generation strategy. It constrains Claude to
  // produce a Zwibbler-compatible HTML component that is:
  //   - self-contained (inline CSS & JS, no external resources)
  //   - safe (no fetch, no eval, no dynamic script injection)
  //   - academic in purpose
  //   - well-structured for Zwibbler's component system

  const SYSTEM_PROMPT = `You are an expert frontend developer who creates self-contained HTML widgets for an academic whiteboard application powered by Zwibbler.

## Your Task
Generate a SINGLE self-contained HTML widget based on the user's description. The widget will be embedded inside a Zwibbler whiteboard as an interactive HTML component.

## Output Format
Return ONLY a JSON object with this exact structure — no markdown fences, no explanation:
{
  "label": "Short Name (2-4 words)",
  "description": "One sentence describing what this tool does",
  "html": "<div class=\\"widget-root\\">...the full HTML...</div>",
  "css": "/* scoped CSS for .widget-root and descendants */",
  "js": "// JS that runs inside controller(scope, el) where el is the root element"
}

## Constraints — you MUST follow ALL of these:

### Safety
- NO fetch, XMLHttpRequest, WebSocket, EventSource, or any network requests
- NO eval, Function(), setTimeout with strings, or dynamic code execution
- NO document.cookie, localStorage, sessionStorage, indexedDB access
- NO window.open, window.location, or navigation
- NO creating <script>, <link>, <iframe>, <object>, <embed> elements
- NO inline event handlers in HTML (onclick="..." etc.) — use addEventListener in the JS section
- NO importing or loading external libraries, fonts, images, or resources of any kind
- ALL functionality must be implemented from scratch using only vanilla JS, HTML, and CSS
- NO references to external URLs whatsoever
- You MAY use element.innerHTML on elements within the widget for dynamic content. Do NOT use document.innerHTML or document.body.innerHTML.
- Prefer textContent over innerHTML when displaying plain text (for safety)

### Structure
- The "html" value must be a single root <div class="widget-root"> containing all markup
- The "css" value must scope everything under .widget-root to avoid style leaks
- The "js" value is a function body that receives (scope, el) — "el" is the root DOM element. Use el.querySelector/querySelectorAll to find elements. Do NOT use document.querySelector.
- Use data attributes or classes to identify elements — not IDs (multiple instances may coexist)
- The widget must work at the specified dimensions and handle resize gracefully

### Academic Focus
- Tools must serve a clear educational or academic purpose
- Content must be accurate (correct formulas, correct data, correct conversions)
- Design should be clean, readable, and classroom-appropriate
- Use clear labels, legible fonts (system fonts only), and good contrast

### Quality
- Make the widget genuinely useful and interactive, not just a static display
- Handle edge cases (division by zero, empty inputs, out-of-range values)
- Use semantic HTML where appropriate
- Ensure the widget looks polished — use consistent spacing, alignment, colors`;

  // ── Generation ───────────────────────────────────────────

  /**
   * Generate a tool widget via the Claude API.
   *
   * Supports two modes:
   *   1. Server proxy (preferred): POST to /api/generate — API key lives server-side
   *   2. Direct browser call: sends key with anthropic-dangerous-direct-browser-access
   *
   * @param {string} apiKey   - Anthropic API key (empty string = use server proxy)
   * @param {string} prompt   - User's description of the tool they want
   * @param {string} sizeKey  - "small" | "medium" | "large"
   * @returns {Promise<object>} - { label, description, html, css, js, width, height }
   */
  async function generate(apiKey, prompt, sizeKey = "medium") {
    const size = SIZES[sizeKey] || SIZES.medium;

    let data;

    if (!apiKey) {
      // Mode 1: server-side proxy — key is in env on the server
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: sizeKey }),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Server proxy error (${response.status}): ${err}`);
      }
      data = await response.json();
    } else {
      // Mode 2: direct browser → Anthropic API
      const userMessage = `Create a widget for: ${prompt}\n\nTarget dimensions: ${size.width}px wide by ${size.height}px tall.\n\nRemember: return ONLY the JSON object, no markdown fencing or extra text.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API request failed (${response.status}): ${err}`);
      }
      data = await response.json();
    }

    const text = data.content[0].text.trim();

    // Parse the JSON response — strip markdown fences if the model included them despite instructions
    let cleaned = text;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error("Failed to parse generated tool JSON. The model returned invalid output.");
    }

    // Validate required fields
    for (const field of ["label", "html", "css", "js"]) {
      if (typeof parsed[field] !== "string") {
        throw new Error(`Generated tool is missing required field: "${field}"`);
      }
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

  // ── Public API ───────────────────────────────────────────

  return { generate, SIZES };

})();
