/**
 * Application entry component for SupportFlow Studio.
 *
 * The shell coordinates the complete studio interaction model on top of the
 * challenge's tested data-driven architecture: Build, X-Ray, Spatial and
 * Preview all share one editable in-memory copy of flow_data.json.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import flowData from '../flow_data.json'

import AuditLogPanel from './components/editor/AuditLogPanel.jsx'
import FlowHealthPanel from './components/editor/FlowHealthPanel.jsx'
import NodeInspector from './components/editor/NodeInspector.jsx'
import NodeNavigator from './components/editor/NodeNavigator.jsx'
import SpreadsheetImporter from './components/editor/SpreadsheetImporter.jsx'
import WorkflowLibraryPanel from './components/editor/WorkflowLibraryPanel.jsx'
import FlowCanvas from './components/flow/FlowCanvas.jsx'
import SpatialView from './components/flow/SpatialView.jsx'
import AppToolbar from './components/layout/AppToolbar.jsx'
import CommandPalette from './components/layout/CommandPalette.jsx'
import StatusBar from './components/layout/StatusBar.jsx'
import PreviewRunner from './components/preview/PreviewRunner.jsx'
import analyzeFlow from './domain/analyzeFlow.js'
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
import {
  cloneFlow,
  DEFAULT_WORKFLOW_NAME,
  deleteWorkflow,
  getImportedWorkflowName,
  getWorkflowStats,
  loadWorkflowLibrary,
  loadWorkspaceSession,
  persistWorkflowLibrary,
  persistWorkspaceSession,
  renameWorkflow,
  saveWorkflow,
} from './domain/workflowLibrary.js'
import {
  appendAuditEntry,
  createAuditCsvExport,
  createAuditJsonExport,
  loadAuditLog,
  loadAuditUser,
  normalizeAuditUser,
  persistAuditLog,
  persistAuditUser,
} from './domain/auditLog.js'
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

function getNodeTypeLabel(node) {
  return node?.type === 'end' ? 'terminal' : (node?.type ?? 'node')
}

function getNodeTargetLabel(node) {
  return `${getNodeTypeLabel(node)} node #${node.id}`
}

function getRouteTargetLabel(nodeId, route) {
  return `"${route.label}" from node #${nodeId}`
}

function getRouteAuditId(nodeId, optionIndex) {
  return `${nodeId}-${optionIndex}`
}

function areFlowsEqual(leftFlow, rightFlow) {
  return JSON.stringify(leftFlow) === JSON.stringify(rightFlow)
}

function queueReactStateUpdate(updateState) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(updateState)
    return
  }

  globalThis.setTimeout(updateState, 0)
}

function getDiagnosticFocusNodeId(flow, scenarioId, currentSelectedNodeId) {
  if (scenarioId === 'current') {
    return flow.nodes.some((node) => node.id === currentSelectedNodeId)
      ? currentSelectedNodeId
      : (flow.nodes.find((node) => node.type === 'start')?.id ?? flow.nodes[0]?.id ?? null)
  }

  const demoFlow = createXrayDemo(flow, scenarioId)
  const analysis = analyzeFlow(demoFlow.nodes)

  return (
    analysis.brokenReferences[0]?.sourceId ??
    analysis.unreachable[0]?.id ??
    [...analysis.cycleParticipants][0] ??
    analysis.questionsWithoutRoutes[0]?.id ??
    analysis.terminalsWithRoutes[0]?.id ??
    demoFlow.nodes.find((node) => node.type === 'start')?.id ??
    demoFlow.nodes[0]?.id ??
    null
  )
}

function truncateAuditValue(value, maxLength = 90) {
  const text = String(value ?? '')

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 3)}...`
}

function getTextChangeDetails(field, previousValue, nextValue) {
  return `${field} changed from "${truncateAuditValue(previousValue)}" to "${truncateAuditValue(
    nextValue,
  )}".`
}

function downloadTextFile(filename, content, type) {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof globalThis.URL?.createObjectURL !== 'function'
  ) {
    return false
  }

  const blob = new Blob([content], { type })
  const url = globalThis.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  globalThis.URL.revokeObjectURL(url)

  return true
}

export default function App() {
  const [initialWorkspace] = useState(() => loadWorkspaceSession())
  const [flow, setFlow] = useState(() => initialWorkspace?.flow ?? flowData)
  const [workflowName, setWorkflowName] = useState(
    () => initialWorkspace?.workflowName ?? DEFAULT_WORKFLOW_NAME,
  )
  const [activeWorkflowId, setActiveWorkflowId] = useState(
    () => initialWorkspace?.activeWorkflowId ?? null,
  )
  const [workflows, setWorkflows] = useState(() => loadWorkflowLibrary())
  const [selectedNodeId, setSelectedNodeId] = useState(
    () => initialWorkspace?.selectedNodeId ?? '2',
  )
  const [selectedConnectionId, setSelectedConnectionId] = useState(null)
  const [mode, setMode] = useState(() => initialWorkspace?.mode ?? 'Build')
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [demoScenario, setDemoScenario] = useState('current')
  const [deleteUndo, setDeleteUndo] = useState(null)
  const [isDeleteUndoMinimized, setIsDeleteUndoMinimized] = useState(false)
  const [routeEditorFocusId, setRouteEditorFocusId] = useState(null)
  const [isSpreadsheetImporterOpen, setIsSpreadsheetImporterOpen] = useState(false)
  const [isWorkflowLibraryOpen, setIsWorkflowLibraryOpen] = useState(false)
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(() => loadAuditUser())
  const [auditEntries, setAuditEntries] = useState(() => loadAuditLog())
  const [importNotice, setImportNotice] = useState(null)
  const [workflowNotice, setWorkflowNotice] = useState(null)
  const [canvasViewResetKey, setCanvasViewResetKey] = useState(0)

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

  useEffect(() => {
    persistWorkspaceSession({
      flow,
      workflowName,
      activeWorkflowId,
      selectedNodeId,
      mode,
    })
  }, [activeWorkflowId, flow, mode, selectedNodeId, workflowName])

  useEffect(() => {
    if (!activeWorkflowId) {
      return
    }

    const activeWorkflow = workflows.find((workflow) => workflow.id === activeWorkflowId)

    if (!activeWorkflow) {
      return
    }

    if (activeWorkflow.name === workflowName && areFlowsEqual(activeWorkflow.flow, flow)) {
      return
    }

    const { workflows: nextWorkflows } = saveWorkflow(workflows, {
      id: activeWorkflowId,
      name: workflowName,
      flow,
    })

    if (!persistWorkflowLibrary(nextWorkflows)) {
      queueReactStateUpdate(() => {
        setWorkflowNotice('Could not save workflow edits in this browser.')
      })
      return
    }

    queueReactStateUpdate(() => {
      setWorkflows(nextWorkflows)
    })
  }, [activeWorkflowId, flow, workflowName, workflows])

  const recordAuditEvent = useCallback(
    (event) => {
      setAuditEntries((currentEntries) => {
        const nextEntries = appendAuditEntry(currentEntries, {
          actor: normalizeAuditUser(currentUser),
          workflowName,
          ...event,
        })

        persistAuditLog(nextEntries)
        return nextEntries
      })
    },
    [currentUser, workflowName],
  )

  const requestCanvasViewReset = useCallback(() => {
    setCanvasViewResetKey((currentKey) => currentKey + 1)

    const scrollToCanvas = () => {
      const canvas = document.querySelector('.flow-workspace')

      if (typeof canvas?.scrollIntoView !== 'function') {
        return
      }

      canvas.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' })
    }

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollToCanvas)
    } else {
      window.setTimeout(scrollToCanvas, 0)
    }
  }, [])

  const handleCurrentUserChange = (nextUser) => {
    setCurrentUser(nextUser)
    persistAuditUser(nextUser)
  }

  const handleAuditExport = (format) => {
    const exportedAt = new Date().toISOString().slice(0, 10)

    if (format === 'csv') {
      downloadTextFile(
        `supportflow-audit-${exportedAt}.csv`,
        createAuditCsvExport(auditEntries),
        'text/csv;charset=utf-8',
      )
      return
    }

    downloadTextFile(
      `supportflow-audit-${exportedAt}.json`,
      createAuditJsonExport(auditEntries),
      'application/json;charset=utf-8',
    )
  }

  const handleAuditLogOpen = () => {
    setIsAuditLogOpen(true)
    setIsSpreadsheetImporterOpen(false)
    setIsWorkflowLibraryOpen(false)
  }

  const handleNodeTextChange = (nodeId, nextText) => {
    setDeleteUndo(null)
    setRouteEditorFocusId(null)
    setImportNotice(null)
    setWorkflowNotice(null)
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

  const handleNodeTextCommit = (nodeId, previousText, nextText) => {
    const node = flow.nodes.find((currentNode) => currentNode.id === nodeId)

    if (!node || previousText === nextText) {
      return
    }

    recordAuditEvent({
      action: 'node.edited',
      targetType: 'node',
      targetId: node.id,
      targetLabel: getNodeTargetLabel(node),
      summary: `Edited ${getNodeTypeLabel(node)} node #${node.id}.`,
      details: getTextChangeDetails('Text', previousText, nextText),
      meta: {
        field: 'text',
        before: previousText,
        after: nextText,
      },
    })
  }

  const handleNodeMove = useCallback((nodeId, nextPosition) => {
    setFlow((currentFlow) => ({
      ...currentFlow,
      nodes: currentFlow.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              position: nextPosition,
            }
          : node,
      ),
    }))
  }, [])

  const handleNodeMoveCommit = (nodeId, previousPosition, nextPosition) => {
    const node = flow.nodes.find((currentNode) => currentNode.id === nodeId)

    if (!node || (previousPosition.x === nextPosition.x && previousPosition.y === nextPosition.y)) {
      return
    }

    setDeleteUndo(null)
    setImportNotice(null)
    setWorkflowNotice(null)
    recordAuditEvent({
      action: 'node.moved',
      targetType: 'node',
      targetId: node.id,
      targetLabel: getNodeTargetLabel(node),
      summary: `Moved ${getNodeTypeLabel(node)} node #${node.id}.`,
      details: `Position changed from (${previousPosition.x}, ${previousPosition.y}) to (${nextPosition.x}, ${nextPosition.y}).`,
      meta: {
        field: 'position',
        before: previousPosition,
        after: nextPosition,
      },
    })
  }

  const handleNodeAdd = ({ type, sourceNodeId = selectedNodeId }) => {
    const nextNodeId = getNextNodeId(flow.nodes)
    const sourceNode = flow.nodes.find((node) => node.id === sourceNodeId)
    const routeConnectionId =
      sourceNode && sourceNode.type !== 'end'
        ? `${sourceNodeId}-${sourceNode.options.length}-${nextNodeId}`
        : null
    const nodeType = type === 'end' ? 'end' : 'question'
    const nodeLabel = nodeType === 'end' ? 'terminal' : nodeType

    setDeleteUndo(null)
    setImportNotice(null)
    setWorkflowNotice(null)
    setFlow((currentFlow) => addNode(currentFlow, { id: nextNodeId, type, sourceNodeId }))
    setSelectedNodeId(nextNodeId)
    setSelectedConnectionId(routeConnectionId)
    setRouteEditorFocusId(routeConnectionId)
    recordAuditEvent({
      action: 'node.added',
      targetType: 'node',
      targetId: nextNodeId,
      targetLabel: `${nodeLabel} node #${nextNodeId}`,
      summary: `Added ${nodeLabel} node #${nextNodeId}.`,
      details:
        sourceNode && sourceNode.type !== 'end'
          ? `Connected from ${getNodeTargetLabel(sourceNode)}.`
          : 'Created without an incoming route.',
      meta: {
        nodeType,
        sourceNodeId: sourceNode?.id ?? '',
      },
    })
  }

  const handleRouteAdd = (nodeId, targetNodeId = null) => {
    const sourceNode = flow.nodes.find((node) => node.id === nodeId)

    if (!sourceNode || sourceNode.type === 'end') {
      return
    }

    const targetId = targetNodeId ?? getDefaultRouteTargetId(flow.nodes, nodeId)
    const targetNode = flow.nodes.find((node) => node.id === targetId)

    if (!targetNode) {
      return
    }

    const optionIndex = sourceNode.options.length
    const routeLabel = targetNodeId ? `Route to #${targetId}` : 'New route'

    setDeleteUndo(null)
    setImportNotice(null)
    setWorkflowNotice(null)
    setFlow((currentFlow) => addRoute(currentFlow, nodeId, targetId))
    setSelectedNodeId(nodeId)
    setSelectedConnectionId(`${nodeId}-${sourceNode.options.length}-${targetId}`)
    setRouteEditorFocusId(`${nodeId}-${sourceNode.options.length}-${targetId}`)
    recordAuditEvent({
      action: 'route.added',
      targetType: 'route',
      targetId: getRouteAuditId(nodeId, optionIndex),
      targetLabel: `"${routeLabel}" from node #${nodeId}`,
      summary: `Added route "${routeLabel}" from node #${nodeId} to node #${targetId}.`,
      details: `Target node: ${getNodeTargetLabel(targetNode)}.`,
      meta: {
        sourceNodeId: nodeId,
        optionIndex,
        targetNodeId: targetId,
      },
    })
  }

  const handleRouteConnect = (sourceNodeId, targetNodeId) => {
    const sourceNode = flow.nodes.find((node) => node.id === sourceNodeId)
    const targetNode = flow.nodes.find((node) => node.id === targetNodeId)

    if (!sourceNode || !targetNode || sourceNode.type === 'end') {
      return
    }

    const optionIndex = sourceNode.options.length
    const routeLabel = `Route to #${targetNodeId}`

    setDeleteUndo(null)
    setImportNotice(null)
    setWorkflowNotice(null)
    setFlow((currentFlow) => addRoute(currentFlow, sourceNodeId, targetNodeId))
    setSelectedNodeId(sourceNodeId)
    setSelectedConnectionId(`${sourceNodeId}-${sourceNode.options.length}-${targetNodeId}`)
    setRouteEditorFocusId(`${sourceNodeId}-${sourceNode.options.length}-${targetNodeId}`)
    recordAuditEvent({
      action: 'route.added',
      targetType: 'route',
      targetId: getRouteAuditId(sourceNodeId, optionIndex),
      targetLabel: `"${routeLabel}" from node #${sourceNodeId}`,
      summary: `Added route "${routeLabel}" from node #${sourceNodeId} to node #${targetNodeId}.`,
      details: `Created by dragging the connector handle onto ${getNodeTargetLabel(targetNode)}.`,
      meta: {
        sourceNodeId,
        optionIndex,
        targetNodeId,
        createdByDrag: true,
      },
    })
  }

  const handleRouteChange = (nodeId, optionIndex, patch) => {
    const route = flow.nodes.find((node) => node.id === nodeId)?.options[optionIndex]
    const isEditingSelectedConnection =
      selectedConnection?.sourceId === nodeId && selectedConnection.optionIndex === optionIndex
    const nextConnectionId = isEditingSelectedConnection
      ? `${nodeId}-${optionIndex}-${patch.nextId ?? selectedConnection.targetId}`
      : null

    setDeleteUndo(null)
    setImportNotice(null)
    setWorkflowNotice(null)
    setFlow((currentFlow) => updateRoute(currentFlow, nodeId, optionIndex, patch))
    setSelectedConnectionId(nextConnectionId)
    setRouteEditorFocusId(routeEditorFocusId === selectedConnection?.id ? nextConnectionId : null)

    if (
      route &&
      Object.prototype.hasOwnProperty.call(patch, 'nextId') &&
      route.nextId !== patch.nextId
    ) {
      const targetNode = flow.nodes.find((node) => node.id === patch.nextId)

      recordAuditEvent({
        action: 'route.edited',
        targetType: 'route',
        targetId: getRouteAuditId(nodeId, optionIndex),
        targetLabel: getRouteTargetLabel(nodeId, route),
        summary: `Changed route "${route.label}" target from node #${route.nextId} to node #${patch.nextId}.`,
        details: targetNode ? `New target: ${getNodeTargetLabel(targetNode)}.` : '',
        meta: {
          field: 'nextId',
          before: route.nextId,
          after: patch.nextId,
          sourceNodeId: nodeId,
          optionIndex,
        },
      })
    }
  }

  const handleRouteLabelCommit = (nodeId, optionIndex, previousLabel, nextLabel) => {
    const route = flow.nodes.find((node) => node.id === nodeId)?.options[optionIndex]

    if (!route || previousLabel === nextLabel) {
      return
    }

    recordAuditEvent({
      action: 'route.edited',
      targetType: 'route',
      targetId: getRouteAuditId(nodeId, optionIndex),
      targetLabel: getRouteTargetLabel(nodeId, route),
      summary: `Renamed route "${truncateAuditValue(previousLabel)}" to "${truncateAuditValue(
        nextLabel,
      )}".`,
      details: `Route from node #${nodeId} still points to node #${route.nextId}.`,
      meta: {
        field: 'label',
        before: previousLabel,
        after: nextLabel,
        sourceNodeId: nodeId,
        optionIndex,
      },
    })
  }

  const handleRouteReconnect = (nodeId, optionIndex, targetNodeId) => {
    const sourceNode = flow.nodes.find((node) => node.id === nodeId)
    const targetNode = flow.nodes.find((node) => node.id === targetNodeId)
    const route = sourceNode?.options[optionIndex]

    if (!sourceNode || sourceNode.type === 'end' || !targetNode || !route) {
      return
    }

    const nextConnectionId = `${nodeId}-${optionIndex}-${targetNodeId}`

    setDeleteUndo(null)
    setImportNotice(null)
    setWorkflowNotice(null)
    setFlow((currentFlow) =>
      updateRoute(currentFlow, nodeId, optionIndex, { nextId: targetNodeId }),
    )
    setSelectedNodeId(targetNodeId)
    setSelectedConnectionId(nextConnectionId)
    setRouteEditorFocusId(null)
    recordAuditEvent({
      action: 'route.rewired',
      targetType: 'route',
      targetId: getRouteAuditId(nodeId, optionIndex),
      targetLabel: getRouteTargetLabel(nodeId, route),
      summary: `Rewired route "${route.label}" from node #${nodeId} to node #${targetNodeId}.`,
      details: `Target changed from node #${route.nextId} to ${getNodeTargetLabel(targetNode)} by dragging the route label.`,
      meta: {
        field: 'nextId',
        before: route.nextId,
        after: targetNodeId,
        sourceNodeId: nodeId,
        optionIndex,
        changedByDrag: true,
      },
    })
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
        undoAuditEvent: {
          action: 'delete.undone',
          targetType: 'route',
          targetId: getRouteAuditId(nodeId, optionIndex),
          targetLabel: getRouteTargetLabel(nodeId, route),
          summary: `Undid deletion of route "${route.label}".`,
          details: `Restored route from node #${nodeId} to node #${route.nextId}.`,
        },
      })
      setIsDeleteUndoMinimized(false)
      setImportNotice(null)
      setWorkflowNotice(null)
      setFlow(removeRoute(flow, nodeId, optionIndex))
      setSelectedConnectionId(null)
      setRouteEditorFocusId(null)
      recordAuditEvent({
        action: 'route.deleted',
        targetType: 'route',
        targetId: getRouteAuditId(nodeId, optionIndex),
        targetLabel: getRouteTargetLabel(nodeId, route),
        summary: `Deleted route "${route.label}".`,
        details: `Removed route from node #${nodeId} to node #${route.nextId}.`,
        meta: {
          sourceNodeId: nodeId,
          optionIndex,
          targetNodeId: route.nextId,
        },
      })
    },
    [flow, recordAuditEvent, selectedConnectionId, selectedNodeId],
  )

  const handleNodeRemove = useCallback(
    (nodeId) => {
      const nodeToRemove = flow.nodes.find((node) => node.id === nodeId)
      const nextFlow = removeNode(flow, nodeId)

      if (!nodeToRemove || nextFlow === flow) {
        return
      }

      const nodeLabel = nodeToRemove.type === 'end' ? 'terminal' : nodeToRemove.type
      const incomingRouteCount = flow.nodes.reduce(
        (count, node) => count + node.options.filter((option) => option.nextId === nodeId).length,
        0,
      )

      setDeleteUndo({
        flow,
        selectedConnectionId,
        selectedNodeId,
        message: `Deleted ${nodeLabel} node #${nodeToRemove.id}.`,
        undoAuditEvent: {
          action: 'delete.undone',
          targetType: 'node',
          targetId: nodeToRemove.id,
          targetLabel: getNodeTargetLabel(nodeToRemove),
          summary: `Undid deletion of ${nodeLabel} node #${nodeToRemove.id}.`,
          details: `Restored the node and its connected routes.`,
        },
      })
      setIsDeleteUndoMinimized(false)
      setImportNotice(null)
      setWorkflowNotice(null)
      setFlow(nextFlow)
      setSelectedNodeId(
        nextFlow.nodes.find((node) => node.type === 'start')?.id ?? nextFlow.nodes[0]?.id ?? null,
      )
      setSelectedConnectionId(null)
      setRouteEditorFocusId(null)
      recordAuditEvent({
        action: 'node.deleted',
        targetType: 'node',
        targetId: nodeToRemove.id,
        targetLabel: getNodeTargetLabel(nodeToRemove),
        summary: `Deleted ${nodeLabel} node #${nodeToRemove.id}.`,
        details: `Removed ${nodeToRemove.options.length} outbound routes and ${incomingRouteCount} incoming routes.`,
        meta: {
          nodeType: nodeToRemove.type,
          outgoingRouteCount: nodeToRemove.options.length,
          incomingRouteCount,
        },
      })
    },
    [flow, recordAuditEvent, selectedConnectionId, selectedNodeId],
  )

  const handleDeleteUndo = () => {
    if (!deleteUndo) {
      return
    }

    setFlow(deleteUndo.flow)
    setSelectedNodeId(deleteUndo.selectedNodeId)
    setSelectedConnectionId(deleteUndo.selectedConnectionId)
    setDeleteUndo(null)
    setIsDeleteUndoMinimized(false)
    setRouteEditorFocusId(null)
    recordAuditEvent(deleteUndo.undoAuditEvent)
  }

  const handleDeleteUndoDismiss = () => {
    setDeleteUndo(null)
    setIsDeleteUndoMinimized(false)
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
    setSelectedNodeId(getDiagnosticFocusNodeId(flow, scenarioId, selectedNodeId))
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

  const handleSpreadsheetImport = (importPayload) => {
    handleWorkflowImports(Array.isArray(importPayload) ? importPayload : [importPayload])
  }

  const handleWorkflowImports = (imports) => {
    const validImports = imports
      .filter((item) => Array.isArray(item?.flow?.nodes))
      .map((item) => ({
        ...item,
        warnings: item.warnings ?? [],
        sourceLabel: item.sourceLabel ?? 'import',
        sourceName: item.sourceName ?? '',
      }))

    if (validImports.length === 0) {
      return
    }

    const savedImports = []
    let nextWorkflows = workflows

    validImports.forEach((item) => {
      const importedWorkflowName = getImportedWorkflowName(item.sourceLabel, item.sourceName)
      const result = saveWorkflow(nextWorkflows, {
        name: importedWorkflowName,
        flow: item.flow,
      })

      nextWorkflows = result.workflows
      savedImports.push({
        ...item,
        workflow: result.workflow,
        routeCount: item.flow.nodes.reduce((count, node) => count + node.options.length, 0),
      })
    })

    const activeImport = savedImports.at(-1)
    const totalNodeCount = savedImports.reduce((count, item) => count + item.flow.nodes.length, 0)
    const totalRouteCount = savedImports.reduce((count, item) => count + item.routeCount, 0)
    const totalWarnings = savedImports.flatMap((item) => item.warnings ?? [])
    const wasSaved = persistWorkflows(nextWorkflows)

    setIsSpreadsheetImporterOpen(false)
    if (wasSaved) setWorkflowNotice(null)
    setImportNotice({
      message:
        savedImports.length === 1
          ? `${
              wasSaved ? 'Imported and saved' : 'Imported'
            } "${activeImport.workflow.name}" with ${activeImport.flow.nodes.length} nodes and ${
              activeImport.routeCount
            } routes.`
          : `${
              wasSaved ? 'Imported and saved' : 'Imported'
            } ${savedImports.length} workflows with ${totalNodeCount} nodes and ${totalRouteCount} routes.`,
      warnings: totalWarnings,
    })

    savedImports.forEach((item) => {
      recordAuditEvent({
        action: 'import.completed',
        targetType: 'import',
        targetId: item.sourceName || item.sourceLabel,
        targetLabel: item.sourceName || item.sourceLabel,
        summary: `Imported ${item.flow.nodes.length} nodes and ${item.routeCount} routes from ${item.sourceLabel}.`,
        details:
          item.warnings.length > 0
            ? `${item.warnings.length} warnings were raised during import.`
            : 'Import completed without warnings.',
        workflowName: item.workflow.name,
        meta: {
          sourceLabel: item.sourceLabel,
          sourceName: item.sourceName,
          nodeCount: item.flow.nodes.length,
          routeCount: item.routeCount,
          warningCount: item.warnings.length,
        },
      })

      if (!wasSaved) {
        return
      }

      recordAuditEvent({
        action: 'workflow.saved',
        targetType: 'workflow',
        targetId: item.workflow.id,
        targetLabel: item.workflow.name,
        summary: `Saved workflow "${item.workflow.name}".`,
        details: `${item.flow.nodes.length} nodes and ${item.routeCount} routes saved automatically after import.`,
        workflowName: item.workflow.name,
        meta: {
          workflowId: item.workflow.id,
          sourceLabel: item.sourceLabel,
          sourceName: item.sourceName,
          autoSaved: true,
        },
      })
    })
  }

  const persistWorkflows = (nextWorkflows) => {
    setWorkflows(nextWorkflows)

    if (persistWorkflowLibrary(nextWorkflows)) {
      return true
    }

    setWorkflowNotice('Could not save workflows in this browser.')
    return false
  }

  const handleWorkflowUse = (workflowId) => {
    const workflow = workflows.find((currentWorkflow) => currentWorkflow.id === workflowId)

    if (!workflow) {
      return
    }

    const nextFlow = cloneFlow(workflow.flow)
    const startNode = nextFlow.nodes.find((node) => node.type === 'start') ?? nextFlow.nodes[0]

    setFlow(nextFlow)
    setWorkflowName(workflow.name)
    setActiveWorkflowId(workflow.id)
    setSelectedNodeId(startNode?.id ?? null)
    setSelectedConnectionId(null)
    setRouteEditorFocusId(null)
    setDeleteUndo(null)
    setMode('Build')
    setIsPreviewing(false)
    setDemoScenario('current')
    setIsWorkflowLibraryOpen(false)
    setImportNotice(null)
    setWorkflowNotice(`Using workflow "${workflow.name}".`)
    requestCanvasViewReset()
    recordAuditEvent({
      action: 'workflow.used',
      targetType: 'workflow',
      targetId: workflow.id,
      targetLabel: workflow.name,
      summary: `Used workflow "${workflow.name}".`,
      details: `Loaded saved workflow onto the active canvas.`,
      workflowName: workflow.name,
      meta: {
        workflowId: workflow.id,
      },
    })
  }

  const handleWorkflowRename = (workflowId, nextName) => {
    const previousWorkflow = workflows.find((currentWorkflow) => currentWorkflow.id === workflowId)
    const { workflow, workflows: nextWorkflows } = renameWorkflow(workflows, workflowId, nextName)

    if (!workflow || !persistWorkflows(nextWorkflows)) {
      return
    }

    if (workflow.id === activeWorkflowId) {
      setWorkflowName(workflow.name)
    }

    setImportNotice(null)
    setWorkflowNotice(`Renamed workflow to "${workflow.name}".`)
    recordAuditEvent({
      action: 'workflow.renamed',
      targetType: 'workflow',
      targetId: workflow.id,
      targetLabel: workflow.name,
      summary: `Renamed workflow "${previousWorkflow?.name ?? workflow.id}" to "${workflow.name}".`,
      details: getTextChangeDetails('Workflow name', previousWorkflow?.name ?? '', workflow.name),
      workflowName: workflow.name,
      meta: {
        workflowId: workflow.id,
        before: previousWorkflow?.name ?? '',
        after: workflow.name,
      },
    })
  }

  const handleWorkflowDelete = (workflowId) => {
    const workflow = workflows.find((currentWorkflow) => currentWorkflow.id === workflowId)

    if (!workflow) {
      return
    }

    const nextWorkflows = deleteWorkflow(workflows, workflowId)

    if (!persistWorkflows(nextWorkflows)) {
      return
    }

    if (workflowId === activeWorkflowId) {
      setActiveWorkflowId(null)
    }

    setImportNotice(null)
    setWorkflowNotice(`Deleted workflow "${workflow.name}".`)

    const stats = getWorkflowStats(workflow.flow)

    recordAuditEvent({
      action: 'workflow.deleted',
      targetType: 'workflow',
      targetId: workflow.id,
      targetLabel: workflow.name,
      summary: `Deleted workflow "${workflow.name}".`,
      details: `${stats.nodeCount} nodes and ${stats.routeCount} routes were in the deleted workflow.`,
      workflowName: workflow.name,
      meta: {
        workflowId: workflow.id,
      },
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
        setIsWorkflowLibraryOpen(false)
        setIsAuditLogOpen(false)
        return
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return
      }

      if (
        event.defaultPrevented ||
        isCommandPaletteOpen ||
        isSpreadsheetImporterOpen ||
        isWorkflowLibraryOpen ||
        isAuditLogOpen ||
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
    isAuditLogOpen,
    isCommandPaletteOpen,
    isSpreadsheetImporterOpen,
    isWorkflowLibraryOpen,
    isPreviewing,
    mode,
    selectedConnection,
    selectedNode,
  ])

  const displayMode = isPreviewing ? 'Preview' : mode

  const handleInspectorBackToCanvas = () => {
    if (mode !== 'Build' || isPreviewing) {
      handleModeChange('Build')
    }

    const scrollToCanvas = () => {
      const canvas = document.querySelector('.flow-workspace')

      if (typeof canvas?.scrollIntoView !== 'function') {
        return
      }

      canvas.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' })
    }

    if (mode !== 'Build' || isPreviewing) {
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(scrollToCanvas)
      } else {
        window.setTimeout(scrollToCanvas, 0)
      }
      return
    }

    scrollToCanvas()
  }

  return (
    <main className="app-shell">
      <AppToolbar
        workflowName={workflowName}
        mode={mode}
        isPreviewMode={isPreviewing}
        healthIssueCount={healthIssues.length}
        auditEntryCount={auditEntries.length}
        currentUser={currentUser}
        onModeChange={handleModeChange}
        onPreviewStart={handlePreviewStart}
        onSpreadsheetImport={() => setIsSpreadsheetImporterOpen(true)}
        onWorkflowLibrary={() => setIsWorkflowLibraryOpen(true)}
        onAuditLog={handleAuditLogOpen}
        onCurrentUserChange={handleCurrentUserChange}
      />

      <div
        className={['editor-layout', isPreviewing ? 'editor-layout--preview' : '']
          .filter(Boolean)
          .join(' ')}
      >
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
            viewResetKey={canvasViewResetKey}
            issues={healthIssues}
            onNodeSelect={handleNodeSelect}
            onConnectionSelect={handleConnectionSelect}
            onRouteConnect={handleRouteConnect}
            onRouteReconnect={handleRouteReconnect}
            onNodeMove={handleNodeMove}
            onNodeMoveCommit={handleNodeMoveCommit}
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
            onTextCommit={handleNodeTextCommit}
            onNodeAdd={handleNodeAdd}
            onRouteAdd={handleRouteAdd}
            onRouteChange={handleRouteChange}
            onRouteLabelCommit={handleRouteLabelCommit}
            onRouteRemove={handleRouteRemove}
            onNodeRemove={handleNodeRemove}
            onBackToCanvas={handleInspectorBackToCanvas}
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
        workflowName={workflowName}
        isDemo={isDemo}
        selectedNodeId={selectedNodeId}
        mode={displayMode}
        onCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {deleteUndo && (
        <div
          className={['app-undo-toast', isDeleteUndoMinimized ? 'app-undo-toast--minimized' : '']
            .filter(Boolean)
            .join(' ')}
          aria-live="polite"
        >
          <span role="status">
            {isDeleteUndoMinimized ? 'Delete undo available' : deleteUndo.message}
          </span>
          <button type="button" onClick={handleDeleteUndo}>
            Undo
          </button>
          {isDeleteUndoMinimized ? (
            <button
              type="button"
              className="app-undo-toast__secondary"
              aria-label="Restore undo message"
              onClick={() => setIsDeleteUndoMinimized(false)}
            >
              Show
            </button>
          ) : (
            <button
              type="button"
              className="app-undo-toast__secondary"
              aria-label="Minimize undo message"
              onClick={() => setIsDeleteUndoMinimized(true)}
            >
              Minimize
            </button>
          )}
          <button
            type="button"
            className="app-undo-toast__dismiss"
            aria-label="Close undo message"
            onClick={handleDeleteUndoDismiss}
          >
            Close
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

      {workflowNotice && (
        <div className="app-import-toast" aria-live="polite">
          <span role="status">{workflowNotice}</span>
          <button type="button" onClick={() => setWorkflowNotice(null)}>
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
        onWorkflowLibrary={() => setIsWorkflowLibraryOpen(true)}
        onAuditLog={handleAuditLogOpen}
      />

      <SpreadsheetImporter
        open={isSpreadsheetImporterOpen}
        onClose={() => setIsSpreadsheetImporterOpen(false)}
        onImport={handleSpreadsheetImport}
      />

      <WorkflowLibraryPanel
        open={isWorkflowLibraryOpen}
        workflows={workflows}
        activeWorkflowId={activeWorkflowId}
        currentFlow={flow}
        workflowName={workflowName}
        onClose={() => setIsWorkflowLibraryOpen(false)}
        onUseWorkflow={handleWorkflowUse}
        onRenameWorkflow={handleWorkflowRename}
        onDeleteWorkflow={handleWorkflowDelete}
      />

      <AuditLogPanel
        open={isAuditLogOpen}
        entries={auditEntries}
        currentUser={currentUser}
        onCurrentUserChange={handleCurrentUserChange}
        onClose={() => setIsAuditLogOpen(false)}
        onExport={handleAuditExport}
      />
    </main>
  )
}
