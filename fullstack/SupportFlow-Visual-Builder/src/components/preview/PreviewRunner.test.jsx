/**
 * Covers the complete SupportFlow preview journey.
 *
 * The tests verify that the simulation starts at the Start node, follows
 * nextId relationships when answers are selected, reaches a terminal state,
 * and can restart from the beginning.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import flowData from '../../../flow_data.json'
import PreviewRunner from './PreviewRunner.jsx'

describe('PreviewRunner', () => {
  it('starts at the configured Start node', () => {
    render(<PreviewRunner flow={flowData} />)

    expect(screen.getByText('Welcome to Support. What is your issue?')).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /Internet is down/,
      }),
    ).toBeInTheDocument()
  })

  it('traverses the flow using selected answers', async () => {
    const user = userEvent.setup()

    render(<PreviewRunner flow={flowData} />)

    await user.click(
      screen.getByRole('button', {
        name: /Internet is down/,
      }),
    )

    expect(screen.getByText('Have you tried restarting your router?')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /No, let me try/,
      }),
    )

    expect(
      screen.getByText('Restarting usually fixes it! Come back if it fails.'),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: 'Restart conversation',
      }),
    ).toBeInTheDocument()
  })

  it('restarts the simulation from the Start node', async () => {
    const user = userEvent.setup()

    render(<PreviewRunner flow={flowData} />)

    await user.click(
      screen.getByRole('button', {
        name: /Billing Question/,
      }),
    )

    await user.click(
      screen.getByRole('button', {
        name: /Personal/,
      }),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Restart conversation',
      }),
    )

    expect(screen.getByText('Welcome to Support. What is your issue?')).toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: /Internet is down/,
      }),
    ).toBeInTheDocument()
  })
})
