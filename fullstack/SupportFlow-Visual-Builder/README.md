# SupportFlow Studio

SupportFlow Studio is a visual decision-tree editor for customer-support flows. It turns the supplied `flow_data.json` into an interactive graph that support teams can inspect, edit, validate, and run as a chat simulation.

The implementation is deliberately built without graph or component libraries. Node positions come directly from the provided JSON, while relationships are measured from the DOM and rendered with native SVG.

## Design

**Figma design system and product design**  
https://www.figma.com/design/h6kKHcwHrkwz2CKxqu7CGh/SupportFlow-Studio---Design-System---Product

The design uses a restrained dark workspace with semantic states:

- **Start** — green
- **Question** — blue
- **Terminal** — amber
- **Error** — muted red

The product shell includes a searchable node navigator, visual graph, inspector rail, minimap, mode controls, and compact status information.

## Features

### Build mode

- Renders all six nodes from `flow_data.json`.
- Preserves the supplied `1200 × 800` canvas and exact node `x/y` coordinates.
- Converts node options into directed graph connections.
- Measures rendered node boundaries with DOM geometry and `ResizeObserver`.
- Draws custom cubic Bézier connectors with native SVG.
- Supports route labels, selection states, execution packets, minimap navigation, and canvas zoom controls.
- Includes a searchable/collapsible node navigator.

### Flow import

Support teams can convert an old Excel-style configuration into a visual flow without hand-authoring JSON. Open **Import flow** in Build mode, then paste SupportFlow JSON, paste rows copied from Excel, or upload `.json`, `.xlsx`, `.csv`, or `.tsv` files.

Native JSON imports accept the same `{ meta, nodes }` structure used by the app, plus flat `rows`, `data`, or `records` exports when they use spreadsheet-style headings. Excel and CSV/TSV imports detect the useful header row, accept flexible column names, group repeated node rows into outbound routes, create terminal placeholders for referenced endpoints that are missing from the sheet, and lay out nodes automatically when coordinates are absent.

Accepted table shape for Excel, CSV/TSV, and flat JSON rows:

| Flow field    | Example headings                             |
| ------------- | -------------------------------------------- |
| Node ID       | `Node ID`, `Source Node`, `Step ID`          |
| Type          | `Type`, `Kind`, `Category`                   |
| Question text | `Question Text`, `Prompt`, `Message`         |
| Route label   | `Route Label`, `Answer Label`, `Choice`      |
| Next node     | `Next Node ID`, `Destination Node`, `Target` |
| Position      | `X`, `Y`, `Canvas X`, `Canvas Y`             |

**Business value:** this gives teams a practical migration path from the messy spreadsheet process described in the brief. A manager can bring existing support logic into the editor, visually inspect the generated tree, use Flow Health to catch bad references, and then refine routes or messages on the canvas.

### Workflow library

Workflows can be saved in the browser and reused later without a backend database. Open **Workflows** in Build mode to name and save the current flow, search saved workflows, rename them, delete old ones, or click **Use workflow** to load a saved flow back onto the canvas.

Search checks workflow names, node IDs, node text, route labels, and route targets. When a saved workflow is used, the editor switches back to Build mode, selects the Start node, and all normal editing, validation, import, and Preview behavior continues against that loaded workflow.

**Business value:** support managers can keep separate flows for billing, technical support, onboarding, or seasonal campaigns and switch between them without rebuilding from scratch.

### Node inspector

Selecting a node opens a detailed inspector with **Properties**, **Routes**, and **Health** tabs.

Question or terminal text is edited against a single shared in-memory flow model, so changes update the canvas and Preview immediately. The imported challenge fixture is never mutated directly.

The inspector header includes a **Canvas** back action so narrow layouts can jump from Properties, Routes, or Health back to the main Build canvas quickly.

The Routes tab supports authoring changes without touching JSON: choose where a new outbound route should point before adding it, edit route labels, retarget routes to any existing node, remove routes, and create connected Question or Terminal nodes from the selected Start/Question node. Question and Terminal nodes can be deleted from Properties or with `Delete`/`Backspace`; the editor removes incoming routes automatically, keeps Start protected, and offers Undo after deletions.

On the canvas, Start and Question nodes reveal a small `+` connector handle when selected, hovered, or focused. Drag it onto another node to create a new route visually; newly created and selected routes expose a focused label field in the inspector so the route name can be entered immediately. Existing route labels can also be dragged onto another node to change their target while keeping the route name. Selecting a route label exposes Delete route and lets `Delete`/`Backspace` remove the selected route.

### Preview runner

Preview mode runs the same live flow as a customer conversation:

- starts at the Start node;
- displays the current support message;
- follows the selected option's `nextId`;
- keeps conversation history;
- detects terminal nodes; and
- provides a Restart action at the end of the journey.

### X-Ray / Flow Health

**Flow Health is the required wildcard feature.**

A flow can look visually correct while still containing structural mistakes that only surface during execution. Flow Health therefore validates the graph and detects:

- duplicate node IDs;
- missing route targets;
- unreachable nodes;
- invalid Start-node counts;
- unexpected dead ends;
- Terminal nodes with outgoing routes; and
- cycles that can trap a customer in an endless journey.

Build mode surfaces the same validation results while editing: affected nodes get compact warning badges, and the inspector shows node-specific fixes plus jump buttons for issues elsewhere in the flow.

**Business value:** Flow Health acts as an editor-side quality gate before publish. It reduces broken customer journeys, configuration mistakes, and avoidable support tickets that are difficult for non-technical authors to spot visually.

#### Diagnostic demo

Open **X-Ray** and choose a **Diagnostic demo** scenario:

- **Broken reference** sends the Business route from node #3 to a missing target. X-Ray marks the source and draws a dangling route; all six existing nodes remain reachable.
- **Unreachable branch** disconnects Billing from Start, highlighting nodes #3 and #6 as unreachable.
- **Cycle** adds a self-loop to node #3, highlighting the actual cycle participant and drawing the loop outside the card.

Examples are temporary projections of the current flow, including any edited text. They preserve the six node IDs and supplied coordinates and never modify `flow_data.json` or the editable flow. **Return to current flow**, switching to Build/Spatial, or starting Preview clears the example. Preview always uses the author's real flow. Issue actions select the affected node on the canvas.

### Spatial mode

Spatial mode provides an alternate topology view of the same six challenge nodes. It derives from the existing flow model rather than maintaining duplicate graph data and includes working zoom/reset controls plus relationship highlighting.

### Command palette

`⌘K` / `Ctrl+K` opens a command palette for switching between Build, X-Ray, Spatial, Preview, Flow Import, and Workflows.

## Architecture

```text
flow_data.json
      |
      +--> App.jsx --------------------> shared editable state
      |
      +--> getConnections.js ----------> ConnectorLayer.jsx
      |                                      |
      |                                  native SVG
      |
      +--> FlowCanvas.jsx --------------> FlowNode.jsx
      |
      +--> importJsonFlow.js / importExcelFlow.js / importSpreadsheetFlow.js
      |                                      |
      |                                  SpreadsheetImporter.jsx
      |
      +--> workflowLibrary.js ----------> WorkflowLibraryPanel.jsx
      |
      +--> analyzeFlow.js / validateFlow.js --> X-Ray + Flow Health
      |
      +--> traverseFlow.js -------------> PreviewRunner.jsx
```

Key decisions:

- `App.jsx` owns the editable flow so all modes observe the same data.
- Graph traversal, validation, analysis, and path geometry live in pure domain functions.
- DOM measurement keeps connector anchors aligned when node dimensions change.
- Broken `nextId` references do not crash rendering; diagnostics surface them instead.
- Coordinates from `flow_data.json` remain authoritative.
- Reduced-motion preferences disable continuous execution animations.

## Technology

- React 19
- JavaScript / JSX
- Vite
- Native SVG
- Custom CSS and CSS variables
- Vitest
- React Testing Library
- ESLint
- Prettier
- Husky + lint-staged

No React Flow, jsPlumb, Mermaid, Material UI, Bootstrap, Chakra UI, or other graph/component library is used.

## Project structure

```text
src/
├── components/
│   ├── editor/
│   │   ├── FlowHealthPanel.jsx
│   │   ├── NodeInspector.jsx
│   │   ├── NodeNavigator.jsx
│   │   ├── SpreadsheetImporter.jsx
│   │   └── WorkflowLibraryPanel.jsx
│   ├── flow/
│   │   ├── ConnectorLayer.jsx
│   │   ├── FlowCanvas.jsx
│   │   ├── FlowNode.jsx
│   │   ├── Minimap.jsx
│   │   └── SpatialView.jsx
│   ├── layout/
│   │   ├── AppToolbar.jsx
│   │   ├── CommandPalette.jsx
│   │   └── StatusBar.jsx
│   └── preview/
│       └── PreviewRunner.jsx
├── domain/
│   ├── analyzeFlow.js
│   ├── createBezierPath.js
│   ├── getConnections.js
│   ├── importExcelFlow.js
│   ├── importJsonFlow.js
│   ├── importSpreadsheetFlow.js
│   ├── traverseFlow.js
│   ├── validateFlow.js
│   └── workflowLibrary.js
├── hooks/
│   └── useNodeMeasurements.js
├── styles/
│   ├── command-palette.css
│   ├── flow.css
│   ├── global.css
│   ├── studio.css
│   ├── studio-interactions.css
│   └── tokens.css
├── App.jsx
└── main.jsx
```

## Running locally

From `fullstack/SupportFlow-Visual-Builder`:

```bash
npm install
npm run dev
```

## Quality gate

```bash
npm run verify
```

This runs:

```text
Prettier format check
        ↓
ESLint
        ↓
Vitest
        ↓
Vite production build
```

Git hooks also enforce quality locally:

- **pre-commit** — lint-staged checks
- **pre-push** — complete `npm run verify`

## Tests

The suite covers node rendering, exact challenge coordinates, connector extraction, Bézier geometry, selection and editing, workflow saving/searching/loading/deletion, mode switching, Preview traversal/restart, JSON/Excel/Spreadsheet Import parsing, Flow Health rules, and navigator interactions.

Run tests independently with:

```bash
npm test
```

## Deployment

SupportFlow Studio is a static Vite application.

Recommended monorepo deployment settings:

```text
Root directory: fullstack/SupportFlow-Visual-Builder
Build command: npm run build
Output directory: dist
Install command: npm install
```

The production URL should be tested in an Incognito/Private window before submission.

## Challenge data

The supplied fixture remains the source of truth:

```text
#1 Start
├── Internet is down → #2
│   ├── Yes, didn't work → #4
│   └── No, let me try → #5
└── Billing Question → #3
    ├── Personal → #6
    └── Business → #6
```

## Author

**Jameson Githinji**  
GitHub: https://github.com/code-ninja-james  
LinkedIn: https://www.linkedin.com/in/jameson-githinji/
