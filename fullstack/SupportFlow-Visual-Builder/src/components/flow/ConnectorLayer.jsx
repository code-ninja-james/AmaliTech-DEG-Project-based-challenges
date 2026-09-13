/**
 * Draws the directed relationships between SupportFlow nodes using native SVG.
 *
 * The component receives measured DOM rectangles rather than owning layout
 * logic itself. Each route gets its own source port, and incoming routes are
 * distributed across the target boundary so parallel connections remain
 * visually distinguishable.
 */

import { createBezierPath, getBezierPoint } from '../../domain/createBezierPath.js'

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
  // A lightweight text estimate avoids DOM measurement for decorative labels.
  // The cap prevents long option text from dominating the graph.
  return Math.min(170, Math.max(72, label.length * 6.2 + 18))
}

export default function ConnectorLayer({ connections, nodeRects, width, height }) {
  const incomingPositions = getIncomingPositions(connections)

  return (
    <svg
      className="connector-layer"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
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
          <path className="connector-arrow" d="M 0 0 L 7 3.5 L 0 7 Z" />
        </marker>
      </defs>

      {connections.map((connection) => {
        const sourceRect = nodeRects[connection.sourceId]
        const targetRect = nodeRects[connection.targetId]

        // Broken nextId references are intentionally ignored by the renderer.
        // Flow Health will surface them as validation issues instead of
        // allowing malformed data to crash the entire visual editor.
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

        return (
          <g key={connection.id}>
            <path
              className="connector-path"
              data-connection-id={connection.id}
              d={path}
              markerEnd="url(#supportflow-arrow)"
            />

            <circle className="connector-port" cx={source.x} cy={source.y} r="3" />

            <g
              className="connector-label"
              transform={`translate(${labelPosition.x} ${labelPosition.y})`}
            >
              <rect
                className="connector-label__background"
                x={-labelWidth / 2}
                y="-10"
                width={labelWidth}
                height="20"
                rx="3"
              />

              <text className="connector-label__text" textAnchor="middle" dominantBaseline="middle">
                {connection.label}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}
