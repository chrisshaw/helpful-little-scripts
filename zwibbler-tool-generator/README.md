# Zwibbler Tool Generator

An AI-powered tool generator for [Zwibbler](https://zwibbler.com) whiteboards. Users describe academic tools in natural language — calculator, periodic table, coordinate plane, unit converter, etc. — and a Claude-backed agent generates interactive HTML widgets that drop directly onto the whiteboard canvas.

## How it works

```
User prompt  →  Express API  →  Anthropic SDK  →  Validate  →  JSON response
                                                                     ↓
Canvas  ←  Zwibbler.component()  ←  Sandbox preview  ←  Vue 3 client
```

1. **User describes a tool** in natural language via the generator dialog
2. **The server calls Claude** (via the Anthropic SDK) to generate a self-contained widget (HTML + scoped CSS + vanilla JS) following strict constraints
3. **Server-side validation** checks the output against ~30 blocked patterns before returning it
4. **User previews** the widget in a sandboxed iframe before accepting
5. **The widget is registered** as a `Zwibbler.component()` and placed on the canvas as a movable, resizable HTML node
6. **The tool appears in the sidebar** so the user can stamp additional copies

## Architecture

```
zwibbler-tool-generator/
├── client/                     Vue 3 + Vite frontend
│   ├── src/
│   │   ├── App.vue             Root component
│   │   ├── components/
│   │   │   ├── TopBar.vue      Undo/redo, zoom controls
│   │   │   ├── Toolbar.vue     Drawing tools + generated tools sidebar
│   │   │   ├── CanvasArea.vue  Zwibbler canvas container
│   │   │   └── GeneratorDialog.vue  Prompt input, preview, accept flow
│   │   ├── composables/
│   │   │   └── useZwibbler.js  Zwibbler context management
│   │   ├── api/
│   │   │   └── generator.js    POST /api/generate wrapper
│   │   └── utils/
│   │       └── sandbox.js      Preview rendering + component HTML builder
│   └── public/
│       └── (zwibbler.js)       Place your licensed copy here
├── server/                     Express + Anthropic SDK backend
│   ├── index.js                Express app entry point
│   └── generator.js            Anthropic SDK calls, system prompt, validation
└── package.json                Root scripts (dev, build, install)
```

## Zwibbler integration points

The system uses three key Zwibbler APIs:

- **`Zwibbler.create(element, options)`** — programmatically creates a canvas (managed via the `useZwibbler` composable)
- **`Zwibbler.component(name, { template, controller })`** — registers each generated widget as a reusable component
- **`ctx.createHTMLNode(componentName, properties)`** — places the component on the canvas as a movable/resizable node

Generated widgets become first-class Zwibbler objects: users can drag, resize, and layer them alongside pen strokes, shapes, and text.

## Safety model

The generator uses defense in depth:

1. **Constrained system prompt** — Claude is instructed to produce only academic widgets with no network access, no external resources, no eval, no DOM escape, etc.
2. **Server-side validation** — regex-based validator rejects code containing ~30 dangerous patterns before the response reaches the client
3. **Sandboxed preview** — the widget renders in an `<iframe sandbox="allow-scripts">` (no same-origin access) before the user accepts it
4. **Scoped execution** — the JS runs inside a `Zwibbler.component` controller, scoped to its own DOM element. Errors are caught and displayed inline rather than crashing the whiteboard.
5. **Automatic retry** — if the first generation fails validation, the server retries once before returning an error

## Setup

### Prerequisites

- A [Zwibbler license](https://zwibbler.com) — place `zwibbler.js` in `client/public/`
- An [Anthropic API key](https://console.anthropic.com/) — set as `ANTHROPIC_API_KEY` environment variable
- Node.js 18+

### Install

```bash
cd zwibbler-tool-generator
npm run install:all
```

### Development

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

This starts both the Express API server (port 3001) and the Vite dev server (port 3000) with API proxying. Open `http://localhost:3000`.

### Production

```bash
npm run build                          # builds client to client/dist/
ANTHROPIC_API_KEY=sk-ant-... npm start # starts the API server
```

In production, serve `client/dist/` with your preferred static file server (nginx, CDN, etc.) and proxy `/api` requests to the Express server.

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
