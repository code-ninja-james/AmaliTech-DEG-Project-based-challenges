/**
 * Application entry component for SupportFlow Studio.
 *
 * It owns the editable in-memory flow state and the current node selection.
 * The provided flow_data.json remains the initial source of truth, while all
 * editor changes use immutable React state updates so the original imported
 * challenge data is never mutated.
 */

import { useState } from 'react'

import flowData from '../flow_data.json'

import NodeInspector from './components/editor/NodeInspector.jsx'
import FlowCanvas from './components/flow/FlowCanvas.jsx'
import './styles/flow.css'

export default function App() {
  const [flow, setFlow] = useState(flowData)
  const [selectedNodeId, setSelectedNodeId] = useState(null)

  const selectedNode = flow.nodes.find((node) => node.id === selectedNodeId) ?? null

  const handleNodeTextChange = (nodeId, nextText) => {
    setFlow((currentFlow) => ({
      ...currentFlow,
      nodes: currentFlow.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              text: nextText,
            }
          : node,
      ),
    }))
  }

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <div>
          <h1 className="app-title">SupportFlow Studio</h1>
          <p className="app-subtitle">Visual decision-tree editor</p>
        </div>

        <div className="app-toolbar__meta">
          <span>{flow.nodes.length} nodes</span>
          <span>
            {flow.meta.canvas_size.w} × {flow.meta.canvas_size.h}
          </span>
        </div>
      </header>

      <div className="editor-layout">
        <FlowCanvas flow={flow} selectedNodeId={selectedNodeId} onNodeSelect={setSelectedNodeId} />

        <NodeInspector node={selectedNode} onTextChange={handleNodeTextChange} />
      </div>
    </main>
  )
}
