import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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

  it('only exposes node move handles in Build mode', () => {
    const { rerender } = render(<FlowCanvas flow={flowData} />)

    expect(screen.getByRole('button', { name: 'Move node 2' })).toBeInTheDocument()

    rerender(<FlowCanvas flow={flowData} mode="X-Ray" />)

    expect(screen.queryByRole('button', { name: 'Move node 2' })).not.toBeInTheDocument()
  })
})
