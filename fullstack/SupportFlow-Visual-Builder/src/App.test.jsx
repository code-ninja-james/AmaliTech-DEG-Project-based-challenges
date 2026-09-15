/**
 * Covers the primary SupportFlow Studio behaviours that cross components.
 *
 * These tests protect node editing, navigation, Build/X-Ray/Spatial switching
 * and the chat preview while allowing the product shell to evolve visually.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App.jsx'

describe('SupportFlow application', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

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
    expect(screen.getByTestId('flow-node-2')).toHaveClass('flow-node--selected')
  })

  it('updates node text on the canvas as the inspector value changes', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-2'))

    const questionText = screen.getByLabelText('Question Text')

    await user.clear(questionText)
    await user.type(questionText, 'Is your router still offline?')

    expect(
      within(screen.getByTestId('flow-node-2')).getByText('Is your router still offline?'),
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
    expect(screen.getByTestId('flow-node-3')).toHaveClass('flow-node--selected')
  })

  it('preserves interactive route selection across normal mode switches', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByTestId('flow-node-3'))
    await user.click(screen.getByRole('button', { name: 'Personal, route to node 6' }))
    await user.click(screen.getByRole('button', { name: 'Spatial', exact: true }))
    await user.click(screen.getByRole('button', { name: 'Build', exact: true }))
    expect(screen.getByRole('button', { name: 'Personal, route to node 6' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches diagnostic scenarios without accumulating faults or changing the six nodes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Flow Health/ }))
    const scenario = screen.getByRole('combobox', { name: 'Diagnostic demo' })

    await user.selectOptions(scenario, 'broken-reference')
    expect(
      screen.getByText('Route "Business" from node #3 points to missing node #missing-billing.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('flow-node-3')).toHaveClass('flow-node--xray-broken')
    expect(screen.getByTestId('broken-connection-3-1-missing-billing')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^flow-node-/)).toHaveLength(6)
    expect(screen.getByText(/DEMO · X-RAY · 6\/6 reachable/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Select node #3' }))
    expect(screen.getByTestId('flow-node-3')).toHaveClass('flow-node--selected')

    await user.selectOptions(scenario, 'unreachable-branch')
    expect(screen.getByText(/X-RAY · 4\/6 reachable/)).toBeInTheDocument()
    expect(screen.queryByTestId('broken-connection-3-1-missing-billing')).not.toBeInTheDocument()
    for (const id of ['3', '6']) {
      expect(screen.getByTestId(`flow-node-${id}`)).toHaveClass('flow-node--xray-error')
    }

    await user.selectOptions(scenario, 'cycle')
    expect(screen.getByText(/X-RAY · 6\/6 reachable · cycle detected/)).toBeInTheDocument()
    expect(screen.getByTestId('flow-node-3')).toHaveClass('flow-node--xray-cycle')
    expect(screen.getByTestId('flow-node-1')).not.toHaveClass('flow-node--xray-cycle')
    expect(screen.getByTestId('flow-node-6')).not.toHaveClass('flow-node--xray-error')
    expect(screen.getAllByTestId(/^flow-node-/)).toHaveLength(6)

    await user.click(screen.getByRole('button', { name: 'Return to current flow' }))
    expect(scenario).toHaveValue('current')
    expect(screen.getByText('No structural issues detected')).toBeInTheDocument()
    expect(screen.queryByText('Diagnostic demo · temporary')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Check account again, route to node 3' }),
    ).not.toBeInTheDocument()
  })

  it('preserves unsaved edits through a demo and uses the original routes in Preview', async () => {
    const user = userEvent.setup()
    render(<App />)
    const text = screen.getByLabelText('Question Text')
    await user.clear(text)
    await user.type(text, 'Your edited router question')

    await user.click(screen.getByRole('button', { name: /Flow Health/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Diagnostic demo' }), 'cycle')
    await user.click(screen.getByRole('button', { name: 'Build', exact: true }))
    expect(screen.getByLabelText('Question Text')).toHaveValue('Your edited router question')
    expect(screen.getByRole('button', { name: 'Flow Health, 0 issues' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Play preview' }))
    const preview = screen.getByRole('region', { name: 'Flow preview' })
    await user.click(within(preview).getByRole('button', { name: 'Internet is down' }))
    expect(within(preview).getByText('Your edited router question')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Flow Health/ }))
    expect(screen.getByRole('combobox', { name: 'Diagnostic demo' })).toHaveValue('current')
    expect(screen.getByText('No structural issues detected')).toBeInTheDocument()
  })

  it('exits the demo when changing modes through the command palette', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Flow Health/ }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Diagnostic demo' }),
      'broken-reference',
    )
    await user.keyboard('{Control>}k{/Control}')
    await user.click(screen.getByRole('button', { name: /Preview/ }))

    const preview = screen.getByRole('region', { name: 'Flow preview' })
    await user.click(within(preview).getByRole('button', { name: 'Billing Question' }))
    await user.click(within(preview).getByRole('button', { name: 'Business' }))
    expect(within(preview).getByText('Connecting you to a Billing Agent...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Flow Health, 0 issues' })).toBeInTheDocument()
  })

  it('copies a diagnostic report for the active X-Ray scenario', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: /Flow Health/ }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Diagnostic demo' }),
      'broken-reference',
    )
    await user.click(screen.getByRole('button', { name: 'Copy diagnostic report' }))

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toContain('Scenario: Broken reference (temporary demo)')
    expect(writeText.mock.calls[0][0]).toContain(
      'ERROR: Route "Business" from node #3 points to missing node #missing-billing.',
    )
    expect(screen.getByText('Report copied')).toBeInTheDocument()
  })
})
