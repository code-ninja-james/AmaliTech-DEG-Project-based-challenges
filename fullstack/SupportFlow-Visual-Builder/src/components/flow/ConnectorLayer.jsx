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

function getBoundaryAnchor(rect, index, count, edge) {
  const horizontalRatio = (index + 1) / (count + 1)

  return {
    x: rect.x + rect.width * horizontalRatio,
    y: edge === 'bottom' ? rect.y + rect.height : rect.y,
  }
}

function getLabelWidth(label) {
  return Math.min(170, Math.max(72, label.length * 6.2 + 18))
}

export default function ConnectorLayer({
  connections,
  nodeRects,
  nodes = [],
  width,
  height,
  selectedNodeId = null,
  mode = 'Build',
  reachableIds = new Set(),
}) {
  const incomingPositions = getIncomingPositions(connections)
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const isXray = mode === 'X-Ray'
  const noMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <svg
      className="connector-layer"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <defs>
        <marker id="supportflow-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="rgba(255,255,255,0.14)" />
        </marker>
        <marker id="supportflow-arrow-related" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="rgba(79,143,247,0.80)" />
        </marker>
        <marker id="supportflow-arrow-xray" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="rgba(16,185,129,0.48)" />
        </marker>

        {connections.map((connection) => {
          const sourceNode = nodeMap.get(connection.sourceId)
          const targetNode = nodeMap.get(connection.targetId)
          const sourceRect = nodeRects[connection.sourceId]
          const targetRect = nodeRects[connection.targetId]

          if (!sourceNode || !targetNode || !sourceRect || !targetRect) {
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
              <stop offset="0%" stopColor={TYPE_COLOR[sourceNode.type] ?? '#4f8ff7'} stopOpacity="0.55" />
              <stop offset="100%" stopColor={TYPE_COLOR[targetNode.type] ?? '#4f8ff7'} stopOpacity="0.35" />
            </linearGradient>
          )
        })}
      </defs>

      {connections.map((connection) => {
        const sourceRect = nodeRects[connection.sourceId]
        const targetRect = nodeRects[connection.targetId]
        const sourceNode = nodeMap.get(connection.sourceId)
        const targetNode = nodeMap.get(connection.targetId)

        if (!sourceRect || !targetRect) {
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

        const path = createBezierPath(source, target)
        const labelPosition = getBezierPoint(source, target, 0.46)
        const labelWidth = getLabelWidth(connection.label)
        const isRelated =
          selectedNodeId === connection.sourceId ||
          selectedNodeId === connection.targetId
        const xrayReachable =
          reachableIds.has(connection.sourceId) &&
          reachableIds.has(connection.targetId)
        const sourceColor = TYPE_COLOR[sourceNode?.type] ?? '#4f8ff7'
        const pathLength = Math.hypot(target.x - source.x, target.y - source.y)
        const packetDuration = `${(2.8 + pathLength / 380).toFixed(2)}s`
        const showPacket =
          !noMotion &&
          ((!isXray && isRelated) || (isXray && isRelated && xrayReachable))

        const stroke = isRelated
          ? `url(#connector-gradient-${connection.id})`
          : isXray
            ? xrayReachable
              ? 'rgba(16,185,129,0.22)'
              : 'rgba(239,68,68,0.35)'
            : 'rgba(255,255,255,0.08)'

        return (
          <g key={connection.id}>
            <path
              className="connector-path"
              data-connection-id={connection.id}
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={isRelated ? 1.7 : 1}
              strokeDasharray={isXray && !xrayReachable ? '5 3' : undefined}
              markerEnd={
                isRelated
                  ? 'url(#supportflow-arrow-related)'
                  : isXray
                    ? 'url(#supportflow-arrow-xray)'
                    : 'url(#supportflow-arrow)'
              }
            />

            {showPacket && (
              <circle r="2.5" fill={sourceColor} className="connector-packet">
                <animateMotion dur={packetDuration} repeatCount="indefinite" path={path} calcMode="linear" />
                <animate attributeName="opacity" values="0;0.65;0.65;0" keyTimes="0;0.10;0.88;1" dur={packetDuration} repeatCount="indefinite" />
              </circle>
            )}

            <circle className="connector-port" cx={source.x} cy={source.y} r="3" />

            {(isRelated || !selectedNodeId) && (
              <g className="connector-label" transform={`translate(${labelPosition.x} ${labelPosition.y})`}>
                <rect
                  className="connector-label__background"
                  x={-labelWidth / 2}
                  y="-10"
                  width={labelWidth}
                  height="20"
                  rx="3"
                />
                <text className="connector-label__text" textAnchor="middle" dominantBaseline="middle">
                  {connection.label.length > 26
                    ? `${connection.label.slice(0, 25)}…`
                    : connection.label}
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
