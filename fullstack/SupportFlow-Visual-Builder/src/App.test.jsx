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

  it('minimizes, restores and closes the delete undo toast', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-3'))
    await user.click(screen.getByRole('button', { name: 'Personal, route to node 6' }))
    await user.click(screen.getByRole('button', { name: 'Delete route' }))

    expect(screen.getByText('Deleted route "Personal".')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Minimize undo message' }))

    expect(screen.queryByText('Deleted route "Personal".')).not.toBeInTheDocument()
    expect(screen.getByText('Delete undo available')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restore undo message' }))

    expect(screen.getByText('Deleted route "Personal".')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close undo message' }))

    expect(screen.queryByText('Deleted route "Personal".')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete undo available')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('keeps undo available while the delete toast is minimized', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-3'))
    await user.click(screen.getByRole('button', { name: 'Personal, route to node 6' }))
    await user.click(screen.getByRole('button', { name: 'Delete route' }))
    await user.click(screen.getByRole('button', { name: 'Minimize undo message' }))
    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.getByRole('button', { name: 'Personal, route to node 6' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByText('Delete undo available')).not.toBeInTheDocument()
  })

  it('records named editor changes in the audit log', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.clear(screen.getByLabelText('Current user'))
    await user.type(screen.getByLabelText('Current user'), 'Jameson')
    await user.click(screen.getByTestId('flow-node-2'))

    const questionText = screen.getByLabelText('Question Text')

    await user.clear(questionText)
    await user.type(questionText, 'Audit-ready router question')
    fireEvent.blur(questionText)

    await user.click(screen.getByRole('button', { name: 'Routes' }))
    await user.selectOptions(screen.getByLabelText('New route target'), '6')
    await user.click(screen.getByRole('button', { name: 'Add route' }))
    await user.click(screen.getByRole('button', { name: /Open audit log/ }))

    const audit = screen.getByRole('dialog', { name: 'Audit log' })

    expect(within(audit).getByLabelText('Audit current user')).toHaveValue('Jameson')
    expect(within(audit).getByText('Edited question node #2.')).toBeInTheDocument()
    expect(
      within(audit).getByText('Added route "Route to #6" from node #2 to node #6.'),
    ).toBeInTheDocument()
    expect(within(audit).getAllByText('Jameson').length).toBeGreaterThan(0)
    expect(within(audit).getByRole('button', { name: 'Export JSON' })).toBeEnabled()
    expect(within(audit).getByRole('button', { name: 'Export CSV' })).toBeEnabled()

    await user.type(within(audit).getByLabelText('Search audit log'), 'question node')

    expect(within(audit).getByText('Edited question node #2.')).toBeInTheDocument()
    expect(
      within(audit).queryByText('Added route "Route to #6" from node #2 to node #6.'),
    ).not.toBeInTheDocument()

    await user.clear(within(audit).getByLabelText('Search audit log'))
    await user.selectOptions(within(audit).getByLabelText('Audit action filter'), 'route.added')

    expect(
      within(audit).getByText('Added route "Route to #6" from node #2 to node #6.'),
    ).toBeInTheDocument()
    expect(within(audit).queryByText('Edited question node #2.')).not.toBeInTheDocument()
  })

  it('moves node cards on the canvas and records the layout change', async () => {
    const user = userEvent.setup()

    render(<App />)

    const node = screen.getByTestId('flow-node-2')

    fireEvent.pointerDown(screen.getByTestId('node-move-header-2'), {
      clientX: 260,
      clientY: 260,
    })
    fireEvent.pointerMove(window, {
      clientX: 340,
      clientY: 324,
    })
    fireEvent.pointerUp(window, {
      clientX: 340,
      clientY: 324,
    })

    await waitFor(() => {
      expect(node).toHaveStyle({
        left: '336px',
        top: '312px',
      })
    })

    await user.click(screen.getByRole('button', { name: /Open audit log/ }))

    const audit = screen.getByRole('dialog', { name: 'Audit log' })

    expect(within(audit).getByText('Moved question node #2.')).toBeInTheDocument()
    expect(
      within(audit).getByText('Position changed from (250, 250) to (336, 312).'),
    ).toBeInTheDocument()
  })

  it('records delete undo actions in the audit log', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-3'))
    await user.click(screen.getByRole('button', { name: 'Personal, route to node 6' }))
    await user.click(screen.getByRole('button', { name: 'Delete route' }))
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await user.click(screen.getByRole('button', { name: /Open audit log/ }))

    const audit = screen.getByRole('dialog', { name: 'Audit log' })

    expect(within(audit).getByText('Deleted route "Personal".')).toBeInTheDocument()
    expect(within(audit).getByText('Undid deletion of route "Personal".')).toBeInTheDocument()
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

    fireEvent.blur(label)
    await user.click(screen.getByRole('button', { name: /Open audit log/ }))

    expect(
      within(screen.getByRole('dialog', { name: 'Audit log' })).getByText(
        'Renamed route "Personal" to "VIP customer".',
      ),
    ).toBeInTheDocument()
  })

  it('retargets the selected canvas route from the inspector', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByTestId('flow-node-3'))
    await user.click(screen.getByRole('button', { name: 'Personal, route to node 6' }))

    await user.selectOptions(screen.getByLabelText('Selected route target'), '5')

    expect(screen.getByRole('button', { name: 'Personal, route to node 5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.queryByRole('button', { name: 'Personal, route to node 6' }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Selected route target')).toHaveValue('5')
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

    await user.click(screen.getByRole('button', { name: /Open audit log/ }))

    expect(
      within(screen.getByRole('dialog', { name: 'Audit log' })).getByText(
        'Rewired route "Personal" from node #3 to node #4.',
      ),
    ).toBeInTheDocument()
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
    expect(within(dialog).getByRole('status')).toHaveTextContent('Spreadsheet Workflow')

    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    expect(
      screen.getByText('Imported and saved "Spreadsheet Workflow" with 5 nodes and 4 routes.'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-1')).getByText(
        'Welcome to Support. What is your issue?',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Workflow library' })).getByRole('button', {
        name: 'Use workflow',
      }),
    )

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
    expect(within(dialog).getByRole('status')).toHaveTextContent('JSON Workflow')

    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    expect(
      screen.getByText('Imported and saved "JSON Workflow" with 4 nodes and 3 routes.'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-1')).getByText(
        'Welcome to Support. What is your issue?',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('flow-node-start')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))

    const library = screen.getByRole('dialog', { name: 'Workflow library' })
    expect(within(library).getAllByText('JSON Workflow').length).toBeGreaterThan(0)
    expect(within(library).queryByText('Active')).not.toBeInTheDocument()
    await user.click(within(library).getByRole('button', { name: 'Use workflow' }))

    expect(within(screen.getByTestId('flow-node-start')).getByText('Billing')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-business-billing')).getByText(
        'A business billing agent will join shortly.',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))

    const activeLibrary = screen.getByRole('dialog', { name: 'Workflow library' })
    expect(within(activeLibrary).getByText('Active')).toBeInTheDocument()
    expect(within(activeLibrary).queryByText('No saved workflows yet.')).not.toBeInTheDocument()
  })

  it('runs X-Ray demo scenarios against an imported custom JSON workflow', async () => {
    const user = userEvent.setup()
    const customWorkflow = JSON.stringify({
      nodes: [
        {
          id: 'welcome',
          type: 'start',
          message: 'Welcome to imported support.',
          routes: [
            { answerLabel: 'Billing', to: 'billing' },
            { answerLabel: 'Technical help', targetNodeId: 'tech' },
          ],
        },
        {
          id: 'billing',
          type: 'question',
          prompt: 'Personal or business billing?',
          options: {
            Personal: { target: { id: 'personal-terminal' } },
            Business: { destinationId: 'business-terminal', label: 'Business account' },
          },
        },
        {
          id: 'tech',
          type: 'terminal',
          text: 'A technician will help you.',
        },
        {
          id: 'personal-terminal',
          type: 'terminal',
          text: 'Personal billing support.',
        },
        {
          id: 'business-terminal',
          type: 'terminal',
          text: 'Business billing support.',
        },
      ],
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Import flow' }))

    const dialog = screen.getByRole('dialog', { name: 'Import flow' })
    fireEvent.change(within(dialog).getByLabelText('Pasted rows or JSON'), {
      target: { value: customWorkflow },
    })

    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Ready to create 5 nodes and 4 routes from JSON.',
    )
    expect(within(dialog).getByRole('status')).toHaveTextContent('JSON Workflow')

    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    expect(
      screen.getByText('Imported and saved "JSON Workflow" with 5 nodes and 4 routes.'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('flow-node-welcome')).not.toBeInTheDocument()
    expect(screen.getByTestId('flow-node-1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Workflow library' })).getByRole('button', {
        name: 'Use workflow',
      }),
    )

    expect(screen.getByTestId('flow-node-welcome')).toBeInTheDocument()
    expect(screen.queryByTestId('flow-node-1')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Flow Health/ }))
    const scenario = screen.getByRole('combobox', { name: 'Diagnostic demo' })

    await user.selectOptions(scenario, 'broken-reference')
    expect(screen.getByText(/points to missing node #missing-demo-node/)).toBeInTheDocument()
    expect(screen.getByTestId('flow-node-billing')).toHaveClass('flow-node--xray-broken')
    expect(screen.queryByTestId('flow-node-2')).not.toBeInTheDocument()

    await user.selectOptions(scenario, 'cycle')
    expect(screen.getAllByText(/cycle detected/).length).toBeGreaterThan(0)
    expect(screen.getByTestId('flow-node-billing')).toHaveClass('flow-node--xray-cycle')
    expect(
      screen.getByRole('button', { name: 'X-Ray loop back, route to node billing' }),
    ).toBeInTheDocument()

    await user.selectOptions(scenario, 'question-no-routes')
    expect(
      screen.getByText('Node #question-with-no-routes-demo ends unexpectedly without any routes.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('flow-node-question-with-no-routes-demo')).toHaveClass(
      'flow-node--xray-error',
    )
  })

  it('keeps imports inactive until a saved workflow is used', async () => {
    const user = userEvent.setup()
    let app = render(<App />)

    await user.click(screen.getByRole('button', { name: 'Import flow' }))

    const dialog = screen.getByRole('dialog', { name: 'Import flow' })
    await user.click(within(dialog).getByRole('button', { name: 'Use JSON sample' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    expect(screen.queryByTestId('flow-node-start')).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-1')).getByText(
        'Welcome to Support. What is your issue?',
      ),
    ).toBeInTheDocument()

    app.unmount()
    app = render(<App />)

    expect(screen.queryByTestId('flow-node-start')).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-1')).getByText(
        'Welcome to Support. What is your issue?',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))
    const library = screen.getByRole('dialog', { name: 'Workflow library' })
    expect(within(library).getAllByText('JSON Workflow').length).toBeGreaterThan(0)
    await user.click(within(library).getByRole('button', { name: 'Use workflow' }))

    expect(screen.getByTestId('flow-node-start')).toBeInTheDocument()
    expect(screen.queryByTestId('flow-node-1')).not.toBeInTheDocument()

    app.unmount()
    render(<App />)

    expect(screen.getByTestId('flow-node-start')).toBeInTheDocument()
    expect(screen.queryByTestId('flow-node-1')).not.toBeInTheDocument()
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
    await user.upload(within(dialog).getByLabelText('Import files'), file)

    await waitFor(() => {
      expect(within(dialog).getByRole('status')).toHaveTextContent(
        'Ready to create 3 nodes and 2 routes from Excel workbook.',
      )
    })
    expect(within(dialog).getByRole('status')).toHaveTextContent('Support Flow')

    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    expect(
      screen.getByText('Imported and saved "Support Flow" with 3 nodes and 2 routes.'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-1')).getByText(
        'Welcome to Support. What is your issue?',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Workflow library' })).getByRole('button', {
        name: 'Use workflow',
      }),
    )

    expect(
      within(screen.getByTestId('flow-node-1')).getByText('Welcome from Excel.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Technical support, route to node 3' }),
    ).toBeInTheDocument()
  })

  it('uploads multiple allowed workflow files and skips unsupported files', async () => {
    const user = userEvent.setup()
    const createWorkflowFile = ({ fileName, startId, endId, startText, endText }) =>
      new File(
        [
          JSON.stringify({
            nodes: [
              {
                id: startId,
                type: 'start',
                text: startText,
                options: [{ label: 'Done', nextId: endId }],
              },
              {
                id: endId,
                type: 'end',
                text: endText,
                options: [],
              },
            ],
          }),
        ],
        fileName,
        { type: 'application/json' },
      )
    const onboardingFile = createWorkflowFile({
      fileName: 'onboarding-flow.json',
      startId: 'start-onboarding',
      endId: 'end-onboarding',
      startText: 'Welcome to onboarding.',
      endText: 'Onboarding is complete.',
    })
    const billingFile = createWorkflowFile({
      fileName: 'billing-flow.json',
      startId: 'start-billing',
      endId: 'end-billing',
      startText: 'Welcome to billing.',
      endText: 'Billing is complete.',
    })
    const unsupportedFile = new File(['not a workflow'], 'random-notes.exe', {
      type: 'application/octet-stream',
    })

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Import flow' }))

    const dialog = screen.getByRole('dialog', { name: 'Import flow' })
    fireEvent.change(within(dialog).getByLabelText('Import files'), {
      target: { files: [onboardingFile, unsupportedFile, billingFile] },
    })

    await waitFor(() => {
      expect(within(dialog).getByRole('status')).toHaveTextContent(
        'Ready to create 2 workflows with 4 nodes and 2 routes from selected files.',
      )
    })
    expect(within(dialog).getByRole('status')).toHaveTextContent('Onboarding Flow')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Billing Flow')
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Only .json, .xlsx, .csv, or .tsv workflow files are allowed. Skipped: random-notes.exe.',
    )

    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    expect(
      screen.getByText('Imported and saved 2 workflows with 4 nodes and 2 routes.'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-1')).getByText(
        'Welcome to Support. What is your issue?',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('flow-node-start-billing')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))

    const library = screen.getByRole('dialog', { name: 'Workflow library' })
    expect(within(library).getByText('Onboarding Flow')).toBeInTheDocument()
    expect(within(library).getAllByText('Billing Flow').length).toBeGreaterThan(0)
    expect(within(library).queryByText('Active')).not.toBeInTheDocument()
    expect(within(library).queryByText(/random-notes/)).not.toBeInTheDocument()

    await user.click(within(library).getAllByRole('button', { name: 'Use workflow' })[0])
    expect(
      within(screen.getByTestId('flow-node-start-billing')).getByText('Welcome to billing.'),
    ).toBeInTheDocument()
  })

  it('auto-saves imports, active edits, searches, uses and deletes workflows', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Import flow' }))

    let dialog = screen.getByRole('dialog', { name: 'Import flow' })
    await user.click(within(dialog).getByRole('button', { name: 'Use JSON sample' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    expect(
      screen.getByText('Imported and saved "JSON Workflow" with 4 nodes and 3 routes.'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-1')).getByText(
        'Welcome to Support. What is your issue?',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('flow-node-start')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))

    let library = screen.getByRole('dialog', { name: 'Workflow library' })
    expect(within(library).getAllByText('JSON Workflow').length).toBeGreaterThan(0)
    expect(within(library).queryByText('Active')).not.toBeInTheDocument()
    await user.click(within(library).getByRole('button', { name: 'Use workflow' }))

    await user.click(screen.getByTestId('flow-node-start'))
    await user.clear(screen.getByLabelText('Question Text'))
    await user.type(screen.getByLabelText('Question Text'), 'Temporary canvas question')

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))

    library = screen.getByRole('dialog', { name: 'Workflow library' })
    expect(
      within(library).getByRole('group', { name: 'Current workflow rating breakdown' }),
    ).toHaveTextContent('Structure')
    expect(
      within(library).getByRole('group', { name: 'Current workflow rating breakdown' }),
    ).toHaveTextContent('Route labels')
    expect(within(library).getByText('Current Workflow')).toBeInTheDocument()
    expect(within(library).getByLabelText('Current workflow summary')).toHaveTextContent(
      'JSON Workflow',
    )
    expect(within(library).queryByRole('button', { name: 'Save current workflow' })).toBeNull()

    expect(within(library).getAllByText('JSON Workflow').length).toBeGreaterThan(0)
    expect(within(library).getByText('Active')).toBeInTheDocument()
    expect(within(library).getAllByText('100/100 · Launch ready').length).toBeGreaterThan(0)
    expect(
      within(library).getByRole('group', { name: 'Rating breakdown for JSON Workflow' }),
    ).toHaveTextContent('Endings')
    expect(within(library).getByLabelText('Suggestions for JSON Workflow')).toHaveTextContent(
      'Ready to preview',
    )

    await user.click(within(library).getByRole('button', { name: 'Close workflow library' }))

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))
    library = screen.getByRole('dialog', { name: 'Workflow library' })

    await user.type(within(library).getByLabelText('Search Workflows'), 'Temporary')
    expect(within(library).getAllByText('JSON Workflow').length).toBeGreaterThan(0)

    await user.click(within(library).getByRole('button', { name: 'Edit name' }))
    await user.clear(within(library).getByLabelText('Workflow name for JSON Workflow'))
    await user.type(
      within(library).getByLabelText('Workflow name for JSON Workflow'),
      'Saved support workflow',
    )
    await user.click(within(library).getByRole('button', { name: 'Save name' }))

    expect(screen.getByText('Renamed workflow to "Saved support workflow".')).toBeInTheDocument()
    expect(within(library).getAllByText('Saved support workflow').length).toBeGreaterThan(0)

    await user.click(within(library).getByRole('button', { name: 'Use workflow' }))

    expect(screen.queryByRole('dialog', { name: 'Workflow library' })).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('flow-node-start')).getByText('Temporary canvas question'),
    ).toBeInTheDocument()
    await user.click(screen.getByTestId('flow-node-start'))
    expect(screen.getByLabelText('Question Text')).toHaveValue('Temporary canvas question')

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))
    library = screen.getByRole('dialog', { name: 'Workflow library' })
    await user.clear(within(library).getByLabelText('Search Workflows'))
    await user.click(within(library).getByRole('button', { name: 'Delete' }))

    expect(screen.getByText('Deleted workflow "Saved support workflow".')).toBeInTheDocument()
    expect(within(library).getByText('No saved workflows yet.')).toBeInTheDocument()
  })

  it('records imports and workflow library actions in the audit log', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Import flow' }))

    let dialog = screen.getByRole('dialog', { name: 'Import flow' })
    await user.click(within(dialog).getByRole('button', { name: 'Use JSON sample' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create flow' }))

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))

    let library = screen.getByRole('dialog', { name: 'Workflow library' })
    expect(within(library).getAllByText('JSON Workflow').length).toBeGreaterThan(0)
    await user.click(within(library).getByRole('button', { name: 'Use workflow' }))

    await user.click(screen.getByRole('button', { name: 'Open workflows' }))
    library = screen.getByRole('dialog', { name: 'Workflow library' })
    await user.click(within(library).getByRole('button', { name: 'Delete' }))
    await user.click(within(library).getByRole('button', { name: 'Close workflow library' }))
    await user.click(screen.getByRole('button', { name: /Open audit log/ }))

    dialog = screen.getByRole('dialog', { name: 'Audit log' })

    expect(within(dialog).getByText('Imported 4 nodes and 3 routes from JSON.')).toBeInTheDocument()
    expect(within(dialog).getByText('Saved workflow "JSON Workflow".')).toBeInTheDocument()
    expect(within(dialog).getByText('Used workflow "JSON Workflow".')).toBeInTheDocument()
    expect(within(dialog).getByText('Deleted workflow "JSON Workflow".')).toBeInTheDocument()
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

  it('switches diagnostic scenarios without accumulating faults or mutating the current flow', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Flow Health/ }))
    const scenario = screen.getByRole('combobox', { name: 'Diagnostic demo' })

    await user.selectOptions(scenario, 'broken-reference')
    expect(screen.getByText(/points to missing node/)).toBeInTheDocument()
    expect(screen.getByTestId('flow-node-2')).toHaveClass('flow-node--xray-broken')
    expect(screen.getByText('Missing target')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^flow-node-/)).toHaveLength(6)
    expect(screen.getByText(/DEMO · X-RAY · 6\/6 reachable/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Select node #2' }))
    expect(screen.getByTestId('flow-node-2')).toHaveClass('flow-node--selected')

    await user.selectOptions(scenario, 'unreachable-branch')
    expect(screen.getByText(/X-RAY · 3\/6 reachable/)).toBeInTheDocument()
    expect(screen.queryByText('Missing target')).not.toBeInTheDocument()
    for (const id of ['2', '4', '5']) {
      expect(screen.getByTestId(`flow-node-${id}`)).toHaveClass('flow-node--xray-error')
    }

    await user.selectOptions(scenario, 'cycle')
    expect(screen.getByText(/X-RAY · 6\/6 reachable · cycle detected/)).toBeInTheDocument()
    expect(screen.getByTestId('flow-node-2')).toHaveClass('flow-node--xray-cycle')
    expect(screen.getByTestId('flow-node-1')).not.toHaveClass('flow-node--xray-cycle')
    expect(screen.getByTestId('flow-node-6')).not.toHaveClass('flow-node--xray-error')
    expect(screen.getAllByTestId(/^flow-node-/)).toHaveLength(6)

    await user.selectOptions(scenario, 'question-no-routes')
    expect(
      screen.getByText('Node #question-with-no-routes-demo ends unexpectedly without any routes.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('flow-node-question-with-no-routes-demo')).toHaveClass(
      'flow-node--xray-error',
    )
    expect(screen.getAllByTestId(/^flow-node-/)).toHaveLength(7)

    await user.click(screen.getByRole('button', { name: 'Return to current flow' }))
    expect(scenario).toHaveValue('current')
    expect(screen.getByText('No structural issues detected')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^flow-node-/)).toHaveLength(6)
    expect(screen.queryByText('Diagnostic demo · temporary')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'X-Ray loop back, route to node 2' }),
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
    expect(writeText.mock.calls[0][0]).toContain('points to missing node #missing-demo-node')
    expect(screen.getByText('Report copied')).toBeInTheDocument()
  })
})
