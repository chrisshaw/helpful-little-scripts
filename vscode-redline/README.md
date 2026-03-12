# Redline

A VS Code extension for annotating Markdown files with editorial comments. Annotations are stored in a readable Markdown sidecar file — your source files are never modified.

## How it works

When you annotate text in `draft.md`, Redline creates a companion `draft.redline.md` file:

```markdown
> context before ==selected span== context after
> [draft.md:14](draft.md#L14)

This passage needs tightening.

---

> ==The quick brown fox== jumped over the lazy dog.
> [draft.md:28](draft.md#L28)

Too cliche.

\`\`\`suggestion
A swift russet fox
\`\`\`

---
```

The sidecar file is valid, readable Markdown. You can edit it by hand, commit it to version control, or share it with collaborators.

## Features

- **Highlight annotations** — annotated text gets a subtle background color
- **Gutter icons** — comment bubble on lines with annotations
- **Inline previews** — truncated comments shown after annotated lines (git-blame style)
- **Hover tooltips** — full comment shown on hover, with suggestion diffs
- **Change suggestions** — GitHub PR-style ```` ```suggestion ```` blocks for proposed replacements
- **Smart anchoring** — annotations survive edits via context matching with fuzzy fallback

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| Redline: Add Comment | `Ctrl+Shift+;` (`Cmd+Shift+;`) | Annotate selected text |
| Redline: Open Sidecar File | `Ctrl+Shift+'` (`Cmd+Shift+'`) | Open the sidecar file side-by-side |
| Redline: Delete Comment | — | Delete an annotation (from hover or quick pick) |
| Redline: Go to Next Comment | — | Jump to the next annotation |
| Redline: Go to Previous Comment | — | Jump to the previous annotation |

You can also right-click selected text and choose "Redline: Add Comment" from the context menu.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `redline.highlightColor` | `rgba(255, 107, 107, 0.12)` | Background color for annotated ranges |
| `redline.showInlinePreview` | `true` | Show inline comment previews after lines |
| `redline.contextChars` | `40` | Characters of surrounding context to capture |

## Development

```bash
npm install
npm run compile
npm test
```

Press `F5` in VS Code to launch the Extension Development Host.

## Installation

Package with `vsce`:

```bash
npx @vscode/vsce package
code --install-extension redline-0.1.0.vsix
```
