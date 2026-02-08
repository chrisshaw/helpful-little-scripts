/**
 * server.js
 *
 * Lightweight dev server that:
 *   1. Serves the static frontend files
 *   2. Proxies /api/generate requests to the Anthropic API
 *      (avoids CORS issues with direct browser → Anthropic calls)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node server.js
 *
 * The server reads the API key from the environment so it never touches
 * the browser. Runs on port 3000 by default (PORT env to override).
 */

const http = require("http");
const fs   = require("fs");
const path = require("path");
const url  = require("url");

const PORT    = parseInt(process.env.PORT, 10) || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || "";

if (!API_KEY) {
  console.warn(
    "WARNING: ANTHROPIC_API_KEY not set.\n" +
    "The /api/generate endpoint will fail. You can still use the frontend\n" +
    "with a client-side key, but the proxy route won't work.\n"
  );
}

// ── MIME types ───────────────────────────────────────────

const MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
};

// ── Static file serving ─────────────────────────────────

function serveStatic(req, res) {
  let filePath = path.join(__dirname, url.parse(req.url).pathname);

  // Default to index.html
  if (filePath.endsWith("/")) filePath += "index.html";

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

// ── API proxy ───────────────────────────────────────────

async function handleApiGenerate(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed");
    return;
  }

  if (!API_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Server has no ANTHROPIC_API_KEY configured" }));
    return;
  }

  // Read request body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const { prompt, size } = parsed;
  if (!prompt || typeof prompt !== "string") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing 'prompt' field" }));
    return;
  }

  try {
    // We dynamically build the same request that ToolGenerator builds client-side,
    // but here we attach the server-side API key.
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: getSystemPrompt(),
        messages: [{
          role: "user",
          content: buildUserMessage(prompt, size),
        }],
      }),
    });

    const anthropicBody = await anthropicRes.text();

    res.writeHead(anthropicRes.status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(anthropicBody);
  } catch (err) {
    console.error("Anthropic API error:", err);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to reach Anthropic API" }));
  }
}

function getSystemPrompt() {
  // Same system prompt as tool-generator.js — duplicated here so the server
  // can operate independently if the client sends raw prompts.
  return `You are an expert frontend developer who creates self-contained HTML widgets for an academic whiteboard application powered by Zwibbler.

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
}

function buildUserMessage(prompt, size) {
  const SIZES = { small: [300, 200], medium: [450, 350], large: [600, 500] };
  const [w, h] = SIZES[size] || SIZES.medium;
  return `Create a widget for: ${prompt}\n\nTarget dimensions: ${w}px wide by ${h}px tall.\n\nRemember: return ONLY the JSON object, no markdown fencing or extra text.`;
}

// ── Request router ──────────────────────────────────────

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (parsed.pathname === "/api/generate") {
    handleApiGenerate(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Zwibbler Tool Generator`);
  console.log(`  ───────────────────────`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  API key: ${API_KEY ? "configured (server-side proxy active)" : "NOT SET (client-side mode only)"}\n`);
});
