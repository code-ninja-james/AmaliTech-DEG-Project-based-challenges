/**
 * Application entry component for SupportFlow Studio.
 *
 * The shell coordinates the complete studio interaction model on top of the
 * challenge's tested data-driven architecture: Build, X-Ray, Spatial and
 * Preview all share one editable in-memory copy of flow_data.json.
 */

import { useEffect, useMemo, useState } from 'react'

import flowData from '../flow_data.json'

import FlowHealthPanel from './components/editor/FlowHealthPanel.jsx'
import NodeInspector from './components/editor/NodeInspector.jsx'
import NodeNavigator from './components/editor/NodeNavigator.jsx'
import FlowCanvas from './components/flow/FlowCanvas.jsx'
import SpatialView from './components/flow/SpatialView.jsx'
import AppToolbar from './components/layout/AppToolbar.jsx'
import CommandPalette from './components/layout/CommandPalette.jsx'
import StatusBar from './components/layout/StatusBar.jsx'
import PreviewRunner from './components/preview/PreviewRunner.jsx'
import validateFlow from './domain/validateFlow.js'
import getConnections from './domain/getConnections.js'
import createXrayDemo from './domain/xrayDemo.js'
import './styles/flow.css'
import './styles/studio.css'
import './styles/studio-interactions.css'
import './styles/command-palette.css'
import './styles/xray-demo.css'

export default function App() {
  const [flow, setFlow] = useState(flowData)
  const [selectedNodeId, setSelectedNodeId] = useState('2')
  const [selectedConnectionId, setSelectedConnectionId] = useState(null)
  const [mode, setMode] = useState('Build')
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [demoScenario, setDemoScenario] = useState('current')

  const displayFlow = useMemo(
    () => (mode === 'X-Ray' ? createXrayDemo(flow, demoScenario) : flow),
    [flow, mode, demoScenario],
  )
  const isDemo = mode === 'X-Ray' && demoScenario !== 'current'

  const selectedNode = flow.nodes.find((node) => node.id === selectedNodeId) ?? null
  const connections = useMemo(() => getConnections(displayFlow.nodes), [displayFlow.nodes])

  const selectedConnection =
    connections.find((connection) => connection.id === selectedConnectionId) ?? null

  const healthIssues = useMemo(() => validateFlow(displayFlow.nodes), [displayFlow.nodes])

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
    setSelectedConnectionId(null)
    setSelectedNodeId(nodeId)
  }

  const handleConnectionSelect = (connection) => {
    setSelectedConnectionId(connection.id)
    setSelectedNodeId(
      displayFlow.nodes.some((node) => node.id === connection.targetId)
        ? connection.targetId
        : connection.sourceId,
    )
  }

  const handleDemoChange = (scenarioId) => {
    setDemoScenario(scenarioId)
    setSelectedConnectionId(null)
  }

  const handleModeChange = (nextMode) => {
    if (nextMode !== 'X-Ray' && demoScenario !== 'current') handleDemoChange('current')
    setMode(nextMode)
    setIsPreviewing(false)
  }

  const handlePreviewStart = () => {
    handleDemoChange('current')
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

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsCommandPaletteOpen((current) => !current)
        return
      }

      if (event.key === 'Escape') {
        setIsCommandPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

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
          flow={displayFlow}
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
            flow={displayFlow}
            mode={mode}
            isDemo={isDemo}
            selectedNodeId={selectedNodeId}
            selectedConnectionId={selectedConnectionId}
            onNodeSelect={handleNodeSelect}
            onConnectionSelect={handleConnectionSelect}
          />
        )}

        {mode === 'Build' && isPreviewing && (
          <PreviewRunner flow={flow} onBack={handlePreviewExit} onNodeSelect={handleNodeSelect} />
        )}

        {(mode === 'Build' || mode === 'Spatial') && (
          <NodeInspector
            key={`${selectedNodeId ?? 'no-selection'}-${selectedConnectionId ?? 'no-route'}`}
            node={selectedNode}
            flow={flow}
            selectedConnection={selectedConnection}
            onTextChange={handleNodeTextChange}
          />
        )}

        {mode === 'X-Ray' && !isPreviewing && (
          <FlowHealthPanel
            flow={displayFlow}
            issues={healthIssues}
            demoScenario={demoScenario}
            onDemoChange={handleDemoChange}
            onNodeSelect={handleNodeSelect}
          />
        )}
      </div>

      <StatusBar
        flow={displayFlow}
        isDemo={isDemo}
        selectedNodeId={selectedNodeId}
        mode={displayMode}
        onCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      <CommandPalette
        open={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onModeChange={handleModeChange}
        onPreviewStart={handlePreviewStart}
      />
    </main>
  )
}
