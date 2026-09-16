# SupportFlow Studio

SupportFlow Studio is a visual decision-tree editor for customer-support flows. It turns the supplied `flow_data.json` into an interactive graph that support teams can inspect, edit, validate, and run as a chat simulation.

The implementation is deliberately built without graph or component libraries. Node positions come directly from the provided JSON, while relationships are measured from the DOM and rendered with native SVG.

The current build also covers the real workflow around the editor: importing old spreadsheet configurations, saving reusable workflows, auditing who changed what, and validating the flow before it is tested or shared.

## Design

**Figma design system and product design**  
https://www.figma.com/design/h6kKHcwHrkwz2CKxqu7CGh/SupportFlow-Studio---Design-System---Product

The Figma file has been updated to match the implemented product instead of standing apart from the code. It includes the Build editor, route editing state, Import Flow, Workflow Library, Audit Log, Preview runner, X-Ray diagnostics, Spatial mode, and the supporting design-system page.

The design uses a restrained dark workspace with semantic states:

- **Start** — green
- **Question** — blue
- **Terminal** — amber
- **Error** — muted red

The product shell includes a searchable node navigator, visual graph, inspector rail, minimap, mode controls, and compact status information.

The latest design-system pass also documents the newer product controls:

- **Import Flow** — JSON, Excel, CSV, and TSV migration entry point.
- **Workflow Library** — save, search, rename, use, and delete saved flows.
- **Security Audit** — current-user identity, searchable history, and export actions.
- **Route Authoring** — editable labels, target selectors, delete actions, and draggable route handles.

## Beyond the brief

The required assignment asks for a visual graph, editing, Preview mode, and one wildcard feature. SupportFlow Studio goes further by adding the surrounding workflow a support manager would need before using this in practice.

| Added feature               | What it does                                                        | Why it matters                                                     |
| --------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Spreadsheet and JSON import | Converts `.json`, `.xlsx`, `.csv`, and `.tsv` flow data into nodes. | Gives teams a migration path from messy Excel configuration files. |
| Workflow Library            | Saves, searches, renames, uses, and deletes browser-stored flows.   | Lets managers keep multiple support flows without rebuilding them. |
| Workflow readiness rating   | Scores each workflow and lists the top improvement suggestions.     | Helps managers compare saved flows and fix weak spots quickly.     |
| Security Audit Log          | Tracks who added, edited, deleted, imported, saved, or reused data. | Makes the demo credible for teams that care about accountability.  |
| Canvas layout editing       | Lets users drag node cards into clearer positions.                  | Gives managers control over readability without editing JSON.      |
| Route authoring tools       | Adds, names, retargets, drags, and deletes routes visually.         | Allows non-technical users to change flow logic without JSON.      |
| Delete safety               | Offers Undo after deletion, plus minimize and close controls.       | Reduces the risk of accidental destructive edits.                  |
| Diagnostic demo scenarios   | Shows broken reference, unreachable branch, and cycle examples.     | Makes the X-Ray feature easy to evaluate during a review.          |
| Spatial mode and minimap    | Provides alternate navigation and topology views.                   | Helps larger flows remain understandable as they grow.             |
| Command palette             | Opens key actions with `⌘K` / `Ctrl+K`.                             | Speeds up navigation for power users and reviewers.                |

## Features

### Build mode

- Renders all six nodes from `flow_data.json`.
- Preserves the supplied `1200 × 800` canvas and exact node `x/y` coordinates.
- Converts node options into directed graph connections.
- Measures rendered node boundaries with DOM geometry and `ResizeObserver`.
- Draws custom cubic Bézier connectors with native SVG.
- Supports route labels, selection states, execution packets, minimap navigation, and canvas zoom controls.
- Includes a searchable/collapsible node navigator.
- Allows node cards to be moved by dragging the card header or the Move handle in Build mode; moved positions are kept in state, saved with workflows, and recorded in the audit log.

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

Each workflow also receives a readiness rating, such as **100/100 · Launch ready** or **Needs review**, plus short improvement suggestions generated from the same structural checks used by Flow Health. Saved flows can therefore be compared quickly before a manager chooses which one to use.

**Business value:** support managers can keep separate flows for billing, technical support, onboarding, or seasonal campaigns and switch between them without rebuilding from scratch.

### Security audit trail

SupportFlow Studio includes a lightweight local audit trail for demo security reviews. The toolbar has a **Current user** field so the manager making changes can identify themselves before editing. Open **Audit** to search and filter recorded changes, inspect who changed what, and export the log as JSON or CSV.

The audit trail records node additions, node text edits, node deletions, route additions, route label edits, route target changes, dragged route rewires, JSON/Excel imports, workflow saves, workflow use, workflow renames, workflow deletions, and delete undo actions. Audit entries are stored in `localStorage` with the saved workflow library.

**Business value:** managers can review change history before publishing a support flow, which makes accidental edits easier to trace and gives the demo a credible governance story without needing a backend database.

### Node inspector

Selecting a node opens a detailed inspector with **Properties**, **Routes**, and **Health** tabs.

Question or terminal text is edited against a single shared in-memory flow model, so changes update the canvas and Preview immediately. The imported challenge fixture is never mutated directly.

The inspector header includes a **Canvas** back action so narrow layouts can jump from Properties, Routes, or Health back to the main Build canvas quickly.

The Routes tab supports authoring changes without touching JSON: choose where a new outbound route should point before adding it, edit route labels, retarget routes to any existing node, remove routes, and create connected Question or Terminal nodes from the selected Start/Question node. Question and Terminal nodes can be deleted from Properties or with `Delete`/`Backspace`; the editor removes incoming routes automatically, keeps Start protected, and offers an Undo message after deletions that can be minimized or closed.

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

This is also where light gamification belongs. Instead of adding playful game mechanics, SupportFlow uses professional progress feedback: issue counts, node health checks, route warnings, and readiness language that helps a manager know whether a workflow is safe to preview or publish. A future iteration can turn the same validation data into a simple **Launch Readiness Score** without changing the editor's serious support-operations tone.

#### Diagnostic demo

Open **X-Ray** and choose a **Diagnostic demo** scenario:

- **Broken reference** sends the Business route from node #3 to a missing target. X-Ray marks the source and draws a dangling route; all six existing nodes remain reachable.
- **Unreachable branch** disconnects Billing from Start, highlighting nodes #3 and #6 as unreachable.
- **Cycle** adds a self-loop to node #3, highlighting the actual cycle participant and drawing the loop outside the card.

Examples are temporary projections of the current flow, including any edited text. They preserve the six node IDs and supplied coordinates and never modify `flow_data.json` or the editable flow. **Return to current flow**, switching to Build/Spatial, or starting Preview clears the example. Preview always uses the author's real flow. Issue actions select the affected node on the canvas.

### Spatial mode

Spatial mode provides an alternate topology view of the same six challenge nodes. It derives from the existing flow model rather than maintaining duplicate graph data and includes working zoom/reset controls plus relationship highlighting.

### Command palette

`⌘K` / `Ctrl+K` opens a command palette for switching between Build, X-Ray, Spatial, Preview, Flow Import, Workflows, and Audit.

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
      +--> auditLog.js -----------------> AuditLogPanel.jsx
      |
      +--> analyzeFlow.js / validateFlow.js --> X-Ray + Flow Health
      |
      +--> traverseFlow.js -------------> PreviewRunner.jsx
```

Key decisions:

- `App.jsx` owns the editable flow so all modes observe the same data.
- Graph traversal, validation, analysis, and path geometry live in pure domain functions.
- Workflow and audit-history persistence are isolated in localStorage domain helpers.
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
│   │   ├── AuditLogPanel.jsx
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
│   ├── auditLog.js
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

The suite covers node rendering, exact challenge coordinates, connector extraction, Bézier geometry, route dragging, selection and editing, delete undo behavior, workflow saving/searching/loading/renaming/deletion, workflow readiness ratings, audit history storage/search/export, mode switching, Preview traversal/restart, JSON/Excel/Spreadsheet Import parsing, Flow Health rules, and navigator interactions.

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
