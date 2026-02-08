import type { GeneratedTool, RegisteredToolMeta, DrawingToolName } from "./tool";

interface ZwibblerContext {
  on(event: "document-changed", handler: () => void): void;
  on(event: "tool-changed", handler: (toolName: DrawingToolName) => void): void;
  canUndo(): boolean;
  canRedo(): boolean;
  usePickTool(): void;
  useBrushTool(): void;
  useLineTool(): void;
  useRectangleTool(): void;
  useCircleTool(): void;
  useTextTool(): void;
  undo(): void;
  redo(): void;
  getZoom(): number;
  setZoom(zoom: number): void;
  begin(): void;
  commit(): void;
  createHTMLNode(componentName: string, props: Record<string, string>): void;
  destroy?(): void;
}

interface ZwibblerScope {
  $element: Element | null;
}

interface ZwibblerComponentDefinition {
  template: string;
  controller(scope: ZwibblerScope): void;
}

interface ZwibblerGlobal {
  create(el: Element, options: { showToolbar: boolean; showColourPanel: boolean }): ZwibblerContext;
  component(name: string, definition: ZwibblerComponentDefinition): void;
}

declare global {
  const Zwibbler: ZwibblerGlobal;

  interface Window {
    Zwibbler?: ZwibblerGlobal;
  }
}

export type { ZwibblerContext, ZwibblerScope, ZwibblerGlobal, GeneratedTool, RegisteredToolMeta };
