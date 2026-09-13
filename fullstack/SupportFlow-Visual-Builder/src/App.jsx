/**
 * Application entry component for SupportFlow Studio.
 *
 * It loads the provided flow_data.json, renders the product shell, and passes
 * the flow into the visual canvas. Editing and preview behaviour will be added
 * in later feature branches without changing the original challenge data.
 */

import flowData from '../flow_data.json'

import FlowCanvas from './components/flow/FlowCanvas.jsx'
import './styles/flow.css'

export default function App() {
  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <div>
          <h1 className="app-title">SupportFlow Studio</h1>
          <p className="app-subtitle">Visual decision-tree editor</p>
        </div>

        <div className="app-toolbar__meta">
          <span>{flowData.nodes.length} nodes</span>
          <span>
            {flowData.meta.canvas_size.w} × {flowData.meta.canvas_size.h}
          </span>
        </div>
      </header>

      <FlowCanvas flow={flowData} />
    </main>
  )
}
