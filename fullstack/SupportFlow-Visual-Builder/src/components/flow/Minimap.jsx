/**
 * Renders a compact overview of the complete SupportFlow graph.
 *
 * The minimap uses the same authoritative x/y coordinates as the main canvas
 * but intentionally simplifies node and connector rendering. This gives users
 * spatial orientation without introducing a second graph-layout system.
 */

import { useMemo, useState } from 'react'

import getConnections from '../../domain/getConnections.js'

const NODE_DIMENSIONS = {
  start: { width: 196, height: 88 },
  question: { width: 196, height: 88 },
  end: { width: 180, height: 64 },
}

function getNodeDimensions(node) {
  return NODE_DIMENSIONS[node.type] ?? { width: 180, height: 80 }
}

export default function Minimap({ flow, selectedNodeId }) {
  const [isOpen, setIsOpen] = useState(true)

  const connections = useMemo(
    () => getConnections(flow.nodes),
    [flow.nodes],
  )

  const nodeMap = useMemo(
    () => new Map(flow.nodes.map((node) => [node.id, node])),
    [flow.nodes],
  )

  if (!isOpen) {
    return (
      <button
        className="minimap-toggle"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Map
      </button>
    )
  }

  return (
    <aside className="minimap" aria-label="Flow minimap">
      <header className="minimap__header">
        <span>Minimap</span>
        <button
          type="button"
          aria-label="Close minimap"
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
      </header>

      <svg
        className="minimap__graph"
        viewBox={`0 0 ${flow.meta.canvas_size.w} ${flow.meta.canvas_size.h}`}
        role="img"
        aria-label="Overview of SupportFlow nodes"
      >
        {connections.map((connection) => {
          const sourceNode = nodeMap.get(connection.sourceId)
          const targetNode = nodeMap.get(connection.targetId)

          if (!sourceNode || !targetNode) {
            return null
          }

          const sourceSize = getNodeDimensions(sourceNode)
          const targetSize = getNodeDimensions(targetNode)
          const sourceX =
            sourceNode.position.x +
            sourceSize.width *
              ((connection.optionIndex + 1) /
                (connection.sourceOptionCount + 1))
          const sourceY = sourceNode.position.y + sourceSize.height
          const targetX = targetNode.position.x + targetSize.width / 2
          const targetY = targetNode.position.y

          return (
            <line
              className="minimap__connection"
              key={connection.id}
              x1={sourceX}
              y1={sourceY}
              x2={targetX}
              y2={targetY}
            />
          )
        })}

        {flow.nodes.map((node) => {
          const { width, height } = getNodeDimensions(node)
          const isSelected = node.id === selectedNodeId

          return (
            <rect
              className={[
                'minimap__node',
                `minimap__node--${node.type}`,
                isSelected ? 'minimap__node--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={node.id}
              x={node.position.x}
              y={node.position.y}
              width={width}
              height={height}
              rx="4"
            />
          )
        })}
      </svg>
    </aside>
  )
}
