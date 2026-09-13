/**
 * Renders the SupportFlow decision tree inside the fixed canvas defined by
 * flow_data.json.
 *
 * The canvas dimensions and node coordinates come directly from the challenge
 * data so the visual graph stays deterministic and can share the same
 * coordinate system with the custom SVG connector layer.
 */

import FlowNode from './FlowNode.jsx'

export default function FlowCanvas({ flow }) {
  const { canvas_size: canvasSize } = flow.meta

  return (
    <section className="flow-workspace" aria-label="Support flow">
      <div
        className="flow-canvas"
        data-testid="flow-canvas"
        style={{
          // The supplied canvas dimensions are authoritative challenge data.
          width: `${canvasSize.w}px`,
          height: `${canvasSize.h}px`,
        }}
      >
        {flow.nodes.map((node) => (
          <FlowNode key={node.id} node={node} />
        ))}
      </div>
    </section>
  )
}
