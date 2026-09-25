import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import SpatialView from './SpatialView.jsx'

describe('SpatialView', () => {
  it('renders imported workflows with custom node ids', () => {
    const importedFlow = {
      meta: { canvas_size: { w: 1200, h: 800 } },
      nodes: [
        {
          id: 'start-node',
          type: 'start',
          text: 'Start import',
          position: { x: 500, y: 72 },
          options: [{ label: 'Billing', nextId: 'billing-node' }],
        },
        {
          id: 'billing-node',
          type: 'question',
          text: 'Collect invoice number',
          position: { x: 500, y: 262 },
          options: [{ label: 'Done', nextId: 'done-node' }],
        },
        {
          id: 'done-node',
          type: 'end',
          text: 'Close ticket',
          position: { x: 500, y: 452 },
          options: [],
        },
      ],
    }

    render(<SpatialView flow={importedFlow} selectedNodeId="start-node" onNodeSelect={() => {}} />)

    expect(screen.getByLabelText('Spatial topology')).toBeInTheDocument()
    expect(screen.getByText('Start import')).toBeInTheDocument()
    expect(screen.getByText('Collect invoice number')).toBeInTheDocument()
    expect(screen.getByText('Close ticket')).toBeInTheDocument()
  })

  it('zooms spatial content while keeping a mobile scroll surface for panning', () => {
    const flow = {
      meta: { canvas_size: { w: 1200, h: 800 } },
      nodes: [
        {
          id: 1,
          type: 'start',
          text: 'Start',
          position: { x: 0, y: 0 },
          options: [{ label: 'Next', nextId: 2 }],
        },
        {
          id: 2,
          type: 'end',
          text: 'Done',
          position: { x: 0, y: 0 },
          options: [],
        },
      ],
    }

    const { container } = render(
      <SpatialView flow={flow} selectedNodeId={1} onNodeSelect={() => {}} />,
    )
    const spatialView = screen.getByLabelText('Spatial topology')
    const svg = container.querySelector('.spatial-view__svg')
    const backgroundPlane = container.querySelector('.spatial-view__background-plane')
    const initialViewBox = svg.getAttribute('viewBox')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in spatial view' }))

    const [viewX, viewY, viewWidth, viewHeight] = svg.getAttribute('viewBox').split(' ').map(Number)

    expect(spatialView).toHaveStyle({ '--spatial-mobile-size': '108%' })
    expect(svg).not.toHaveAttribute('viewBox', initialViewBox)
    expect(Number(backgroundPlane.getAttribute('x'))).toBeCloseTo(viewX)
    expect(Number(backgroundPlane.getAttribute('y'))).toBeCloseTo(viewY)
    expect(Number(backgroundPlane.getAttribute('width'))).toBeCloseTo(viewWidth)
    expect(Number(backgroundPlane.getAttribute('height'))).toBeCloseTo(viewHeight)
  })
})
