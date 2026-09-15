export default function createXrayReport({
  flow,
  analysis,
  issues = [],
  scenarioLabel = 'Current flow',
  isDemo = false,
}) {
  const nodes = flow?.nodes ?? []
  const lines = [
    'SupportFlow X-Ray diagnostic report',
    `Scenario: ${scenarioLabel}${isDemo ? ' (temporary demo)' : ''}`,
    `Nodes: ${nodes.length}`,
    `Reachable: ${analysis.reachable.size} / ${nodes.length}`,
    `Unreachable: ${analysis.unreachable.length}`,
    `Broken references: ${analysis.brokenReferences.length}`,
    `Cycles: ${analysis.hasCycle ? 'detected' : 'none'}`,
    `Start nodes: ${analysis.startCount}`,
    `Terminal exits: ${analysis.terminalCount}`,
    `Max depth: ${analysis.maxDepth}`,
    '',
    'Issues:',
  ]

  if (issues.length === 0) {
    lines.push('- None')
  } else {
    issues.forEach((issue) => {
      lines.push(`- ${issue.severity.toUpperCase()}: ${issue.message}`)
    })
  }

  if (analysis.unreachable.length > 0) {
    lines.push('', 'Unreachable nodes:')
    analysis.unreachable.forEach((node) => {
      lines.push(`- #${node.id}: ${node.text}`)
    })
  }

  if (analysis.brokenReferences.length > 0) {
    lines.push('', 'Broken references:')
    analysis.brokenReferences.forEach((reference) => {
      lines.push(`- #${reference.sourceId} "${reference.label}" -> #${reference.targetId}`)
    })
  }

  if (analysis.cycleParticipants.size > 0) {
    lines.push('', 'Cycle participants:')
    analysis.cycleParticipants.forEach((id) => {
      lines.push(`- #${id}`)
    })
  }

  return lines.join('\n')
}
