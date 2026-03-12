import * as vscode from "vscode";
import { ResolvedAnnotation } from "./types";
import { parseRedlineFile } from "./parser";
import { resolveAnnotations } from "./anchoring";
import {
  createDecorationTypes,
  disposeDecorationTypes,
  applyDecorations,
  clearDecorations,
} from "./decorations";
import { createHoverProvider } from "./hover";
import { createDocumentLinkProvider } from "./links";
import { createCodeLensProvider } from "./codelens";
import { registerCommands, getSidecarPath, isSidecarFile, getSourcePath } from "./commands";

/** Per-file resolved annotations cache. Keyed by source file URI string. */
const annotationCache = new Map<string, ResolvedAnnotation[]>();

export function activate(context: vscode.ExtensionContext): void {
  createDecorationTypes(context);

  // Register commands
  registerCommands(context, refreshAll, getAnnotationsForUri);

  // Register hover provider for markdown files
  const hoverProvider = createHoverProvider(getAnnotationsForUri);
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: "markdown" },
      hoverProvider
    )
  );

  // Register CodeLens provider — "Go to comment" above annotated lines
  const codeLensProvider = createCodeLensProvider(getAnnotationsForUri);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "markdown" },
      codeLensProvider
    )
  );

  // Register link provider so source references in sidecar files are clickable
  const linkProvider = createDocumentLinkProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { language: "markdown", pattern: "**/*.redline.*" },
      linkProvider
    )
  );

  // Refresh decorations when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        refreshEditor(editor);
      }
    })
  );

  // Re-anchor when a source document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const uri = event.document.uri;
      if (uri.scheme !== "file") return;

      if (isSidecarFile(uri)) {
        // Sidecar changed — refresh the source file's decorations
        const sourceUri = getSourcePath(uri);
        if (sourceUri) {
          invalidateAndRefresh(sourceUri);
        }
      } else if (uri.fsPath.endsWith(".md")) {
        // Source file changed — re-anchor annotations
        invalidateAndRefresh(uri);
      }
    })
  );

  // Watch for sidecar file creation/deletion
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.redline.*");
  context.subscriptions.push(
    watcher.onDidCreate((uri) => {
      const sourceUri = getSourcePath(uri);
      if (sourceUri) invalidateAndRefresh(sourceUri);
    }),
    watcher.onDidChange((uri) => {
      const sourceUri = getSourcePath(uri);
      if (sourceUri) invalidateAndRefresh(sourceUri);
    }),
    watcher.onDidDelete((uri) => {
      const sourceUri = getSourcePath(uri);
      if (sourceUri) {
        annotationCache.delete(sourceUri.toString());
        // Clear decorations on any visible editor for this source
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document.uri.toString() === sourceUri.toString()) {
            clearDecorations(editor);
          }
        }
      }
    }),
    watcher
  );

  // Rebuild decorations when configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("redline")) {
        createDecorationTypes(context);
        refreshAll();
      }
    })
  );

  // Initial decoration pass for already-open editors
  refreshAll();
}

export function deactivate(): void {
  disposeDecorationTypes();
  annotationCache.clear();
}

/** Get cached resolved annotations for a source file URI. */
function getAnnotationsForUri(uri: vscode.Uri): ResolvedAnnotation[] {
  return annotationCache.get(uri.toString()) ?? [];
}

/** Invalidate cache for a source URI and refresh its editors. */
function invalidateAndRefresh(sourceUri: vscode.Uri): void {
  annotationCache.delete(sourceUri.toString());
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.uri.toString() === sourceUri.toString()) {
      refreshEditor(editor);
    }
  }
}

/** Refresh decorations for all visible markdown editors. */
function refreshAll(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.languageId === "markdown") {
      refreshEditor(editor);
    }
  }
}

/** Refresh decorations for a single editor. */
async function refreshEditor(editor: vscode.TextEditor): Promise<void> {
  const uri = editor.document.uri;
  if (uri.scheme !== "file") return;

  // Don't decorate sidecar files themselves
  if (isSidecarFile(uri)) {
    clearDecorations(editor);
    return;
  }

  // Only markdown files
  if (editor.document.languageId !== "markdown") return;

  // Check cache first
  let resolved = annotationCache.get(uri.toString());

  if (!resolved) {
    resolved = await loadAnnotations(uri, editor.document.getText());
    annotationCache.set(uri.toString(), resolved);
  }

  applyDecorations(editor, resolved);
}

/** Load and resolve annotations for a source file. */
async function loadAnnotations(
  sourceUri: vscode.Uri,
  sourceText: string
): Promise<ResolvedAnnotation[]> {
  const sidecarUri = getSidecarPath(sourceUri);

  try {
    const sidecarBytes = await vscode.workspace.fs.readFile(sidecarUri);
    const sidecarContent = Buffer.from(sidecarBytes).toString("utf-8");
    const annotations = parseRedlineFile(sidecarContent);
    return resolveAnnotations(annotations, sourceText);
  } catch {
    // No sidecar file — no annotations
    return [];
  }
}
