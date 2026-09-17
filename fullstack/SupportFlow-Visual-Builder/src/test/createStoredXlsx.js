const encoder = new TextEncoder()

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getColumnName(index) {
  let column = ''
  let value = index + 1

  while (value > 0) {
    const remainder = (value - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    value = Math.floor((value - 1) / 26)
  }

  return column
}

function createWorksheetXml(rows) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, cellIndex) => {
          const reference = `${getColumnName(cellIndex)}${rowIndex + 1}`

          return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`
        })
        .join('')

      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true)
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value, true)
}

function concatBytes(chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const output = new Uint8Array(size)
  let offset = 0

  chunks.forEach((chunk) => {
    output.set(chunk, offset)
    offset += chunk.length
  })

  return output
}

function createLocalHeader(nameBytes, dataBytes) {
  const header = new Uint8Array(30)
  const view = new DataView(header.buffer)

  writeUint32(view, 0, 0x04034b50)
  writeUint16(view, 4, 20)
  writeUint16(view, 6, 0)
  writeUint16(view, 8, 0)
  writeUint16(view, 10, 0)
  writeUint16(view, 12, 0)
  writeUint32(view, 14, 0)
  writeUint32(view, 18, dataBytes.length)
  writeUint32(view, 22, dataBytes.length)
  writeUint16(view, 26, nameBytes.length)
  writeUint16(view, 28, 0)

  return concatBytes([header, nameBytes, dataBytes])
}

function createCentralDirectoryHeader(nameBytes, dataBytes, localHeaderOffset) {
  const header = new Uint8Array(46)
  const view = new DataView(header.buffer)

  writeUint32(view, 0, 0x02014b50)
  writeUint16(view, 4, 20)
  writeUint16(view, 6, 20)
  writeUint16(view, 8, 0)
  writeUint16(view, 10, 0)
  writeUint16(view, 12, 0)
  writeUint16(view, 14, 0)
  writeUint32(view, 16, 0)
  writeUint32(view, 20, dataBytes.length)
  writeUint32(view, 24, dataBytes.length)
  writeUint16(view, 28, nameBytes.length)
  writeUint16(view, 30, 0)
  writeUint16(view, 32, 0)
  writeUint16(view, 34, 0)
  writeUint16(view, 36, 0)
  writeUint32(view, 38, 0)
  writeUint32(view, 42, localHeaderOffset)

  return concatBytes([header, nameBytes])
}

function createEndOfCentralDirectory(entryCount, centralDirectorySize, centralDirectoryOffset) {
  const record = new Uint8Array(22)
  const view = new DataView(record.buffer)

  writeUint32(view, 0, 0x06054b50)
  writeUint16(view, 4, 0)
  writeUint16(view, 6, 0)
  writeUint16(view, 8, entryCount)
  writeUint16(view, 10, entryCount)
  writeUint32(view, 12, centralDirectorySize)
  writeUint32(view, 16, centralDirectoryOffset)
  writeUint16(view, 20, 0)

  return record
}

export function createStoredZip(entries) {
  const localEntries = []
  const centralEntries = []
  let offset = 0

  entries.forEach(([path, content]) => {
    const nameBytes = encoder.encode(path)
    const dataBytes = encoder.encode(content)
    const localEntry = createLocalHeader(nameBytes, dataBytes)

    localEntries.push(localEntry)
    centralEntries.push(createCentralDirectoryHeader(nameBytes, dataBytes, offset))
    offset += localEntry.length
  })

  const centralDirectoryOffset = offset
  const centralDirectory = concatBytes(centralEntries)
  const endOfCentralDirectory = createEndOfCentralDirectory(
    entries.length,
    centralDirectory.length,
    centralDirectoryOffset,
  )

  return concatBytes([...localEntries, centralDirectory, endOfCentralDirectory])
}

export function createStoredXlsx(rows) {
  return createStoredZip([
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Support Flow" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ],
    ['xl/worksheets/sheet1.xml', createWorksheetXml(rows)],
  ])
}
