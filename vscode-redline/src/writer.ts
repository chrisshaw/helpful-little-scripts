import { Annotation } from "./types";

/**
 * Serialize an array of Annotations into the .redline.md sidecar format.
 */
export function writeRedlineFile(annotations: Annotation[]): string {
  if (annotations.length === 0) {
    return "";
  }

  return annotations.map(writeAnnotation).join("\n\n---\n\n") + "\n\n---\n";
}

/**
 * Serialize a single Annotation into a block of the sidecar format.
 */
function writeAnnotation(annotation: Annotation): string {
  const parts: string[] = [];

  // Build the blockquote with == markers around the selected span
  const markedText = insertHighlightMarkers(
    annotation.quotedText,
    annotation.selectionStart,
    annotation.selectionEnd
  );

  // Split into lines for the blockquote
  const quoteLines = markedText.split("\n").map((line) => `> ${line}`);

  // Add source reference link as the last blockquote line
  if (annotation.sourceFile) {
    const ref = formatSourceReference(
      annotation.sourceFile,
      annotation.sourceLine
    );
    quoteLines.push(`> ${ref}`);
  }

  parts.push(quoteLines.join("\n"));

  // Add the comment body
  if (annotation.comment) {
    parts.push(annotation.comment);
  }

  return parts.join("\n\n");
}

/**
 * Insert ==highlight== markers around the selected span in the quoted text.
 */
function insertHighlightMarkers(
  text: string,
  start: number,
  end: number
): string {
  if (start === 0 && end === text.length) {
    // Entire text is selected — still mark it for clarity
    return `==${text}==`;
  }

  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  return `${before}==${selected}==${after}`;
}

/**
 * Format a source reference link: `[filename:line](filename#Lline)`
 */
function formatSourceReference(file: string, line: number): string {
  return `[${file}:${line}](${file}#L${line})`;
}

/**
 * Append a single annotation to existing sidecar content.
 * If the content is empty, starts a new file.
 */
export function appendAnnotation(
  existingContent: string,
  annotation: Annotation
): string {
  const block = writeAnnotation(annotation);

  if (!existingContent.trim()) {
    return block + "\n\n---\n";
  }

  // Ensure existing content ends with a separator
  const trimmed = existingContent.trimEnd();
  const needsSeparator = !trimmed.endsWith("---");

  if (needsSeparator) {
    return trimmed + "\n\n---\n\n" + block + "\n\n---\n";
  }

  return trimmed + "\n\n" + block + "\n\n---\n";
}

/**
 * Remove an annotation from sidecar content by index.
 * Returns the new content string.
 */
export function removeAnnotation(
  existingContent: string,
  index: number
): string {
  // Re-parse, remove, re-serialize
  // This is imported dynamically to avoid circular deps at module level,
  // but since both are simple pure functions we can inline the logic.
  // Instead, we'll split by --- and remove the block at the given index.
  const blocks = existingContent
    .split(/^---\s*$/m)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (index < 0 || index >= blocks.length) {
    return existingContent;
  }

  blocks.splice(index, 1);

  if (blocks.length === 0) {
    return "";
  }

  return blocks.join("\n\n---\n\n") + "\n\n---\n";
}
