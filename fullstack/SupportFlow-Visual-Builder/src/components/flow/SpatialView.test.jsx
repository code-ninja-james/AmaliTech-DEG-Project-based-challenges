import { render, screen } from '@testing-library/react'
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
})
