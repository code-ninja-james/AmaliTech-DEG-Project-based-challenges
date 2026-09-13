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
  const visited = new Set()
  const stack = new Set()
  const participants = new Set()

  function visit(nodeId) {
    if (stack.has(nodeId)) {
      participants.add(nodeId)
      return true
    }

    if (visited.has(nodeId)) {
      return false
    }

    visited.add(nodeId)
    stack.add(nodeId)

    const node = nodeMap.get(nodeId)
    let hasCycle = false

    node?.options.forEach((option) => {
      if (!nodeMap.has(option.nextId)) {
        return
      }

      if (stack.has(option.nextId)) {
        participants.add(nodeId)
        participants.add(option.nextId)
        hasCycle = true
        return
      }

      if (visit(option.nextId)) {
        participants.add(nodeId)
        hasCycle = true
      }
    })

    stack.delete(nodeId)
    return hasCycle
  }

  nodes.forEach((node) => visit(node.id))

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
  const terminalsWithRoutes = nodes.filter(
    (node) => node.type === 'end' && node.options.length > 0,
  )
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
