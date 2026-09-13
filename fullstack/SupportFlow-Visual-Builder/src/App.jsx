/**
 * Application entry component for SupportFlow Studio.
 *
 * The shell coordinates Build, X-Ray and Preview modes around one shared
 * in-memory flow model. The visual structure follows the product design while
 * retaining the tested domain, editor, validation and preview implementation.
 */

import { useMemo, useState } from 'react'

import flowData from '../flow_data.json'

import FlowHealthPanel from './components/editor/FlowHealthPanel.jsx'
import NodeInspector from './components/editor/NodeInspector.jsx'
import NodeNavigator from './components/editor/NodeNavigator.jsx'
import FlowCanvas from './components/flow/FlowCanvas.jsx'
import AppToolbar from './components/layout/AppToolbar.jsx'
import StatusBar from './components/layout/StatusBar.jsx'
import PreviewRunner from './components/preview/PreviewRunner.jsx'
import validateFlow from './domain/validateFlow.js'
import './styles/flow.css'
import './styles/studio.css'

export default function App() {
  const [flow, setFlow] = useState(flowData)

  // Starting with a selected question mirrors a realistic authoring session
  // and makes the initial editor view informative instead of showing an empty rail.
  const [selectedNodeId, setSelectedNodeId] = useState('2')
  const [mode, setMode] = useState('editor')
  const [sidePanel, setSidePanel] = useState('inspector')

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
    setSidePanel('inspector')
  }

  const handleBuildMode = () => {
    setMode('editor')
    setSidePanel('inspector')
  }

  const handleXrayMode = () => {
    setMode('editor')
    setSidePanel('health')
  }

  const isPreviewMode = mode === 'preview'
  const displayMode = isPreviewMode
    ? 'Preview'
    : sidePanel === 'health'
      ? 'X-Ray'
      : 'Build'

  return (
    <main className="app-shell">
      <AppToolbar
        activePanel={sidePanel}
        healthIssueCount={healthIssues.length}
        isPreviewMode={isPreviewMode}
        onBuild={handleBuildMode}
        onXray={handleXrayMode}
        onPreviewToggle={() =>
          setMode(isPreviewMode ? 'editor' : 'preview')
        }
      />

      {isPreviewMode ? (
        <PreviewRunner flow={flow} />
      ) : (
        <div className="editor-layout">
          <NodeNavigator
            flow={flow}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
          />

          <FlowCanvas
            flow={flow}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
          />

          {sidePanel === 'health' ? (
            <FlowHealthPanel issues={healthIssues} />
          ) : (
            <NodeInspector
              node={selectedNode}
              onTextChange={handleNodeTextChange}
            />
          )}
        </div>
      )}

      <StatusBar
        flow={flow}
        selectedNodeId={selectedNodeId}
        mode={displayMode}
      />
    </main>
  )
}
