import { describe, expect, it } from 'vitest'

import {
  createFlowFromSpreadsheet,
  parseSpreadsheetText,
  SAMPLE_SPREADSHEET_TEXT,
} from './importSpreadsheetFlow.js'

describe('importSpreadsheetFlow', () => {
  it('parses rows copied from Excel with a messy title row', () => {
    const { flow, warnings } = createFlowFromSpreadsheet(SAMPLE_SPREADSHEET_TEXT)

    expect(flow.nodes).toHaveLength(5)
    expect(flow.meta.canvas_size.w).toBeGreaterThanOrEqual(1200)
    expect(flow.nodes[0]).toMatchObject({
      id: '1',
      type: 'start',
      text: 'Welcome to Acme Support. What do you need help with?',
      options: [
        { label: 'Billing', nextId: '2' },
        { label: 'Technical support', nextId: '3' },
      ],
    })
    expect(flow.nodes.find((node) => node.id === '3')).toMatchObject({
      type: 'end',
      text: 'Please restart the router, then call 555-0142 if it stays offline.',
    })
    expect(warnings).toEqual([])
  })

  it('accepts flexible CSV headings and creates missing targets as terminals', () => {
    const csv = [
      'Exported from old spreadsheet',
      'Source Node,Kind,Prompt,Answer Label,Destination Node',
      'start,entry,"Welcome, what do you need?",Billing,billing',
      'billing,decision,Personal or business?,Personal,done',
      'billing,decision,Personal or business?,Personal,done',
    ].join('\n')

    const { flow, warnings } = createFlowFromSpreadsheet(csv)

    expect(flow.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'start',
          type: 'start',
          options: [{ label: 'Billing', nextId: 'billing' }],
        }),
        expect.objectContaining({
          id: 'billing',
          type: 'question',
          options: [{ label: 'Personal', nextId: 'done' }],
        }),
        expect.objectContaining({
          id: 'done',
          type: 'end',
          text: 'Terminal response for #done',
          options: [],
        }),
      ]),
    )
    expect(warnings).toEqual(
      expect.arrayContaining([
        'Duplicate route "Personal" on node #billing was skipped.',
        'Node #done used generated text because the spreadsheet row was blank.',
      ]),
    )
  })

  it('auto-lays out rows when coordinate columns are blank', () => {
    const csv = [
      'Old support export',
      'Node ID,Type,Question Text,Route Label,Next Node ID,Canvas X,Canvas Y',
      'start,start,"Welcome to support.",Billing,billing,,',
      'start,start,"Welcome to support.",Technical support,tech,,',
      'billing,end,"Connecting you to billing.",,,,',
      'tech,end,"Restart your router first.",,,,',
    ].join('\n')

    const { flow } = createFlowFromSpreadsheet(csv)
    const positions = flow.nodes.map((node) => node.position)

    expect(positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      ]),
    )
    expect(flow.nodes.find((node) => node.id === 'start').position).not.toEqual({ x: 0, y: 0 })
    expect(new Set(positions.map((position) => `${position.x}:${position.y}`)).size).toBe(
      flow.nodes.length,
    )
  })

  it('throws a helpful error when no header can be found', () => {
    expect(() => createFlowFromSpreadsheet('just messy notes\nwithout columns')).toThrow(
      /Could not find spreadsheet columns/,
    )
  })

  it('keeps quoted CSV cells intact', () => {
    expect(
      parseSpreadsheetText('"Node ID","Question Text"\n"1","Hello, ""VIP"" customer"'),
    ).toEqual([
      ['Node ID', 'Question Text'],
      ['1', 'Hello, "VIP" customer'],
    ])
  })
})
