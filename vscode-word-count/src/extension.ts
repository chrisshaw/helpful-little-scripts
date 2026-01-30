import * as vscode from "vscode";

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.tooltip = "Document Word Count";
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateWordCount),
    vscode.window.onDidChangeTextEditorSelection(updateWordCount),
    vscode.workspace.onDidChangeTextDocument(updateWordCount)
  );

  updateWordCount();
}

function updateWordCount() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    statusBarItem.hide();
    return;
  }

  const enabledLanguages = vscode.workspace
    .getConfiguration("wordCount")
    .get<string[]>("enabledLanguages", [
      "markdown",
      "plaintext",
      "latex",
      "html",
      "restructuredtext",
    ]);

  if (!enabledLanguages.includes(editor.document.languageId)) {
    statusBarItem.hide();
    return;
  }

  const selection = editor.selection;
  const hasSelection = !selection.isEmpty;

  const text = hasSelection
    ? editor.document.getText(selection)
    : editor.document.getText();

  const words = countWords(text);
  const label = hasSelection ? `$(pencil) ${words} words selected` : `$(book) ${words} words`;

  statusBarItem.text = label;
  statusBarItem.show();
}

function countWords(text: string): number {
  // Strip common markdown/markup syntax so it doesn't inflate the count.
  const cleaned = text
    // YAML front-matter
    .replace(/^---[\s\S]*?---/m, "")
    // HTML tags
    .replace(/<[^>]+>/g, "")
    // Markdown images ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Markdown links – keep the link text: [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Markdown heading markers, blockquote markers, horizontal rules
    .replace(/^[#>*\-=`~]+\s?/gm, "")
    // Inline code / code fences
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    // Reference-style link definitions [id]: url
    .replace(/^\[[^\]]*\]:\s.*$/gm, "");

  const matches = cleaned.match(/\S+/g);
  return matches ? matches.length : 0;
}

export function deactivate() {
  // nothing to clean up – disposables are handled by the context
}
