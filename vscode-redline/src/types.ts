/** A single annotation parsed from a .redline.md sidecar file. */
export interface Annotation {
  /** The full quoted passage including surrounding context (without == markers). */
  quotedText: string;

  /** Start offset within quotedText where the selected span begins. */
  selectionStart: number;

  /** End offset within quotedText where the selected span ends. */
  selectionEnd: number;

  /** Source file path (relative, as written in the sidecar). */
  sourceFile: string;

  /** Line number hint from the source reference link (1-based). */
  sourceLine: number;

  /** The comment body (may contain markdown, including suggestion blocks). */
  comment: string;

  /** Extracted suggested replacement text, if a ```suggestion block is present. */
  suggestion?: string;
}

/** An annotation with its resolved position in the source document. */
export interface ResolvedAnnotation extends Annotation {
  /** Character offset in the source file where the selected span starts. */
  sourceOffset: number;

  /** Length of the selected span in the source file. */
  sourceLength: number;
}

/** Result of attempting to anchor an annotation to a source file. */
export type AnchorResult =
  | { status: "exact"; offset: number; length: number }
  | { status: "fuzzy"; offset: number; length: number; confidence: number }
  | { status: "orphaned" };
