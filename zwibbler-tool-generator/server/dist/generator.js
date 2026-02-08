import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();
export class ValidationError extends Error {
    reasons;
    constructor(message, reasons) {
        super(message);
        this.name = "ValidationError";
        this.reasons = reasons;
    }
}
const SIZES = {
    small: { width: 300, height: 200 },
    medium: { width: 450, height: 350 },
    large: { width: 600, height: 500 },
};
const SYSTEM_PROMPT = `You are an expert frontend developer who creates self-contained HTML widgets for an academic whiteboard application powered by Zwibbler.

## Your Task
Generate a SINGLE self-contained HTML widget based on the user's description. The widget will be embedded inside a Zwibbler whiteboard as an interactive HTML component.

## Output Format
Return ONLY a JSON object with this exact structure — no markdown fences, no explanation:
{
  "label": "Short Name (2-4 words)",
  "description": "One sentence describing what this tool does",
  "html": "<div class=\\"widget-root\\">...the full HTML...</div>",
  "css": "/* scoped CSS for .widget-root and descendants */",
  "js": "// JS that runs inside controller(scope, el) where el is the root element"
}

## Constraints — you MUST follow ALL of these:

### Safety
- NO fetch, XMLHttpRequest, WebSocket, EventSource, or any network requests
- NO eval, Function(), setTimeout with strings, or dynamic code execution
- NO document.cookie, localStorage, sessionStorage, indexedDB access
- NO window.open, window.location, or navigation
- NO creating <script>, <link>, <iframe>, <object>, <embed> elements
- NO inline event handlers in HTML (onclick="..." etc.) — use addEventListener in the JS section
- NO importing or loading external libraries, fonts, images, or resources of any kind
- ALL functionality must be implemented from scratch using only vanilla JS, HTML, and CSS
- NO references to external URLs whatsoever
- You MAY use element.innerHTML on elements within the widget for dynamic content. Do NOT use document.innerHTML or document.body.innerHTML.
- Prefer textContent over innerHTML when displaying plain text (for safety)

### Structure
- The "html" value must be a single root <div class="widget-root"> containing all markup
- The "css" value must scope everything under .widget-root to avoid style leaks
- The "js" value is a function body that receives (scope, el) — "el" is the root DOM element. Use el.querySelector/querySelectorAll to find elements. Do NOT use document.querySelector.
- Use data attributes or classes to identify elements — not IDs (multiple instances may coexist)
- The widget must work at the specified dimensions and handle resize gracefully

### Academic Focus
- Tools must serve a clear educational or academic purpose
- Content must be accurate (correct formulas, correct data, correct conversions)
- Design should be clean, readable, and classroom-appropriate
- Use clear labels, legible fonts (system fonts only), and good contrast

### Quality
- Make the widget genuinely useful and interactive, not just a static display
- Handle edge cases (division by zero, empty inputs, out-of-range values)
- Use semantic HTML where appropriate
- Ensure the widget looks polished — use consistent spacing, alignment, colors`;
/**
 * Validate generated tool output against blocked patterns.
 * Returns { valid: true } or { valid: false, reasons: string[] }.
 */
function validate(tool) {
    const BLOCKED_PATTERNS = [
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
    const BLOCKED_HTML_PATTERNS = [
        [/<script[\s>]/i, "<script> tags are not allowed"],
        [/<iframe[\s>]/i, "<iframe> tags are not allowed"],
        [/<object[\s>]/i, "<object> tags are not allowed"],
        [/<embed[\s>]/i, "<embed> tags are not allowed"],
        [/<link[\s>]/i, "<link> tags are not allowed"],
        [/\bon(?:click|load|error|mouse\w+|key\w+|focus|blur|change|submit|input|dblclick|contextmenu|drag\w*|drop|scroll|wheel|touch\w+|pointer\w+|animationend|transitionend)\s*=/i, "Inline event handlers are not allowed"],
        [/javascript\s*:/i, "javascript: URLs are not allowed"],
        [/=\s*["']data\s*:/i, "data: URLs are not allowed in HTML attributes"],
    ];
    const reasons = [];
    for (const [pattern, reason] of BLOCKED_PATTERNS) {
        if (pattern.test(tool.js))
            reasons.push(`[JS] ${reason}`);
    }
    for (const [pattern, reason] of [...BLOCKED_PATTERNS, ...BLOCKED_HTML_PATTERNS]) {
        if (pattern.test(tool.html))
            reasons.push(`[HTML] ${reason}`);
    }
    if (/url\s*\(/i.test(tool.css)) {
        reasons.push("[CSS] url() references are not allowed");
    }
    if (reasons.length > 0) {
        return { valid: false, reasons };
    }
    return { valid: true };
}
/**
 * Parse Claude's response text into a tool object.
 */
function parseToolResponse(text, size) {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(cleaned);
    const requiredFields = ["label", "html", "css", "js"];
    for (const field of requiredFields) {
        if (typeof parsed[field] !== "string") {
            throw new Error(`Generated tool is missing required field: "${field}"`);
        }
    }
    if (parsed.description !== undefined && typeof parsed.description !== "string") {
        throw new Error('Generated tool has invalid field: "description"');
    }
    return {
        label: parsed.label,
        description: parsed.description || "",
        html: parsed.html,
        css: parsed.css,
        js: parsed.js,
        width: size.width,
        height: size.height,
    };
}
/**
 * Generate a tool widget via the Anthropic SDK.
 * Validates the output and retries once if validation fails.
 */
function getSize(sizeKey) {
    if (sizeKey && sizeKey in SIZES) {
        return SIZES[sizeKey];
    }
    return SIZES.medium;
}
function getFirstTextContent(response) {
    const textBlock = response.content.find((block) => block.type === "text" && typeof block.text === "string");
    if (!textBlock) {
        throw new Error("Failed to parse generated tool response");
    }
    return textBlock.text;
}
export async function generate(prompt, sizeKey) {
    const size = getSize(sizeKey);
    const userMessage = `Create a widget for: ${prompt}\n\nTarget dimensions: ${size.width}px wide by ${size.height}px tall.\n\nRemember: return ONLY the JSON object, no markdown fencing or extra text.`;
    async function callClaude() {
        const response = await client.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            stream: false,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userMessage }],
        });
        return parseToolResponse(getFirstTextContent(response), size);
    }
    // First attempt
    const tool = await callClaude();
    const result = validate(tool);
    if (result.valid) {
        return tool;
    }
    // Automatic retry — the model sometimes slips on a single constraint
    const tool2 = await callClaude();
    const result2 = validate(tool2);
    if (!result2.valid) {
        throw new ValidationError("Generated tool failed safety validation", result2.reasons);
    }
    return tool2;
}
