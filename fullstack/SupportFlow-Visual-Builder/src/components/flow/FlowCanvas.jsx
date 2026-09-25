/**
 * Renders the SupportFlow decision tree inside the fixed challenge canvas.
 *
 * The canvas preserves every supplied x/y coordinate while layering in the
 * Make prototype's depth bands, X-Ray banner, relation highlighting, minimap,
 * animated execution packets and functional zoom controls.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import analyzeFlow from '../../domain/analyzeFlow.js'
import getConnections from '../../domain/getConnections.js'
import useNodeMeasurements from '../../hooks/useNodeMeasurements.js'
import '../../styles/minimap.css'
import ConnectorLayer from './ConnectorLayer.jsx'
import FlowNode from './FlowNode.jsx'
import Minimap from './Minimap.jsx'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 1.4
const ZOOM_STEP = 0.1
const NODE_MOVE_GRID = 24
const MOBILE_POINTER_QUERY = '(max-width: 720px)'
const DEFAULT_NODE_WIDTH = 196
const DEFAULT_NODE_HEIGHT = 96

function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4.5 8h7" />
    </svg>
  )
}

function ZoomInIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4.5 8h7M8 4.5v7" />
    </svg>
  )
}

function FitViewIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5.5 3.5h-2v2M10.5 3.5h2v2M12.5 10.5v2h-2M5.5 12.5h-2v-2" />
      <path d="M6 6h4v4H6z" />
    </svg>
  )
}

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function snapToGrid(value) {
  return Math.round(value / NODE_MOVE_GRID) * NODE_MOVE_GRID
}

function shouldPreventScrollDuringNodeMove(event) {
  if (event.pointerType === 'touch') {
    return true
  }

  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_POINTER_QUERY).matches
  )
}

function getDraggedNodePosition(dragState, point, nodeRect, canvasSize) {
  if (!point) {
    return dragState.lastPosition
  }

  const width = nodeRect?.width ?? DEFAULT_NODE_WIDTH
  const height = nodeRect?.height ?? DEFAULT_NODE_HEIGHT
  const maxX = Math.max(0, canvasSize.w - width)
  const maxY = Math.max(0, canvasSize.h - height)
  const nextX = dragState.startPosition.x + (point.x - dragState.startPoint.x)
  const nextY = dragState.startPosition.y + (point.y - dragState.startPoint.y)

  return {
    x: clamp(snapToGrid(nextX), 0, maxX),
    y: clamp(snapToGrid(nextY), 0, maxY),
  }
}

export default function FlowCanvas({
  flow,
  mode = 'Build',
  isDemo = false,
  selectedNodeId = null,
  selectedConnectionId = null,
  viewResetKey = 0,
  issues = [],
  onNodeSelect = () => {},
  onConnectionSelect = () => {},
  onRouteConnect = () => {},
  onRouteReconnect = () => {},
  onNodeMove = () => {},
  onNodeMoveCommit = () => {},
}) {
  const { canvas_size: canvasSize } = flow.meta
  const workspaceRef = useRef(null)
  const [hoveredNodeId, setHoveredNodeId] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [draftRoute, setDraftRoute] = useState(null)
  const [nodeDrag, setNodeDrag] = useState(null)
  const viewResetContextRef = useRef({ nodes: flow.nodes, selectedNodeId })
  const handledViewResetKeyRef = useRef(null)
  const appliedMobileInitialFitRef = useRef(false)

  const connections = useMemo(() => getConnections(flow.nodes), [flow.nodes])
  const analysis = useMemo(() => analyzeFlow(flow.nodes), [flow.nodes])
  const brokenRouteNodeIds = new Set(analysis.brokenReferences.map(({ sourceId }) => sourceId))
  const issuesByNodeId = useMemo(() => {
    const groupedIssues = new Map()

    issues.forEach((issue) => {
      if (!issue.nodeId) {
        return
      }

      groupedIssues.set(issue.nodeId, [...(groupedIssues.get(issue.nodeId) ?? []), issue])
    })

    return groupedIssues
  }, [issues])
  const incomingCounts = useMemo(() => {
    const counts = new Map(flow.nodes.map((node) => [node.id, 0]))

    connections.forEach((connection) => {
      counts.set(connection.targetId, (counts.get(connection.targetId) ?? 0) + 1)
    })

    return counts
  }, [connections, flow.nodes])
  const diagnosticIssueNodeIds = useMemo(
    () =>
      new Set([
        ...analysis.questionsWithoutRoutes.map((node) => node.id),
        ...analysis.terminalsWithRoutes.map((node) => node.id),
      ]),
    [analysis.questionsWithoutRoutes, analysis.terminalsWithRoutes],
  )

  const { canvasRef, nodeRects, registerNode } = useNodeMeasurements(flow.nodes, zoom)

  useEffect(() => {
    viewResetContextRef.current = { nodes: flow.nodes, selectedNodeId }
  }, [flow.nodes, selectedNodeId])

  const getScrollViewport = useCallback(() => {
    const workspace = workspaceRef.current

    if (!workspace) {
      return null
    }

    return workspace.querySelector('.flow-scroll-area') ?? workspace
  }, [])

  const getCanvasPoint = useCallback(
    (event) => {
      const canvas = canvasRef.current

      if (!canvas) {
        return null
      }

      const rect = canvas.getBoundingClientRect()

      return {
        x: (event.clientX - rect.left) / zoom,
        y: (event.clientY - rect.top) / zoom,
      }
    },
    [canvasRef, zoom],
  )

  const getEventTargetNodeId = useCallback((event, sourceId, allowSource = false) => {
    const element =
      event.target instanceof Element ? event.target.closest('[data-flow-node-id]') : null
    const targetId = element?.getAttribute('data-flow-node-id') ?? null

    return targetId && (allowSource || targetId !== sourceId) ? targetId : null
  }, [])

  const getPointTargetNodeId = useCallback(
    (point, sourceId, allowSource = false) => {
      if (!point) {
        return null
      }

      return (
        Object.entries(nodeRects).find(([nodeId, rect]) => {
          if (!allowSource && nodeId === sourceId) {
            return false
          }

          return (
            point.x >= rect.x &&
            point.x <= rect.x + rect.width &&
            point.y >= rect.y &&
            point.y <= rect.y + rect.height
          )
        })?.[0] ?? null
      )
    },
    [nodeRects],
  )

  const handleRouteDraftStart = useCallback(
    (sourceId, event) => {
      if (mode !== 'Build') {
        return
      }

      const point = getCanvasPoint(event) ?? { x: 0, y: 0 }

      onNodeSelect(sourceId)
      setDraftRoute({ type: 'create', sourceId, point, startPoint: point, targetId: null })
    },
    [getCanvasPoint, mode, onNodeSelect],
  )

  const handleRouteRewireStart = useCallback(
    (connection, event) => {
      if (mode !== 'Build') {
        return
      }

      const point = getCanvasPoint(event) ?? { x: 0, y: 0 }

      onConnectionSelect(connection)
      setDraftRoute({
        type: 'rewire',
        sourceId: connection.sourceId,
        optionIndex: connection.optionIndex,
        sourceOptionCount: connection.sourceOptionCount,
        point,
        startPoint: point,
        targetId: null,
        hasMoved: false,
      })
    },
    [getCanvasPoint, mode, onConnectionSelect],
  )

  const beginNodeMove = useCallback(
    (nodeId, node, point, shouldPreventScroll = false) => {
      onNodeSelect(nodeId)
      setDraftRoute(null)
      setNodeDrag({
        nodeId,
        startPoint: point,
        startPosition: node.position,
        lastPosition: node.position,
        hasMoved: false,
        shouldPreventScroll,
      })
    },
    [onNodeSelect],
  )

  const handleNodeMoveStart = useCallback(
    (nodeId, event) => {
      if (mode !== 'Build') {
        return
      }

      const node = flow.nodes.find((candidate) => candidate.id === nodeId)
      const point = getCanvasPoint(event)

      if (!node || !point) {
        return
      }

      beginNodeMove(nodeId, node, point, shouldPreventScrollDuringNodeMove(event))
    },
    [beginNodeMove, flow.nodes, getCanvasPoint, mode],
  )

  useEffect(() => {
    if (!draftRoute) {
      return undefined
    }

    const handlePointerMove = (event) => {
      const point = getCanvasPoint(event)
      const allowSource = draftRoute.type === 'rewire'
      const targetId =
        getEventTargetNodeId(event, draftRoute.sourceId, allowSource) ??
        getPointTargetNodeId(point, draftRoute.sourceId, allowSource)
      const dragDistance =
        point && draftRoute.startPoint
          ? Math.hypot(point.x - draftRoute.startPoint.x, point.y - draftRoute.startPoint.y)
          : 0

      setDraftRoute((currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              point: point ?? currentDraft.point,
              targetId,
              hasMoved: currentDraft.hasMoved || dragDistance > 4,
            }
          : null,
      )
    }

    const handlePointerUp = (event) => {
      const point = getCanvasPoint(event)
      const allowSource = draftRoute.type === 'rewire'
      const directTargetId = getEventTargetNodeId(event, draftRoute.sourceId, allowSource)
      const targetId =
        directTargetId ?? getPointTargetNodeId(point, draftRoute.sourceId, allowSource)
      const canCommitDrop = draftRoute.hasMoved || Boolean(directTargetId)

      if (targetId && draftRoute.type === 'rewire' && canCommitDrop) {
        onRouteReconnect(draftRoute.sourceId, draftRoute.optionIndex, targetId)
      } else if (targetId && canCommitDrop) {
        onRouteConnect(draftRoute.sourceId, targetId)
      }

      setDraftRoute(null)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDraftRoute(null)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    draftRoute,
    getCanvasPoint,
    getEventTargetNodeId,
    getPointTargetNodeId,
    onRouteConnect,
    onRouteReconnect,
  ])

  useEffect(() => {
    if (!nodeDrag) {
      return undefined
    }

    const handlePointerMove = (event) => {
      if (nodeDrag.shouldPreventScroll) {
        event.preventDefault()
      }

      const point = getCanvasPoint(event)
      const nextPosition = getDraggedNodePosition(
        nodeDrag,
        point,
        nodeRects[nodeDrag.nodeId],
        canvasSize,
      )
      const hasMoved =
        nodeDrag.hasMoved ||
        nextPosition.x !== nodeDrag.startPosition.x ||
        nextPosition.y !== nodeDrag.startPosition.y

      if (
        nextPosition.x !== nodeDrag.lastPosition.x ||
        nextPosition.y !== nodeDrag.lastPosition.y
      ) {
        onNodeMove(nodeDrag.nodeId, nextPosition)
      }

      setNodeDrag((currentDrag) =>
        currentDrag
          ? {
              ...currentDrag,
              lastPosition: nextPosition,
              hasMoved,
            }
          : null,
      )
    }

    const handlePointerUp = (event) => {
      if (nodeDrag.shouldPreventScroll) {
        event.preventDefault()
      }

      const point = getCanvasPoint(event)
      const nextPosition = getDraggedNodePosition(
        nodeDrag,
        point,
        nodeRects[nodeDrag.nodeId],
        canvasSize,
      )
      const hasMoved =
        nodeDrag.hasMoved ||
        nextPosition.x !== nodeDrag.startPosition.x ||
        nextPosition.y !== nodeDrag.startPosition.y

      if (
        nextPosition.x !== nodeDrag.lastPosition.x ||
        nextPosition.y !== nodeDrag.lastPosition.y
      ) {
        onNodeMove(nodeDrag.nodeId, nextPosition)
      }

      if (hasMoved) {
        onNodeMoveCommit(nodeDrag.nodeId, nodeDrag.startPosition, nextPosition)
      }

      setNodeDrag(null)
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') {
        return
      }

      onNodeMove(nodeDrag.nodeId, nodeDrag.startPosition)
      setNodeDrag(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [canvasSize, getCanvasPoint, nodeDrag, nodeRects, onNodeMove, onNodeMoveCommit])

  const getFitZoom = useCallback(() => {
    const viewport = getScrollViewport()

    if (!viewport) {
      return 1
    }

    const horizontalScale = Math.max(1, viewport.clientWidth - 80) / canvasSize.w
    const verticalScale = Math.max(1, viewport.clientHeight - 80) / canvasSize.h

    return clampZoom(Math.min(horizontalScale, verticalScale, 1))
  }, [canvasSize.h, canvasSize.w, getScrollViewport])

  const handleFitView = useCallback(() => {
    setZoom(getFitZoom())
  }, [getFitZoom])

  const resetCanvasView = useCallback(() => {
    const { nodes, selectedNodeId: resetSelectedNodeId } = viewResetContextRef.current
    const nextZoom = getFitZoom()
    const viewport = getScrollViewport()
    const focusNode =
      nodes.find((node) => node.id === resetSelectedNodeId) ??
      nodes.find((node) => node.type === 'start') ??
      nodes[0]

    setZoom(nextZoom)

    if (!viewport || !focusNode?.position) {
      return
    }

    const scrollToFocus = () => {
      const nextLeft = Math.max(
        0,
        (focusNode.position.x + DEFAULT_NODE_WIDTH / 2) * nextZoom - viewport.clientWidth / 2,
      )
      const nextTop = Math.max(
        0,
        (focusNode.position.y + DEFAULT_NODE_HEIGHT / 2) * nextZoom - viewport.clientHeight / 3,
      )

      if (typeof viewport.scrollTo === 'function') {
        viewport.scrollTo({ left: nextLeft, top: nextTop, behavior: 'auto' })
        return
      }

      viewport.scrollLeft = nextLeft
      viewport.scrollTop = nextTop
    }

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollToFocus)
    } else {
      window.setTimeout(scrollToFocus, 0)
    }
  }, [getFitZoom, getScrollViewport])

  useEffect(() => {
    if (!viewResetKey || handledViewResetKeyRef.current === viewResetKey) {
      return undefined
    }

    handledViewResetKeyRef.current = viewResetKey

    if (typeof window.requestAnimationFrame === 'function') {
      const frameId = window.requestAnimationFrame(resetCanvasView)

      return () => window.cancelAnimationFrame?.(frameId)
    }

    const timeoutId = window.setTimeout(resetCanvasView, 0)

    return () => window.clearTimeout(timeoutId)
  }, [resetCanvasView, viewResetKey])

  useEffect(() => {
    if (
      appliedMobileInitialFitRef.current ||
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(max-width: 720px)').matches
    ) {
      return undefined
    }

    appliedMobileInitialFitRef.current = true

    if (typeof window.requestAnimationFrame === 'function') {
      const frameId = window.requestAnimationFrame(resetCanvasView)

      return () => window.cancelAnimationFrame?.(frameId)
    }

    const timeoutId = window.setTimeout(resetCanvasView, 0)

    return () => window.clearTimeout(timeoutId)
  }, [resetCanvasView])

  const isXray = mode === 'X-Ray'

  return (
    <section
      ref={workspaceRef}
      className={['flow-workspace', isXray ? 'flow-workspace--xray' : ''].filter(Boolean).join(' ')}
      aria-label="Support flow"
    >
      {isXray && (
        <div className="flow-xray-banner">
          <span className="studio-blink" aria-hidden="true" />
          <strong>
            {isDemo && 'DEMO · '}
            X-RAY · {analysis.reachable.size}/{flow.nodes.length} reachable ·{' '}
            {analysis.hasCycle ? 'cycle detected!' : 'no cycles'} ·{' '}
            {analysis.brokenReferences.length} broken refs · start count: {analysis.startCount}
          </strong>
        </div>
      )}

      <div className="flow-scroll-area">
        <div
          className="flow-zoom-surface"
          style={{
            width: `${canvasSize.w * zoom}px`,
            height: `${canvasSize.h * zoom}px`,
          }}
        >
          <div
            ref={canvasRef}
            className={['flow-canvas', nodeDrag ? 'flow-canvas--moving-node' : '']
              .filter(Boolean)
              .join(' ')}
            data-testid="flow-canvas"
            style={{
              width: `${canvasSize.w}px`,
              height: `${canvasSize.h}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <svg
              className="flow-depth-layer"
              width={canvasSize.w}
              height={canvasSize.h}
              aria-hidden="true"
            >
              <line x1="0" y1="178" x2={canvasSize.w} y2="178" />
              <line x1="0" y1="422" x2={canvasSize.w} y2="422" />
              <text x="20" y="100">
                0 · ENTRY
              </text>
              <text x="20" y="305">
                1 · BRANCH
              </text>
              <text x="20" y="560">
                2 · RESOLVE
              </text>
            </svg>

            <ConnectorLayer
              connections={connections}
              nodeRects={nodeRects}
              nodes={flow.nodes}
              width={canvasSize.w}
              height={canvasSize.h}
              showLabels={false}
              selectedNodeId={selectedNodeId}
              selectedConnectionId={selectedConnectionId}
              onConnectionSelect={onConnectionSelect}
              onRouteRewireStart={handleRouteRewireStart}
              mode={mode}
              reachableIds={analysis.reachable}
              cycleParticipantIds={analysis.cycleParticipants}
              draftConnection={draftRoute}
            />

            {flow.nodes.map((node) => (
              <FlowNode
                key={isXray ? `${node.id}-xray` : node.id}
                node={node}
                nodeRef={(element) => registerNode(node.id, element)}
                isSelected={node.id === selectedNodeId}
                isHovered={node.id === hoveredNodeId}
                isXray={isXray}
                isReachable={analysis.reachable.has(node.id)}
                hasDiagnosticIssue={diagnosticIssueNodeIds.has(node.id)}
                isCycleParticipant={analysis.cycleParticipants.has(node.id)}
                hasBrokenRoute={brokenRouteNodeIds.has(node.id)}
                incomingCount={incomingCounts.get(node.id) ?? 0}
                issues={issuesByNodeId.get(node.id) ?? []}
                isConnectable={mode === 'Build' && node.type !== 'end'}
                isConnectionTarget={draftRoute?.targetId === node.id}
                isConnectionSource={draftRoute?.sourceId === node.id}
                isMovable={mode === 'Build'}
                isMoving={nodeDrag?.nodeId === node.id}
                onRouteDraftStart={handleRouteDraftStart}
                onMoveStart={handleNodeMoveStart}
                onSelect={onNodeSelect}
                onHover={setHoveredNodeId}
              />
            ))}

            <ConnectorLayer
              connections={connections}
              nodeRects={nodeRects}
              nodes={flow.nodes}
              width={canvasSize.w}
              height={canvasSize.h}
              showPaths={false}
              showDraft={false}
              selectedNodeId={selectedNodeId}
              selectedConnectionId={selectedConnectionId}
              onConnectionSelect={onConnectionSelect}
              onRouteRewireStart={handleRouteRewireStart}
              mode={mode}
              reachableIds={analysis.reachable}
              cycleParticipantIds={analysis.cycleParticipants}
            />
          </div>
        </div>
      </div>

      <Minimap
        flow={flow}
        selectedNodeId={selectedNodeId}
        mode={mode}
        reachableIds={analysis.reachable}
        cycleParticipantIds={analysis.cycleParticipants}
        brokenRouteNodeIds={brokenRouteNodeIds}
      />

      <div className="flow-canvas-controls">
        <button
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => setZoom((current) => clampZoom(current - ZOOM_STEP))}
        >
          <ZoomOutIcon />
        </button>
        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
        >
          <ZoomInIcon />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" title="Fit view" aria-label="Fit view" onClick={handleFitView}>
          <FitViewIcon />
        </button>
      </div>
    </section>
  )
}
