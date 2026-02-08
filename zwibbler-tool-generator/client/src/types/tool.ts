export type ToolSizeKey = "small" | "medium" | "large";

export interface GeneratedTool {
  label: string;
  description: string;
  html: string;
  css: string;
  js: string;
  width: number;
  height: number;
}

export interface RegisteredToolMeta {
  componentName: string;
  label: string;
  description: string;
  width: number;
  height: number;
}

export type DrawingToolName = "pick" | "brush" | "line" | "rectangle" | "circle" | "text";
