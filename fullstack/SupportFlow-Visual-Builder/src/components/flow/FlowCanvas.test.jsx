import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import flowData from '../../../flow_data.json'
import FlowCanvas from './FlowCanvas.jsx'

describe('FlowCanvas', () => {
  it('renders every node from the supplied flow data', () => {
    render(<FlowCanvas flow={flowData} />)

    expect(screen.getAllByTestId(/^flow-node-/)).toHaveLength(6)
  })

  it('uses the canvas dimensions supplied by the flow metadata', () => {
    render(<FlowCanvas flow={flowData} />)

    const canvas = screen.getByTestId('flow-canvas')

    expect(canvas).toHaveStyle({
      width: '1200px',
      height: '800px',
    })
  })

  it('preserves the supplied node coordinates', () => {
    render(<FlowCanvas flow={flowData} />)

    expect(screen.getByTestId('flow-node-1')).toHaveStyle({
      left: '500px',
      top: '50px',
    })

    expect(screen.getByTestId('flow-node-4')).toHaveStyle({
      left: '100px',
      top: '500px',
    })

    expect(screen.getByTestId('flow-node-6')).toHaveStyle({
      left: '750px',
      top: '500px',
    })
  })

  it('keeps editable route labels layered above node cards', () => {
    render(<FlowCanvas flow={flowData} />)

    const canvas = screen.getByTestId('flow-canvas')
    const pathLayer = canvas.querySelector('.connector-layer--paths:not(.connector-layer--labels)')
    const labelLayer = canvas.querySelector('.connector-layer--labels:not(.connector-layer--paths)')
    const firstNode = screen.getByTestId('flow-node-1')
    const canvasChildren = [...canvas.children]

    expect(pathLayer).toBeInTheDocument()
    expect(labelLayer).toBeInTheDocument()
    expect(canvasChildren.indexOf(pathLayer)).toBeLessThan(canvasChildren.indexOf(firstNode))
    expect(canvasChildren.indexOf(labelLayer)).toBeGreaterThan(canvasChildren.indexOf(firstNode))
  })

  it('keeps route labels visible when another node is selected', () => {
    render(<FlowCanvas flow={flowData} selectedNodeId="2" />)

    expect(screen.getByRole('button', { name: 'Personal, route to node 6' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Business, route to node 6' })).toBeInTheDocument()
  })

  it('keeps imported node ids compact in card headers', () => {
    const importedFlow = {
      meta: { canvas_size: { w: 900, h: 600 } },
      nodes: [
        {
          id: 'q-billing',
          type: 'question',
          text: 'Is this for a personal or business account?',
          position: { x: 120, y: 120 },
          options: [],
        },
      ],
    }

    render(<FlowCanvas flow={importedFlow} />)

    expect(screen.getByText('q-billing')).toBeInTheDocument()
    expect(screen.queryByText('node_q-billing')).not.toBeInTheDocument()
  })

  it('marks node cards as draggable in Build mode without showing a move button', () => {
    const { rerender } = render(<FlowCanvas flow={flowData} />)

    expect(screen.getByTestId('flow-node-2')).toHaveClass('flow-node--movable')
    expect(screen.getByTestId('node-move-header-2')).toHaveClass('flow-node__header--movable')
    expect(screen.queryByRole('button', { name: 'Move node 2' })).not.toBeInTheDocument()

    rerender(<FlowCanvas flow={flowData} mode="X-Ray" />)

    expect(screen.getByTestId('flow-node-2')).not.toHaveClass('flow-node--movable')
    expect(screen.getByTestId('node-move-header-2')).not.toHaveClass('flow-node__header--movable')
  })

  it('keeps the user zoom level when flow nodes update without a view reset', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<FlowCanvas flow={flowData} viewResetKey={0} />)

    rerender(<FlowCanvas flow={flowData} viewResetKey={1} />)
    await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByText('70%')).toBeInTheDocument()

    const editedFlow = {
      ...flowData,
      nodes: flowData.nodes.map((node) =>
        node.id === '2'
          ? {
              ...node,
              text: 'Has the router been restarted?',
            }
          : node,
      ),
    }

    rerender(<FlowCanvas flow={editedFlow} selectedNodeId="2" viewResetKey={1} />)
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('rewires a captured touch using release coordinates, even without a move event', () => {
    const onRouteReconnect = vi.fn()
    const rectSpy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function () {
        const node = flowData.nodes.find(
          (entry) => entry.id === this.getAttribute('data-flow-node-id'),
        )
        const x = node?.position.x ?? 0
        const y = node?.position.y ?? 0
        return { x, y, left: x, top: y, right: x + 196, bottom: y + 96, width: 196, height: 96 }
      })
    const pointer = (element, type, x, y, pointerId = 7) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      })
      Object.defineProperties(event, {
        pointerId: { value: pointerId },
        pointerType: { value: 'touch' },
      })
      fireEvent(element, event)
    }

    try {
      render(<FlowCanvas flow={flowData} onRouteReconnect={onRouteReconnect} />)
      const label = screen.getByRole('button', { name: 'Personal, route to node 6' })
      pointer(label, 'pointerdown', 820, 420)
      // Touch capture keeps event.target on the label, not the card underneath.
      pointer(label, 'pointerup', 150, 540, 8)
      expect(onRouteReconnect).not.toHaveBeenCalled()
      expect(screen.getByTestId('draft-connection')).toBeInTheDocument()
      pointer(label, 'pointerup', 150, 540)
      expect(onRouteReconnect).toHaveBeenCalledWith('3', 0, '4')
      expect(screen.queryByTestId('draft-connection')).not.toBeInTheDocument()
    } finally {
      rectSpy.mockRestore()
    }
  })

  it('cancels a touch route drag without changing the route', () => {
    const onRouteReconnect = vi.fn()
    render(<FlowCanvas flow={flowData} onRouteReconnect={onRouteReconnect} />)
    const label = screen.getByRole('button', { name: 'Personal, route to node 6' })
    fireEvent.pointerDown(label, { isPrimary: true })
    expect(screen.getByTestId('draft-connection')).toBeInTheDocument()
    fireEvent.pointerCancel(label)
    expect(screen.queryByTestId('draft-connection')).not.toBeInTheDocument()
    fireEvent.pointerUp(screen.getByTestId('flow-node-4'))
    expect(onRouteReconnect).not.toHaveBeenCalled()
  })

  it('fits the canvas on first load on phone-sized screens', async () => {
    const originalMatchMedia = window.matchMedia

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(max-width: 720px)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    try {
      render(<FlowCanvas flow={flowData} selectedNodeId="2" />)

      await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument())
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
    }
  })
})
