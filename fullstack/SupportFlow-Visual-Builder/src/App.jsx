/**
 * Application entry component for SupportFlow Studio.
 *
 * It owns the editable in-memory flow state, node selection, and product mode.
 * Editor mode renders the visual graph and inspector, while Preview mode runs
 * the same live flow data as a chat simulation without mutating the source
 * challenge JSON.
 */

import { useState } from 'react'

import flowData from '../flow_data.json'

import NodeInspector from './components/editor/NodeInspector.jsx'
import FlowCanvas from './components/flow/FlowCanvas.jsx'
import PreviewRunner from './components/preview/PreviewRunner.jsx'
import './styles/flow.css'

export default function App() {
  const [flow, setFlow] = useState(flowData)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [mode, setMode] = useState('editor')

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

  const isPreviewMode = mode === 'preview'

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <div>
          <h1 className="app-title">SupportFlow Studio</h1>
          <p className="app-subtitle">
            {isPreviewMode ? 'Previewing support conversation' : 'Visual decision-tree editor'}
          </p>
        </div>

        <div className="app-toolbar__actions">
          {!isPreviewMode && (
            <div className="app-toolbar__meta">
              <span>{flow.nodes.length} nodes</span>
              <span>
                {flow.meta.canvas_size.w} × {flow.meta.canvas_size.h}
              </span>
            </div>
          )}

          <button
            className={
              isPreviewMode ? 'app-mode-button app-mode-button--secondary' : 'app-mode-button'
            }
            type="button"
            onClick={() => setMode(isPreviewMode ? 'editor' : 'preview')}
          >
            {isPreviewMode ? 'Back to editor' : 'Play preview'}
          </button>
        </div>
      </header>

      {isPreviewMode ? (
        <PreviewRunner flow={flow} />
      ) : (
        <div className="editor-layout">
          <FlowCanvas
            flow={flow}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
          />

          <NodeInspector node={selectedNode} onTextChange={handleNodeTextChange} />
        </div>
      )}
    </main>
  )
}
