import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import flowData from '../../../flow_data.json'
import analyzeFlow from '../../domain/analyzeFlow.js'
import { getBezierPoint } from '../../domain/createBezierPath.js'
import getConnections from '../../domain/getConnections.js'
import createXrayDemo from '../../domain/xrayDemo.js'
import ConnectorLayer from './ConnectorLayer.jsx'

function parseTranslate(transform) {
  const match = transform.match(/translate\(([-\d.]+) ([-\d.]+)\)/)

  return {
    x: Number(match?.[1] ?? 0),
    y: Number(match?.[2] ?? 0),
  }
}

function getDistance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

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

  it('keeps labels attached to the connector curve when avoiding node cards', () => {
    const sourceRect = { x: 100, y: 60, width: 196, height: 100 }
    const targetRect = { x: 700, y: 420, width: 196, height: 100 }
    const source = { x: 198, y: 160 }
    const target = { x: 798, y: 420 }
    const defaultLabelPoint = getBezierPoint(source, target, 0.46)

    render(
      <ConnectorLayer
        connections={[
          {
            id: '1-0-2',
            sourceId: '1',
            targetId: '2',
            optionIndex: 0,
            sourceOptionCount: 1,
            label: 'Blocked midpoint',
          },
        ]}
        nodes={[
          { id: '1', type: 'start', options: [], position: sourceRect },
          { id: '2', type: 'question', options: [], position: targetRect },
          { id: '3', type: 'question', options: [], position: defaultLabelPoint },
        ]}
        nodeRects={{
          1: sourceRect,
          2: targetRect,
          3: {
            x: defaultLabelPoint.x - 54,
            y: defaultLabelPoint.y - 26,
            width: 108,
            height: 52,
          },
        }}
        width={1000}
        height={700}
      />,
    )

    const labelPosition = parseTranslate(
      screen
        .getByRole('button', { name: 'Blocked midpoint, route to node 2' })
        .getAttribute('transform'),
    )
    const nearestCurveDistance = Array.from({ length: 71 }, (_, index) =>
      getDistance(labelPosition, getBezierPoint(source, target, 0.15 + index * 0.01)),
    ).reduce((nearest, distance) => Math.min(nearest, distance), Infinity)

    expect(nearestCurveDistance).toBeLessThan(3)
  })
})
