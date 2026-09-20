/**
 * Draws SupportFlow relationships using native SVG and measured DOM geometry.
 *
 * Build mode highlights edges related to the selected node and animates a
 * single execution packet. X-Ray mode recolors reachable and broken paths while
 * preserving the custom connector implementation required by the challenge.
 */

import { createBezierPath, getBezierPoint } from '../../domain/createBezierPath.js'

const TYPE_COLOR = {
  start: '#10b981',
  question: '#4f8ff7',
  end: '#f59e0b',
}
const LABEL_HEIGHT = 22
const LABEL_NODE_GAP = 8
const LABEL_LABEL_GAP = 8
const LABEL_PREFERRED_T = 0.46
const LABEL_T_CANDIDATES = [0.46, 0.38, 0.54, 0.3, 0.62, 0.24, 0.7, 0.78]
const LABEL_NORMAL_FALLBACKS = [0, -16, 16, -32, 32]
const MAX_LABEL_CHARACTERS = 42

function getIncomingPositions(connections) {
  const groupedConnections = new Map()

  connections.forEach((connection) => {
    const group = groupedConnections.get(connection.targetId) ?? []
    group.push(connection)
    groupedConnections.set(connection.targetId, group)
  })

  const positions = new Map()

  groupedConnections.forEach((group) => {
    group.forEach((connection, index) => {
      positions.set(connection.id, {
        index,
        count: group.length,
      })
    })
  })

  return positions
}

function getParallelRoutePositions(connections) {
  const groups = new Map()

  connections.forEach((connection) => {
    const key = `${connection.sourceId}-${connection.targetId}`
    const group = groups.get(key) ?? []

    group.push(connection)
    groups.set(key, group)
  })

  const positions = new Map()

  groups.forEach((group) => {
    group.forEach((connection, index) => {
      positions.set(connection.id, {
        index,
        count: group.length,
      })
    })
  })

  return positions
}
function getBoundaryAnchor(rect, index, count, edge) {
  const horizontalRatio = (index + 1) / (count + 1)

  return {
    x: rect.x + rect.width * horizontalRatio,
    y: edge === 'bottom' ? rect.y + rect.height : rect.y,
  }
}

function getConnectorLabelText(label) {
  return label.length > MAX_LABEL_CHARACTERS
    ? `${label.slice(0, MAX_LABEL_CHARACTERS - 1)}…`
    : label
}

function getLabelWidth(label) {
  return Math.min(280, Math.max(86, getConnectorLabelText(label).length * 6.6 + 24))
}

function getLabelRect(position, labelWidth) {
  return {
    x: position.x - labelWidth / 2,
    y: position.y - LABEL_HEIGHT / 2,
    width: labelWidth,
    height: LABEL_HEIGHT,
  }
}

function doRectsOverlap(left, right, gap = 0) {
  return !(
    left.x + left.width < right.x - gap ||
    left.x > right.x + right.width + gap ||
    left.y + left.height < right.y - gap ||
    left.y > right.y + right.height + gap
  )
}

function clampLabelPosition(position, labelWidth, canvasWidth, canvasHeight) {
  return {
    x: Math.min(canvasWidth - labelWidth / 2, Math.max(labelWidth / 2, position.x)),
    y: Math.min(canvasHeight - LABEL_HEIGHT / 2, Math.max(LABEL_HEIGHT / 2, position.y)),
  }
}

function getBezierNormal(source, target, t) {
  const before = getBezierPoint(source, target, Math.max(0, t - 0.01))
  const after = getBezierPoint(source, target, Math.min(1, t + 0.01))
  const dx = after.x - before.x
  const dy = after.y - before.y
  const length = Math.hypot(dx, dy) || 1

  return {
    x: -dy / length,
    y: dx / length,
  }
}

function overlapsAnyRect(position, labelWidth, rects, gap) {
  const labelRect = getLabelRect(position, labelWidth)

  return rects.some((rect) => doRectsOverlap(labelRect, rect, gap))
}

function isLabelPositionClear(position, labelWidth, nodeRectList, placedLabelRects) {
  return (
    !overlapsAnyRect(position, labelWidth, nodeRectList, LABEL_NODE_GAP) &&
    !overlapsAnyRect(position, labelWidth, placedLabelRects, LABEL_LABEL_GAP)
  )
}

function getReadablePathLabelPosition(
  source,
  target,
  labelWidth,
  labelSpacing,
  nodeRects,
  placedLabelRects,
  canvasWidth,
  canvasHeight,
) {
  const nodeRectList = Object.values(nodeRects)
  const preferredPoint = getBezierPoint(source, target, LABEL_PREFERRED_T)
  const preferredNormal = getBezierNormal(source, target, LABEL_PREFERRED_T)

  for (const fallbackOffset of LABEL_NORMAL_FALLBACKS) {
    for (const t of LABEL_T_CANDIDATES) {
      const point = getBezierPoint(source, target, t)
      const normal = getBezierNormal(source, target, t)
      const totalOffset = labelSpacing + fallbackOffset
      const candidate = clampLabelPosition(
        {
          x: point.x + normal.x * totalOffset,
          y: point.y + normal.y * totalOffset,
        },
        labelWidth,
        canvasWidth,
        canvasHeight,
      )

      if (isLabelPositionClear(candidate, labelWidth, nodeRectList, placedLabelRects)) {
        return candidate
      }
    }
  }

  return clampLabelPosition(
    {
      x: preferredPoint.x + preferredNormal.x * labelSpacing,
      y: preferredPoint.y + preferredNormal.y * labelSpacing,
    },
    labelWidth,
    canvasWidth,
    canvasHeight,
  )
}

export default function ConnectorLayer({
  connections,
  nodeRects,
  nodes = [],
  width,
  height,
  showPaths = true,
  showLabels = true,
  showDraft = true,
  selectedNodeId = null,
  selectedConnectionId = null,
  onConnectionSelect = () => {},
  onRouteRewireStart = () => {},
  mode = 'Build',
  reachableIds = new Set(),
  cycleParticipantIds = new Set(),
  draftConnection = null,
}) {
  const incomingPositions = getIncomingPositions(connections)
  const parallelRoutePositions = getParallelRoutePositions(connections)
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const placedLabelRects = []
  const isXray = mode === 'X-Ray'
  const noMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <svg
      className={[
        'connector-layer',
        showPaths ? 'connector-layer--paths' : '',
        showLabels ? 'connector-layer--labels' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-label={showPaths ? 'Flow connections' : 'Editable route labels'}
    >
      <defs>
        <marker
          id="supportflow-arrow"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
        >
          <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="rgba(255,255,255,0.14)" />
        </marker>
        <marker
          id="supportflow-arrow-related"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
        >
          <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="rgba(79,143,247,0.80)" />
        </marker>
        <marker
          id="supportflow-arrow-xray"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
        >
          <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="rgba(16,185,129,0.48)" />
        </marker>
        {[
          ['error', '#ef4444'],
          ['cycle', '#4f8ff7'],
        ].map(([kind, color]) => (
          <marker
            key={kind}
            id={`supportflow-arrow-${kind}`}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <path d="M 0 0 L 7 3.5 L 0 7 Z" fill={color} />
          </marker>
        ))}
        <marker
          id="supportflow-arrow-draft"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
        >
          <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="rgba(79,143,247,0.9)" />
        </marker>

        {connections.map((connection) => {
          const sourceNode = nodeMap.get(connection.sourceId)
          const targetNode = nodeMap.get(connection.targetId)
          const sourceRect = nodeRects[connection.sourceId]
          const targetRect = nodeRects[connection.targetId]

          if (!showPaths || !sourceNode || !targetNode || !sourceRect || !targetRect) {
            return null
          }

          const incomingPosition = incomingPositions.get(connection.id)
          const source = getBoundaryAnchor(
            sourceRect,
            connection.optionIndex,
            connection.sourceOptionCount,
            'bottom',
          )
          const target = getBoundaryAnchor(
            targetRect,
            incomingPosition.index,
            incomingPosition.count,
            'top',
          )

          return (
            <linearGradient
              key={`gradient-${connection.id}`}
              id={`connector-gradient-${connection.id}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              gradientUnits="userSpaceOnUse"
            >
              <stop
                offset="0%"
                stopColor={TYPE_COLOR[sourceNode.type] ?? '#4f8ff7'}
                stopOpacity="0.55"
              />
              <stop
                offset="100%"
                stopColor={TYPE_COLOR[targetNode.type] ?? '#4f8ff7'}
                stopOpacity="0.35"
              />
            </linearGradient>
          )
        })}
      </defs>

      {connections.map((connection) => {
        const sourceRect = nodeRects[connection.sourceId]
        const targetRect = nodeRects[connection.targetId]
        const sourceNode = nodeMap.get(connection.sourceId)

        if (!sourceRect) {
          return null
        }

        const incomingPosition = incomingPositions.get(connection.id)
        const source = getBoundaryAnchor(
          sourceRect,
          connection.optionIndex,
          connection.sourceOptionCount,
          'bottom',
        )

        if (!targetRect) {
          if (!showPaths || !isXray || nodeMap.has(connection.targetId)) return null

          // A missing target has no DOM rectangle. Show an explicit dangling
          // route instead of silently dropping the edge from the diagnostic view.
          const end = { x: source.x + 64, y: source.y + 68 }
          return (
            <g
              key={connection.id}
              className="connector-broken"
              data-testid={`broken-connection-${connection.id}`}
            >
              <title>
                {connection.label}: missing node #{connection.targetId}
              </title>
              <path
                d={createBezierPath(source, end)}
                fill="none"
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
              <circle cx={end.x} cy={end.y} r="4" fill="#1a0505" stroke="#ef4444" />
              <text x={end.x + 9} y={end.y + 3}>
                Missing target
              </text>
            </g>
          )
        }

        const target = getBoundaryAnchor(
          targetRect,
          incomingPosition.index,
          incomingPosition.count,
          'top',
        )

        const isSelfLoop = connection.sourceId === connection.targetId
        const loopX = sourceRect.x + sourceRect.width + 76
        const loopY = (source.y + target.y) / 2
        const path = isSelfLoop
          ? `M ${source.x} ${source.y} C ${source.x} ${source.y + 60}, ${loopX} ${source.y + 60}, ${loopX} ${loopY} C ${loopX} ${target.y - 60}, ${target.x} ${target.y - 60}, ${target.x} ${target.y}`
          : createBezierPath(source, target)
        const parallelPosition = parallelRoutePositions.get(connection.id) ?? {
          index: 0,
          count: 1,
        }

        const labelSpacing =
          parallelPosition.count > 1
            ? (parallelPosition.index - (parallelPosition.count - 1) / 2) * 30
            : 0
        const labelWidth = getLabelWidth(connection.label)
        const isConnectionSelected = selectedConnectionId === connection.id
        const canRewire = mode === 'Build'

        const isRelated =
          isConnectionSelected ||
          selectedNodeId === connection.sourceId ||
          selectedNodeId === connection.targetId
        const xrayReachable =
          reachableIds.has(connection.sourceId) && reachableIds.has(connection.targetId)
        const isCycleRoute =
          cycleParticipantIds.has(connection.sourceId) &&
          cycleParticipantIds.has(connection.targetId)
        const shouldShowLabel =
          showLabels &&
          (mode === 'Build' || isRelated || !selectedNodeId || (isXray && isCycleRoute))
        const readableLabelPosition = isSelfLoop
          ? { x: loopX + labelSpacing, y: loopY }
          : getReadablePathLabelPosition(
              source,
              target,
              labelWidth,
              labelSpacing,
              nodeRects,
              placedLabelRects,
              width,
              height,
            )
        if (shouldShowLabel) {
          placedLabelRects.push(getLabelRect(readableLabelPosition, labelWidth))
        }

        const displayLabel = getConnectorLabelText(connection.label)
        const sourceColor = TYPE_COLOR[sourceNode?.type] ?? '#4f8ff7'
        const pathLength = Math.hypot(target.x - source.x, target.y - source.y)
        const packetDuration = `${(2.8 + pathLength / 380).toFixed(2)}s`
        const showPacket =
          !noMotion && ((!isXray && isRelated) || (isXray && isRelated && xrayReachable))

        const stroke = isXray
          ? !xrayReachable
            ? 'rgba(239,68,68,0.65)'
            : isCycleRoute
              ? 'rgba(79,143,247,0.8)'
              : 'rgba(16,185,129,0.45)'
          : isRelated
            ? `url(#connector-gradient-${connection.id})`
            : 'rgba(255,255,255,0.08)'

        return (
          <g key={connection.id}>
            {showPaths && (
              <>
                <path
                  className={[
                    'connector-path',
                    isConnectionSelected ? 'connector-path--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-connection-id={connection.id}
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isConnectionSelected ? 2.4 : isRelated ? 1.7 : 1}
                  strokeDasharray={isXray && !xrayReachable ? '5 3' : undefined}
                  markerEnd={
                    isXray
                      ? !xrayReachable
                        ? 'url(#supportflow-arrow-error)'
                        : isCycleRoute
                          ? 'url(#supportflow-arrow-cycle)'
                          : 'url(#supportflow-arrow-xray)'
                      : isRelated
                        ? 'url(#supportflow-arrow-related)'
                        : 'url(#supportflow-arrow)'
                  }
                />

                {showPacket && (
                  <circle r="2.5" fill={sourceColor} className="connector-packet">
                    <animateMotion
                      dur={packetDuration}
                      repeatCount="indefinite"
                      path={path}
                      calcMode="linear"
                    />
                    <animate
                      attributeName="opacity"
                      values="0;0.65;0.65;0"
                      keyTimes="0;0.10;0.88;1"
                      dur={packetDuration}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                <circle className="connector-port" cx={source.x} cy={source.y} r="3" />
              </>
            )}

            {shouldShowLabel && (
              <g
                className={[
                  'connector-label',
                  isConnectionSelected ? 'connector-label--selected' : '',
                  canRewire ? 'connector-label--draggable' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                transform={`translate(${readableLabelPosition.x} ${readableLabelPosition.y})`}
                role="button"
                tabIndex="0"
                aria-pressed={isConnectionSelected}
                aria-label={`${connection.label}, route to node ${connection.targetId}`}
                data-testid={`connector-label-${connection.id}`}
                onPointerDown={(event) => {
                  if (!canRewire) {
                    return
                  }

                  event.preventDefault()
                  event.stopPropagation()
                  onRouteRewireStart(connection, event)
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  onConnectionSelect(connection)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }

                  event.preventDefault()
                  onConnectionSelect(connection)
                }}
              >
                <title>
                  {canRewire
                    ? `${connection.label}: click to edit, drag to change target`
                    : `${connection.label}: route to node ${connection.targetId}`}
                </title>
                <rect
                  className="connector-label__background"
                  x={-labelWidth / 2}
                  y="-10"
                  width={labelWidth}
                  height="20"
                  rx="3"
                />
                <text
                  className="connector-label__text"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {displayLabel}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {showDraft && draftConnection && nodeRects[draftConnection.sourceId] && (
        <g className="connector-draft" data-testid="draft-connection">
          {(() => {
            const sourceRect = nodeRects[draftConnection.sourceId]
            const sourceNode = nodeMap.get(draftConnection.sourceId)
            const sourceOptionCount =
              draftConnection.sourceOptionCount ?? (sourceNode?.options.length ?? 0) + 1
            const sourceOptionIndex = draftConnection.optionIndex ?? sourceOptionCount - 1
            const source = getBoundaryAnchor(
              sourceRect,
              sourceOptionIndex,
              sourceOptionCount,
              'bottom',
            )
            const targetRect = draftConnection.targetId ? nodeRects[draftConnection.targetId] : null
            const target = targetRect
              ? getBoundaryAnchor(targetRect, 0, 1, 'top')
              : draftConnection.point

            if (!target) {
              return null
            }

            return (
              <>
                <path
                  d={createBezierPath(source, target)}
                  fill="none"
                  stroke="rgba(79,143,247,0.78)"
                  strokeWidth="1.7"
                  strokeDasharray="6 4"
                  markerEnd="url(#supportflow-arrow-draft)"
                />
                <circle cx={source.x} cy={source.y} r="4" fill="#06060a" stroke="#4f8ff7" />
                <circle cx={target.x} cy={target.y} r="4" fill="#06060a" stroke="#4f8ff7" />
              </>
            )
          })()}
        </g>
      )}
    </svg>
  )
}
