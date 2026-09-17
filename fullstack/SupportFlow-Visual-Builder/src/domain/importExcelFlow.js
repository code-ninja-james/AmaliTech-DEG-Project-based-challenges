import { createFlowFromRows, DEFAULT_CANVAS_SIZE } from './importSpreadsheetFlow.js'

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const LOCAL_FILE_SIGNATURE = 0x04034b50
const STORED = 0
const DEFLATE = 8

function readUtf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 66000)

  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset
    }
  }

  throw new Error('Could not read the Excel workbook. The .xlsx zip directory is missing.')
}

function resolvePath(basePath, targetPath) {
  if (targetPath.startsWith('/')) {
    return targetPath.slice(1)
  }

  const parts = basePath.split('/').slice(0, -1)

  targetPath.split('/').forEach((part) => {
    if (!part || part === '.') {
      return
    }

    if (part === '..') {
      parts.pop()
      return
    }

    parts.push(part)
  })

  return parts.join('/')
}

async function inflateRaw(bytes) {
  if (!globalThis.DecompressionStream) {
    throw new Error('This browser cannot read compressed Excel files. Export as CSV/TSV instead.')
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const buffer = await new Response(stream).arrayBuffer()

  return new Uint8Array(buffer)
}

async function readZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  const view = new DataView(arrayBuffer)
  const endOffset = findEndOfCentralDirectory(view)
  const entryCount = view.getUint16(endOffset + 10, true)
  const directoryOffset = view.getUint32(endOffset + 16, true)
  const entries = new Map()
  let offset = directoryOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Could not read the Excel workbook. A zip entry is invalid.')
    }

    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const fileName = readUtf8(bytes.slice(offset + 46, offset + 46 + fileNameLength))

    if (view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_SIGNATURE) {
      throw new Error(`Could not read ${fileName} from the Excel workbook.`)
    }

    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true)
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength
    const compressedBytes = bytes.slice(dataOffset, dataOffset + compressedSize)

    if (compressionMethod === STORED) {
      entries.set(fileName, compressedBytes)
    } else if (compressionMethod === DEFLATE) {
      entries.set(fileName, await inflateRaw(compressedBytes))
    } else {
      throw new Error(`Excel entry ${fileName} uses an unsupported compression method.`)
    }

    offset += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

function parseXml(xmlText) {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml')

  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Could not read the Excel workbook XML.')
  }

  return document
}

function getElementsByLocalName(root, localName) {
  return Array.from(root.getElementsByTagName('*')).filter(
    (element) => element.localName === localName,
  )
}

function getFirstElementByLocalName(root, localName) {
  return getElementsByLocalName(root, localName)[0] ?? null
}

function getRelationshipId(element) {
  return (
    element.getAttribute('r:id') ??
    element.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'id',
    ) ??
    element.getAttribute('id')
  )
}

function readRelationships(entries, relsPath, sourcePath) {
  const relsEntry = entries.get(relsPath)
  const relationships = new Map()

  if (!relsEntry) {
    return relationships
  }

  const document = parseXml(readUtf8(relsEntry))

  getElementsByLocalName(document, 'Relationship').forEach((relationship) => {
    relationships.set(relationship.getAttribute('Id'), {
      type: relationship.getAttribute('Type') ?? '',
      target: resolvePath(sourcePath, relationship.getAttribute('Target') ?? ''),
    })
  })

  return relationships
}

function findWorkbookPath(entries) {
  const relationships = readRelationships(entries, '_rels/.rels', '')
  const officeDocument = [...relationships.values()].find((relationship) =>
    relationship.type.includes('/officeDocument'),
  )

  if (officeDocument?.target && entries.has(officeDocument.target)) {
    return officeDocument.target
  }

  if (entries.has('xl/workbook.xml')) {
    return 'xl/workbook.xml'
  }

  throw new Error('Could not find workbook.xml inside the Excel file.')
}

function findWorksheetPaths(entries, workbookPath) {
  const workbook = parseXml(readUtf8(entries.get(workbookPath)))
  const sheets = getElementsByLocalName(workbook, 'sheet')
  const worksheetPaths = []

  if (sheets.length > 0) {
    const workbookRelsPath = resolvePath(
      workbookPath,
      `_rels/${workbookPath.split('/').pop()}.rels`,
    )
    const relationships = readRelationships(entries, workbookRelsPath, workbookPath)

    sheets.forEach((sheet) => {
      const worksheetPath = relationships.get(getRelationshipId(sheet))?.target

      if (worksheetPath && entries.has(worksheetPath)) {
        worksheetPaths.push(worksheetPath)
      }
    })
  }

  const fallbackWorksheetPaths = [...entries.keys()].filter((path) =>
    /^xl\/worksheets\/sheet\d+\.xml$/i.test(path),
  )

  fallbackWorksheetPaths.forEach((path) => {
    if (!worksheetPaths.includes(path)) {
      worksheetPaths.push(path)
    }
  })

  if (worksheetPaths.length === 0) {
    throw new Error('Could not find a worksheet inside the Excel file.')
  }

  return worksheetPaths
}

function findWorksheetPath(entries, workbookPath) {
  return findWorksheetPaths(entries, workbookPath)[0]
}

function readSharedStrings(entries) {
  const sharedStrings = entries.get('xl/sharedStrings.xml')

  if (!sharedStrings) {
    return []
  }

  return getElementsByLocalName(parseXml(readUtf8(sharedStrings)), 'si').map((item) =>
    getElementsByLocalName(item, 't')
      .map((textNode) => textNode.textContent ?? '')
      .join(''),
  )
}

function getColumnIndex(cellReference, fallbackIndex) {
  const letters = String(cellReference ?? '').match(/^[A-Z]+/i)?.[0]

  if (!letters) {
    return fallbackIndex
  }

  return (
    letters
      .toUpperCase()
      .split('')
      .reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1
  )
}

function getCellText(cell, sharedStrings) {
  const type = cell.getAttribute('t')

  if (type === 'inlineStr') {
    return getElementsByLocalName(cell, 't')
      .map((textNode) => textNode.textContent ?? '')
      .join('')
  }

  const value = getFirstElementByLocalName(cell, 'v')?.textContent ?? ''

  if (type === 's') {
    return sharedStrings[Number(value)] ?? ''
  }

  if (type === 'b') {
    return value === '1' ? 'TRUE' : 'FALSE'
  }

  if (value) {
    return value
  }

  return getElementsByLocalName(cell, 't')
    .map((textNode) => textNode.textContent ?? '')
    .join('')
}

function trimRow(row) {
  let lastUsefulCell = row.length - 1

  while (lastUsefulCell >= 0 && String(row[lastUsefulCell] ?? '').trim() === '') {
    lastUsefulCell -= 1
  }

  return row.slice(0, lastUsefulCell + 1)
}

export async function readRowsFromExcelWorkbook(arrayBuffer) {
  const entries = await readZipEntries(arrayBuffer)
  const workbookPath = findWorkbookPath(entries)
  const worksheetPath = findWorksheetPath(entries, workbookPath)
  const worksheet = parseXml(readUtf8(entries.get(worksheetPath)))
  const sharedStrings = readSharedStrings(entries)

  return readRowsFromWorksheet(worksheet, sharedStrings)
}

function readRowsFromWorksheet(worksheet, sharedStrings) {
  return getElementsByLocalName(worksheet, 'row')
    .map((row) => {
      const cells = []

      getElementsByLocalName(row, 'c').forEach((cell, fallbackIndex) => {
        cells[getColumnIndex(cell.getAttribute('r'), fallbackIndex)] = getCellText(
          cell,
          sharedStrings,
        ).trim()
      })

      return trimRow(cells.map((cell) => cell ?? ''))
    })
    .filter((row) => row.some((cell) => cell.trim()))
}

async function readWorksheetRowsFromExcelWorkbook(arrayBuffer) {
  const entries = await readZipEntries(arrayBuffer)
  const workbookPath = findWorkbookPath(entries)
  const sharedStrings = readSharedStrings(entries)

  return findWorksheetPaths(entries, workbookPath).map((worksheetPath) => ({
    path: worksheetPath,
    rows: readRowsFromWorksheet(parseXml(readUtf8(entries.get(worksheetPath))), sharedStrings),
  }))
}

export async function createFlowFromExcelWorkbook(
  arrayBuffer,
  { canvasSize = DEFAULT_CANVAS_SIZE } = {},
) {
  const worksheets = await readWorksheetRowsFromExcelWorkbook(arrayBuffer)
  const failures = []

  for (const worksheet of worksheets) {
    if (worksheet.rows.length === 0) {
      failures.push(`${worksheet.path}: no rows`)
      continue
    }

    try {
      return createFlowFromRows(worksheet.rows, {
        canvasSize,
        emptyMessage: 'The Excel workbook did not contain readable flow rows.',
      })
    } catch (error) {
      failures.push(`${worksheet.path}: ${error.message}`)
    }
  }

  const detail = failures.length > 0 ? ` Checked ${failures.join('; ')}.` : ''

  throw new Error(`The Excel workbook did not contain readable flow rows.${detail}`)
}
