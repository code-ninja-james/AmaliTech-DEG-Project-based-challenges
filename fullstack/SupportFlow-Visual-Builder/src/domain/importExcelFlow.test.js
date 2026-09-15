import { describe, expect, it } from 'vitest'

import { createStoredXlsx } from '../test/createStoredXlsx.js'

import { createFlowFromExcelWorkbook, readRowsFromExcelWorkbook } from './importExcelFlow.js'

function getArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

describe('importExcelFlow', () => {
  it('reads worksheet rows from an xlsx workbook', async () => {
    const rows = [
      ['Old help bot export'],
      ['Node ID', 'Type', 'Question Text', 'Route Label', 'Next Node ID'],
      ['1', 'start', 'Welcome to support.', 'Billing', '2'],
    ]

    await expect(
      readRowsFromExcelWorkbook(getArrayBuffer(createStoredXlsx(rows))),
    ).resolves.toEqual(rows)
  })

  it('creates a SupportFlow graph from an xlsx workbook', async () => {
    const workbook = createStoredXlsx([
      ['Old help bot export'],
      ['Node ID', 'Type', 'Question Text', 'Route Label', 'Next Node ID'],
      ['1', 'start', 'Welcome to support.', 'Billing', '2'],
      ['2', 'end', 'Connecting you to billing.', '', ''],
    ])

    const { flow, warnings } = await createFlowFromExcelWorkbook(getArrayBuffer(workbook))

    expect(flow.nodes).toHaveLength(2)
    expect(flow.nodes[0]).toMatchObject({
      id: '1',
      type: 'start',
      options: [{ label: 'Billing', nextId: '2' }],
    })
    expect(flow.nodes[1]).toMatchObject({
      id: '2',
      type: 'end',
      text: 'Connecting you to billing.',
    })
    expect(warnings).toEqual([])
  })
})
