/**
 * Application entry component for SupportFlow Studio.
 *
 * The shell coordinates the complete studio interaction model on top of the
 * challenge's tested data-driven architecture: Build, X-Ray, Spatial and
 * Preview all share one editable in-memory copy of flow_data.json.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

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
import {
  addNode,
  addRoute,
  getNextNodeId,
  removeNode,
  removeRoute,
  updateRoute,
} from './domain/flowEditing.js'
import createXrayDemo from './domain/xrayDemo.js'
import './styles/flow.css'
import './styles/studio.css'
import './styles/studio-interactions.css'
import './styles/command-palette.css'
import './styles/xray-demo.css'

function isTextEditingTarget(target) {
  if (!(target instanceof Element)) {
    return false
  }

  return (
    target.isContentEditable ||
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
    Boolean(target.closest('[contenteditable="true"]'))
  )
}

export default function App() {
  const [flow, setFlow] = useState(flowData)
  const [selectedNodeId, setSelectedNodeId] = useState('2')
  const [selectedConnectionId, setSelectedConnectionId] = useState(null)
  const [mode, setMode] = useState('Build')
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [demoScenario, setDemoScenario] = useState('current')
  const [deleteUndo, setDeleteUndo] = useState(null)

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
    setDeleteUndo(null)
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

  const handleNodeAdd = ({ type, sourceNodeId = selectedNodeId }) => {
    const nextNodeId = getNextNodeId(flow.nodes)

    setDeleteUndo(null)
    setFlow((currentFlow) => addNode(currentFlow, { id: nextNodeId, type, sourceNodeId }))
    setSelectedNodeId(nextNodeId)
    setSelectedConnectionId(null)
  }

  const handleRouteAdd = (nodeId) => {
    setDeleteUndo(null)
    setFlow((currentFlow) => addRoute(currentFlow, nodeId))
    setSelectedConnectionId(null)
  }

  const handleRouteConnect = (sourceNodeId, targetNodeId) => {
    const sourceNode = flow.nodes.find((node) => node.id === sourceNodeId)
    const targetNode = flow.nodes.find((node) => node.id === targetNodeId)

    if (!sourceNode || !targetNode || sourceNode.type === 'end') {
      return
    }

    setDeleteUndo(null)
    setFlow((currentFlow) => addRoute(currentFlow, sourceNodeId, targetNodeId))
    setSelectedNodeId(sourceNodeId)
    setSelectedConnectionId(`${sourceNodeId}-${sourceNode.options.length}-${targetNodeId}`)
  }

  const handleRouteChange = (nodeId, optionIndex, patch) => {
    setDeleteUndo(null)
    setFlow((currentFlow) => updateRoute(currentFlow, nodeId, optionIndex, patch))
    setSelectedConnectionId(null)
  }

  const handleRouteRemove = useCallback(
    (nodeId, optionIndex) => {
      const sourceNode = flow.nodes.find((node) => node.id === nodeId)
      const route = sourceNode?.options[optionIndex]

      if (!route) {
        return
      }

      setDeleteUndo({
        flow,
        selectedConnectionId,
        selectedNodeId,
        message: `Deleted route "${route.label}".`,
      })
      setFlow(removeRoute(flow, nodeId, optionIndex))
      setSelectedConnectionId(null)
    },
    [flow, selectedConnectionId, selectedNodeId],
  )

  const handleNodeRemove = useCallback(
    (nodeId) => {
      const nodeToRemove = flow.nodes.find((node) => node.id === nodeId)
      const nextFlow = removeNode(flow, nodeId)

      if (!nodeToRemove || nextFlow === flow) {
        return
      }

      const nodeLabel = nodeToRemove.type === 'end' ? 'terminal' : nodeToRemove.type

      setDeleteUndo({
        flow,
        selectedConnectionId,
        selectedNodeId,
        message: `Deleted ${nodeLabel} node #${nodeToRemove.id}.`,
      })
      setFlow(nextFlow)
      setSelectedNodeId(
        nextFlow.nodes.find((node) => node.type === 'start')?.id ?? nextFlow.nodes[0]?.id ?? null,
      )
      setSelectedConnectionId(null)
    },
    [flow, selectedConnectionId, selectedNodeId],
  )

  const handleDeleteUndo = () => {
    if (!deleteUndo) {
      return
    }

    setFlow(deleteUndo.flow)
    setSelectedNodeId(deleteUndo.selectedNodeId)
    setSelectedConnectionId(deleteUndo.selectedConnectionId)
    setDeleteUndo(null)
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
        return
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return
      }

      if (
        event.defaultPrevented ||
        isCommandPaletteOpen ||
        isPreviewing ||
        (mode !== 'Build' && mode !== 'Spatial') ||
        isTextEditingTarget(event.target)
      ) {
        return
      }

      if (selectedConnection) {
        event.preventDefault()
        handleRouteRemove(selectedConnection.sourceId, selectedConnection.optionIndex)
        return
      }

      if (selectedNode && selectedNode.type !== 'start') {
        event.preventDefault()
        handleNodeRemove(selectedNode.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    handleNodeRemove,
    handleRouteRemove,
    isCommandPaletteOpen,
    isPreviewing,
    mode,
    selectedConnection,
    selectedNode,
  ])

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
            issues={healthIssues}
            onNodeSelect={handleNodeSelect}
            onConnectionSelect={handleConnectionSelect}
            onRouteConnect={handleRouteConnect}
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
            issues={healthIssues}
            onIssueSelect={handleNodeSelect}
            onTextChange={handleNodeTextChange}
            onNodeAdd={handleNodeAdd}
            onRouteAdd={handleRouteAdd}
            onRouteChange={handleRouteChange}
            onRouteRemove={handleRouteRemove}
            onNodeRemove={handleNodeRemove}
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

      {deleteUndo && (
        <div className="app-undo-toast" aria-live="polite">
          <span role="status">{deleteUndo.message}</span>
          <button type="button" onClick={handleDeleteUndo}>
            Undo
          </button>
        </div>
      )}

      <CommandPalette
        open={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onModeChange={handleModeChange}
        onPreviewStart={handlePreviewStart}
      />
    </main>
  )
}
