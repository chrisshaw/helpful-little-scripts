import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseRedlineFile,
  parseSourceReference,
  extractHighlightSpan,
  extractSuggestion,
} from "./parser";

describe("parseSourceReference", () => {
  it("parses a standard reference link", () => {
    const result = parseSourceReference("[draft.md:14](draft.md#L14)");
    assert.deepStrictEqual(result, { file: "draft.md", line: 14 });
  });

  it("parses a reference with a path", () => {
    const result = parseSourceReference(
      "[README.md:3](docs/README.md#L3)"
    );
    assert.deepStrictEqual(result, { file: "README.md", line: 3 });
  });

  it("returns null for non-reference text", () => {
    assert.strictEqual(parseSourceReference("just some text"), null);
  });

  it("returns null for malformed reference", () => {
    assert.strictEqual(parseSourceReference("[no-line](file.md)"), null);
  });
});

describe("extractHighlightSpan", () => {
  it("extracts a highlighted span", () => {
    const result = extractHighlightSpan(
      "context before ==selected span== context after"
    );
    assert.strictEqual(
      result.text,
      "context before selected span context after"
    );
    assert.strictEqual(result.start, 15);
    assert.strictEqual(result.end, 28);
    assert.strictEqual(
      result.text.slice(result.start, result.end),
      "selected span"
    );
  });

  it("handles highlight at start of text", () => {
    const result = extractHighlightSpan("==first word== and the rest");
    assert.strictEqual(result.text, "first word and the rest");
    assert.strictEqual(result.start, 0);
    assert.strictEqual(result.end, 10);
  });

  it("handles highlight at end of text", () => {
    const result = extractHighlightSpan("the start and ==last word==");
    assert.strictEqual(result.text, "the start and last word");
    assert.strictEqual(result.start, 14);
    assert.strictEqual(result.end, 23);
  });

  it("handles entire text highlighted", () => {
    const result = extractHighlightSpan("==everything==");
    assert.strictEqual(result.text, "everything");
    assert.strictEqual(result.start, 0);
    assert.strictEqual(result.end, 10);
  });

  it("treats text without markers as fully selected", () => {
    const result = extractHighlightSpan("no markers here");
    assert.strictEqual(result.text, "no markers here");
    assert.strictEqual(result.start, 0);
    assert.strictEqual(result.end, 15);
  });

  it("handles only opening marker as fully selected", () => {
    const result = extractHighlightSpan("only ==opening marker");
    assert.strictEqual(result.text, "only ==opening marker");
    assert.strictEqual(result.start, 0);
    assert.strictEqual(result.end, 21);
  });
});

describe("extractSuggestion", () => {
  it("extracts a suggestion block", () => {
    const comment = `This should change.

\`\`\`suggestion
replacement text
\`\`\``;
    assert.strictEqual(extractSuggestion(comment), "replacement text");
  });

  it("extracts multiline suggestion", () => {
    const comment = `Fix this.

\`\`\`suggestion
line one
line two
\`\`\``;
    assert.strictEqual(extractSuggestion(comment), "line one\nline two");
  });

  it("returns undefined when no suggestion", () => {
    assert.strictEqual(extractSuggestion("just a comment"), undefined);
  });
});

describe("parseRedlineFile", () => {
  it("parses a single annotation", () => {
    const content = `> context before ==selected span== context after
> [draft.md:14](draft.md#L14)

Comment text here.

---`;

    const annotations = parseRedlineFile(content);
    assert.strictEqual(annotations.length, 1);

    const a = annotations[0];
    assert.strictEqual(
      a.quotedText,
      "context before selected span context after"
    );
    assert.strictEqual(a.selectionStart, 15);
    assert.strictEqual(a.selectionEnd, 28);
    assert.strictEqual(a.sourceFile, "draft.md");
    assert.strictEqual(a.sourceLine, 14);
    assert.strictEqual(a.comment, "Comment text here.");
    assert.strictEqual(a.suggestion, undefined);
  });

  it("parses multiple annotations", () => {
    const content = `> ==first== thing
> [a.md:1](a.md#L1)

Comment one.

---

> second ==thing==
> [b.md:5](b.md#L5)

Comment two.

---`;

    const annotations = parseRedlineFile(content);
    assert.strictEqual(annotations.length, 2);

    assert.strictEqual(annotations[0].quotedText, "first thing");
    assert.strictEqual(annotations[0].sourceFile, "a.md");
    assert.strictEqual(annotations[0].comment, "Comment one.");

    assert.strictEqual(annotations[1].quotedText, "second thing");
    assert.strictEqual(annotations[1].sourceFile, "b.md");
    assert.strictEqual(annotations[1].comment, "Comment two.");
  });

  it("parses annotation with suggestion", () => {
    const content = `> ==The quick brown fox== jumped over the lazy dog.
> [draft.md:28](draft.md#L28)

This opening is too cliche.

\`\`\`suggestion
A swift russet fox
\`\`\`

---`;

    const annotations = parseRedlineFile(content);
    assert.strictEqual(annotations.length, 1);

    const a = annotations[0];
    assert.strictEqual(a.suggestion, "A swift russet fox");
    assert.ok(a.comment.includes("This opening is too cliche."));
  });

  it("handles multiline blockquotes", () => {
    const content = `> This is a longer passage that
> spans ==multiple lines== in the
> source document.
> [doc.md:10](doc.md#L10)

Needs tightening.

---`;

    const annotations = parseRedlineFile(content);
    assert.strictEqual(annotations.length, 1);

    const a = annotations[0];
    assert.ok(a.quotedText.includes("multiple lines"));
    assert.strictEqual(a.sourceFile, "doc.md");
    assert.strictEqual(a.sourceLine, 10);
  });

  it("handles annotation without source reference", () => {
    const content = `> ==some text== in context

A comment without a link.

---`;

    const annotations = parseRedlineFile(content);
    assert.strictEqual(annotations.length, 1);
    assert.strictEqual(annotations[0].sourceFile, "");
    assert.strictEqual(annotations[0].sourceLine, 0);
  });

  it("handles empty input", () => {
    assert.deepStrictEqual(parseRedlineFile(""), []);
  });

  it("handles trailing content without final ---", () => {
    const content = `> ==word== in context
> [f.md:1](f.md#L1)

Comment here.`;

    const annotations = parseRedlineFile(content);
    assert.strictEqual(annotations.length, 1);
    assert.strictEqual(annotations[0].comment, "Comment here.");
  });

  it("handles annotation with no comment (highlight only)", () => {
    const content = `> ==highlighted text== in context
> [draft.md:5](draft.md#L5)

---`;

    const annotations = parseRedlineFile(content);
    assert.strictEqual(annotations.length, 1);

    const a = annotations[0];
    assert.strictEqual(a.quotedText, "highlighted text in context");
    assert.strictEqual(a.selectionStart, 0);
    assert.strictEqual(a.selectionEnd, 16);
    assert.strictEqual(a.sourceFile, "draft.md");
    assert.strictEqual(a.sourceLine, 5);
    assert.strictEqual(a.comment, "");
  });

  it("handles annotation with only whitespace after blockquote", () => {
    const content = `> some ==word== here
> [f.md:2](f.md#L2)

---

> ==another==
> [f.md:10](f.md#L10)

A real comment.

---`;

    const annotations = parseRedlineFile(content);
    assert.strictEqual(annotations.length, 2);
    assert.strictEqual(annotations[0].comment, "");
    assert.strictEqual(annotations[1].comment, "A real comment.");
  });

  it("handles multiline comments", () => {
    const content = `> ==word==
> [f.md:1](f.md#L1)

First paragraph of comment.

Second paragraph of comment.

---`;

    const annotations = parseRedlineFile(content);
    assert.strictEqual(annotations.length, 1);
    assert.ok(annotations[0].comment.includes("First paragraph"));
    assert.ok(annotations[0].comment.includes("Second paragraph"));
  });
});
