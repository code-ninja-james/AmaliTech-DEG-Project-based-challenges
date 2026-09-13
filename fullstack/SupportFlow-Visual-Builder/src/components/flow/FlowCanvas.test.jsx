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
})
