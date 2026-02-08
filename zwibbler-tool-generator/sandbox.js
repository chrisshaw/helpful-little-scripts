/**
 * sandbox.js
 *
 * Validates and sanitizes AI-generated widget code before it is registered
 * as a Zwibbler component. This is the safety layer between the AI output
 * and the whiteboard runtime.
 *
 * Defence in depth:
 *   1. Static analysis — reject code containing dangerous patterns
 *   2. CSP via sandboxed iframe for preview (allow-scripts only, no same-origin)
 *   3. Runtime wrapper — the JS runs inside a controller where globals are limited
 *   4. Zwibbler's own HTML node sandboxing (components run in the page but are
 *      scoped to their element)
 */

const Sandbox = (() => {

  // ── Blocklists ───────────────────────────────────────────
  //
  // Each entry is [regex, human-readable reason].
  // We check both the JS and HTML for these patterns.

  const BLOCKED_PATTERNS = [
    // Network access
    [/\bfetch\s*\(/i,                         "Network requests (fetch) are not allowed"],
    [/\bXMLHttpRequest\b/i,                   "Network requests (XMLHttpRequest) are not allowed"],
    [/\bWebSocket\b/i,                        "WebSocket connections are not allowed"],
    [/\bEventSource\b/i,                      "Server-sent events are not allowed"],
    [/\bnavigator\.sendBeacon\b/i,            "navigator.sendBeacon is not allowed"],
    [/\bimportScripts\b/i,                    "importScripts is not allowed"],

    // Dynamic code execution
    [/\beval\s*\(/i,                          "eval() is not allowed"],
    [/\bnew\s+Function\s*\(/i,               "new Function() is not allowed"],
    [/\bsetTimeout\s*\(\s*["`']/i,           "setTimeout with string argument is not allowed"],
    [/\bsetInterval\s*\(\s*["`']/i,          "setInterval with string argument is not allowed"],

    // DOM escape / injection
    [/\bdocument\s*\.\s*write/i,             "document.write is not allowed"],
    [/\bdocument\s*\.\s*cookie/i,            "document.cookie access is not allowed"],
    [/\bdocument\b[^.]*\.innerHTML\s*=/i,     "document innerHTML assignment is not allowed"],
    [/\.outerHTML\s*=/i,                      "outerHTML assignment is not allowed"],
    [/\bdocument\.createElement\s*\(\s*['"`]script/i,  "Creating <script> elements is not allowed"],
    [/\bdocument\.createElement\s*\(\s*['"`]iframe/i,  "Creating <iframe> elements is not allowed"],
    [/\bdocument\.createElement\s*\(\s*['"`]object/i,  "Creating <object> elements is not allowed"],
    [/\bdocument\.createElement\s*\(\s*['"`]embed/i,   "Creating <embed> elements is not allowed"],
    [/\bdocument\.createElement\s*\(\s*['"`]link/i,    "Creating <link> elements is not allowed"],

    // Storage
    [/\blocalStorage\b/i,                     "localStorage is not allowed"],
    [/\bsessionStorage\b/i,                   "sessionStorage is not allowed"],
    [/\bindexedDB\b/i,                        "indexedDB is not allowed"],

    // Navigation
    [/\bwindow\s*\.\s*open\s*\(/i,           "window.open is not allowed"],
    [/\bwindow\s*\.\s*location/i,            "window.location access is not allowed"],
    [/\blocation\s*\.\s*href/i,              "location.href is not allowed"],
    [/\blocation\s*\.\s*assign/i,            "location.assign is not allowed"],
    [/\blocation\s*\.\s*replace\s*\(/i,      "location.replace is not allowed"],

    // External resources
    [/https?:\/\//i,                          "External URLs are not allowed"],
    [/\bimport\s*\(/i,                        "Dynamic import() is not allowed"],
    [/\bimport\s+/i,                          "ES module imports are not allowed"],
    [/\brequire\s*\(/i,                       "require() is not allowed"],
  ];

  // Additional patterns only checked in HTML
  const BLOCKED_HTML_PATTERNS = [
    [/<script[\s>]/i,                         "<script> tags are not allowed"],
    [/<iframe[\s>]/i,                         "<iframe> tags are not allowed"],
    [/<object[\s>]/i,                         "<object> tags are not allowed"],
    [/<embed[\s>]/i,                          "<embed> tags are not allowed"],
    [/<link[\s>]/i,                           "<link> tags are not allowed"],
    [/\bon(?:click|load|error|mouse\w+|key\w+|focus|blur|change|submit|input|dblclick|contextmenu|drag\w*|drop|scroll|wheel|touch\w+|pointer\w+|animationend|transitionend)\s*=/i, "Inline event handlers are not allowed"],
    [/javascript\s*:/i,                       "javascript: URLs are not allowed"],
    [/=\s*["']data\s*:/i,                     "data: URLs are not allowed in HTML attributes"],
  ];

  // ── Validation ───────────────────────────────────────────

  /**
   * Validate a generated tool definition.
   * Returns { valid: true } or { valid: false, reasons: string[] }.
   */
  function validate(tool) {
    const reasons = [];

    // Check JS
    for (const [pattern, reason] of BLOCKED_PATTERNS) {
      if (pattern.test(tool.js)) {
        reasons.push(`[JS] ${reason}`);
      }
    }

    // Check HTML
    for (const [pattern, reason] of [...BLOCKED_PATTERNS, ...BLOCKED_HTML_PATTERNS]) {
      if (pattern.test(tool.html)) {
        reasons.push(`[HTML] ${reason}`);
      }
    }

    // Check CSS (mainly for url() references to external resources)
    if (/url\s*\(/i.test(tool.css)) {
      reasons.push("[CSS] url() references are not allowed");
    }

    if (reasons.length > 0) {
      return { valid: false, reasons };
    }
    return { valid: true };
  }

  // ── Component HTML builder ──────────────────────────────
  //
  // Combines CSS + HTML for Zwibbler component registration.

  /**
   * Build the full HTML string for a widget, combining its CSS and HTML.
   * This is used once during component registration — not at runtime.
   */
  function buildComponentHTML(tool) {
    return `<style>${tool.css}</style>${tool.html}`;
  }

  // ── Preview in sandboxed iframe ──────────────────────────

  /**
   * Render a tool inside a sandboxed iframe for preview purposes.
   * The iframe uses srcdoc with sandbox="allow-scripts" (no same-origin).
   */
  function renderPreview(iframeEl, tool) {
    const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; padding: 12px; }
  ${tool.css}
</style>
</head>
<body>
${tool.html}
<script>
(function() {
  var el = document.querySelector('.widget-root');
  if (!el) return;
  ${tool.js}
})();
<\/script>
</body>
</html>`;

    iframeEl.removeAttribute("src");
    iframeEl.srcdoc = doc;
  }

  // ── Public API ───────────────────────────────────────────

  return { validate, buildComponentHTML, renderPreview };

})();
