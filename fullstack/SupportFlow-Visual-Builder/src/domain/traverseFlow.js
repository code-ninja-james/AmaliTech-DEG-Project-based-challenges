/**
 * Provides the core traversal helpers for SupportFlow's preview runner.
 *
 * The visual editor and preview use the same flow structure, but traversal
 * should remain independent from React so it can be tested as pure domain
 * logic and reused by future validation features.
 */

/**
 * Returns the single configured Start node.
 *
 * @param {Array} nodes
 * @returns {object|null}
 */
export function getStartNode(nodes) {
  return nodes.find((node) => node.type === 'start') ?? null
}

/**
 * Resolves a node by its id.
 *
 * Missing targets return null instead of throwing so malformed flows can be
 * surfaced gracefully rather than crashing the preview experience.
 *
 * @param {Array} nodes
 * @param {string} nodeId
 * @returns {object|null}
 */
export function getNodeById(nodes, nodeId) {
  return nodes.find((node) => node.id === nodeId) ?? null
}

/**
 * Resolves the node reached by selecting a specific option.
 *
 * @param {Array} nodes
 * @param {{ nextId: string }} option
 * @returns {object|null}
 */
export function getNextNode(nodes, option) {
  return getNodeById(nodes, option.nextId)
}
