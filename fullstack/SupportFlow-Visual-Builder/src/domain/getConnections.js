/**
 * Converts SupportFlow node options into explicit directed graph connections.
 *
 * In flow_data.json, an option is more than display text: its `nextId`
 * represents an edge from the current node to another node. Normalising those
 * relationships here keeps graph knowledge outside React components and makes
 * the connection model independently testable.
 */

export default function getConnections(nodes) {
  return nodes.flatMap((node) => {
    const options = node.options ?? []

    return options.map((option, optionIndex) => ({
      // optionIndex keeps connections unique when multiple options point
      // to the same target, as happens with the Billing routes.
      id: `${node.id}-${optionIndex}-${option.nextId}`,
      sourceId: node.id,
      targetId: option.nextId,
      label: option.label,
      optionIndex,
      sourceOptionCount: options.length,
    }))
  })
}
