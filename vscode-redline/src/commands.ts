import * as vscode from "vscode";
import * as path from "path";
import { Annotation, ResolvedAnnotation } from "./types";
import { appendAnnotation, removeAnnotation } from "./writer";

/** Get the sidecar file path for a given source file. */
export function getSidecarPath(sourceUri: vscode.Uri): vscode.Uri {
  const dir = path.dirname(sourceUri.fsPath);
  const ext = path.extname(sourceUri.fsPath);
  const base = path.basename(sourceUri.fsPath, ext);
  return vscode.Uri.file(path.join(dir, `${base}.redline${ext}`));
}

/**
 * Get the source file path for a given sidecar file.
 * Returns null if the file doesn't appear to be a sidecar.
 */
export function getSourcePath(sidecarUri: vscode.Uri): vscode.Uri | null {
  const basename = path.basename(sidecarUri.fsPath);
  const match = basename.match(/^(.+)\.redline(\.[^.]+)$/);
  if (!match) return null;
  const dir = path.dirname(sidecarUri.fsPath);
  return vscode.Uri.file(path.join(dir, `${match[1]}${match[2]}`));
}

/** Check if a URI is a sidecar file. */
export function isSidecarFile(uri: vscode.Uri): boolean {
  return path.basename(uri.fsPath).includes(".redline.");
}

/**
 * Register all redline commands.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  refreshCallback: () => void,
  getAnnotations: (uri: vscode.Uri) => ResolvedAnnotation[]
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("redline.add", () =>
      addRedline(refreshCallback)
    ),

    vscode.commands.registerCommand("redline.delete", (args?: unknown) =>
      deleteRedline(args, refreshCallback, getAnnotations)
    ),

    vscode.commands.registerCommand("redline.openSidecar", (args?: unknown) =>
      openSidecar(getAnnotations, args)
    ),

    vscode.commands.registerCommand("redline.nextNote", () =>
      navigateNote("next", getAnnotations)
    ),

    vscode.commands.registerCommand("redline.prevNote", () =>
      navigateNote("prev", getAnnotations)
    )
  );
}

/**
 * Add a redline annotation to the current selection.
 * Creates the annotation block with an empty comment, opens the sidecar
 * file side-by-side, and places the cursor where the user can start typing.
 */
async function addRedline(refreshCallback: () => void): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showWarningMessage(
      "Select some text first to add a redline."
    );
    return;
  }

  if (isSidecarFile(editor.document.uri)) {
    vscode.window.showWarningMessage(
      "Can't add a redline to a sidecar file."
    );
    return;
  }

  const document = editor.document;
  const selection = editor.selection;
  const selectedText = document.getText(selection);
  const contextChars = vscode.workspace
    .getConfiguration("redline")
    .get<number>("contextChars", 40);

  // Grab surrounding context
  const fullText = document.getText();
  const selStart = document.offsetAt(selection.start);
  const selEnd = document.offsetAt(selection.end);

  const ctxStart = Math.max(0, selStart - contextChars);
  const ctxEnd = Math.min(fullText.length, selEnd + contextChars);

  // Trim context to word boundaries
  let contextBefore = fullText.slice(ctxStart, selStart);
  const firstSpace = contextBefore.indexOf(" ");
  if (firstSpace !== -1 && ctxStart > 0) {
    contextBefore = contextBefore.slice(firstSpace + 1);
  }

  let contextAfter = fullText.slice(selEnd, ctxEnd);
  const lastSpace = contextAfter.lastIndexOf(" ");
  if (lastSpace !== -1 && ctxEnd < fullText.length) {
    contextAfter = contextAfter.slice(0, lastSpace);
  }

  const quotedText = contextBefore + selectedText + contextAfter;
  const annotationSelStart = contextBefore.length;
  const annotationSelEnd = annotationSelStart + selectedText.length;
  const sourceLine = selection.start.line + 1; // 1-based

  const sourceFileName = path.basename(document.uri.fsPath);

  // Create annotation with empty comment — user will type it in the sidecar
  const annotation: Annotation = {
    quotedText,
    selectionStart: annotationSelStart,
    selectionEnd: annotationSelEnd,
    sourceFile: sourceFileName,
    sourceLine,
    comment: "",
  };

  // Read or create sidecar file, ensuring the in-memory document model
  // stays in sync with what we write. Using WorkspaceEdit instead of
  // writeFile prevents the race condition where the editor opens with
  // stale content and our cursor position is wrong.
  const sidecarUri = getSidecarPath(document.uri);
  let existingContent = "";

  try {
    const existingBytes = await vscode.workspace.fs.readFile(sidecarUri);
    existingContent = Buffer.from(existingBytes).toString("utf-8");
  } catch {
    // File doesn't exist yet — create it so we can open a TextDocument
    await vscode.workspace.fs.writeFile(sidecarUri, Buffer.from("", "utf-8"));
  }

  const newContent = appendAnnotation(existingContent, annotation);

  // Compute cursor position from the newContent string.
  // The comment area is the blank line after the last blockquote.
  const contentLines = newContent.split("\n");
  let commentLine = 0;
  for (let i = contentLines.length - 1; i >= 0; i--) {
    const text = contentLines[i].trim();
    if (text === "" || text === "---") continue;
    commentLine = i + 1;
    break;
  }

  // If the target line is "---", insert a blank line before it for the comment.
  if (commentLine < contentLines.length && contentLines[commentLine].trim() === "---") {
    contentLines.splice(commentLine, 0, "");
  }

  const finalContent = contentLines.join("\n");

  // Use WorkspaceEdit to update the in-memory document model atomically.
  // This ensures the document content matches our cursor position calculation.
  const sidecarDoc = await vscode.workspace.openTextDocument(sidecarUri);
  const wsEdit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    new vscode.Position(0, 0),
    sidecarDoc.lineAt(Math.max(0, sidecarDoc.lineCount - 1)).range.end
  );
  wsEdit.replace(sidecarUri, fullRange, finalContent);
  await vscode.workspace.applyEdit(wsEdit);
  await sidecarDoc.save();

  refreshCallback();

  const cursorPos = new vscode.Position(Math.max(0, commentLine), 0);
  const cursorRange = new vscode.Range(cursorPos, cursorPos);

  const sidecarEditor = await vscode.window.showTextDocument(sidecarUri, {
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
    selection: cursorRange,
  });

  setCursorReliably(sidecarEditor, cursorRange);
}

/**
 * Delete a redline annotation.
 */
async function deleteRedline(
  args: unknown,
  refreshCallback: () => void,
  getAnnotations: (uri: vscode.Uri) => ResolvedAnnotation[]
): Promise<void> {
  let sourceUri: vscode.Uri | undefined;
  let targetOffset: number | undefined;

  // Parse args from hover command link
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args);
      sourceUri = vscode.Uri.parse(parsed.sourceFile);
      targetOffset = parsed.offset;
    } catch {
      // ignore
    }
  } else if (args && typeof args === "object") {
    const obj = args as Record<string, unknown>;
    if (typeof obj.sourceFile === "string") {
      sourceUri = vscode.Uri.parse(obj.sourceFile);
    }
    if (typeof obj.offset === "number") {
      targetOffset = obj.offset;
    }
  }

  if (!sourceUri) {
    sourceUri = vscode.window.activeTextEditor?.document.uri;
  }
  if (!sourceUri) return;

  const annotations = getAnnotations(sourceUri);
  if (annotations.length === 0) {
    vscode.window.showInformationMessage("No redlines to delete.");
    return;
  }

  // Find the annotation to delete
  let indexToDelete: number;
  if (targetOffset !== undefined) {
    indexToDelete = annotations.findIndex(
      (a) => a.sourceOffset === targetOffset
    );
    if (indexToDelete === -1) {
      vscode.window.showWarningMessage("Could not find that redline.");
      return;
    }
  } else {
    // Show a quick pick
    const items = annotations.map((a, i) => ({
      label: a.quotedText.slice(a.selectionStart, a.selectionEnd),
      description: truncate(a.comment, 50),
      index: i,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a redline to delete",
    });
    if (!picked) return;
    indexToDelete = picked.index;
  }

  // Remove from the sidecar file
  const sidecarUri = getSidecarPath(sourceUri);
  try {
    const existingBytes = await vscode.workspace.fs.readFile(sidecarUri);
    const existingContent = Buffer.from(existingBytes).toString("utf-8");
    const newContent = removeAnnotation(existingContent, indexToDelete);

    if (newContent) {
      await vscode.workspace.fs.writeFile(
        sidecarUri,
        Buffer.from(newContent, "utf-8")
      );
    } else {
      await vscode.workspace.fs.delete(sidecarUri);
    }

    refreshCallback();
  } catch {
    vscode.window.showErrorMessage("Failed to delete redline.");
  }
}

/**
 * Open the sidecar file for the current editor, side by side.
 * If we can identify which annotation triggered this (via args or cursor),
 * jump to that annotation's comment in the sidecar.
 *
 * Args can be:
 * - { sourceFile: string, offset: number } — from hover/CodeLens
 * - string (JSON-encoded version of the above)
 */
async function openSidecar(
  getAnnotations: (uri: vscode.Uri) => ResolvedAnnotation[],
  args?: unknown
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (isSidecarFile(editor.document.uri)) {
    // Already viewing a sidecar — open the source
    const sourceUri = getSourcePath(editor.document.uri);
    if (!sourceUri) return;
    await vscode.window.showTextDocument(sourceUri, {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: false,
    });
    return;
  }

  const sidecarUri = getSidecarPath(editor.document.uri);

  // Parse args to find the target annotation offset
  let targetOffset: number | undefined;
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args);
      if (typeof parsed.offset === "number") {
        targetOffset = parsed.offset;
      }
    } catch {
      // ignore
    }
  } else if (args && typeof args === "object") {
    const obj = args as Record<string, unknown>;
    if (typeof obj.offset === "number") {
      targetOffset = obj.offset;
    }
  }

  // Find the target annotation
  let targetAnnotation: ResolvedAnnotation | undefined;
  const annotations = getAnnotations(editor.document.uri);

  if (targetOffset !== undefined) {
    // Match by offset (from CodeLens/hover args)
    targetAnnotation = annotations.find(
      (a) => a.sourceOffset === targetOffset
    );
  } else {
    // Fallback: match by cursor line
    const cursorLine = editor.selection.active.line;
    targetAnnotation = annotations.find((a) => {
      const aLine = editor.document.positionAt(a.sourceOffset).line;
      return aLine === cursorLine;
    });
  }

  // If we have a target annotation, find its position in the sidecar BEFORE
  // opening the editor. Passing `selection` to showTextDocument sets the cursor
  // atomically with focus, avoiding race conditions where VS Code restores the
  // old cursor position after we try to set ours.
  let selection: vscode.Range | undefined;
  if (targetAnnotation) {
    const sidecarDoc = await vscode.workspace.openTextDocument(sidecarUri);
    selection = findAnnotationCommentPosition(sidecarDoc, targetAnnotation);
  }

  const sidecarEditor = await vscode.window.showTextDocument(sidecarUri, {
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
    selection,
  });

  if (selection) {
    setCursorReliably(sidecarEditor, selection);
  }
}

/**
 * Find the position of an annotation's comment area in a sidecar document.
 * Returns a zero-width Range at the comment line, or undefined if not found.
 */
function findAnnotationCommentPosition(
  doc: vscode.TextDocument,
  annotation: ResolvedAnnotation
): vscode.Range | undefined {
  const selectedSpan = annotation.quotedText.slice(
    annotation.selectionStart,
    annotation.selectionEnd
  );

  // For multi-line selections, the ==markers== may span across blockquote
  // lines. Search for the opening marker with just the first line of the span.
  const firstLineOfSpan = selectedSpan.split("\n")[0];
  const openingMarker = `==${firstLineOfSpan}`;

  // Find the blockquote containing this marked span
  let foundQuote = false;
  for (let i = 0; i < doc.lineCount; i++) {
    const text = doc.lineAt(i).text;

    // Look for a blockquote line containing the opening == marker
    if (text.startsWith(">") && text.includes(openingMarker)) {
      foundQuote = true;
      continue;
    }

    // Once we found the quote, skip remaining blockquote lines
    if (foundQuote && text.startsWith(">")) {
      continue;
    }

    // First non-blockquote line after our match — this is the comment area
    if (foundQuote) {
      // Skip blank line between blockquote and comment
      let targetLine = i;
      if (text.trim() === "" && targetLine + 1 < doc.lineCount) {
        const nextText = doc.lineAt(targetLine + 1).text;
        if (nextText.trim() !== "---") {
          targetLine = targetLine + 1;
        }
      }
      const pos = new vscode.Position(targetLine, 0);
      return new vscode.Range(pos, pos);
    }
  }

  return undefined;
}

/**
 * Navigate to the next or previous annotation.
 */
function navigateNote(
  direction: "next" | "prev",
  getAnnotations: (uri: vscode.Uri) => ResolvedAnnotation[]
): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const annotations = getAnnotations(editor.document.uri);
  if (annotations.length === 0) {
    vscode.window.showInformationMessage("No redlines in this file.");
    return;
  }

  // Sort by offset
  const sorted = [...annotations].sort(
    (a, b) => a.sourceOffset - b.sourceOffset
  );
  const currentOffset = editor.document.offsetAt(editor.selection.active);

  let target: ResolvedAnnotation;

  if (direction === "next") {
    target =
      sorted.find((a) => a.sourceOffset > currentOffset) ?? sorted[0];
  } else {
    target =
      [...sorted].reverse().find((a) => a.sourceOffset < currentOffset) ??
      sorted[sorted.length - 1];
  }

  const pos = editor.document.positionAt(target.sourceOffset);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(
    new vscode.Range(pos, pos),
    vscode.TextEditorRevealType.InCenter
  );
}

/** Set cursor position and scroll it into view. */
function setCursorReliably(editor: vscode.TextEditor, range: vscode.Range): void {
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}

function truncate(text: string, max: number): string {
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= max) return firstLine;
  return firstLine.slice(0, max - 1) + "\u2026";
}
