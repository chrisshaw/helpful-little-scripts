/**
 * Client-side sandbox utilities for previewing generated widgets
 * in a secure iframe before placing them on the canvas.
 *
 * Note: The server also performs validation before returning results.
 * This module handles preview rendering and building the component HTML
 * for Zwibbler registration.
 */

/**
 * Build combined HTML string (CSS + HTML) for Zwibbler component registration.
 */
export function buildComponentHTML(tool) {
  return `<style>${tool.css}</style>${tool.html}`;
}

/**
 * Render a tool inside a sandboxed iframe for preview.
 * The iframe uses srcdoc with sandbox="allow-scripts" (no same-origin access).
 */
export function renderPreview(iframeEl, tool) {
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
