# Word Count — VS Code Extension

A minimal word count extension that shows a live count in the status bar.

## Features

- **Status bar word count** – displays total words in the current document (bottom-left).
- **Selection-aware** – when you select text, the count switches to show only the selected words.
- **Markdown-friendly** – strips front-matter, links, images, HTML tags, and heading markers so the count reflects actual prose.
- **Configurable languages** – enabled for Markdown, Plain Text, LaTeX, HTML, and reStructuredText by default. Add or remove language IDs via the `wordCount.enabledLanguages` setting.

## Install (local / dev)

```bash
cd vscode-word-count
npm install
npm run compile
```

Then press **F5** in VS Code to launch an Extension Development Host, or package with `vsce`:

```bash
npx @vscode/vsce package
code --install-extension word-count-0.1.0.vsix
```

## Configuration

| Setting                        | Default                                                        | Description                           |
| ------------------------------ | -------------------------------------------------------------- | ------------------------------------- |
| `wordCount.enabledLanguages`   | `["markdown","plaintext","latex","html","restructuredtext"]`   | Language IDs that activate the count. |
