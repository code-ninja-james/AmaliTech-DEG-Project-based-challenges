import { describe, expect, it } from 'vitest'

import { createFlowFromJsonText, SAMPLE_FLOW_JSON_TEXT } from './importJsonFlow.js'

describe('importJsonFlow', () => {
  it('imports the native SupportFlow JSON shape', () => {
    const { flow, warnings } = createFlowFromJsonText(SAMPLE_FLOW_JSON_TEXT)

    expect(flow.nodes).toHaveLength(4)
    expect(flow.meta.canvas_size).toEqual({ w: 1200, h: 800 })
    expect(flow.nodes[0]).toMatchObject({
      id: 'start',
      type: 'start',
      options: [
        { label: 'Billing', nextId: 'billing' },
        { label: 'Technical support', nextId: 'tech' },
      ],
    })
    expect(warnings).toEqual([])
  })

  it('imports flat JSON rows using spreadsheet-style headings', () => {
    const rows = JSON.stringify({
      rows: [
        {
          'Source Node': 'start',
          Kind: 'entry',
          Prompt: 'Welcome, what do you need?',
          Choice: 'Billing',
          Target: 'billing',
        },
        {
          'Source Node': 'billing',
          Kind: 'terminal',
          Prompt: 'Connecting you to billing.',
        },
      ],
    })

    const { flow, warnings } = createFlowFromJsonText(rows)

    expect(flow.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'start',
          type: 'start',
          options: [{ label: 'Billing', nextId: 'billing' }],
        }),
        expect.objectContaining({
          id: 'billing',
          type: 'end',
          text: 'Connecting you to billing.',
        }),
      ]),
    )
    expect(warnings).toEqual([])
  })

  it('imports a plain array of node objects', () => {
    const { flow, warnings } = createFlowFromJsonText(
      JSON.stringify([
        {
          id: 'welcome',
          type: 'start',
          text: 'Welcome.',
          options: { Help: 'help' },
        },
        {
          id: 'help',
          type: 'end',
          text: 'A specialist will help you shortly.',
          options: [],
        },
      ]),
    )

    expect(flow.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'welcome',
          type: 'start',
          options: [{ label: 'Help', nextId: 'help' }],
        }),
        expect.objectContaining({
          id: 'help',
          type: 'end',
        }),
      ]),
    )
    expect(warnings).toEqual([])
  })

  it('throws a helpful error for invalid JSON syntax', () => {
    expect(() => createFlowFromJsonText('{ not valid json }')).toThrow(/Could not parse JSON/)
  })
})
