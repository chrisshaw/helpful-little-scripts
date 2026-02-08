/**
 * app.js
 *
 * Wires together the Zwibbler canvas, the AI tool generator, and the sandbox.
 * This is the main application entry point.
 */

(() => {
  "use strict";

  // ── State ────────────────────────────────────────────────

  let zwibblerCtx = null;           // ZwibblerContext, set by initApp
  let generatedToolCounter = 0;     // unique suffix for component names
  let pendingTool = null;           // tool waiting to be accepted from preview
  let apiKey = "";                  // Anthropic API key (empty = use server proxy)
  let useServerProxy = false;       // true when server has the key

  // Persisted list of generated tools available in the sidebar.
  // Each entry: { componentName, label, description, width, height }
  const generatedToolsList = [];

  // ── API Key Management ───────────────────────────────────
  //
  // On startup, we probe the server proxy. If it's configured with a key,
  // we skip asking the user for one. Otherwise, fall back to client-side key.

  async function detectServerProxy() {
    try {
      const res = await fetch("/api/generate", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "__ping__", size: "small" }),
      });
      // If we get a 502 or the server says no key, it's not configured
      if (res.status === 500) {
        const body = await res.json();
        if (body.error && body.error.includes("no ANTHROPIC_API_KEY")) return false;
      }
      // Any other response (including 4xx from Anthropic) means the proxy is working
      return true;
    } catch {
      return false;
    }
  }

  function getApiKey() {
    if (useServerProxy) return ""; // empty string signals proxy mode to ToolGenerator
    if (apiKey) return apiKey;
    const stored = sessionStorage.getItem("ztg_api_key");
    if (stored) { apiKey = stored; return apiKey; }
    const entered = prompt(
      "Enter your Anthropic API key.\n\n" +
      "This is stored only in your browser session and sent directly to the Anthropic API.\n" +
      "Alternatively, run the server with ANTHROPIC_API_KEY set to avoid this prompt."
    );
    if (!entered) throw new Error("API key is required to generate tools.");
    apiKey = entered.trim();
    sessionStorage.setItem("ztg_api_key", apiKey);
    return apiKey;
  }

  // ── Zwibbler Controller ──────────────────────────────────
  //
  // This function is referenced by z-controller="initApp" in the HTML.
  // Zwibbler calls it with the ZwibblerContext as the scope.

  window.initApp = function (ctx) {
    zwibblerCtx = ctx;

    // Detect if the server proxy has an API key configured
    detectServerProxy().then(hasProxy => { useServerProxy = hasProxy; });

    // Expose the generated tools list to the Zwibbler framework for z-for binding
    ctx.generatedTools = generatedToolsList;

    // Open the generator dialog
    ctx.openGenerator = function () {
      document.getElementById("generator-overlay").classList.remove("hidden");
      document.getElementById("tool-prompt").focus();
    };

    // Place a previously generated tool onto the canvas
    ctx.placeGeneratedTool = function (tool) {
      placeToolOnCanvas(tool);
    };

    // Simple zoom helpers
    ctx.zoomIn = function () { ctx.setZoom(ctx.getZoom() * 1.2); };
    ctx.zoomOut = function () { ctx.setZoom(ctx.getZoom() / 1.2); };
  };

  // ── Dialog Helpers (called from HTML onclick) ────────────

  window.closeGenerator = function () {
    document.getElementById("generator-overlay").classList.add("hidden");
    document.getElementById("generator-status").classList.add("hidden");
    document.getElementById("generator-preview").classList.add("hidden");
    pendingTool = null;
  };

  window.setPromptHint = function (chip) {
    const input = document.getElementById("tool-prompt");
    input.value = chip.textContent;
    input.focus();
  };

  window.doGenerate = async function () {
    const promptText = document.getElementById("tool-prompt").value.trim();
    if (!promptText) return;

    let key;
    try { key = getApiKey(); } catch { return; }

    const sizeKey = document.getElementById("tool-size").value;
    const statusEl = document.getElementById("generator-status");
    const statusText = document.getElementById("status-text");
    const previewEl = document.getElementById("generator-preview");
    const generateBtn = document.getElementById("btn-do-generate");

    // Show spinner, hide previous preview
    statusEl.classList.remove("hidden");
    previewEl.classList.add("hidden");
    generateBtn.disabled = true;
    statusText.textContent = "Generating your tool...";

    try {
      const tool = await ToolGenerator.generate(key, promptText, sizeKey);

      // Validate through sandbox
      const result = Sandbox.validate(tool);
      if (!result.valid) {
        statusText.textContent = "Generated code failed safety checks. Retrying...";
        // One automatic retry — the model sometimes slips on a single constraint
        const tool2 = await ToolGenerator.generate(key, promptText, sizeKey);
        const result2 = Sandbox.validate(tool2);
        if (!result2.valid) {
          throw new Error(
            "Generated tool failed safety validation:\n" +
            result2.reasons.join("\n")
          );
        }
        pendingTool = tool2;
      } else {
        pendingTool = tool;
      }

      // Show preview
      statusEl.classList.add("hidden");
      previewEl.classList.remove("hidden");
      Sandbox.renderPreview(
        document.getElementById("preview-frame"),
        pendingTool
      );

    } catch (err) {
      statusText.textContent = `Error: ${err.message}`;
      console.error("Tool generation failed:", err);
    } finally {
      generateBtn.disabled = false;
    }
  };

  window.regenerateTool = function () {
    window.doGenerate();
  };

  window.acceptTool = function () {
    if (!pendingTool || !zwibblerCtx) return;
    const registered = registerZwibblerComponent(pendingTool);
    placeToolOnCanvas(registered);

    // Add to sidebar list so the user can stamp more copies
    generatedToolsList.push(registered);
    // Trigger Zwibbler digest so z-for picks up the new entry
    zwibblerCtx.generatedTools = generatedToolsList.concat();
    if (zwibblerCtx.$digest) zwibblerCtx.$digest();

    window.closeGenerator();
  };

  // ── Zwibbler Component Registration ──────────────────────

  /**
   * Register the generated tool as a Zwibbler component and return
   * metadata that allows placing it on the canvas later.
   */
  function registerZwibblerComponent(tool) {
    generatedToolCounter++;
    const componentName = `GeneratedTool_${generatedToolCounter}`;
    const fullHTML = Sandbox.buildComponentHTML(tool);

    Zwibbler.component(componentName, {
      template: `
        <div class="widget-root" z-sizeable="stretch"
             style="width:${tool.width}px; height:${tool.height}px; overflow:auto; background:#fff; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
          ${fullHTML}
        </div>
      `,
      controller(scope) {
        // scope.$element is the root DOM element of the component
        const el = scope.$element;
        if (!el) return;
        const root = el.querySelector(".widget-root");
        if (!root) return;

        // Run the generated JS in a try/catch so a widget bug doesn't crash the whiteboard
        try {
          const fn = new Function("scope", "el", tool.js);
          fn(scope, root);
        } catch (err) {
          console.error(`[${componentName}] Widget JS error:`, err);
          root.textContent = `Widget error: ${err.message}`;
          root.style.cssText += "color:red; padding:20px; font-size:14px;";
        }
      },
    });

    return {
      componentName,
      label: tool.label,
      description: tool.description,
      width: tool.width,
      height: tool.height,
    };
  }

  /**
   * Place a registered tool component onto the Zwibbler canvas.
   */
  function placeToolOnCanvas(toolMeta) {
    if (!zwibblerCtx) return;
    zwibblerCtx.begin();
    zwibblerCtx.createHTMLNode(toolMeta.componentName, {
      "style.width": toolMeta.width + "px",
      "style.height": toolMeta.height + "px",
    });
    zwibblerCtx.commit();
  }

})();
