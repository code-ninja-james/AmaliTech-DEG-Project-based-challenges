import analyzeFlow from './analyzeFlow.js'

/** Temporary diagnostic examples generated from the active workflow. */
export const XRAY_DEMO_SCENARIOS = [
  {
    id: 'current',
    label: 'Current flow',
    description: 'Inspect the workflow exactly as it is right now.',
  },
  {
    id: 'broken-reference',
    label: 'Broken reference',
    description: 'Temporarily adds a route in this workflow that points to a missing node.',
  },
  {
    id: 'unreachable-branch',
    label: 'Unreachable branch',
    description: 'Temporarily disconnects a branch in this workflow so X-Ray can flag it.',
  },
  {
    id: 'cycle',
    label: 'Cycle',
    description: 'Temporarily adds a loop in this workflow so X-Ray can detect a cycle.',
  },
  {
    id: 'question-no-routes',
    label: 'Question with no routes',
    description: 'Temporarily adds a reachable question that has no answer routes.',
  },
]

const DEMO_NODE_WIDTH = 220
const DEMO_NODE_HEIGHT = 140
const DEMO_NODE_OFFSET = { x: 300, y: 190 }

function cloneFlow(flow) {
  return JSON.parse(JSON.stringify(flow))
}

function getOptions(node) {
  return Array.isArray(node?.options) ? node.options : []
}

function getUniqueNodeId(nodes, baseId) {
  const existingIds = new Set(nodes.map((node) => node.id))
  let suffix = 1
  let nextId = baseId

  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`
    suffix += 1
  }

  return nextId
}

function getReachableNonTerminalNode(nodes, allowNoRoutes = false) {
  const analysis = analyzeFlow(nodes)
  const isUsableSource = (node) =>
    analysis.reachable.has(node.id) &&
    node.type !== 'end' &&
    (allowNoRoutes || getOptions(node).length > 0)

  return (
    nodes.find((node) => node.type === 'question' && isUsableSource(node)) ??
    nodes.find((node) => node.type === 'start' && isUsableSource(node)) ??
    nodes.find(isUsableSource) ??
    null
  )
}

function getDemoPosition(sourceNode, nodes, index = 0) {
  const sourcePosition = sourceNode?.position ?? { x: 520, y: 80 }
  const usedPositions = new Set(
    nodes.map((node) => `${node.position?.x ?? 0}:${node.position?.y ?? 0}`),
  )
  let position = {
    x: sourcePosition.x + DEMO_NODE_OFFSET.x,
    y: sourcePosition.y + DEMO_NODE_OFFSET.y + index * 48,
  }
  let attempts = 0

  while (usedPositions.has(`${position.x}:${position.y}`) && attempts < 8) {
    position = {
      x: position.x + 48,
      y: position.y + 48,
    }
    attempts += 1
  }

  return position
}

function includeNodeInCanvas(flow, node) {
  const currentSize = flow.meta?.canvas_size ?? { w: 1200, h: 800 }

  flow.meta = {
    ...(flow.meta ?? {}),
    canvas_size: {
      w: Math.max(currentSize.w, (node.position?.x ?? 0) + DEMO_NODE_WIDTH),
      h: Math.max(currentSize.h, (node.position?.y ?? 0) + DEMO_NODE_HEIGHT),
    },
  }
}

function createBrokenReferenceDemo(flow) {
  const demo = cloneFlow(flow)
  const sourceNode = getReachableNonTerminalNode(demo.nodes, true)

  if (!sourceNode) {
    return demo
  }

  const missingNodeId = getUniqueNodeId(demo.nodes, 'missing-demo-node')

  sourceNode.options = [
    ...getOptions(sourceNode),
    {
      label: 'X-Ray missing target',
      nextId: missingNodeId,
    },
  ]

  return demo
}

function createUnreachableBranchDemo(flow) {
  const sourceFlow = cloneFlow(flow)

  for (const sourceNode of sourceFlow.nodes) {
    const options = getOptions(sourceNode)

    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
      const candidate = cloneFlow(flow)
      const candidateSource = candidate.nodes.find((node) => node.id === sourceNode.id)

      candidateSource.options = getOptions(candidateSource).filter(
        (_option, index) => index !== optionIndex,
      )

      const analysis = analyzeFlow(candidate.nodes)

      if (analysis.unreachable.length > 0 && analysis.brokenReferences.length === 0) {
        return candidate
      }
    }
  }

  const fallback = cloneFlow(flow)
  const branchNode = {
    id: getUniqueNodeId(fallback.nodes, 'unreachable-demo-question'),
    type: 'question',
    text: 'X-Ray demo unreachable question.',
    position: getDemoPosition(fallback.nodes[0], fallback.nodes),
    options: [
      {
        label: 'Continue demo branch',
        nextId: getUniqueNodeId(fallback.nodes, 'unreachable-demo-terminal'),
      },
    ],
  }
  const terminalNode = {
    id: branchNode.options[0].nextId,
    type: 'end',
    text: 'X-Ray demo unreachable terminal.',
    position: getDemoPosition(branchNode, fallback.nodes, 1),
    options: [],
  }

  fallback.nodes.push(branchNode, terminalNode)
  includeNodeInCanvas(fallback, branchNode)
  includeNodeInCanvas(fallback, terminalNode)

  return fallback
}

function createCycleDemo(flow) {
  const demo = cloneFlow(flow)
  const sourceNode = getReachableNonTerminalNode(demo.nodes, true)

  if (!sourceNode) {
    return demo
  }

  sourceNode.options = [
    ...getOptions(sourceNode),
    {
      label: 'X-Ray loop back',
      nextId: sourceNode.id,
    },
  ]

  return demo
}

function createQuestionNoRoutesDemo(flow) {
  const demo = cloneFlow(flow)
  const sourceNode = getReachableNonTerminalNode(demo.nodes, true)

  if (!sourceNode) {
    return demo
  }

  const questionNode = {
    id: getUniqueNodeId(demo.nodes, 'question-with-no-routes-demo'),
    type: 'question',
    text: 'X-Ray demo question with no routes.',
    position: getDemoPosition(sourceNode, demo.nodes),
    options: [],
  }

  sourceNode.options = [
    ...getOptions(sourceNode),
    {
      label: 'Open incomplete question',
      nextId: questionNode.id,
    },
  ]

  demo.nodes.push(questionNode)
  includeNodeInCanvas(demo, questionNode)

  return demo
}

const SCENARIO_BUILDERS = {
  'broken-reference': createBrokenReferenceDemo,
  'unreachable-branch': createUnreachableBranchDemo,
  cycle: createCycleDemo,
  'question-no-routes': createQuestionNoRoutesDemo,
}

export default function createXrayDemo(flow, scenarioId) {
  const buildScenario = SCENARIO_BUILDERS[scenarioId]

  return buildScenario ? buildScenario(flow) : flow
}
