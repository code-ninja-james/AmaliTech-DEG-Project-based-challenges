/**
 * Covers the primary SupportFlow Studio behaviours that cross components.
 *
 * These tests protect node editing, navigation, Build/X-Ray/Spatial switching
 * and the chat preview while allowing the product shell to evolve visually.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createStoredXlsx } from './test/createStoredXlsx.js'
import App from './App.jsx'

describe('SupportFlow application', () => {
  afterEach(() => {
    window.localStorage.clear()
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

  it('adds a connected question node from the Routes tab', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Routes' }))
    await user.click(screen.getByRole('button', { name: 'Add question node' }))

    expect(screen.getByTestId('flow-node-7')).toBeInTheDocument()
    expect(screen.getByTestId('flow-node-7')).toHaveClass('flow-node--selected')
    expect(screen.getByLabelText('Question Text')).toHaveValue('New question')
    expect(
      within(screen.getByTestId('flow-node-2')).getByText('New question route'),
    ).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Question Text'))
    await user.type(screen.getByLabelText('Question Text'), 'Do you see router lights?')

    expect(
      within(screen.getByTestId('flow-node-7')).getByText('Do you see router lights?'),
    ).toBeInTheDocument()
  })

  it('adds, edits and removes routes from an existing question node', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Routes' }))
    await user.selectOptions(screen.getByLabelText('New route target'), '6')
    await user.click(screen.getByRole('button', { name: 'Add route' }))

    expect(screen.getByLabelText('Selected route label')).toHaveFocus()
    expect(screen.getByLabelText('Route 2 target')).toHaveValue('6')

    await user.clear(screen.getByLabelText('Route 2 label'))
    await user.type(screen.getByLabelText('Route 2 label'), 'Escalate')

    expect(within(screen.getByTestId('flow-node-2')).getByText('Escalate')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Escalate, route to node 6' })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[2])

    expect(
      within(screen.getByTestId('flow-node-2')).queryByText('Escalate'),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Route 2 label')).not.toBeInTheDocument()
  })

  it('deletes the selected canvas route from the inspector', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-3'))
    await user.click(screen.getByRole('button', { name: 'Personal, route to node 6' }))
    await user.click(screen.getByRole('button', { name: 'Delete route' }))

    expect(
      screen.queryByRole('button', { name: 'Personal, route to node 6' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Personal')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Business, route to node 6' })).toBeInTheDocument()
    expect(screen.getByText('Deleted route "Personal".')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.getByRole('button', { name: 'Personal, route to node 6' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByText('Deleted route "Personal".')).not.toBeInTheDocument()
  })

  it('renames the selected canvas route from the inspector', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-3'))
    await user.click(screen.getByRole('button', { name: 'Personal, route to node 6' }))

    const label = screen.getByLabelText('Selected route label')

    expect(label).toHaveValue('Personal')

    await user.clear(label)
    await user.type(label, 'VIP customer')

    expect(screen.getByRole('button', { name: 'VIP customer, route to node 6' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(screen.getByTestId('flow-node-3')).getByText('VIP customer')).toBeInTheDocument()
  })

  it('deletes the selected canvas route with the keyboard', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-3'))
    await user.click(screen.getByRole('button', { name: 'Personal, route to node 6' }))
    await user.keyboard('{Delete}')

    expect(
      screen.queryByRole('button', { name: 'Personal, route to node 6' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Deleted route "Personal".')).toBeInTheDocument()
  })

  it('creates a new route by dragging a connector handle onto a node', async () => {
    render(<App />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Drag new route from node 2' }), {
      clientX: 420,
      clientY: 350,
    })

    expect(await screen.findByTestId('draft-connection')).toBeInTheDocument()

    fireEvent.pointerUp(screen.getByTestId('flow-node-6'), {
      clientX: 850,
      clientY: 520,
    })

    expect(screen.getByLabelText('Selected route label')).toHaveFocus()
    expect(within(screen.getByTestId('flow-node-2')).getByText('Route to #6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Route to #6, route to node 6' })).toBeInTheDocument()
  })

  it('rewires an existing route by dragging its canvas label onto another node', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-3'))

    const routeLabel = screen.getByRole('button', { name: 'Personal, route to node 6' })

    fireEvent.pointerDown(routeLabel, {
      clientX: 820,
      clientY: 420,
    })

    expect(await screen.findByTestId('draft-connection')).toBeInTheDocument()

    fireEvent.pointerUp(screen.getByTestId('flow-node-4'), {
      clientX: 210,
      clientY: 560,
    })

    expect(screen.getByRole('button', { name: 'Personal, route to node 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.queryByRole('button', { name: 'Personal, route to node 6' }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Selected route label')).toHaveValue('Personal')
    expect(screen.getByTestId('flow-node-4')).toHaveClass('flow-node--selected')
  })

  it('deletes a terminal node and removes routes that targeted it', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('navigator-node-6'))
    expect(screen.getByLabelText('Message Text')).toHaveValue(
      'Connecting you to a Billing Agent...',
    )

    await user.click(screen.getByRole('button', { name: 'Delete node' }))

    expect(screen.queryByTestId('flow-node-6')).not.toBeInTheDocument()
    expect(screen.getByTestId('flow-node-1')).toHaveClass('flow-node--selected')

    await user.click(screen.getByTestId('navigator-node-3'))
    await user.click(screen.getByRole('button', { name: 'Routes' }))

    expect(screen.getByText('No outbound routes yet')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Personal, route to node 6' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Business, route to node 6' }),
    ).not.toBeInTheDocument()
  })

  it('deletes selected nodes with the keyboard and protects text editing', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('navigator-node-6'))
    await user.click(screen.getByLabelText('Message Text'))
    await user.keyboard('{Backspace}')

    expect(screen.getByTestId('flow-node-6')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()

    await user.click(screen.getByTestId('navigator-node-6'))
    await user.keyboard('{Delete}')

    expect(screen.queryByTestId('flow-node-6')).not.toBeInTheDocument()
    expect(screen.getByText('Deleted terminal node #6.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.getByTestId('flow-node-6')).toBeInTheDocument()
    expect(screen.getByTestId('flow-node-6')).toHaveClass('flow-node--selected')
  })

  it('surfaces build validation hints after route edits create flow issues', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('navigator-node-3'))
    await user.click(screen.getByRole('button', { name: 'Routes' }))
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])

    expect(screen.getByRole('button', { name: 'Flow Health, 2 issues' })).toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-3')).getByLabelText('1 validation issue'),
    ).toHaveTextContent('1')
    expect(
      within(screen.getByTestId('flow-node-6')).getByLabelText('1 validation issue'),
    ).toHaveTextContent('1')
    expect(screen.getByText('Node #3 ends unexpectedly without any routes.')).toBeInTheDocument()

    await user.click(screen.getByTestId('navigator-node-2'))

    expect(
      screen.getByText('Selected node is clean. Other flow issues need attention.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Select node #6' }))

    expect(screen.getByTestId('flow-node-6')).toHaveClass('flow-node--selected')
    expect(screen.getByText('Node #6 cannot be reached from the Start node.')).toBeInTheDocument()
  })

  it('does not expose node deletion for the Start node', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('navigator-node-1'))

    expect(screen.queryByRole('button', { name: 'Delete node' })).not.toBeInTheDocument()
    expect(screen.getByText('Start is the entry point and cannot be deleted.')).toBeInTheDocument()
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

  it('imports a pasted spreadsheet flow and runs it in Preview', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Import flow' }))

    const dialog = screen.getByRole('dialog', { name: 'Import flow' })
    expect(within(dialog).getByText('Build flow from JSON or Excel')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Use sheet sample' }))

    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Ready to create 5 nodes and 4 routes from spreadsheet.',
    )

    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    expect(screen.getByText('Imported 5 nodes and 4 routes from spreadsheet.')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-1')).getByText(
        'Welcome to Acme Support. What do you need help with?',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Billing, route to node 2' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Play preview' }))

    const preview = screen.getByRole('region', { name: 'Flow preview' })
    expect(
      within(preview).getByText('Welcome to Acme Support. What do you need help with?'),
    ).toBeInTheDocument()

    await user.click(within(preview).getByRole('button', { name: 'Billing' }))

    expect(
      within(preview).getByText('Is this for a personal or business account?'),
    ).toBeInTheDocument()
  })

  it('imports a JSON flow sample', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Import flow' }))

    const dialog = screen.getByRole('dialog', { name: 'Import flow' })
    await user.click(within(dialog).getByRole('button', { name: 'Use JSON sample' }))

    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Ready to create 4 nodes and 3 routes from JSON.',
    )

    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    expect(screen.getByText('Imported 4 nodes and 3 routes from JSON.')).toBeInTheDocument()
    expect(within(screen.getByTestId('flow-node-start')).getByText('Billing')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-business-billing')).getByText(
        'A business billing agent will join shortly.',
      ),
    ).toBeInTheDocument()
  })

  it('imports an uploaded Excel workbook', async () => {
    const user = userEvent.setup()
    const workbook = createStoredXlsx([
      ['Old help bot export'],
      ['Node ID', 'Type', 'Question Text', 'Route Label', 'Next Node ID'],
      ['1', 'start', 'Welcome from Excel.', 'Billing', '2'],
      ['1', 'start', 'Welcome from Excel.', 'Technical support', '3'],
      ['2', 'end', 'Connecting you to billing.', '', ''],
      ['3', 'end', 'Restart your router first.', '', ''],
    ])
    const file = new File([workbook], 'support-flow.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Import flow' }))

    const dialog = screen.getByRole('dialog', { name: 'Import flow' })
    await user.upload(within(dialog).getByLabelText('Import file'), file)

    await waitFor(() => {
      expect(within(dialog).getByRole('status')).toHaveTextContent(
        'Ready to create 3 nodes and 2 routes from Excel workbook.',
      )
    })

    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    expect(
      screen.getByText('Imported 3 nodes and 2 routes from Excel workbook.'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-1')).getByText('Welcome from Excel.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Technical support, route to node 3' }),
    ).toBeInTheDocument()
  })

  it('saves, searches, edits, uses and deletes workflows', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-2'))
    await user.clear(screen.getByLabelText('Question Text'))
    await user.type(screen.getByLabelText('Question Text'), 'Saved router question')

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))

    let library = screen.getByRole('dialog', { name: 'Workflow library' })
    await user.clear(within(library).getByLabelText('Current workflow name'))
    await user.type(within(library).getByLabelText('Current workflow name'), 'Router workflow')
    await user.click(within(library).getByRole('button', { name: 'Save current workflow' }))

    expect(screen.getByText('Saved workflow "Router workflow".')).toBeInTheDocument()
    expect(within(library).getByText('Router workflow')).toBeInTheDocument()

    await user.click(within(library).getByRole('button', { name: 'Close workflow library' }))
    await user.clear(screen.getByLabelText('Question Text'))
    await user.type(screen.getByLabelText('Question Text'), 'Temporary canvas question')

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))
    library = screen.getByRole('dialog', { name: 'Workflow library' })

    await user.type(within(library).getByLabelText('Search workflows'), 'saved router')
    expect(within(library).getByText('Router workflow')).toBeInTheDocument()

    await user.click(within(library).getByRole('button', { name: 'Edit name' }))
    await user.clear(within(library).getByLabelText('Workflow name for Router workflow'))
    await user.type(
      within(library).getByLabelText('Workflow name for Router workflow'),
      'Saved support workflow',
    )
    await user.click(within(library).getByRole('button', { name: 'Save name' }))

    expect(screen.getByText('Renamed workflow to "Saved support workflow".')).toBeInTheDocument()
    expect(within(library).getByText('Saved support workflow')).toBeInTheDocument()

    await user.click(within(library).getByRole('button', { name: 'Use workflow' }))

    expect(screen.queryByRole('dialog', { name: 'Workflow library' })).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-2')).getByText('Saved router question'),
    ).toBeInTheDocument()
    await user.click(screen.getByTestId('flow-node-2'))
    expect(screen.getByLabelText('Question Text')).toHaveValue('Saved router question')
    expect(screen.getByText('Using workflow "Saved support workflow".')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))
    library = screen.getByRole('dialog', { name: 'Workflow library' })
    await user.clear(within(library).getByLabelText('Search workflows'))
    await user.click(within(library).getByRole('button', { name: 'Delete' }))

    expect(screen.getByText('Deleted workflow "Saved support workflow".')).toBeInTheDocument()
    expect(within(library).getByText('No saved workflows yet.')).toBeInTheDocument()
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

  it('returns from the inspector area to the build canvas', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView

    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    try {
      render(<App />)

      await user.click(screen.getByTestId('flow-node-2'))
      await user.click(screen.getByRole('button', { name: 'Routes' }))
      await user.click(screen.getByRole('button', { name: 'Back to canvas' }))

      expect(scrollIntoView).toHaveBeenCalled()
      expect(screen.getByTestId('flow-canvas')).toBeInTheDocument()
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        })
      } else {
        delete window.HTMLElement.prototype.scrollIntoView
      }
    }
  })

  it('returns from preview to the build canvas from the inspector area', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Play preview' }))
    expect(screen.getByRole('region', { name: 'Flow preview' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to canvas' }))

    expect(screen.queryByRole('region', { name: 'Flow preview' })).not.toBeInTheDocument()
    expect(screen.getByTestId('flow-canvas')).toBeInTheDocument()
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
