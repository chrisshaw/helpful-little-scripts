import { Annotation, AnchorResult, ResolvedAnnotation } from "./types";

/**
 * Attempt to locate an annotation's selected span within the source text.
 *
 * Strategy:
 * 1. Try exact match of the full quoted text (context + selection)
 * 2. Try exact match of just the selected span, near the hinted line
 * 3. Fall back to fuzzy matching of the selected span
 * 4. If nothing works, return orphaned
 */
export function anchorAnnotation(
  annotation: Annotation,
  sourceText: string
): AnchorResult {
  const selectedSpan = annotation.quotedText.slice(
    annotation.selectionStart,
    annotation.selectionEnd
  );

  // Strategy 1: Exact match of the full quoted context
  const contextMatches = findAllOccurrences(sourceText, annotation.quotedText);
  if (contextMatches.length === 1) {
    return {
      status: "exact",
      offset: contextMatches[0] + annotation.selectionStart,
      length: selectedSpan.length,
    };
  }
  if (contextMatches.length > 1) {
    // Disambiguate by proximity to the hinted line
    const hintedOffset = lineToOffset(sourceText, annotation.sourceLine);
    const closest = contextMatches.reduce((best, offset) =>
      Math.abs(offset - hintedOffset) < Math.abs(best - hintedOffset)
        ? offset
        : best
    );
    return {
      status: "exact",
      offset: closest + annotation.selectionStart,
      length: selectedSpan.length,
    };
  }

  // Strategy 2: Exact match of the selected span, preferring near the hinted line
  const spanMatches = findAllOccurrences(sourceText, selectedSpan);
  if (spanMatches.length === 1) {
    return {
      status: "exact",
      offset: spanMatches[0],
      length: selectedSpan.length,
    };
  }
  if (spanMatches.length > 1) {
    // Disambiguate by proximity to the hinted line
    const hintedOffset = lineToOffset(sourceText, annotation.sourceLine);
    const closest = spanMatches.reduce((best, offset) =>
      Math.abs(offset - hintedOffset) < Math.abs(best - hintedOffset)
        ? offset
        : best
    );
    return {
      status: "exact",
      offset: closest,
      length: selectedSpan.length,
    };
  }

  // Strategy 3: Fuzzy match — look for the best substring match
  const fuzzy = fuzzyFind(sourceText, selectedSpan);
  if (fuzzy) {
    return {
      status: "fuzzy",
      offset: fuzzy.offset,
      length: fuzzy.length,
      confidence: fuzzy.confidence,
    };
  }

  // Nothing found
  return { status: "orphaned" };
}

/**
 * Resolve all annotations against a source text, returning those that could
 * be anchored with their resolved positions.
 */
export function resolveAnnotations(
  annotations: Annotation[],
  sourceText: string
): ResolvedAnnotation[] {
  const resolved: ResolvedAnnotation[] = [];

  for (const annotation of annotations) {
    const result = anchorAnnotation(annotation, sourceText);
    if (result.status !== "orphaned") {
      resolved.push({
        ...annotation,
        sourceOffset: result.offset,
        sourceLength: result.length,
      });
    }
  }

  return resolved;
}

/**
 * Find all occurrences of a substring in a text.
 */
function findAllOccurrences(text: string, substring: string): number[] {
  if (!substring) return [];
  const results: number[] = [];
  let index = 0;
  while ((index = text.indexOf(substring, index)) !== -1) {
    results.push(index);
    index += 1;
  }
  return results;
}

/**
 * Convert a 1-based line number to a character offset in the text.
 */
export function lineToOffset(text: string, line: number): number {
  if (line <= 1) return 0;

  let offset = 0;
  let currentLine = 1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      currentLine++;
      if (currentLine === line) {
        return i + 1;
      }
    }
  }

  return text.length;
}

/**
 * Convert a character offset to a 1-based line number.
 */
export function offsetToLine(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
    }
  }
  return line;
}

/**
 * Fuzzy find a target string in source text.
 * Uses a sliding window approach with Levenshtein-like scoring.
 * Returns the best match if it exceeds a minimum confidence threshold.
 */
function fuzzyFind(
  source: string,
  target: string
): { offset: number; length: number; confidence: number } | null {
  if (!target || target.length < 3) return null;

  const minConfidence = 0.6;
  let bestScore = 0;
  let bestOffset = -1;
  let bestLength = 0;

  // Try windows of varying sizes around the target length
  const minWindow = Math.max(3, Math.floor(target.length * 0.7));
  const maxWindow = Math.ceil(target.length * 1.3);

  for (
    let windowSize = minWindow;
    windowSize <= maxWindow && windowSize <= source.length;
    windowSize++
  ) {
    for (let i = 0; i <= source.length - windowSize; i++) {
      const candidate = source.slice(i, i + windowSize);
      const score = similarity(candidate, target);

      if (score > bestScore) {
        bestScore = score;
        bestOffset = i;
        bestLength = windowSize;
      }
    }
  }

  if (bestScore >= minConfidence && bestOffset !== -1) {
    return {
      offset: bestOffset,
      length: bestLength,
      confidence: bestScore,
    };
  }

  return null;
}

/**
 * Compute similarity between two strings using bigram overlap (Dice coefficient).
 * Returns a value between 0 and 1.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const aBigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.slice(i, i + 2);
    aBigrams.set(bigram, (aBigrams.get(bigram) ?? 0) + 1);
  }

  let intersections = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.slice(i, i + 2);
    const count = aBigrams.get(bigram);
    if (count && count > 0) {
      aBigrams.set(bigram, count - 1);
      intersections++;
    }
  }

  return (2 * intersections) / (a.length - 1 + (b.length - 1));
}
