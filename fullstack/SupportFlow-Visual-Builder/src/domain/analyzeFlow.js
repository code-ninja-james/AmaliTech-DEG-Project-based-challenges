/**
 * Computes the structural diagnostics used by X-Ray mode and inspector health.
 *
 * The analysis is intentionally framework-agnostic. Rendering components can
 * consume the same reachability, depth, cycle and reference data without
 * reimplementing graph traversal rules in multiple places.
 */

function getStartNodes(nodes) {
  return nodes.filter((node) => node.type === 'start')
}

function getNodeMap(nodes) {
  return new Map(nodes.map((node) => [node.id, node]))
}

function getReachability(nodes, nodeMap, startNode) {
  const reachable = new Set()
  const depthById = new Map()

  if (!startNode) {
    return { reachable, depthById }
  }

  const queue = [{ id: startNode.id, depth: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()

    if (reachable.has(current.id)) {
      continue
    }

    reachable.add(current.id)
    depthById.set(current.id, current.depth)

    const node = nodeMap.get(current.id)

    node?.options.forEach((option) => {
      if (nodeMap.has(option.nextId) && !reachable.has(option.nextId)) {
        queue.push({ id: option.nextId, depth: current.depth + 1 })
      }
    })
  }

  return { reachable, depthById }
}

function detectCycle(nodes, nodeMap) {
  // Strongly connected components identify actual cycle members, excluding
  // nodes that only lead into a cycle or are reachable after it.
  const indices = new Map()
  const lowLinks = new Map()
  const stack = []
  const onStack = new Set()
  const participants = new Set()
  let nextIndex = 0

  function visit(nodeId) {
    indices.set(nodeId, nextIndex)
    lowLinks.set(nodeId, nextIndex)
    nextIndex += 1
    stack.push(nodeId)
    onStack.add(nodeId)

    nodeMap.get(nodeId).options.forEach((option) => {
      if (!nodeMap.has(option.nextId)) {
        return
      }

      if (!indices.has(option.nextId)) {
        visit(option.nextId)
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId), lowLinks.get(option.nextId)))
      } else if (onStack.has(option.nextId)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId), indices.get(option.nextId)))
      }
    })

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) return

    const component = []
    let member

    do {
      member = stack.pop()
      onStack.delete(member)
      component.push(member)
    } while (member !== nodeId)

    if (
      component.length > 1 ||
      nodeMap.get(nodeId).options.some((option) => option.nextId === nodeId)
    ) {
      component.forEach((id) => participants.add(id))
    }
  }

  nodes.forEach((node) => {
    if (!indices.has(node.id)) visit(node.id)
  })

  return {
    hasCycle: participants.size > 0,
    cycleParticipants: participants,
  }
}

export default function analyzeFlow(nodes) {
  const nodeMap = getNodeMap(nodes)
  const startNodes = getStartNodes(nodes)
  const startNode = startNodes[0] ?? null
  const { reachable, depthById } = getReachability(nodes, nodeMap, startNode)
  const { hasCycle, cycleParticipants } = detectCycle(nodes, nodeMap)

  const brokenReferences = nodes.flatMap((node) =>
    node.options
      .filter((option) => !nodeMap.has(option.nextId))
      .map((option) => ({
        sourceId: node.id,
        targetId: option.nextId,
        label: option.label,
      })),
  )

  const unreachable = nodes.filter((node) => !reachable.has(node.id))
  const terminalsWithRoutes = nodes.filter((node) => node.type === 'end' && node.options.length > 0)
  const questionsWithoutRoutes = nodes.filter(
    (node) => node.type === 'question' && node.options.length === 0,
  )
  const terminalCount = nodes.filter(
    (node) => node.type === 'end' || node.options.length === 0,
  ).length

  const maxDepth = Math.max(0, ...depthById.values())

  return {
    nodeMap,
    startNode,
    startCount: startNodes.length,
    reachable,
    unreachable,
    depthById,
    maxDepth,
    brokenReferences,
    hasCycle,
    cycleParticipants,
    terminalsWithRoutes,
    questionsWithoutRoutes,
    terminalCount,
    isHealthy:
      startNodes.length === 1 &&
      unreachable.length === 0 &&
      brokenReferences.length === 0 &&
      !hasCycle &&
      terminalsWithRoutes.length === 0 &&
      questionsWithoutRoutes.length === 0,
  }
}
