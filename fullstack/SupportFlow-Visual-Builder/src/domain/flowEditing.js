const NODE_PADDING = 40
const NODE_WIDTH = 220
const NODE_HEIGHT = 120
const HORIZONTAL_STEP = 260
const VERTICAL_STEP = 120

const DEFAULT_NODE_TEXT = {
  question: 'New question',
  end: 'New terminal response',
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getCanvasSize(flow) {
  return flow.meta?.canvas_size ?? { w: 1200, h: 800 }
}

function isNearExistingNode(position, nodes) {
  return nodes.some(
    (node) =>
      Math.abs(node.position.x - position.x) < NODE_WIDTH &&
      Math.abs(node.position.y - position.y) < NODE_HEIGHT,
  )
}

export function getNextNodeId(nodes) {
  const existingIds = new Set(nodes.map((node) => node.id))
  const numericIds = nodes.map((node) => Number(node.id)).filter(Number.isInteger)

  if (numericIds.length === nodes.length) {
    return String(Math.max(0, ...numericIds) + 1)
  }

  let index = nodes.length + 1
  let candidate = `node-${index}`

  while (existingIds.has(candidate)) {
    index += 1
    candidate = `node-${index}`
  }

  return candidate
}

export function getDefaultRouteTargetId(nodes, sourceNodeId) {
  return (
    nodes.find((node) => node.type === 'end' && node.id !== sourceNodeId)?.id ??
    nodes.find((node) => node.id !== sourceNodeId)?.id ??
    sourceNodeId
  )
}

export function getNewNodePosition(flow, sourceNodeId) {
  const canvasSize = getCanvasSize(flow)
  const sourceNode = flow.nodes.find((node) => node.id === sourceNodeId)
  const maxX = Math.max(NODE_PADDING, canvasSize.w - NODE_WIDTH)
  const maxY = Math.max(NODE_PADDING, canvasSize.h - NODE_HEIGHT)
  const baseX = sourceNode
    ? sourceNode.position.x + HORIZONTAL_STEP
    : NODE_PADDING + (flow.nodes.length % 4) * HORIZONTAL_STEP
  const baseY = sourceNode
    ? sourceNode.position.y + VERTICAL_STEP + sourceNode.options.length * 70
    : NODE_PADDING + Math.floor(flow.nodes.length / 4) * VERTICAL_STEP

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const position = {
      x: clamp(baseX + (attempt % 3) * 44, NODE_PADDING, maxX),
      y: clamp(baseY + attempt * 72, NODE_PADDING, maxY),
    }

    if (!isNearExistingNode(position, flow.nodes)) {
      return position
    }
  }

  return {
    x: clamp(baseX, NODE_PADDING, maxX),
    y: clamp(baseY, NODE_PADDING, maxY),
  }
}

export function addNode(flow, { id, type = 'question', sourceNodeId = null }) {
  const nodeType = type === 'end' ? 'end' : 'question'
  const newNode = {
    id,
    type: nodeType,
    text: DEFAULT_NODE_TEXT[nodeType],
    position: getNewNodePosition(flow, sourceNodeId),
    options: [],
  }

  return {
    ...flow,
    nodes: [
      ...flow.nodes.map((node) => {
        if (node.id !== sourceNodeId || node.type === 'end') {
          return node
        }

        return {
          ...node,
          options: [
            ...node.options,
            {
              label: nodeType === 'end' ? 'New terminal route' : 'New question route',
              nextId: id,
            },
          ],
        }
      }),
      newNode,
    ],
  }
}

export function addRoute(flow, nodeId) {
  return {
    ...flow,
    nodes: flow.nodes.map((node) => {
      if (node.id !== nodeId || node.type === 'end') {
        return node
      }

      return {
        ...node,
        options: [
          ...node.options,
          {
            label: 'New route',
            nextId: getDefaultRouteTargetId(flow.nodes, nodeId),
          },
        ],
      }
    }),
  }
}

export function updateRoute(flow, nodeId, optionIndex, patch) {
  return {
    ...flow,
    nodes: flow.nodes.map((node) => {
      if (node.id !== nodeId) {
        return node
      }

      return {
        ...node,
        options: node.options.map((option, index) =>
          index === optionIndex ? { ...option, ...patch } : option,
        ),
      }
    }),
  }
}

export function removeRoute(flow, nodeId, optionIndex) {
  return {
    ...flow,
    nodes: flow.nodes.map((node) => {
      if (node.id !== nodeId) {
        return node
      }

      return {
        ...node,
        options: node.options.filter((_, index) => index !== optionIndex),
      }
    }),
  }
}

export function removeNode(flow, nodeId) {
  const nodeToRemove = flow.nodes.find((node) => node.id === nodeId)

  if (!nodeToRemove || nodeToRemove.type === 'start') {
    return flow
  }

  return {
    ...flow,
    nodes: flow.nodes
      .filter((node) => node.id !== nodeId)
      .map((node) => ({
        ...node,
        options: node.options.filter((option) => option.nextId !== nodeId),
      })),
  }
}
