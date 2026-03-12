import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  anchorAnnotation,
  resolveAnnotations,
  lineToOffset,
  offsetToLine,
} from "./anchoring";
import { Annotation } from "./types";

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    quotedText: "the man who lived in a brew",
    selectionStart: 12,
    selectionEnd: 17,
    sourceFile: "test.md",
    sourceLine: 1,
    comment: "test",
    ...overrides,
  };
}

describe("lineToOffset", () => {
  const text = "line one\nline two\nline three";

  it("returns 0 for line 1", () => {
    assert.strictEqual(lineToOffset(text, 1), 0);
  });

  it("returns correct offset for line 2", () => {
    assert.strictEqual(lineToOffset(text, 2), 9);
  });

  it("returns correct offset for line 3", () => {
    assert.strictEqual(lineToOffset(text, 3), 18);
  });

  it("returns text length for line beyond file", () => {
    assert.strictEqual(lineToOffset(text, 99), text.length);
  });
});

describe("offsetToLine", () => {
  const text = "line one\nline two\nline three";

  it("returns 1 for offset 0", () => {
    assert.strictEqual(offsetToLine(text, 0), 1);
  });

  it("returns 2 for offset in second line", () => {
    assert.strictEqual(offsetToLine(text, 10), 2);
  });

  it("returns 3 for offset in third line", () => {
    assert.strictEqual(offsetToLine(text, 20), 3);
  });
});

describe("anchorAnnotation", () => {
  it("finds exact match via full context", () => {
    const source = "Once upon a time, the man who lived in a brew was happy.";
    const annotation = makeAnnotation();

    const result = anchorAnnotation(annotation, source);
    assert.strictEqual(result.status, "exact");
    if (result.status === "exact") {
      assert.strictEqual(
        source.slice(result.offset, result.offset + result.length),
        "lived"
      );
    }
  });

  it("finds exact match via selected span when context changed", () => {
    // Context around the selection has changed, but the selected span is still there
    const source = "Different context but lived is still here.";
    const annotation = makeAnnotation({
      quotedText: "old context lived old more",
      selectionStart: 12,
      selectionEnd: 17,
    });

    const result = anchorAnnotation(annotation, source);
    assert.strictEqual(result.status, "exact");
    if (result.status === "exact") {
      assert.strictEqual(
        source.slice(result.offset, result.offset + result.length),
        "lived"
      );
    }
  });

  it("disambiguates multiple span matches using line hint", () => {
    const source = "lived on line 1\nsome text\nlived on line 3";
    const annotation = makeAnnotation({
      quotedText: "lived",
      selectionStart: 0,
      selectionEnd: 5,
      sourceLine: 3,
    });

    const result = anchorAnnotation(annotation, source);
    assert.strictEqual(result.status, "exact");
    if (result.status === "exact") {
      // Should pick the one on line 3
      assert.strictEqual(result.offset, source.lastIndexOf("lived"));
    }
  });

  it("returns orphaned when text is gone", () => {
    const source = "Completely different document with no matching text.";
    const annotation = makeAnnotation({
      quotedText: "something entirely unique and specific xyz123",
      selectionStart: 0,
      selectionEnd: 45,
    });

    const result = anchorAnnotation(annotation, source);
    assert.strictEqual(result.status, "orphaned");
  });

  it("fuzzy matches when text is slightly changed", () => {
    const source = "the man who lives in a brew";
    // Original was "lived" but now it's "lives"
    const annotation = makeAnnotation({
      quotedText: "the man who lived in a brew",
      selectionStart: 12,
      selectionEnd: 17, // "lived"
    });

    const result = anchorAnnotation(annotation, source);
    // Should fuzzy match "lived" → "lives" or find it near the right spot
    assert.ok(
      result.status === "exact" || result.status === "fuzzy",
      `Expected exact or fuzzy, got ${result.status}`
    );
  });
});

describe("resolveAnnotations", () => {
  it("resolves found annotations and skips orphaned", () => {
    const source = "Hello world, the man who lived in a brew, goodbye.";
    const annotations: Annotation[] = [
      makeAnnotation(),
      makeAnnotation({
        quotedText: "totally nonexistent text xyz987",
        selectionStart: 0,
        selectionEnd: 30,
      }),
    ];

    const resolved = resolveAnnotations(annotations, source);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(
      source.slice(resolved[0].sourceOffset, resolved[0].sourceOffset + resolved[0].sourceLength),
      "lived"
    );
  });
});
