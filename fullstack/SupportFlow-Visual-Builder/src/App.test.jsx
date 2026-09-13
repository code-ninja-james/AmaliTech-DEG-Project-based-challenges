/**
 * Covers the primary SupportFlow Studio behaviours that cross components.
 *
 * These tests protect node editing, navigation, Build/X-Ray/Spatial switching
 * and the chat preview while allowing the product shell to evolve visually.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App.jsx'

describe('SupportFlow application', () => {
  it('renders the product identity', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: 'SupportFlow Studio',
      }),
    ).toBeInTheDocument()
  })

  it('opens the inspector when a node is selected', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-2'))

    const inspector = screen.getByLabelText('Node inspector')

    expect(within(inspector).getByText('#2')).toBeInTheDocument()
    expect(screen.getByLabelText('Question Text')).toHaveValue(
      'Have you tried restarting your router?',
    )
    expect(screen.getByTestId('flow-node-2')).toHaveClass(
      'flow-node--selected',
    )
  })

  it('updates node text on the canvas as the inspector value changes', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-2'))

    const questionText = screen.getByLabelText('Question Text')

    await user.clear(questionText)
    await user.type(questionText, 'Is your router still offline?')

    expect(
      within(screen.getByTestId('flow-node-2')).getByText(
        'Is your router still offline?',
      ),
    ).toBeInTheDocument()
  })

  it('switches from the graph to the Make-style preview and back', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(
      screen.getByRole('button', {
        name: 'Play preview',
      }),
    )

    expect(
      screen.getByRole('region', {
        name: 'Flow preview',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('flow-canvas')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Node inspector')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'Back to editor',
      }),
    )

    expect(screen.getByTestId('flow-canvas')).toBeInTheDocument()
  })

  it('opens X-Ray and reports the supplied challenge flow as healthy', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(
      screen.getByRole('button', {
        name: /Flow Health/,
      }),
    )

    expect(screen.getByLabelText('Flow health')).toBeInTheDocument()
    expect(screen.getByText('No structural issues detected')).toBeInTheDocument()
    expect(screen.getByText(/X-RAY · 6\/6 reachable/)).toBeInTheDocument()
  })

  it('renders the Spatial topology mode', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(
      screen.getByRole('button', {
        name: 'Spatial',
      }),
    )

    expect(screen.getByLabelText('Spatial topology')).toBeInTheDocument()
    expect(screen.getByLabelText('Node inspector')).toBeInTheDocument()
  })

  it('selects a node from the navigator and updates the inspector', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('navigator-node-3'))

    const inspector = screen.getByLabelText('Node inspector')

    expect(within(inspector).getByText('#3')).toBeInTheDocument()
    expect(screen.getByTestId('flow-node-3')).toHaveClass(
      'flow-node--selected',
    )
  })
})
