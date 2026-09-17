import { describe, expect, it } from 'vitest'

import { createStoredXlsx, createStoredZip } from '../test/createStoredXlsx.js'

import { createFlowFromExcelWorkbook, readRowsFromExcelWorkbook } from './importExcelFlow.js'

function getArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function createNamespacedSharedStringWorkbook() {
  const sharedStrings = [
    'Old help bot export',
    'Node ID',
    'Type',
    'Question Text',
    'Route Label',
    'Next Node ID',
    'start',
    'Welcome to support.',
    'Billing',
    '2',
    'end',
    'Connecting you to billing.',
  ]
    .map((text) => `<x:si><x:t>${text}</x:t></x:si>`)
    .join('')

  return createStoredZip([
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8"?><r:Relationships xmlns:r="http://schemas.openxmlformats.org/package/2006/relationships"><r:Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></r:Relationships>',
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:sheets><x:sheet name="Support Flow" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8"?><r:Relationships xmlns:r="http://schemas.openxmlformats.org/package/2006/relationships"><r:Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></r:Relationships>',
    ],
    [
      'xl/sharedStrings.xml',
      `<?xml version="1.0" encoding="UTF-8"?><x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sharedStrings}</x:sst>`,
    ],
    [
      'xl/worksheets/sheet1.xml',
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<x:sheetData>',
        '<x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c></x:row>',
        '<x:row r="2">',
        '<x:c r="A2" t="s"><x:v>1</x:v></x:c>',
        '<x:c r="B2" t="s"><x:v>2</x:v></x:c>',
        '<x:c r="C2" t="s"><x:v>3</x:v></x:c>',
        '<x:c r="D2" t="s"><x:v>4</x:v></x:c>',
        '<x:c r="E2" t="s"><x:v>5</x:v></x:c>',
        '</x:row>',
        '<x:row r="3">',
        '<x:c r="A3" t="str"><x:v>1</x:v></x:c>',
        '<x:c r="B3" t="s"><x:v>6</x:v></x:c>',
        '<x:c r="C3" t="s"><x:v>7</x:v></x:c>',
        '<x:c r="D3" t="s"><x:v>8</x:v></x:c>',
        '<x:c r="E3" t="s"><x:v>9</x:v></x:c>',
        '</x:row>',
        '<x:row r="4">',
        '<x:c r="A4" t="s"><x:v>9</x:v></x:c>',
        '<x:c r="B4" t="s"><x:v>10</x:v></x:c>',
        '<x:c r="C4" t="s"><x:v>11</x:v></x:c>',
        '</x:row>',
        '</x:sheetData>',
        '</x:worksheet>',
      ].join(''),
    ],
  ])
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

  it('reads namespace-prefixed Excel XML with shared strings', async () => {
    await expect(
      readRowsFromExcelWorkbook(getArrayBuffer(createNamespacedSharedStringWorkbook())),
    ).resolves.toEqual([
      ['Old help bot export'],
      ['Node ID', 'Type', 'Question Text', 'Route Label', 'Next Node ID'],
      ['1', 'start', 'Welcome to support.', 'Billing', '2'],
      ['2', 'end', 'Connecting you to billing.'],
    ])
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
