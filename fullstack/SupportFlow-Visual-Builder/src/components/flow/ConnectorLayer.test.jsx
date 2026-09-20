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

function getLabelBounds(label) {
  const labelGroup = screen.getByRole('button', { name: label })
  const position = parseTranslate(labelGroup.getAttribute('transform'))
  const background = labelGroup.querySelector('.connector-label__background')

  return {
    x: position.x + Number(background.getAttribute('x')),
    y: position.y + Number(background.getAttribute('y')),
    width: Number(background.getAttribute('width')),
    height: Number(background.getAttribute('height')),
  }
}

function overlaps(left, right, gap = 0) {
  return !(
    left.x + left.width < right.x - gap ||
    left.x > right.x + right.width + gap ||
    left.y + left.height < right.y - gap ||
    left.y > right.y + right.height + gap
  )
}

function renderDemo(scenario, selectedNodeId = '2') {
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
      selectedNodeId={selectedNodeId}
      mode="X-Ray"
      reachableIds={analysis.reachable}
      cycleParticipantIds={analysis.cycleParticipants}
    />,
  )
}

describe('diagnostic connectors', () => {
  it('shows a dangling route when its target is missing', () => {
    renderDemo('broken-reference')
    expect(screen.getByText('Missing target')).toBeInTheDocument()
  })

  it('keeps selected unreachable routes red', () => {
    const { container } = renderDemo('unreachable-branch')
    const edge = container.querySelector('[data-connection-id="2-0-4"]')
    expect(edge).toHaveAttribute('stroke', 'rgba(239,68,68,0.65)')
    expect(edge).toHaveAttribute('marker-end', 'url(#supportflow-arrow-error)')
    expect(edge).toHaveAttribute('stroke-dasharray', '5 3')
  })

  it('draws the cycle outside its node card and labels it without needing selection', () => {
    const { container } = renderDemo('cycle')
    const edge = container.querySelector('[data-connection-id="2-2-2"]')
    expect(edge).toHaveAttribute('stroke', 'rgba(79,143,247,0.8)')
    expect(
      screen.getByRole('button', { name: 'X-Ray loop back, route to node 2' }),
    ).toBeInTheDocument()
  })

  it('marks the selected connector path and label for stronger visual focus', () => {
    const { container } = render(
      <ConnectorLayer
        connections={[
          {
            id: '1-0-2',
            sourceId: '1',
            targetId: '2',
            optionIndex: 0,
            sourceOptionCount: 1,
            label: 'Billing',
          },
        ]}
        nodes={[
          { id: '1', type: 'start', options: [], position: { x: 120, y: 100 } },
          { id: '2', type: 'question', options: [], position: { x: 520, y: 260 } },
        ]}
        nodeRects={{
          1: { x: 120, y: 100, width: 196, height: 100 },
          2: { x: 520, y: 260, width: 196, height: 100 },
        }}
        width={900}
        height={600}
        selectedConnectionId="1-0-2"
      />,
    )

    const edge = container.querySelector('[data-connection-id="1-0-2"]')
    expect(edge).toHaveClass('connector-path--selected')
    expect(edge).toHaveAttribute('stroke-width', '2.4')
    expect(screen.getByRole('button', { name: 'Billing, route to node 2' })).toHaveClass(
      'connector-label--selected',
    )
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

  it('separates route labels that share the same source and target', () => {
    render(
      <ConnectorLayer
        connections={[
          {
            id: '3-0-6',
            sourceId: '3',
            targetId: '6',
            optionIndex: 0,
            sourceOptionCount: 2,
            label: 'Personal',
          },
          {
            id: '3-1-6',
            sourceId: '3',
            targetId: '6',
            optionIndex: 1,
            sourceOptionCount: 2,
            label: 'Business',
          },
        ]}
        nodes={[
          { id: '3', type: 'question', options: [], position: { x: 180, y: 50 } },
          { id: '6', type: 'end', options: [], position: { x: 180, y: 550 } },
        ]}
        nodeRects={{
          3: { x: 180, y: 50, width: 196, height: 100 },
          6: { x: 180, y: 550, width: 180, height: 100 },
        }}
        width={700}
        height={760}
      />,
    )

    const personalBounds = getLabelBounds('Personal, route to node 6')
    const businessBounds = getLabelBounds('Business, route to node 6')

    expect(overlaps(personalBounds, businessBounds, 8)).toBe(false)
  })
})
