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

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export default function FlowCanvas({
  flow,
  mode = 'Build',
  isDemo = false,
  selectedNodeId = null,
  selectedConnectionId = null,
  issues = [],
  onNodeSelect = () => {},
  onConnectionSelect = () => {},
  onRouteConnect = () => {},
  onRouteReconnect = () => {},
}) {
  const { canvas_size: canvasSize } = flow.meta
  const workspaceRef = useRef(null)
  const [hoveredNodeId, setHoveredNodeId] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [draftRoute, setDraftRoute] = useState(null)

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

  const { canvasRef, nodeRects, registerNode } = useNodeMeasurements(flow.nodes, zoom)

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

  const handleFitView = () => {
    const workspace = workspaceRef.current

    if (!workspace) {
      return
    }

    const horizontalScale = (workspace.clientWidth - 80) / canvasSize.w
    const verticalScale = (workspace.clientHeight - 80) / canvasSize.h

    setZoom(clampZoom(Math.min(horizontalScale, verticalScale, 1)))
  }

  const isXray = mode === 'X-Ray'

  return (
    <section ref={workspaceRef} className="flow-workspace" aria-label="Support flow">
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
            className="flow-canvas"
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
                isCycleParticipant={analysis.cycleParticipants.has(node.id)}
                hasBrokenRoute={brokenRouteNodeIds.has(node.id)}
                incomingCount={incomingCounts.get(node.id) ?? 0}
                issues={issuesByNodeId.get(node.id) ?? []}
                isConnectable={mode === 'Build' && node.type !== 'end'}
                isConnectionTarget={draftRoute?.targetId === node.id}
                isConnectionSource={draftRoute?.sourceId === node.id}
                onRouteDraftStart={handleRouteDraftStart}
                onSelect={onNodeSelect}
                onHover={setHoveredNodeId}
              />
            ))}
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
          −
        </button>
        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
        >
          +
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" title="Fit view" aria-label="Fit view" onClick={handleFitView}>
          ⊡
        </button>
      </div>
    </section>
  )
}
