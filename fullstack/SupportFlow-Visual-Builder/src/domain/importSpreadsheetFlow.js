const DEFAULT_CANVAS_SIZE = { w: 1200, h: 800 }
const NODE_PADDING = 72
const NODE_VERTICAL_STEP = 190
const NODE_HORIZONTAL_GAP = 260

export const SAMPLE_SPREADSHEET_TEXT = [
  'Old SupportFlow help-bot sheet',
  'Node ID\tType\tQuestion Text\tRoute Label\tNext Node ID',
  '1\tstart\tWelcome to Acme Support. What do you need help with?\tBilling\t2',
  '1\tstart\tWelcome to Acme Support. What do you need help with?\tTechnical support\t3',
  '2\tquestion\tIs this for a personal or business account?\tPersonal\t4',
  '2\tquestion\tIs this for a personal or business account?\tBusiness\t5',
  '3\tend\tPlease restart the router, then call 555-0142 if it stays offline.\t\t',
  '4\tend\tConnecting you to a billing specialist.\t\t',
  '5\tend\tA business billing agent will join shortly.\t\t',
].join('\n')

const FIELD_ALIASES = {
  id: [
    'id',
    'node',
    'nodeid',
    'node id',
    'source',
    'sourceid',
    'source id',
    'source node',
    'question id',
    'step',
    'step id',
  ],
  type: ['type', 'node type', 'kind', 'category'],
  text: [
    'text',
    'node text',
    'question',
    'question text',
    'prompt',
    'message',
    'script',
    'bot message',
  ],
  optionLabel: [
    'option',
    'option label',
    'answer',
    'answer label',
    'choice',
    'route',
    'route label',
    'label',
    'button',
  ],
  targetId: [
    'next',
    'nextid',
    'next id',
    'next node',
    'next node id',
    'target',
    'target id',
    'target node',
    'destination',
    'destination node',
    'child',
    'child node',
  ],
  x: ['x', 'x position', 'position x', 'canvas x', 'left'],
  y: ['y', 'y position', 'position y', 'canvas y', 'top'],
}

const NORMALIZED_ALIASES = Object.entries(FIELD_ALIASES).reduce((aliases, [field, labels]) => {
  labels.forEach((label) => aliases.set(normalizeHeader(label), field))
  return aliases
}, new Map())

function normalizeHeader(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[#:_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function normalizeId(value) {
  return String(value ?? '')
    .trim()
    .replace(/^#/, '')
}

function normalizeNodeType(value) {
  const type = String(value ?? '')
    .trim()
    .toLowerCase()

  if (['start', 'entry', 'root', 'begin'].includes(type)) {
    return 'start'
  }

  if (['end', 'terminal', 'leaf', 'response', 'answer'].includes(type)) {
    return 'end'
  }

  if (['question', 'decision', 'branch', 'node'].includes(type)) {
    return 'question'
  }

  return null
}

function detectDelimiter(line) {
  const candidates = ['\t', ',', ';']

  return candidates
    .map((delimiter) => ({
      delimiter,
      count: line.split(delimiter).length - 1,
    }))
    .sort((left, right) => right.count - left.count)[0].delimiter
}

function parseDelimitedLine(line, delimiter) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"'
      index += 1
      continue
    }

    if (character === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (character === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += character
  }

  cells.push(current.trim())

  return cells
}

export function parseSpreadsheetText(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => parseDelimitedLine(line, detectDelimiter(line)))
    .map((row) => {
      let lastUsefulCell = row.length - 1

      while (lastUsefulCell >= 0 && row[lastUsefulCell] === '') {
        lastUsefulCell -= 1
      }

      return row.slice(0, lastUsefulCell + 1)
    })
    .filter((row) => row.some((cell) => cell.trim()))
}

function getHeaderMatch(row) {
  const columns = new Map()
  let score = 0

  row.forEach((cell, index) => {
    const field = NORMALIZED_ALIASES.get(normalizeHeader(cell))

    if (field && !columns.has(field)) {
      columns.set(field, index)
      score += 1
    }
  })

  return { columns, score }
}

function findHeader(rows) {
  const candidates = rows.map((row, index) => ({
    index,
    ...getHeaderMatch(row),
  }))

  const bestCandidate = candidates.sort((left, right) => right.score - left.score)[0]

  if (!bestCandidate || bestCandidate.score < 3 || !bestCandidate.columns.has('id')) {
    throw new Error(
      'Could not find spreadsheet columns. Include at least Node ID, Question Text, Route Label, and Next Node ID.',
    )
  }

  return bestCandidate
}

function getCell(row, columns, field) {
  const index = columns.get(field)

  return index === undefined ? '' : String(row[index] ?? '').trim()
}

function readNumber(value) {
  const parsed = Number(String(value).replace(/,/g, '').trim())

  return Number.isFinite(parsed) ? parsed : null
}

function createNodeStoreEntry(id) {
  return {
    id,
    explicitType: null,
    text: '',
    position: null,
    options: [],
    optionKeys: new Set(),
  }
}

function addOption(node, label, targetId, warnings) {
  if (!targetId) {
    if (label) {
      warnings.push(`Route "${label}" on node #${node.id} was skipped because it has no target.`)
    }

    return
  }

  const option = {
    label: label || `Route to #${targetId}`,
    nextId: targetId,
  }
  const optionKey = `${option.label}::${option.nextId}`

  if (node.optionKeys.has(optionKey)) {
    warnings.push(`Duplicate route "${option.label}" on node #${node.id} was skipped.`)
    return
  }

  node.optionKeys.add(optionKey)
  node.options.push(option)
}

function getLayoutDepths(nodes, startNode) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const depthById = new Map()

  if (startNode) {
    const queue = [{ id: startNode.id, depth: 0 }]

    while (queue.length > 0) {
      const current = queue.shift()
      const existingDepth = depthById.get(current.id)

      if (existingDepth !== undefined && existingDepth <= current.depth) {
        continue
      }

      depthById.set(current.id, current.depth)

      nodeMap.get(current.id)?.options.forEach((option) => {
        if (nodeMap.has(option.nextId)) {
          queue.push({ id: option.nextId, depth: current.depth + 1 })
        }
      })
    }
  }

  let fallbackDepth = Math.max(0, ...depthById.values()) + 1

  nodes.forEach((node) => {
    if (!depthById.has(node.id)) {
      depthById.set(node.id, fallbackDepth)
      fallbackDepth += 1
    }
  })

  return depthById
}

function layoutNodes(nodes, canvasSize) {
  const startNode = nodes.find((node) => node.type === 'start') ?? nodes[0]
  const depthById = getLayoutDepths(nodes, startNode)
  const groups = new Map()

  nodes.forEach((node) => {
    const depth = depthById.get(node.id) ?? 0
    groups.set(depth, [...(groups.get(depth) ?? []), node])
  })

  const maxDepth = Math.max(0, ...groups.keys())
  const width = Math.max(
    canvasSize.w,
    ...[...groups.values()].map((group) => NODE_PADDING * 2 + group.length * NODE_HORIZONTAL_GAP),
  )
  const height = Math.max(canvasSize.h, NODE_PADDING * 2 + (maxDepth + 1) * NODE_VERTICAL_STEP)

  groups.forEach((group, depth) => {
    const totalWidth = (group.length - 1) * NODE_HORIZONTAL_GAP
    const startX = Math.max(NODE_PADDING, width / 2 - totalWidth / 2)
    const y = NODE_PADDING + depth * NODE_VERTICAL_STEP

    group.forEach((node, index) => {
      if (node.position) {
        return
      }

      node.position = {
        x: Math.round(startX + index * NODE_HORIZONTAL_GAP),
        y,
      }
    })
  })

  return { w: width, h: height }
}

export function createFlowFromSpreadsheet(text, { canvasSize = DEFAULT_CANVAS_SIZE } = {}) {
  const rows = parseSpreadsheetText(text)

  if (rows.length === 0) {
    throw new Error('Paste spreadsheet rows or upload a CSV/TSV file first.')
  }

  const { index: headerIndex, columns } = findHeader(rows)
  const nodesById = new Map()
  const rowWarnings = []
  const generatedTextIds = new Set()

  rows.slice(headerIndex + 1).forEach((row) => {
    const nodeId = normalizeId(getCell(row, columns, 'id'))

    if (!nodeId) {
      return
    }

    if (!nodesById.has(nodeId)) {
      nodesById.set(nodeId, createNodeStoreEntry(nodeId))
    }

    const node = nodesById.get(nodeId)
    const nodeType = normalizeNodeType(getCell(row, columns, 'type'))
    const textValue = getCell(row, columns, 'text')
    const routeLabel = getCell(row, columns, 'optionLabel')
    const targetId = normalizeId(getCell(row, columns, 'targetId'))
    const x = readNumber(getCell(row, columns, 'x'))
    const y = readNumber(getCell(row, columns, 'y'))

    if (nodeType) {
      node.explicitType = nodeType
    }

    if (textValue && !node.text) {
      node.text = textValue
    }

    if (x !== null && y !== null) {
      node.position = { x, y }
    }

    addOption(node, routeLabel, targetId, rowWarnings)

    if (targetId && !nodesById.has(targetId)) {
      nodesById.set(targetId, createNodeStoreEntry(targetId))
    }
  })

  const importedNodes = [...nodesById.values()]

  if (importedNodes.length === 0) {
    throw new Error('No node rows were found below the detected spreadsheet header.')
  }

  const explicitStartNodes = importedNodes.filter((node) => node.explicitType === 'start')
  const fallbackStartId = explicitStartNodes[0]?.id ?? importedNodes[0].id

  const nodes = importedNodes.map((node) => {
    const type =
      node.explicitType ??
      (node.id === fallbackStartId ? 'start' : node.options.length > 0 ? 'question' : 'end')
    const text =
      node.text ||
      (type === 'end'
        ? `Terminal response for #${node.id}`
        : type === 'start'
          ? 'Imported start question'
          : `Imported question #${node.id}`)

    if (!node.text) {
      generatedTextIds.add(node.id)
    }

    return {
      id: node.id,
      type,
      text,
      position: node.position,
      options: node.options,
    }
  })

  const computedCanvasSize = layoutNodes(nodes, canvasSize)
  const warnings = [...rowWarnings]

  nodes.forEach((node) => {
    if (generatedTextIds.has(node.id)) {
      warnings.push(`Node #${node.id} used generated text because the spreadsheet row was blank.`)
    }
  })

  if (explicitStartNodes.length === 0) {
    warnings.push(`No Start type was provided. Node #${fallbackStartId} was used as Start.`)
  }

  if (explicitStartNodes.length > 1) {
    warnings.push('Multiple Start rows were provided. Flow Health will flag this for review.')
  }

  return {
    flow: {
      meta: {
        theme: 'dark',
        canvas_size: computedCanvasSize,
      },
      nodes,
    },
    warnings,
  }
}
