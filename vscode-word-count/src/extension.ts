import * as vscode from "vscode";
import { countWords } from "./countWords";

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

export function deactivate() {
  // nothing to clean up – disposables are handled by the context
}
