import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import flowData from '../../../flow_data.json'
import analyzeFlow from '../../domain/analyzeFlow.js'
import getConnections from '../../domain/getConnections.js'
import createXrayDemo from '../../domain/xrayDemo.js'
import ConnectorLayer from './ConnectorLayer.jsx'

function renderDemo(scenario) {
  const flow = createXrayDemo(flowData, scenario)
  const analysis = analyzeFlow(flow.nodes)
  const nodeRects = Object.fromEntries(
    flow.nodes.map((node) => [node.id, { ...node.position, width: 196, height: 100 }]),
  )

  return render(
    <ConnectorLayer
      connections={getConnections(flow.nodes)}
      nodes={flow.nodes}
      nodeRects={nodeRects}
      width={1200}
      height={800}
      selectedNodeId="3"
      mode="X-Ray"
      reachableIds={analysis.reachable}
      cycleParticipantIds={analysis.cycleParticipants}
    />,
  )
}

describe('diagnostic connectors', () => {
  it('shows a dangling route when its target is missing', () => {
    renderDemo('broken-reference')
    expect(screen.getByTestId('broken-connection-3-1-missing-billing')).toHaveTextContent(
      'Missing target',
    )
  })

  it('keeps selected unreachable routes red', () => {
    const { container } = renderDemo('unreachable-branch')
    const edge = container.querySelector('[data-connection-id="3-0-6"]')
    expect(edge).toHaveAttribute('stroke', 'rgba(239,68,68,0.65)')
    expect(edge).toHaveAttribute('marker-end', 'url(#supportflow-arrow-error)')
    expect(edge).toHaveAttribute('stroke-dasharray', '5 3')
  })

  it('draws the cycle outside its node card and labels it without needing selection', () => {
    const { container } = renderDemo('cycle')
    const edge = container.querySelector('[data-connection-id="3-2-3"]')
    expect(edge).toHaveAttribute('stroke', 'rgba(79,143,247,0.8)')
    // Node #3 ends at x=946; the loop and label must remain outside it.
    expect(edge.getAttribute('d')).toContain('1022')
    expect(
      screen.getByRole('button', { name: 'Check account again, route to node 3' }),
    ).toHaveAttribute('transform', 'translate(1022 300)')
  })
})
