import { Annotation } from "./types";

/**
 * Parse a .redline.md sidecar file into an array of Annotations.
 *
 * Expected format (annotations separated by `---`):
 *
 * ```
 * > context before ==selected span== context after
 * > [source.md:14](source.md#L14)
 *
 * Comment text here.
 *
 * ---
 * ```
 */
export function parseRedlineFile(content: string): Annotation[] {
  const blocks = splitIntoBlocks(content);
  const annotations: Annotation[] = [];

  for (const block of blocks) {
    const parsed = parseBlock(block);
    if (parsed) {
      annotations.push(parsed);
    }
  }

  return annotations;
}

/**
 * Split sidecar content into annotation blocks separated by `---`.
 * Trims empty blocks.
 */
function splitIntoBlocks(content: string): string[] {
  // Split on horizontal rules: a line that is exactly `---` (with optional whitespace)
  const blocks = content.split(/^---\s*$/m);
  return blocks.map((b) => b.trim()).filter((b) => b.length > 0);
}

/**
 * Parse a single annotation block into an Annotation, or null if unparseable.
 */
function parseBlock(block: string): Annotation | null {
  const lines = block.split("\n");

  // Extract blockquote lines and comment lines
  const quoteLines: string[] = [];
  let commentStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith(">")) {
      quoteLines.push(line.replace(/^>\s?/, ""));
    } else if (quoteLines.length > 0 && commentStartIndex === -1) {
      // First non-quote line after the blockquote starts the comment
      commentStartIndex = i;
    }
  }

  if (quoteLines.length === 0) {
    return null;
  }

  // The last quote line should be the source reference link
  const lastQuoteLine = quoteLines[quoteLines.length - 1];
  const sourceRef = parseSourceReference(lastQuoteLine);

  // The quoted text is everything except the source reference line
  let quotedTextLines: string[];
  if (sourceRef) {
    quotedTextLines = quoteLines.slice(0, -1);
  } else {
    // No source reference found — treat all quote lines as quoted text
    quotedTextLines = quoteLines;
  }

  const rawQuotedText = quotedTextLines.join("\n");

  // Extract the ==highlighted== span
  const { text: quotedText, start, end } = extractHighlightSpan(rawQuotedText);

  // Extract comment (everything after the blockquote)
  let comment = "";
  if (commentStartIndex !== -1) {
    comment = lines.slice(commentStartIndex).join("\n").trim();
  }

  // Extract suggestion block if present
  const suggestion = extractSuggestion(comment);

  return {
    quotedText,
    selectionStart: start,
    selectionEnd: end,
    sourceFile: sourceRef?.file ?? "",
    sourceLine: sourceRef?.line ?? 0,
    comment,
    ...(suggestion !== undefined ? { suggestion } : {}),
  };
}

/**
 * Parse a source reference link like `[source.md:14](source.md#L14)`.
 * Returns the file path and line number, or null if not a valid reference.
 */
export function parseSourceReference(
  line: string
): { file: string; line: number } | null {
  // Match [filename:line](path#Lline) or [filename:line](path)
  const match = line.match(
    /^\[([^\]]+):(\d+)\]\(([^)]+)\)\s*$/
  );
  if (!match) {
    return null;
  }

  const file = match[1];
  const lineNum = parseInt(match[2], 10);

  return { file, line: lineNum };
}

/**
 * Extract the ==highlighted== span from quoted text.
 * Returns the text with == markers removed, and start/end offsets of the span.
 * If no == markers found, the entire text is treated as the selection.
 */
export function extractHighlightSpan(text: string): {
  text: string;
  start: number;
  end: number;
} {
  const openIndex = text.indexOf("==");
  if (openIndex === -1) {
    // No highlight markers — entire text is the selection
    return { text, start: 0, end: text.length };
  }

  const afterOpen = openIndex + 2;
  const closeIndex = text.indexOf("==", afterOpen);
  if (closeIndex === -1) {
    // Only opening marker, no closing — treat as no markers
    return { text, start: 0, end: text.length };
  }

  // Remove the markers and compute offsets
  const before = text.slice(0, openIndex);
  const selected = text.slice(afterOpen, closeIndex);
  const after = text.slice(closeIndex + 2);

  const cleanText = before + selected + after;
  const start = before.length;
  const end = start + selected.length;

  return { text: cleanText, start, end };
}

/**
 * Extract a ```suggestion block from the comment body.
 * Returns the suggestion text, or undefined if none found.
 */
export function extractSuggestion(comment: string): string | undefined {
  const match = comment.match(/```suggestion\s*\n([\s\S]*?)```/);
  if (!match) {
    return undefined;
  }
  return match[1].trimEnd();
}
