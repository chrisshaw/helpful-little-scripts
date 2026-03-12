import * as vscode from "vscode";
import { ResolvedAnnotation } from "./types";

/**
 * Provides CodeLens actions above lines that have redline annotations.
 * Shows a clickable "Go to comment" lens that opens the sidecar file.
 */
export function createCodeLensProvider(
  getAnnotations: (uri: vscode.Uri) => ResolvedAnnotation[]
): vscode.CodeLensProvider {
  const onDidChange = new vscode.EventEmitter<void>();

  return {
    onDidChangeCodeLenses: onDidChange.event,

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
      const annotations = getAnnotations(document.uri);
      if (annotations.length === 0) return [];

      // Group annotations by line so we don't stack multiple lenses on the same line
      const byLine = new Map<number, ResolvedAnnotation[]>();
      for (const a of annotations) {
        const line = document.positionAt(a.sourceOffset).line;
        const existing = byLine.get(line);
        if (existing) {
          existing.push(a);
        } else {
          byLine.set(line, [a]);
        }
      }

      const lenses: vscode.CodeLens[] = [];

      for (const [line, lineAnnotations] of byLine) {
        const range = new vscode.Range(line, 0, line, 0);
        const count = lineAnnotations.length;
        const label =
          count === 1
            ? "$(comment-discussion) Go to comment"
            : `$(comment-discussion) ${count} comments`;

        lenses.push(
          new vscode.CodeLens(range, {
            title: label,
            command: "redline.openSidecar",
            arguments: [{ offset: lineAnnotations[0].sourceOffset }],
          })
        );
      }

      return lenses;
    },
  };
}
