/** Temporary diagnostic examples built from the current six-node challenge flow. */
export const XRAY_DEMO_SCENARIOS = [
  {
    id: 'current',
    label: 'Current flow',
    description: 'Choose an example to see how X-Ray identifies a structural problem.',
  },
  {
    id: 'broken-reference',
    label: 'Broken reference',
    description: 'The Business route from node #3 points to a missing billing node.',
  },
  {
    id: 'unreachable-branch',
    label: 'Unreachable branch',
    description:
      'The Billing route from Start is disconnected. Nodes #3 and #6 become unreachable.',
  },
  {
    id: 'cycle',
    label: 'Cycle',
    description: 'An extra route sends node #3 back to itself. All six nodes remain reachable.',
  },
]

export default function createXrayDemo(flow, scenarioId) {
  if (scenarioId === 'current' || !XRAY_DEMO_SCENARIOS.some(({ id }) => id === scenarioId)) {
    return flow
  }

  return {
    ...flow,
    nodes: flow.nodes.map((node) => {
      if (scenarioId === 'unreachable-branch' && node.id === '1') {
        return { ...node, options: node.options.filter((option) => option.nextId !== '3') }
      }

      if (node.id === '3' && scenarioId === 'broken-reference') {
        return {
          ...node,
          options: node.options.map((option, index) =>
            index === 1 ? { ...option, nextId: 'missing-billing' } : option,
          ),
        }
      }

      if (node.id === '3' && scenarioId === 'cycle') {
        return {
          ...node,
          options: [...node.options, { label: 'Check account again', nextId: node.id }],
        }
      }

      return node
    }),
  }
}
