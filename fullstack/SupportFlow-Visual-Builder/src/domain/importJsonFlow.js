import {
  createFlowFromRows,
  DEFAULT_CANVAS_SIZE,
  layoutNodes,
  normalizeId,
  normalizeNodeType,
} from './importSpreadsheetFlow.js'

export const SAMPLE_FLOW_JSON_TEXT = JSON.stringify(
  {
    meta: {
      theme: 'dark',
      canvas_size: { w: 1200, h: 800 },
    },
    nodes: [
      {
        id: 'start',
        type: 'start',
        text: 'Welcome to Acme Support. What do you need help with?',
        position: { x: 500, y: 70 },
        options: [
          { label: 'Billing', nextId: 'billing' },
          { label: 'Technical support', nextId: 'tech' },
        ],
      },
      {
        id: 'billing',
        type: 'question',
        text: 'Is this for a personal or business account?',
        position: { x: 260, y: 270 },
        options: [{ label: 'Business', nextId: 'business-billing' }],
      },
      {
        id: 'tech',
        type: 'end',
        text: 'Please restart the router, then call 555-0142 if it stays offline.',
        position: { x: 720, y: 270 },
        options: [],
      },
      {
        id: 'business-billing',
        type: 'end',
        text: 'A business billing agent will join shortly.',
        position: { x: 260, y: 500 },
        options: [],
      },
    ],
  },
  null,
  2,
)

function readNumber(value) {
  const parsed = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim(),
  )

  return Number.isFinite(parsed) ? parsed : null
}

function readCanvasSize(meta, fallbackCanvasSize) {
  const rawSize = meta?.canvas_size ?? meta?.canvasSize ?? {}
  const w = readNumber(rawSize.w ?? rawSize.width)
  const h = readNumber(rawSize.h ?? rawSize.height)

  return {
    w: w ?? fallbackCanvasSize.w,
    h: h ?? fallbackCanvasSize.h,
  }
}

function readPosition(value) {
  const x = readNumber(value?.x ?? value?.left)
  const y = readNumber(value?.y ?? value?.top)

  return x === null || y === null ? null : { x, y }
}

function getFirstDefined(source, keys) {
  return keys.reduce((found, key) => found ?? source?.[key], undefined)
}

function readNodeId(node, index) {
  return normalizeId(
    getFirstDefined(node, ['id', 'nodeId', 'node_id', 'node', 'source', 'sourceId', 'step']) ??
      `node-${index + 1}`,
  )
}

function readNodeText(node) {
  return String(
    getFirstDefined(node, [
      'text',
      'nodeText',
      'node_text',
      'question',
      'questionText',
      'question_text',
      'prompt',
      'message',
    ]) ?? '',
  ).trim()
}

function readRouteTarget(route) {
  return normalizeId(
    getFirstDefined(route, ['nextId', 'next_id', 'targetId', 'target_id', 'target', 'next']),
  )
}

function normalizeRoute(route, nodeId, routeIndex, warnings) {
  if (typeof route === 'string' || typeof route === 'number') {
    const nextId = normalizeId(route)

    return nextId ? { label: `Route to #${nextId}`, nextId } : null
  }

  if (Array.isArray(route)) {
    const label = String(route[0] ?? `Route ${routeIndex + 1}`).trim()
    const nextId = normalizeId(route[1])

    return nextId ? { label, nextId } : null
  }

  const nextId = readRouteTarget(route)

  if (!nextId) {
    warnings.push(
      `Route ${routeIndex + 1} on node #${nodeId} was skipped because it has no target.`,
    )
    return null
  }

  return {
    label: String(
      getFirstDefined(route, [
        'label',
        'option',
        'optionLabel',
        'answer',
        'answerLabel',
        'choice',
      ]) ?? `Route to #${nextId}`,
    ).trim(),
    nextId,
  }
}

function normalizeOptions(rawOptions, nodeId, warnings) {
  if (!rawOptions) {
    return []
  }

  if (!Array.isArray(rawOptions) && typeof rawOptions === 'object') {
    return Object.entries(rawOptions)
      .map(([label, nextId]) => ({
        label: String(label).trim(),
        nextId: normalizeId(nextId),
      }))
      .filter((option) => option.nextId)
  }

  if (!Array.isArray(rawOptions)) {
    return []
  }

  return rawOptions
    .map((route, index) => normalizeRoute(route, nodeId, index, warnings))
    .filter(Boolean)
}

function hasNativeNodes(value) {
  return Array.isArray(value?.nodes) || Array.isArray(value?.flow?.nodes)
}

function isNativeNodeArray(value) {
  return (
    Array.isArray(value) &&
    value.some(
      (node) =>
        node &&
        typeof node === 'object' &&
        ('options' in node || 'routes' in node || 'children' in node || 'position' in node),
    )
  )
}

function getRowsPayload(value) {
  if (Array.isArray(value)) {
    return value
  }

  return value?.rows ?? value?.data ?? value?.records ?? null
}

function objectRowsToTable(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]

  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
}

function createFlowFromJsonRows(rows, options) {
  if (rows.length > 0 && Array.isArray(rows[0])) {
    return createFlowFromRows(rows, {
      ...options,
      emptyMessage: 'The JSON rows array is empty.',
    })
  }

  if (rows.length > 0 && typeof rows[0] === 'object') {
    return createFlowFromRows(objectRowsToTable(rows), {
      ...options,
      emptyMessage: 'The JSON rows array is empty.',
    })
  }

  throw new Error('JSON rows must be an array of objects or arrays.')
}

export function createFlowFromJsonValue(value, { canvasSize = DEFAULT_CANVAS_SIZE } = {}) {
  if (!hasNativeNodes(value) && !isNativeNodeArray(value)) {
    const rows = getRowsPayload(value)

    if (Array.isArray(rows)) {
      return createFlowFromJsonRows(rows, { canvasSize })
    }

    throw new Error('JSON import must include a nodes array, flow.nodes, rows, data, or records.')
  }

  const sourceFlow = isNativeNodeArray(value)
    ? { nodes: value }
    : Array.isArray(value?.flow?.nodes)
      ? value.flow
      : value
  const warnings = []
  const fallbackCanvasSize = readCanvasSize(sourceFlow.meta, canvasSize)
  const explicitStartIds = sourceFlow.nodes
    .filter((node) => normalizeNodeType(node?.type) === 'start')
    .map((node, index) => readNodeId(node, index))
  const fallbackStartId = explicitStartIds[0] ?? readNodeId(sourceFlow.nodes[0], 0)

  const nodes = sourceFlow.nodes.map((node, index) => {
    const id = readNodeId(node, index)
    const options = normalizeOptions(node.options ?? node.routes ?? node.children, id, warnings)
    const type =
      normalizeNodeType(node.type) ??
      (id === fallbackStartId ? 'start' : options.length ? 'question' : 'end')
    const text =
      readNodeText(node) ||
      (type === 'end'
        ? `Terminal response for #${id}`
        : type === 'start'
          ? 'Imported start question'
          : `Imported question #${id}`)

    if (!readNodeText(node)) {
      warnings.push(`Node #${id} used generated text because the JSON entry was blank.`)
    }

    return {
      id,
      type,
      text,
      position: readPosition(node.position) ?? readPosition(node),
      options,
    }
  })

  if (nodes.length === 0) {
    throw new Error('JSON import did not contain any nodes.')
  }

  if (explicitStartIds.length === 0) {
    warnings.push(`No Start type was provided. Node #${fallbackStartId} was used as Start.`)
  }

  if (explicitStartIds.length > 1) {
    warnings.push('Multiple Start nodes were provided. Flow Health will flag this for review.')
  }

  return {
    flow: {
      meta: {
        theme: sourceFlow.meta?.theme ?? 'dark',
        canvas_size: layoutNodes(nodes, fallbackCanvasSize),
      },
      nodes,
    },
    warnings,
  }
}

export function createFlowFromJsonText(text, options) {
  try {
    return createFlowFromJsonValue(JSON.parse(text), options)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Could not parse JSON. Check the file syntax and try again.', {
        cause: error,
      })
    }

    throw error
  }
}
