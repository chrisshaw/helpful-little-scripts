import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeRedlineFile, appendAnnotation, removeAnnotation } from "./writer";
import { parseRedlineFile } from "./parser";
import { Annotation } from "./types";

const sampleAnnotation: Annotation = {
  quotedText: "context before selected span context after",
  selectionStart: 15,
  selectionEnd: 28,
  sourceFile: "draft.md",
  sourceLine: 14,
  comment: "Comment text here.",
};

describe("writeRedlineFile", () => {
  it("serializes a single annotation", () => {
    const output = writeRedlineFile([sampleAnnotation]);
    assert.ok(output.includes("> context before ==selected span== context after"));
    assert.ok(output.includes("> [draft.md:14](draft.md#L14)"));
    assert.ok(output.includes("Comment text here."));
    assert.ok(output.includes("---"));
  });

  it("serializes multiple annotations", () => {
    const annotations: Annotation[] = [
      sampleAnnotation,
      {
        quotedText: "another passage",
        selectionStart: 0,
        selectionEnd: 7,
        sourceFile: "other.md",
        sourceLine: 5,
        comment: "Second comment.",
      },
    ];

    const output = writeRedlineFile(annotations);
    assert.ok(output.includes("==selected span=="));
    assert.ok(output.includes("==another== passage"));
    assert.ok(output.includes("[other.md:5](other.md#L5)"));
  });

  it("returns empty string for empty array", () => {
    assert.strictEqual(writeRedlineFile([]), "");
  });

  it("handles annotation with suggestion in comment", () => {
    const annotation: Annotation = {
      quotedText: "the quick brown fox",
      selectionStart: 0,
      selectionEnd: 19,
      sourceFile: "doc.md",
      sourceLine: 1,
      comment: "Too cliche.\n\n```suggestion\nA swift russet fox\n```",
      suggestion: "A swift russet fox",
    };

    const output = writeRedlineFile([annotation]);
    assert.ok(output.includes("```suggestion"));
    assert.ok(output.includes("A swift russet fox"));
  });

  it("serializes annotation with empty comment (highlight only)", () => {
    const annotation: Annotation = {
      quotedText: "highlighted text in context",
      selectionStart: 0,
      selectionEnd: 16,
      sourceFile: "draft.md",
      sourceLine: 5,
      comment: "",
    };

    const output = writeRedlineFile([annotation]);
    assert.ok(output.includes("==highlighted text== in context"));
    assert.ok(output.includes("[draft.md:5](draft.md#L5)"));
    // Should not have a blank comment section — just blockquote then separator
    assert.ok(!output.includes("\n\n\n"));
  });

  it("round-trips annotation with empty comment", () => {
    const annotation: Annotation = {
      quotedText: "some words here",
      selectionStart: 5,
      selectionEnd: 10,
      sourceFile: "test.md",
      sourceLine: 3,
      comment: "",
    };

    const output = writeRedlineFile([annotation]);
    const parsed = parseRedlineFile(output);

    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].quotedText, annotation.quotedText);
    assert.strictEqual(parsed[0].selectionStart, annotation.selectionStart);
    assert.strictEqual(parsed[0].selectionEnd, annotation.selectionEnd);
    assert.strictEqual(parsed[0].comment, "");
  });

  it("handles annotation without source file", () => {
    const annotation: Annotation = {
      quotedText: "some text",
      selectionStart: 0,
      selectionEnd: 9,
      sourceFile: "",
      sourceLine: 0,
      comment: "A note.",
    };

    const output = writeRedlineFile([annotation]);
    assert.ok(output.includes("==some text=="));
    assert.ok(!output.includes("["));
  });
});

describe("round-trip: write then parse", () => {
  it("preserves a single annotation through round-trip", () => {
    const output = writeRedlineFile([sampleAnnotation]);
    const parsed = parseRedlineFile(output);

    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].quotedText, sampleAnnotation.quotedText);
    assert.strictEqual(parsed[0].selectionStart, sampleAnnotation.selectionStart);
    assert.strictEqual(parsed[0].selectionEnd, sampleAnnotation.selectionEnd);
    assert.strictEqual(parsed[0].sourceFile, sampleAnnotation.sourceFile);
    assert.strictEqual(parsed[0].sourceLine, sampleAnnotation.sourceLine);
    assert.strictEqual(parsed[0].comment, sampleAnnotation.comment);
  });

  it("preserves multiple annotations through round-trip", () => {
    const annotations: Annotation[] = [
      sampleAnnotation,
      {
        quotedText: "second passage here",
        selectionStart: 7,
        selectionEnd: 14,
        sourceFile: "b.md",
        sourceLine: 20,
        comment: "Fix this.",
      },
    ];

    const output = writeRedlineFile(annotations);
    const parsed = parseRedlineFile(output);

    assert.strictEqual(parsed.length, 2);
    for (let i = 0; i < annotations.length; i++) {
      assert.strictEqual(parsed[i].quotedText, annotations[i].quotedText);
      assert.strictEqual(parsed[i].selectionStart, annotations[i].selectionStart);
      assert.strictEqual(parsed[i].selectionEnd, annotations[i].selectionEnd);
      assert.strictEqual(parsed[i].sourceFile, annotations[i].sourceFile);
      assert.strictEqual(parsed[i].sourceLine, annotations[i].sourceLine);
      assert.strictEqual(parsed[i].comment, annotations[i].comment);
    }
  });
});

describe("appendAnnotation", () => {
  it("creates new content from empty string", () => {
    const output = appendAnnotation("", sampleAnnotation);
    const parsed = parseRedlineFile(output);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].quotedText, sampleAnnotation.quotedText);
  });

  it("appends to existing content", () => {
    const existing = writeRedlineFile([sampleAnnotation]);
    const newAnnotation: Annotation = {
      quotedText: "new text",
      selectionStart: 0,
      selectionEnd: 8,
      sourceFile: "new.md",
      sourceLine: 1,
      comment: "New comment.",
    };

    const output = appendAnnotation(existing, newAnnotation);
    const parsed = parseRedlineFile(output);
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[1].comment, "New comment.");
  });
});

describe("removeAnnotation", () => {
  it("removes an annotation by index", () => {
    const annotations: Annotation[] = [
      sampleAnnotation,
      {
        quotedText: "second",
        selectionStart: 0,
        selectionEnd: 6,
        sourceFile: "b.md",
        sourceLine: 1,
        comment: "Keep this.",
      },
    ];

    const content = writeRedlineFile(annotations);
    const result = removeAnnotation(content, 0);
    const parsed = parseRedlineFile(result);

    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].comment, "Keep this.");
  });

  it("returns empty string when removing last annotation", () => {
    const content = writeRedlineFile([sampleAnnotation]);
    const result = removeAnnotation(content, 0);
    assert.strictEqual(result, "");
  });

  it("returns original content for out-of-range index", () => {
    const content = writeRedlineFile([sampleAnnotation]);
    const result = removeAnnotation(content, 5);
    assert.strictEqual(result, content);
  });
});
