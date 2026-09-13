/**
 * Renders the SupportFlow decision tree inside the fixed canvas defined by
 * flow_data.json.
 *
 * Nodes retain the exact challenge coordinates, while a pinned minimap provides
 * spatial orientation independently from the scrollable canvas viewport.
 */

import { useMemo } from 'react'

import getConnections from '../../domain/getConnections.js'
import useNodeMeasurements from '../../hooks/useNodeMeasurements.js'
import '../../styles/minimap.css'
import ConnectorLayer from './ConnectorLayer.jsx'
import FlowNode from './FlowNode.jsx'
import Minimap from './Minimap.jsx'

export default function FlowCanvas({
  flow,
  selectedNodeId = null,
  onNodeSelect = () => {},
}) {
  const { canvas_size: canvasSize } = flow.meta

  const connections = useMemo(
    () => getConnections(flow.nodes),
    [flow.nodes],
  )

  const { canvasRef, nodeRects, registerNode } =
    useNodeMeasurements(flow.nodes)

  return (
    <section className="flow-workspace" aria-label="Support flow">
      <div className="flow-scroll-area">
        <div
          ref={canvasRef}
          className="flow-canvas"
          data-testid="flow-canvas"
          style={{
            // Challenge dimensions remain the authoritative coordinate space.
            width: `${canvasSize.w}px`,
            height: `${canvasSize.h}px`,
          }}
        >
          <ConnectorLayer
            connections={connections}
            nodeRects={nodeRects}
            width={canvasSize.w}
            height={canvasSize.h}
          />

          {flow.nodes.map((node) => (
            <FlowNode
              key={node.id}
              node={node}
              nodeRef={(element) => registerNode(node.id, element)}
              isSelected={node.id === selectedNodeId}
              onSelect={onNodeSelect}
            />
          ))}
        </div>
      </div>

      <Minimap flow={flow} selectedNodeId={selectedNodeId} />
    </section>
  )
}
