# SupportFlow Studio

SupportFlow Studio is a visual decision-tree editor for customer-support flows. It turns a JSON-defined conversation into an interactive graph that support teams can inspect, edit, validate, and run as a chat simulation.

The implementation is intentionally built without graph or component libraries. Node placement comes directly from the supplied `flow_data.json`, while connections are calculated from node relationships and rendered with native SVG.

## Design

**Figma design system and product design**  
https://www.figma.com/design/h6kKHcwHrkwz2CKxqu7CGh/SupportFlow-Studio---Design-System---Product

The visual language uses a restrained dark workspace with semantic node colours:

- **Start** — green
- **Question** — blue
- **Terminal** — amber
- **Error** — muted red

The implementation also follows the design system's compact engineering-tool layout, tight corner radii, monospace metadata, node navigator, minimap, inspector rail, and Build/X-Ray/Preview modes.

## Features

### Visual graph

- Renders the supplied `flow_data.json` directly.
- Preserves the provided `1200 × 800` canvas dimensions.
- Positions every node using the exact supplied `x` and `y` coordinates.
- Converts node options into directed graph edges.
- Measures rendered node boundaries in the DOM.
- Draws custom cubic Bézier connectors with native SVG.
- Keeps parallel routes visually distinct.
- Includes route labels, connection ports, a searchable node navigator, and a minimap.

### Node editor

Selecting a node opens the inspector. Question or terminal text can be edited directly and changes appear on the graph immediately.

Editor state is intentionally local and in-memory. The imported challenge JSON is used as the initial model and is never mutated directly.

### Preview runner

`Play preview` switches from authoring mode to a chat-style simulation.

The runner:

- starts from the configured Start node;
- displays the current node's message;
- follows the selected option's `nextId`;
- records the conversation history;
- detects terminal/leaf nodes; and
- provides a restart action at the end of the journey.

Because Preview uses the same in-memory flow model as the editor, text changes are reflected immediately when the conversation is tested.

## Wildcard: Flow Health

I chose **Flow Health** as the wildcard feature because a visual flow can look correct while still containing structural defects that only appear when customers try to use it.

Flow Health validates the current graph and detects:

- duplicate node IDs;
- missing route targets;
- unreachable nodes;
- an invalid number of Start nodes;
- unexpected dead ends;
- Terminal nodes with outgoing routes; and
- cycles that could trap a customer in an endless journey.

### Business value

A broken automated support flow can send customers to the wrong destination, terminate unexpectedly, or make an entire branch unreachable. These mistakes create avoidable support tickets and are difficult for non-technical flow authors to spot by visual inspection alone.

Flow Health acts as an editor-side quality gate. It gives authors immediate feedback before a flow is published, reducing configuration errors and broken customer journeys.

## Product workspace

The editor is organised around three working modes:

**Build** is the primary authoring surface. It combines the searchable node navigator, visual graph, inspector, minimap, and live flow metadata.

**X-Ray** opens Flow Health so structural problems can be reviewed without leaving the graph context.

**Preview** replaces the graph with the customer-facing conversation runner so the same flow can be tested end-to-end.

## Architecture

The application keeps graph/domain concerns separate from React presentation code.

```text
flow_data.json
      |
      +--> getConnections.js ---------> ConnectorLayer.jsx
      |                                      |
      |                                native SVG paths
      |
      +--> FlowCanvas.jsx ------------> FlowNode.jsx
      |
      +--> validateFlow.js -----------> Flow Health
      |
      +--> traverseFlow.js -----------> Preview Runner
      |
      +--> App.jsx -------------------> shared in-memory state
```

Notable implementation decisions:

- `App.jsx` owns the editable flow state so Build, X-Ray, and Preview share one model.
- Graph relationship and validation logic lives in pure domain functions and can be tested independently from React.
- `ResizeObserver` is used to keep SVG connection anchors aligned with cards whose rendered height changes after editing.
- Broken `nextId` references do not crash graph rendering; they are surfaced through Flow Health instead.
- Node coordinates from `flow_data.json` remain authoritative throughout the application.

## Technology

- React 19
- JavaScript / JSX
- Vite
- Native SVG
- CSS custom properties and custom components
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
│   │   └── NodeNavigator.jsx
│   ├── flow/
│   │   ├── ConnectorLayer.jsx
│   │   ├── FlowCanvas.jsx
│   │   ├── FlowNode.jsx
│   │   └── Minimap.jsx
│   ├── layout/
│   │   ├── AppToolbar.jsx
│   │   └── StatusBar.jsx
│   └── preview/
│       └── PreviewRunner.jsx
├── domain/
│   ├── createBezierPath.js
│   ├── getConnections.js
│   ├── traverseFlow.js
│   └── validateFlow.js
├── hooks/
│   └── useNodeMeasurements.js
├── styles/
│   ├── flow.css
│   ├── global.css
│   ├── studio.css
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

Vite will print the local development URL in the terminal.

## Quality checks

Run the complete local quality gate with:

```bash
npm run verify
```

This executes, in order:

```text
Prettier format check
        ↓
ESLint
        ↓
Vitest
        ↓
Vite production build
```

The repository also uses local Git hooks:

- **pre-commit** — runs lint-staged checks;
- **pre-push** — runs the complete `npm run verify` gate.

## Tests

The test suite covers the key behaviours and domain rules, including:

- product rendering;
- exact node coordinates and canvas dimensions;
- graph connection extraction;
- Bézier geometry;
- node selection and live editing;
- editor/preview mode switching;
- preview traversal and restart;
- Flow Health validation rules; and
- node selection from the workspace navigator.

Run tests independently with:

```bash
npm test
```

## Production build

```bash
npm run build
```

The production bundle is generated in `dist/`.

## Deployment

The application is a static Vite/React frontend and can be deployed directly to Vercel, Netlify, or another static hosting provider.

Recommended deployment settings when importing this monorepo:

```text
Root directory: fullstack/SupportFlow-Visual-Builder
Build command: npm run build
Output directory: dist
Install command: npm install
```

After deployment, the production URL should be tested in an Incognito/Private browser window to confirm the application is publicly accessible without an authenticated session.

## Data model

The application uses the supplied `flow_data.json` file without replacing its node IDs, route labels, or coordinates. The challenge fixture contains six nodes:

```text
#1 Start
├── Internet is down → #2
│   ├── Yes, didn't work → #4
│   └── No, let me try → #5
└── Billing Question → #3
    ├── Personal → #6
    └── Business → #6
```

## Engineering notes

Comments in the source are used deliberately to explain constraints, graph mathematics, trade-offs, and non-obvious behaviour rather than restating ordinary JavaScript syntax.

The project uses an audit-friendly branch and pull-request workflow. Features were developed independently and merged through `develop` before the final release to `main`.

## Author

**Jameson Githinji**  
GitHub: https://github.com/code-ninja-james  
LinkedIn: https://www.linkedin.com/in/jameson-githinji/
