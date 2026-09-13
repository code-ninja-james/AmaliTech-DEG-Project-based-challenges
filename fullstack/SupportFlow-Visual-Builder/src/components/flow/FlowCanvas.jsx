/**
 * Renders the SupportFlow decision tree inside the fixed canvas defined by
 * flow_data.json.
 *
 * Nodes use the exact challenge coordinates. Their rendered DOM boundaries are
 * then measured and passed to the custom SVG connector layer, giving nodes and
 * paths one deterministic coordinate system without using a graph library.
 */

import { useMemo } from 'react'

import getConnections from '../../domain/getConnections.js'
import useNodeMeasurements from '../../hooks/useNodeMeasurements.js'
import ConnectorLayer from './ConnectorLayer.jsx'
import FlowNode from './FlowNode.jsx'

export default function FlowCanvas({ flow }) {
  const { canvas_size: canvasSize } = flow.meta

  const connections = useMemo(() => getConnections(flow.nodes), [flow.nodes])

  const { canvasRef, nodeRects, registerNode } = useNodeMeasurements(flow.nodes)

  return (
    <section className="flow-workspace" aria-label="Support flow">
      <div
        ref={canvasRef}
        className="flow-canvas"
        data-testid="flow-canvas"
        style={{
          // Canvas dimensions remain authoritative challenge data.
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
          />
        ))}
      </div>
    </section>
  )
}
