/**
 * Performs structural validation on a SupportFlow decision tree.
 *
 * Visual inspection alone cannot reveal every configuration problem. This
 * validator detects graph errors that could break a live support journey,
 * including missing route targets, duplicate ids, invalid Start configuration,
 * unreachable nodes, unexpected dead ends, cycles, and Terminal nodes that
 * incorrectly continue routing.
 *
 * The validator is deliberately independent from React so the same rules can
 * later support editor warnings, publishing guards, or server-side validation.
 */

const ERROR = 'error'
const WARNING = 'warning'

function createIssue({ code, severity, message, nodeId = null }) {
  return {
    id: nodeId ? `${code}-${nodeId}` : code,
    code,
    severity,
    message,
    nodeId,
  }
}

function findDuplicateIds(nodes) {
  const counts = new Map()

  nodes.forEach((node) => {
    counts.set(node.id, (counts.get(node.id) ?? 0) + 1)
  })

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([nodeId]) =>
      createIssue({
        code: 'duplicate-id',
        severity: ERROR,
        nodeId,
        message: `Node id #${nodeId} is used more than once.`,
      }),
    )
}

function findRouteIssues(nodes, nodeIds) {
  const issues = []

  nodes.forEach((node) => {
    const options = Array.isArray(node.options) ? node.options : []

    if (node.type === 'end' && options.length > 0) {
      issues.push(
        createIssue({
          code: 'terminal-has-routes',
          severity: ERROR,
          nodeId: node.id,
          message: `Terminal node #${node.id} has outgoing routes.`,
        }),
      )
    }

    if (node.type !== 'end' && options.length === 0) {
      issues.push(
        createIssue({
          code: 'unexpected-dead-end',
          severity: ERROR,
          nodeId: node.id,
          message: `Node #${node.id} ends unexpectedly without any routes.`,
        }),
      )
    }

    options.forEach((option, optionIndex) => {
      if (!nodeIds.has(option.nextId)) {
        issues.push(
          createIssue({
            code: `missing-target-${optionIndex}`,
            severity: ERROR,
            nodeId: node.id,
            message: `Route "${option.label}" from node #${node.id} points to missing node #${option.nextId}.`,
          }),
        )
      }
    })
  })

  return issues
}

function findUnreachableNodes(nodes, startNode, nodeIds) {
  if (!startNode) {
    return []
  }

  const visited = new Set()
  const queue = [startNode.id]

  while (queue.length > 0) {
    const nodeId = queue.shift()

    if (visited.has(nodeId)) {
      continue
    }

    visited.add(nodeId)

    const node = nodes.find((candidate) => candidate.id === nodeId)

    if (!node) {
      continue
    }

    node.options.forEach((option) => {
      // Broken references are reported separately and should not interfere
      // with reachability analysis.
      if (nodeIds.has(option.nextId) && !visited.has(option.nextId)) {
        queue.push(option.nextId)
      }
    })
  }

  return nodes
    .filter((node) => !visited.has(node.id))
    .map((node) =>
      createIssue({
        code: 'unreachable-node',
        severity: WARNING,
        nodeId: node.id,
        message: `Node #${node.id} cannot be reached from the Start node.`,
      }),
    )
}

function hasCycle(nodes, nodeIds) {
  const adjacency = new Map()
  const inDegree = new Map()

  nodeIds.forEach((nodeId) => {
    adjacency.set(nodeId, [])
    inDegree.set(nodeId, 0)
  })

  nodes.forEach((node) => {
    node.options.forEach((option) => {
      if (!nodeIds.has(option.nextId)) {
        return
      }

      adjacency.get(node.id)?.push(option.nextId)

      inDegree.set(option.nextId, (inDegree.get(option.nextId) ?? 0) + 1)
    })
  })

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([nodeId]) => nodeId)

  let processedNodes = 0

  while (queue.length > 0) {
    const nodeId = queue.shift()
    processedNodes += 1

    adjacency.get(nodeId)?.forEach((targetId) => {
      const nextDegree = inDegree.get(targetId) - 1

      inDegree.set(targetId, nextDegree)

      if (nextDegree === 0) {
        queue.push(targetId)
      }
    })
  }

  // Kahn's topological-sort algorithm processes every node only when the
  // directed graph is acyclic. Remaining nodes therefore prove a cycle exists.
  return processedNodes !== nodeIds.size
}

/**
 * Validates the structural integrity of a SupportFlow graph.
 *
 * @param {Array} nodes
 * @returns {Array<{
 *   id: string,
 *   code: string,
 *   severity: 'error'|'warning',
 *   message: string,
 *   nodeId: string|null
 * }>}
 */
export default function validateFlow(nodes) {
  const issues = []
  const nodeIds = new Set(nodes.map((node) => node.id))
  const startNodes = nodes.filter((node) => node.type === 'start')

  issues.push(...findDuplicateIds(nodes))

  if (startNodes.length !== 1) {
    issues.push(
      createIssue({
        code: 'invalid-start-count',
        severity: ERROR,
        message: `Flow must contain exactly one Start node; found ${startNodes.length}.`,
      }),
    )
  }

  issues.push(...findRouteIssues(nodes, nodeIds))

  if (startNodes.length === 1) {
    issues.push(...findUnreachableNodes(nodes, startNodes[0], nodeIds))
  }

  if (hasCycle(nodes, nodeIds)) {
    issues.push(
      createIssue({
        code: 'cycle-detected',
        severity: ERROR,
        message: 'The flow contains a cycle and may trap users in an endless journey.',
      }),
    )
  }

  return issues
}
