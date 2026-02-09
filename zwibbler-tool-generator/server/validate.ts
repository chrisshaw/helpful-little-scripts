import { GeneratedTool } from "./generator.js";


export type PatternRule = readonly [RegExp, string];export interface ValidationResult {
  valid: true;
}
export interface ValidationFailure {
  valid: false;
  reasons: string[];
}
export type ValidationOutcome = ValidationResult | ValidationFailure;
export class ValidationError extends Error {
  reasons: string[];

  constructor(message: string, reasons: string[]) {
    super(message);
    this.name = "ValidationError";
    this.reasons = reasons;
  }
}



const BLOCKED_HTML_PATTERNS: PatternRule[] = [
  [/<script[\s>]/i, "<script> tags are not allowed"],
  [/<iframe[\s>]/i, "<iframe> tags are not allowed"],
  [/<object[\s>]/i, "<object> tags are not allowed"],
  [/<embed[\s>]/i, "<embed> tags are not allowed"],
  [/<link[\s>]/i, "<link> tags are not allowed"],
  [/\bon(?:click|load|error|mouse\w+|key\w+|focus|blur|change|submit|input|dblclick|contextmenu|drag\w*|drop|scroll|wheel|touch\w+|pointer\w+|animationend|transitionend)\s*=/i, "Inline event handlers are not allowed"],
  [/javascript\s*:/i, "javascript: URLs are not allowed"],
  [/=\s*["']data\s*:/i, "data: URLs are not allowed in HTML attributes"],
];

const BLOCKED_PATTERNS: PatternRule[] = [
  [/\bfetch\s*\(/i, "Network requests (fetch) are not allowed"],
  [/\bXMLHttpRequest\b/i, "Network requests (XMLHttpRequest) are not allowed"],
  [/\bWebSocket\b/i, "WebSocket connections are not allowed"],
  [/\bEventSource\b/i, "Server-sent events are not allowed"],
  [/\bnavigator\.sendBeacon\b/i, "navigator.sendBeacon is not allowed"],
  [/\bimportScripts\b/i, "importScripts is not allowed"],
  [/\beval\s*\(/i, "eval() is not allowed"],
  [/\bnew\s+Function\s*\(/i, "new Function() is not allowed"],
  [/\bsetTimeout\s*\(\s*["`']/i, "setTimeout with string argument is not allowed"],
  [/\bsetInterval\s*\(\s*["`']/i, "setInterval with string argument is not allowed"],
  [/\bdocument\s*\.\s*write/i, "document.write is not allowed"],
  [/\bdocument\s*\.\s*cookie/i, "document.cookie access is not allowed"],
  [/\bdocument\b[^.]*\.innerHTML\s*=/i, "document innerHTML assignment is not allowed"],
  [/\.outerHTML\s*=/i, "outerHTML assignment is not allowed"],
  [/\bdocument\.createElement\s*\(\s*['"`]script/i, "Creating <script> elements is not allowed"],
  [/\bdocument\.createElement\s*\(\s*['"`]iframe/i, "Creating <iframe> elements is not allowed"],
  [/\bdocument\.createElement\s*\(\s*['"`]object/i, "Creating <object> elements is not allowed"],
  [/\bdocument\.createElement\s*\(\s*['"`]embed/i, "Creating <embed> elements is not allowed"],
  [/\bdocument\.createElement\s*\(\s*['"`]link/i, "Creating <link> elements is not allowed"],
  [/\blocalStorage\b/i, "localStorage is not allowed"],
  [/\bsessionStorage\b/i, "sessionStorage is not allowed"],
  [/\bindexedDB\b/i, "indexedDB is not allowed"],
  [/\bwindow\s*\.\s*open\s*\(/i, "window.open is not allowed"],
  [/\bwindow\s*\.\s*location/i, "window.location access is not allowed"],
  [/\blocation\s*\.\s*href/i, "location.href is not allowed"],
  [/\blocation\s*\.\s*assign/i, "location.assign is not allowed"],
  [/\blocation\s*\.\s*replace\s*\(/i, "location.replace is not allowed"],
  [/https?:\/\//i, "External URLs are not allowed"],
  [/\bimport\s*\(/i, "Dynamic import() is not allowed"],
  [/\bimport\s+/i, "ES module imports are not allowed"],
  [/\brequire\s*\(/i, "require() is not allowed"],
];

/**
 * Validate generated tool output against blocked patterns.
 * Returns { valid: true } or { valid: false, reasons: string[] }.
 */
export function validate(tool: Pick<GeneratedTool, "html" | "css" | "js">): ValidationOutcome {
  const reasons: string[] = [];

  for (const [pattern, reason] of BLOCKED_PATTERNS) {
    if (pattern.test(tool.js)) reasons.push(`[JS] ${reason}`);
  }

  for (const [pattern, reason] of [...BLOCKED_PATTERNS, ...BLOCKED_HTML_PATTERNS]) {
    if (pattern.test(tool.html)) reasons.push(`[HTML] ${reason}`);
  }

  if (/url\s*\(/i.test(tool.css)) {
    reasons.push("[CSS] url() references are not allowed");
  }

  if (reasons.length > 0) {
    return { valid: false, reasons };
  }

  return { valid: true };
}