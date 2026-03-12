import * as vscode from "vscode";
import { ResolvedAnnotation } from "./types";

/**
 * Creates a HoverProvider that shows annotation comments when hovering
 * over annotated text ranges.
 */
export function createHoverProvider(
  getAnnotations: (uri: vscode.Uri) => ResolvedAnnotation[]
): vscode.HoverProvider {
  return {
    provideHover(
      document: vscode.TextDocument,
      position: vscode.Position
    ): vscode.Hover | null {
      const annotations = getAnnotations(document.uri);
      const offset = document.offsetAt(position);

      for (const annotation of annotations) {
        const start = annotation.sourceOffset;
        const end = start + annotation.sourceLength;

        if (offset >= start && offset <= end) {
          return createHover(document, annotation);
        }
      }

      return null;
    },
  };
}

function createHover(
  document: vscode.TextDocument,
  annotation: ResolvedAnnotation
): vscode.Hover {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.supportHtml = true;

  // Show the comment (or a placeholder for highlights without comments)
  if (annotation.comment.trim()) {
    md.appendMarkdown(annotation.comment);
  } else {
    md.appendMarkdown("*No comment — highlight only*");
  }

  // If there's a suggestion, show it as a diff-like block
  if (annotation.suggestion !== undefined) {
    md.appendMarkdown("\n\n---\n\n");
    md.appendMarkdown("**Suggested change:**\n\n");

    const selectedSpan = annotation.quotedText.slice(
      annotation.selectionStart,
      annotation.selectionEnd
    );
    md.appendMarkdown(`~~${selectedSpan}~~ → ${annotation.suggestion}`);
  }

  // Add actions
  const actionArgs = encodeURIComponent(
    JSON.stringify({
      sourceFile: document.uri.toString(),
      offset: annotation.sourceOffset,
    })
  );
  md.appendMarkdown(
    `\n\n[Go to comment](command:redline.openSidecar?${actionArgs} "Open sidecar file") · [Delete](command:redline.delete?${actionArgs} "Delete this redline")`
  );

  const startPos = document.positionAt(annotation.sourceOffset);
  const endPos = document.positionAt(
    annotation.sourceOffset + annotation.sourceLength
  );

  return new vscode.Hover(md, new vscode.Range(startPos, endPos));
}
