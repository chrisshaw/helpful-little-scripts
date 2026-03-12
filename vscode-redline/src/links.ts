import * as vscode from "vscode";
import * as path from "path";

/**
 * Provides clickable links for source references in .redline.md files.
 * Matches patterns like [draft.md:14](draft.md#L14) and links to the
 * source file at the specified line.
 */
export function createDocumentLinkProvider(): vscode.DocumentLinkProvider {
  return {
    provideDocumentLinks(
      document: vscode.TextDocument
    ): vscode.DocumentLink[] {
      const links: vscode.DocumentLink[] = [];
      // Match [filename:line](path#Lline) in blockquote lines
      const linkPattern = /\[([^\]]+:\d+)\]\(([^)]+)\)/g;

      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        let match: RegExpExecArray | null;
        linkPattern.lastIndex = 0;

        while ((match = linkPattern.exec(line.text)) !== null) {
          const linkPath = match[2]; // e.g. "draft.md#L14"
          const [filePart, fragment] = linkPath.split("#");

          // Resolve the file path relative to the sidecar file's directory
          const dir = path.dirname(document.uri.fsPath);
          const targetPath = path.resolve(dir, filePart);
          let targetUri = vscode.Uri.file(targetPath);

          // If there's a #L<line> fragment, add it so VS Code opens at that line
          if (fragment) {
            targetUri = targetUri.with({ fragment });
          }

          const startChar = match.index;
          const endChar = startChar + match[0].length;
          const range = new vscode.Range(i, startChar, i, endChar);

          links.push(new vscode.DocumentLink(range, targetUri));
        }
      }

      return links;
    },
  };
}
