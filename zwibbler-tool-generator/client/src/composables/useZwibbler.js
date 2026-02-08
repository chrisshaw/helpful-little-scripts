import { ref, shallowRef, watch, onBeforeUnmount } from "vue";
import { buildComponentHTML } from "../utils/sandbox.js";

/**
 * Composable that manages the Zwibbler canvas context.
 *
 * Provides reactive state for current tool, undo/redo capability,
 * and methods for tool operations and component registration.
 *
 * Uses a watch on canvasRef so Zwibbler initializes as soon as the
 * DOM element becomes available (after child component mounts).
 */
export function useZwibbler(canvasRef) {
  const ctx = shallowRef(null);
  const currentTool = ref("pick");
  const canUndo = ref(false);
  const canRedo = ref(false);

  let toolCounter = 0;

  watch(canvasRef, (el) => {
    if (!el || ctx.value) return;
    if (typeof Zwibbler === "undefined") return;

    const context = Zwibbler.create(el, {
      showToolbar: false,
      showColourPanel: false,
    });

    ctx.value = context;

    context.on("document-changed", () => {
      canUndo.value = context.canUndo();
      canRedo.value = context.canRedo();
    });

    context.on("tool-changed", (toolName) => {
      currentTool.value = toolName;
    });
  });

  onBeforeUnmount(() => {
    if (ctx.value?.destroy) {
      ctx.value.destroy();
    }
  });

  function useTool(name) {
    if (!ctx.value) return;
    const methods = {
      pick: () => ctx.value.usePickTool(),
      brush: () => ctx.value.useBrushTool(),
      line: () => ctx.value.useLineTool(),
      rectangle: () => ctx.value.useRectangleTool(),
      circle: () => ctx.value.useCircleTool(),
      text: () => ctx.value.useTextTool(),
    };
    methods[name]?.();
  }

  function undo() { ctx.value?.undo(); }
  function redo() { ctx.value?.redo(); }

  function zoomIn() {
    if (!ctx.value) return;
    ctx.value.setZoom(ctx.value.getZoom() * 1.2);
  }

  function zoomOut() {
    if (!ctx.value) return;
    ctx.value.setZoom(ctx.value.getZoom() / 1.2);
  }

  /**
   * Register a generated tool as a Zwibbler component.
   * Returns metadata for placing it on the canvas.
   */
  function registerComponent(tool) {
    toolCounter++;
    const componentName = `GeneratedTool_${toolCounter}`;
    const fullHTML = buildComponentHTML(tool);

    Zwibbler.component(componentName, {
      template: `
        <div class="widget-root" z-sizeable="stretch"
             style="width:${tool.width}px; height:${tool.height}px; overflow:auto; background:#fff; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
          ${fullHTML}
        </div>
      `,
      controller(scope) {
        const el = scope.$element;
        if (!el) return;
        const root = el.querySelector(".widget-root");
        if (!root) return;

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
   * Place a registered component on the canvas.
   */
  function placeOnCanvas(toolMeta) {
    if (!ctx.value) return;
    ctx.value.begin();
    ctx.value.createHTMLNode(toolMeta.componentName, {
      "style.width": toolMeta.width + "px",
      "style.height": toolMeta.height + "px",
    });
    ctx.value.commit();
  }

  return {
    ctx,
    currentTool,
    canUndo,
    canRedo,
    useTool,
    undo,
    redo,
    zoomIn,
    zoomOut,
    registerComponent,
    placeOnCanvas,
  };
}
