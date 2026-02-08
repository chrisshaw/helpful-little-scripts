# Zwibbler Tool Generator

An AI-powered tool generator for [Zwibbler](https://zwibbler.com) whiteboards. Users describe academic tools in natural language — calculator, periodic table, coordinate plane, unit converter, etc. — and a Claude-backed agent generates interactive HTML widgets that drop directly onto the whiteboard canvas.

## How it works

```
User prompt  →  Claude API  →  JSON { html, css, js }  →  Sandbox validation  →  Zwibbler.component()  →  Canvas
     ↑                                                           ↑
 "I need a                                                Static analysis
  fraction                                               blocks dangerous
  visualizer"                                             patterns (fetch,
                                                          eval, navigation,
                                                          external URLs...)
```

1. **User describes a tool** in natural language via the generator dialog
2. **Claude generates** a self-contained widget (HTML + scoped CSS + vanilla JS) following strict constraints in the system prompt
3. **The sandbox validates** the output with static analysis — blocking network requests, dynamic code execution, navigation, storage access, external resources, and inline event handlers
4. **User previews** the widget in a sandboxed iframe before accepting
5. **The widget is registered** as a `Zwibbler.component()` and placed on the canvas as a movable, resizable HTML node
6. **The tool appears in the sidebar** so the user can stamp additional copies

## Architecture

| File | Purpose |
|---|---|
| `index.html` | Main page — Zwibbler canvas + toolbar + generator dialog |
| `style.css` | All styling |
| `tool-generator.js` | Claude API integration — system prompt + request/response handling |
| `sandbox.js` | Static analysis validator + sandboxed iframe preview |
| `app.js` | Glue — Zwibbler controller, dialog lifecycle, component registration |
| `server.js` | Optional Node.js dev server with API proxy (keeps key server-side) |

## Zwibbler integration points

The system uses three key Zwibbler APIs:

- **`Zwibbler.component(name, { template, controller })`** — registers each generated widget as a reusable component with its own HTML template and JS controller
- **`ctx.createHTMLNode(componentName, properties)`** — places the component on the canvas as a movable/resizable node
- **`ctx.begin()` / `ctx.commit()`** — wraps placement in a transaction for proper undo support

Generated widgets become first-class Zwibbler objects: users can drag, resize, and layer them alongside pen strokes, shapes, and text.

## Safety model

The generator uses defense in depth:

1. **Constrained system prompt** — Claude is instructed to produce only academic widgets with no network access, no external resources, no eval, no DOM escape, etc.
2. **Static analysis** (`sandbox.js`) — regex-based validator rejects code containing ~30 dangerous patterns (fetch, eval, innerHTML=, createElement('script'), external URLs, localStorage, etc.)
3. **Sandboxed preview** — the widget renders in an `<iframe sandbox="allow-scripts">` (no same-origin access) before the user accepts it
4. **Scoped execution** — the JS runs inside a `Zwibbler.component` controller, scoped to its own DOM element. Errors are caught and displayed inline rather than crashing the whiteboard.
5. **Automatic retry** — if the first generation fails validation, the system retries once before reporting the failure

## Setup

### Prerequisites

- A [Zwibbler license](https://zwibbler.com) — place `zwibbler.js` in this directory
- An [Anthropic API key](https://console.anthropic.com/)
- Node.js 18+ (for the dev server; optional if you serve files another way)

### Running with the dev server (recommended)

```bash
cd zwibbler-tool-generator
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Open `http://localhost:3000`. The API key stays server-side.

### Running without the dev server

Serve the files with any static HTTP server. On first use, the app will prompt for your API key in the browser. The key is stored only in `sessionStorage` (cleared when the tab closes) and sent directly to the Anthropic API with `anthropic-dangerous-direct-browser-access`.

## Example prompts

- "A basic calculator with +, -, ×, ÷ and a clear button"
- "An interactive periodic table where clicking an element shows its details"
- "A unit converter for length, mass, and temperature"
- "A coordinate plane where you can plot points by clicking"
- "A fraction visualizer with pie chart representation"
- "A multiplication table from 1-12 with highlighting"
- "A simple protractor that can measure angles"
- "A stopwatch with lap times for science experiments"
- "A quadratic equation solver that shows the discriminant and roots"
- "Graph paper with adjustable grid spacing"

## Design decisions

**Why generate HTML widgets rather than curate a fixed library?**
The combinatorial space of useful academic tools is enormous — every subject, every grade level, every specific lesson. A fixed library can never be complete. Generation lets users get exactly the tool they need in seconds, including niche tools (e.g., "a Roman numeral converter" or "a color wheel with RGB/HSL values") that would never make a curated list.

**Why not use existing open-source widget libraries?**
For a production system, you'd want a hybrid: a curated set of high-quality pre-built components for the most common needs (calculator, timer, graph paper), supplemented by the generator for everything else. This prototype focuses on the generation path to prove the concept.

**Why static analysis instead of a full JS sandbox (e.g., SES/Compartment)?**
Static analysis is lightweight, fast, and catches the patterns that matter most for this threat model (data exfiltration, code injection, external resource loading). A full JS sandbox like SES would be more robust but adds complexity and may interfere with Zwibbler's framework. For production, adding SES or running widgets in isolated iframes that communicate via postMessage would be a worthwhile hardening step.

**Why `new Function()` in the component controller?**
The generated JS needs access to the component's DOM element. Zwibbler's controller pattern provides a `scope` object. We bridge these by wrapping the generated JS in a `new Function("scope", "el", generatedCode)` call. Yes, this is a form of eval — but it runs code that has already passed static analysis, and it runs within Zwibbler's component lifecycle, not at the global scope. The alternative (injecting the JS as a `<script>` tag) would be harder to scope and manage.
