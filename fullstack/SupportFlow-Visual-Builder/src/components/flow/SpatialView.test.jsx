import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SpatialView from './SpatialView.jsx'

describe('SpatialView', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

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

  it('zooms mobile spatial content without cropping the scene viewBox', async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === '(max-width: 720px)',
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }))

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

    await waitFor(() => expect(spatialView).toHaveStyle({ '--spatial-mobile-size': '100%' }))

    const initialViewBox = svg.getAttribute('viewBox')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in spatial view' }))

    await waitFor(() => expect(spatialView).toHaveStyle({ '--spatial-mobile-size': '110%' }))

    expect(svg).toHaveAttribute('viewBox', initialViewBox)
    expect(svg).toHaveAttribute('viewBox', '0 0 1100 640')
    expect(backgroundPlane).toHaveAttribute('x', '0')
    expect(backgroundPlane).toHaveAttribute('y', '0')
    expect(backgroundPlane).toHaveAttribute('width', '1100')
    expect(backgroundPlane).toHaveAttribute('height', '640')
  })
})
