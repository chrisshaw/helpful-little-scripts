import * as vscode from "vscode";
import { ResolvedAnnotation } from "./types";
import { offsetToLine } from "./anchoring";

let highlightDecorationType: vscode.TextEditorDecorationType | undefined;
let gutterDecorationType: vscode.TextEditorDecorationType | undefined;
let inlineDecorationType: vscode.TextEditorDecorationType | undefined;

function getHighlightColor(): string {
  return vscode.workspace
    .getConfiguration("redline")
    .get<string>("highlightColor", "rgba(255, 107, 107, 0.12)");
}

function showInlinePreview(): boolean {
  return vscode.workspace
    .getConfiguration("redline")
    .get<boolean>("showInlinePreview", true);
}

/** Create or recreate decoration types. Call on activation and config change. */
export function createDecorationTypes(
  context: vscode.ExtensionContext
): void {
  disposeDecorationTypes();

  highlightDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: getHighlightColor(),
    isWholeLine: false,
  });

  gutterDecorationType = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.joinPath(context.extensionUri, "icon.svg"),
    gutterIconSize: "contain",
  });

  // Inline preview uses after-line decoration — we create individual ones per annotation
  // since each has different text. We'll use a single type with empty after text
  // and override per-range.
  inlineDecorationType = vscode.window.createTextEditorDecorationType({});
}

/** Clean up decoration types. */
export function disposeDecorationTypes(): void {
  highlightDecorationType?.dispose();
  gutterDecorationType?.dispose();
  inlineDecorationType?.dispose();
  highlightDecorationType = undefined;
  gutterDecorationType = undefined;
  inlineDecorationType = undefined;
}

/**
 * Apply decorations for resolved annotations to the given editor.
 */
export function applyDecorations(
  editor: vscode.TextEditor,
  annotations: ResolvedAnnotation[]
): void {
  if (!highlightDecorationType || !gutterDecorationType) {
    return;
  }

  const highlightRanges: vscode.DecorationOptions[] = [];
  const gutterRanges: vscode.DecorationOptions[] = [];
  const inlineRanges: vscode.DecorationOptions[] = [];

  for (const annotation of annotations) {
    const startPos = editor.document.positionAt(annotation.sourceOffset);
    const endPos = editor.document.positionAt(
      annotation.sourceOffset + annotation.sourceLength
    );
    const range = new vscode.Range(startPos, endPos);

    // Highlight the annotated range
    highlightRanges.push({ range });

    // Gutter icon on the first line of the range
    const gutterRange = new vscode.Range(startPos.line, 0, startPos.line, 0);
    gutterRanges.push({ range: gutterRange });

    // Inline preview after the last line of the range (skip if no comment)
    if (showInlinePreview() && annotation.comment.trim()) {
      const previewText = truncateComment(annotation.comment, 60);
      if (previewText) {
        const lineEnd = editor.document.lineAt(endPos.line).range.end;
        inlineRanges.push({
          range: new vscode.Range(lineEnd, lineEnd),
          renderOptions: {
            after: {
              contentText: `  // ${previewText}`,
              color: new vscode.ThemeColor(
                "editorCodeLens.foreground"
              ),
              fontStyle: "italic",
            },
          },
        });
      }
    }
  }

  editor.setDecorations(highlightDecorationType, highlightRanges);
  editor.setDecorations(gutterDecorationType, gutterRanges);
  if (inlineDecorationType) {
    editor.setDecorations(inlineDecorationType, inlineRanges);
  }
}

/** Clear all decorations from an editor. */
export function clearDecorations(editor: vscode.TextEditor): void {
  if (highlightDecorationType) {
    editor.setDecorations(highlightDecorationType, []);
  }
  if (gutterDecorationType) {
    editor.setDecorations(gutterDecorationType, []);
  }
  if (inlineDecorationType) {
    editor.setDecorations(inlineDecorationType, []);
  }
}

/** Truncate a comment to a max length, stripping suggestion blocks. */
function truncateComment(comment: string, maxLength: number): string {
  // Remove suggestion blocks for the preview
  let text = comment.replace(/```suggestion[\s\S]*?```/g, "").trim();
  // Take the first line only
  const firstLine = text.split("\n")[0];
  text = firstLine.trim();

  if (text.length > maxLength) {
    return text.slice(0, maxLength - 1) + "\u2026";
  }
  return text;
}
