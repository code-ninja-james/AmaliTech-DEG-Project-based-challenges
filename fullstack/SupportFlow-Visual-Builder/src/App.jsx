/**
 * Application entry component for SupportFlow Studio.
 *
 * The shell ports the complete Make interaction model onto the challenge's
 * tested data-driven architecture: Build, X-Ray, Spatial and Preview all share
 * one editable in-memory copy of flow_data.json.
 */

import { useMemo, useState } from 'react'

import flowData from '../flow_data.json'

import FlowHealthPanel from './components/editor/FlowHealthPanel.jsx'
import NodeInspector from './components/editor/NodeInspector.jsx'
import NodeNavigator from './components/editor/NodeNavigator.jsx'
import FlowCanvas from './components/flow/FlowCanvas.jsx'
import SpatialView from './components/flow/SpatialView.jsx'
import AppToolbar from './components/layout/AppToolbar.jsx'
import StatusBar from './components/layout/StatusBar.jsx'
import PreviewRunner from './components/preview/PreviewRunner.jsx'
import validateFlow from './domain/validateFlow.js'
import './styles/flow.css'
import './styles/studio.css'
import './styles/make-port.css'

export default function App() {
  const [flow, setFlow] = useState(flowData)
  const [selectedNodeId, setSelectedNodeId] = useState('2')
  const [mode, setMode] = useState('Build')
  const [isPreviewing, setIsPreviewing] = useState(false)

  const selectedNode =
    flow.nodes.find((node) => node.id === selectedNodeId) ?? null

  const healthIssues = useMemo(
    () => validateFlow(flow.nodes),
    [flow.nodes],
  )

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

  const handleNodeSelect = (nodeId) => {
    setSelectedNodeId(nodeId)
  }

  const handleModeChange = (nextMode) => {
    setMode(nextMode)
    setIsPreviewing(false)
  }

  const handlePreviewStart = () => {
    const startNode = flow.nodes.find((node) => node.type === 'start')

    if (startNode) {
      setSelectedNodeId(startNode.id)
    }

    setMode('Build')
    setIsPreviewing(true)
  }

  const handlePreviewExit = () => {
    setIsPreviewing(false)
  }

  const displayMode = isPreviewing ? 'Preview' : mode

  return (
    <main className="app-shell">
      <AppToolbar
        mode={mode}
        isPreviewMode={isPreviewing}
        healthIssueCount={healthIssues.length}
        onModeChange={handleModeChange}
        onPreviewStart={handlePreviewStart}
      />

      <div className="editor-layout">
        <NodeNavigator
          flow={flow}
          selectedNodeId={selectedNodeId}
          onNodeSelect={handleNodeSelect}
        />

        {mode === 'Spatial' && !isPreviewing && (
          <SpatialView
            flow={flow}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
          />
        )}

        {mode !== 'Spatial' && !isPreviewing && (
          <FlowCanvas
            flow={flow}
            mode={mode}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
          />
        )}

        {mode === 'Build' && isPreviewing && (
          <PreviewRunner
            flow={flow}
            onBack={handlePreviewExit}
            onNodeSelect={handleNodeSelect}
          />
        )}

        {(mode === 'Build' || mode === 'Spatial') && (
          <NodeInspector
            node={selectedNode}
            flow={flow}
            onTextChange={handleNodeTextChange}
          />
        )}

        {mode === 'X-Ray' && !isPreviewing && (
          <FlowHealthPanel flow={flow} issues={healthIssues} />
        )}
      </div>

      <StatusBar
        flow={flow}
        selectedNodeId={selectedNodeId}
        mode={displayMode}
      />
    </main>
  )
}
