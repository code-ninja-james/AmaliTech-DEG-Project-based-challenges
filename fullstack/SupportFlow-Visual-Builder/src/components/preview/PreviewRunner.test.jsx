/**
 * Covers the complete SupportFlow preview journey.
 *
 * The tests verify that the simulation starts at the Start node, follows
 * nextId relationships when answers are selected, reaches a terminal state,
 * and can restart from the beginning.
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

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

describe('Preview message editing', () => {
  // jsdom does not implement the native dialog methods.
  const originalShowModal = HTMLDialogElement.prototype.showModal
  const originalClose = HTMLDialogElement.prototype.close
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
  })
  afterAll(() => {
    if (originalShowModal) HTMLDialogElement.prototype.showModal = originalShowModal
    else delete HTMLDialogElement.prototype.showModal
    if (originalClose) HTMLDialogElement.prototype.close = originalClose
    else delete HTMLDialogElement.prototype.close
  })
  it.each([
    ['start', [], '1'],
    ['question', ['Internet is down'], '2'],
    ['terminal', ['Internet is down', 'No, let me try'], '5'],
  ])('edits a %s with a long press without restarting the preview', (type, answers, expectedId) => {
    vi.useFakeTimers()
    try {
      const onNodeEdit = vi.fn()
      const { rerender } = render(<PreviewRunner flow={flowData} onNodeEdit={onNodeEdit} />)
      for (const answer of answers) fireEvent.click(screen.getByRole('button', { name: answer }))
      const node = flowData.nodes.find((entry) => entry.id === expectedId)
      const message = screen.getByRole('button', { name: `${node.text}. Open edit options` })
      fireEvent.pointerDown(message, {
        pointerType: 'touch',
        isPrimary: true,
        clientX: 100,
        clientY: 100,
      })
      act(() => vi.advanceTimersByTime(400))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: `Edit ${type}` }))
      fireEvent.change(screen.getByLabelText('Message'), {
        target: { value: 'Updated preview message' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
      expect(onNodeEdit).toHaveBeenCalledWith(expectedId, node.text, 'Updated preview message')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      rerender(
        <PreviewRunner
          flow={{
            ...flowData,
            nodes: flowData.nodes.map((entry) =>
              entry.id === expectedId ? { ...entry, text: 'Updated preview message' } : entry,
            ),
          }}
          onNodeEdit={onNodeEdit}
        />,
      )
      expect(screen.getByText('Updated preview message')).toBeInTheDocument()
      if (type === 'terminal')
        expect(screen.getByRole('button', { name: 'Restart conversation' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels long pressing when scrolling and discards cancelled edits', () => {
    vi.useFakeTimers()
    try {
      const onNodeEdit = vi.fn()
      render(<PreviewRunner flow={flowData} onNodeEdit={onNodeEdit} />)
      const message = screen.getByRole('button', { name: /Welcome.*Open edit options/ })
      fireEvent.pointerDown(message, { isPrimary: true, clientX: 100, clientY: 100 })
      fireEvent.pointerMove(message, { clientX: 100, clientY: 130 })
      act(() => vi.advanceTimersByTime(500))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      fireEvent.keyDown(message, { key: 'Enter' })
      fireEvent.click(screen.getByRole('button', { name: 'Edit start' }))
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Discard this' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onNodeEdit).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
