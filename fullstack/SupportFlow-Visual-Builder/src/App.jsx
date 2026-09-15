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
import SpreadsheetImporter from './components/editor/SpreadsheetImporter.jsx'
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
  getDefaultRouteTargetId,
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
  const [routeEditorFocusId, setRouteEditorFocusId] = useState(null)
  const [isSpreadsheetImporterOpen, setIsSpreadsheetImporterOpen] = useState(false)
  const [importNotice, setImportNotice] = useState(null)

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
    setRouteEditorFocusId(null)
    setImportNotice(null)
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
    const sourceNode = flow.nodes.find((node) => node.id === sourceNodeId)
    const routeConnectionId =
      sourceNode && sourceNode.type !== 'end'
        ? `${sourceNodeId}-${sourceNode.options.length}-${nextNodeId}`
        : null

    setDeleteUndo(null)
    setImportNotice(null)
    setFlow((currentFlow) => addNode(currentFlow, { id: nextNodeId, type, sourceNodeId }))
    setSelectedNodeId(nextNodeId)
    setSelectedConnectionId(routeConnectionId)
    setRouteEditorFocusId(routeConnectionId)
  }

  const handleRouteAdd = (nodeId) => {
    const sourceNode = flow.nodes.find((node) => node.id === nodeId)

    if (!sourceNode || sourceNode.type === 'end') {
      return
    }

    const targetId = getDefaultRouteTargetId(flow.nodes, nodeId)

    setDeleteUndo(null)
    setImportNotice(null)
    setFlow((currentFlow) => addRoute(currentFlow, nodeId))
    setSelectedNodeId(nodeId)
    setSelectedConnectionId(`${nodeId}-${sourceNode.options.length}-${targetId}`)
    setRouteEditorFocusId(`${nodeId}-${sourceNode.options.length}-${targetId}`)
  }

  const handleRouteConnect = (sourceNodeId, targetNodeId) => {
    const sourceNode = flow.nodes.find((node) => node.id === sourceNodeId)
    const targetNode = flow.nodes.find((node) => node.id === targetNodeId)

    if (!sourceNode || !targetNode || sourceNode.type === 'end') {
      return
    }

    setDeleteUndo(null)
    setImportNotice(null)
    setFlow((currentFlow) => addRoute(currentFlow, sourceNodeId, targetNodeId))
    setSelectedNodeId(sourceNodeId)
    setSelectedConnectionId(`${sourceNodeId}-${sourceNode.options.length}-${targetNodeId}`)
    setRouteEditorFocusId(`${sourceNodeId}-${sourceNode.options.length}-${targetNodeId}`)
  }

  const handleRouteChange = (nodeId, optionIndex, patch) => {
    const isEditingSelectedConnection =
      selectedConnection?.sourceId === nodeId && selectedConnection.optionIndex === optionIndex
    const nextConnectionId = isEditingSelectedConnection
      ? `${nodeId}-${optionIndex}-${patch.nextId ?? selectedConnection.targetId}`
      : null

    setDeleteUndo(null)
    setImportNotice(null)
    setFlow((currentFlow) => updateRoute(currentFlow, nodeId, optionIndex, patch))
    setSelectedConnectionId(nextConnectionId)
    setRouteEditorFocusId(routeEditorFocusId === selectedConnection?.id ? nextConnectionId : null)
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
      setImportNotice(null)
      setFlow(removeRoute(flow, nodeId, optionIndex))
      setSelectedConnectionId(null)
      setRouteEditorFocusId(null)
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
      setImportNotice(null)
      setFlow(nextFlow)
      setSelectedNodeId(
        nextFlow.nodes.find((node) => node.type === 'start')?.id ?? nextFlow.nodes[0]?.id ?? null,
      )
      setSelectedConnectionId(null)
      setRouteEditorFocusId(null)
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
    setRouteEditorFocusId(null)
  }

  const handleNodeSelect = (nodeId) => {
    setSelectedConnectionId(null)
    setRouteEditorFocusId(null)
    setSelectedNodeId(nodeId)
  }

  const handleConnectionSelect = (connection) => {
    setSelectedConnectionId(connection.id)
    setRouteEditorFocusId(null)
    setSelectedNodeId(
      displayFlow.nodes.some((node) => node.id === connection.targetId)
        ? connection.targetId
        : connection.sourceId,
    )
  }

  const handleDemoChange = (scenarioId) => {
    setDemoScenario(scenarioId)
    setSelectedConnectionId(null)
    setRouteEditorFocusId(null)
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

  const handleSpreadsheetImport = ({
    flow: importedFlow,
    warnings = [],
    sourceLabel = 'import',
  }) => {
    const startNode =
      importedFlow.nodes.find((node) => node.type === 'start') ?? importedFlow.nodes[0] ?? null
    const routeCount = importedFlow.nodes.reduce((count, node) => count + node.options.length, 0)

    setFlow(importedFlow)
    setSelectedNodeId(startNode?.id ?? null)
    setSelectedConnectionId(null)
    setRouteEditorFocusId(null)
    setDeleteUndo(null)
    setMode('Build')
    setIsPreviewing(false)
    setDemoScenario('current')
    setIsSpreadsheetImporterOpen(false)
    setImportNotice({
      message: `Imported ${importedFlow.nodes.length} nodes and ${routeCount} routes from ${sourceLabel}.`,
      warnings,
    })
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
        setIsSpreadsheetImporterOpen(false)
        return
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return
      }

      if (
        event.defaultPrevented ||
        isCommandPaletteOpen ||
        isSpreadsheetImporterOpen ||
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
    isSpreadsheetImporterOpen,
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
        onSpreadsheetImport={() => setIsSpreadsheetImporterOpen(true)}
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
            key={selectedNodeId ?? 'no-selection'}
            node={selectedNode}
            flow={flow}
            selectedConnection={selectedConnection}
            autoFocusRouteId={routeEditorFocusId}
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

      {importNotice && (
        <div className="app-import-toast" aria-live="polite">
          <span role="status">
            {importNotice.message}
            {importNotice.warnings.length > 0 && ` ${importNotice.warnings.length} warnings.`}
          </span>
          <button type="button" onClick={() => setImportNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <CommandPalette
        open={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onModeChange={handleModeChange}
        onPreviewStart={handlePreviewStart}
        onSpreadsheetImport={() => setIsSpreadsheetImporterOpen(true)}
      />

      <SpreadsheetImporter
        open={isSpreadsheetImporterOpen}
        onClose={() => setIsSpreadsheetImporterOpen(false)}
        onImport={handleSpreadsheetImport}
      />
    </main>
  )
}
