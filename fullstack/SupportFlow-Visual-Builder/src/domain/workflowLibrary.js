import validateFlow from './validateFlow.js'

export const WORKFLOW_LIBRARY_STORAGE_KEY = 'supportflow.workflow-library.v1'
export const DEFAULT_WORKFLOW_NAME = 'Main Flow'

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function cloneFlow(flow) {
  return JSON.parse(JSON.stringify(flow))
}

export function getWorkflowStats(flow) {
  return {
    nodeCount: flow.nodes.length,
    routeCount: flow.nodes.reduce((count, node) => count + (node.options ?? []).length, 0),
  }
}

function getRatingLabel(score) {
  if (score >= 95) {
    return 'Launch ready'
  }

  if (score >= 80) {
    return 'Strong'
  }

  if (score >= 60) {
    return 'Needs review'
  }

  return 'Blocked'
}

function getRatingTone(score) {
  if (score >= 95) {
    return 'excellent'
  }

  if (score >= 80) {
    return 'good'
  }

  if (score >= 60) {
    return 'warning'
  }

  return 'danger'
}

function getNormalizedRatingNodes(flow) {
  return (flow?.nodes ?? []).map((node) => ({
    ...node,
    options: Array.isArray(node.options) ? node.options : [],
  }))
}

function getUnnamedRoutes(nodes) {
  return nodes.flatMap((node) =>
    node.options.filter((option) => {
      const label = String(option.label ?? '')
        .trim()
        .toLowerCase()

      return !label || label === 'route' || /^route\s*\d*$/.test(label)
    }),
  )
}

function getPlaceholderNodes(nodes) {
  return nodes.filter((node) => {
    const text = String(node.text ?? '')
      .trim()
      .toLowerCase()

    return !text || text === 'new question' || text === 'new terminal outcome'
  })
}

function getIssueSuggestion(issueCode) {
  if (issueCode.startsWith('missing-target')) {
    return 'Reconnect routes that point to missing nodes.'
  }

  const suggestions = {
    'cycle-detected': 'Break loops so customers can reach a terminal outcome.',
    'duplicate-id': 'Give every node a unique ID before saving the workflow.',
    'invalid-start-count': 'Keep exactly one Start node for a predictable entry point.',
    'terminal-has-routes': 'Remove outgoing routes from Terminal nodes.',
    'unexpected-dead-end': 'Add routes or mark intentional endings as Terminal nodes.',
    'unreachable-node': 'Connect unreachable nodes back into the Start path.',
  }

  return suggestions[issueCode] ?? null
}

function getUniqueSuggestions(suggestions) {
  return [...new Set(suggestions.filter(Boolean))]
}

export function getWorkflowRating(flow) {
  const nodes = getNormalizedRatingNodes(flow)
  const issues = validateFlow(nodes)
  const stats = getWorkflowStats({ nodes })
  const errorCount = issues.filter((issue) => issue.severity === 'error').length
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length
  const unnamedRoutes = getUnnamedRoutes(nodes)
  const placeholderNodes = getPlaceholderNodes(nodes)
  const terminalCount = nodes.filter((node) => node.type === 'end').length

  const issuePenalty = errorCount * 18 + warningCount * 8
  const routePenalty = Math.min(unnamedRoutes.length * 4, 16)
  const placeholderPenalty = Math.min(placeholderNodes.length * 5, 15)
  const terminalPenalty = terminalCount === 0 && nodes.length > 0 ? 12 : 0
  const emptyPenalty = nodes.length === 0 ? 100 : 0
  const score = Math.max(
    0,
    Math.min(
      100,
      100 - issuePenalty - routePenalty - placeholderPenalty - terminalPenalty - emptyPenalty,
    ),
  )

  const suggestions = getUniqueSuggestions([
    ...issues.map((issue) => getIssueSuggestion(issue.code)),
    unnamedRoutes.length > 0
      ? `Rename ${unnamedRoutes.length} generic route label${unnamedRoutes.length === 1 ? '' : 's'}.`
      : null,
    placeholderNodes.length > 0
      ? `Replace ${placeholderNodes.length} placeholder node message${
          placeholderNodes.length === 1 ? '' : 's'
        }.`
      : null,
    terminalCount === 0 && nodes.length > 0
      ? 'Add at least one Terminal node so Preview can end cleanly.'
      : null,
    stats.routeCount === 0 && stats.nodeCount > 1
      ? 'Connect nodes with routes so the workflow can be traversed.'
      : null,
  ])

  return {
    score,
    label: getRatingLabel(score),
    tone: getRatingTone(score),
    issueCount: issues.length,
    errorCount,
    warningCount,
    suggestions:
      suggestions.length > 0
        ? suggestions.slice(0, 3)
        : ['Ready to preview. Test each route once before sharing the workflow.'],
  }
}

function getWorkflowId(now = Date.now()) {
  if (globalThis.crypto?.randomUUID) {
    return `workflow-${globalThis.crypto.randomUUID()}`
  }

  return `workflow-${now}-${Math.random().toString(36).slice(2, 8)}`
}

function getTimestamp(now = Date.now()) {
  return new Date(now).toISOString()
}

function normalizeWorkflowName(name) {
  return String(name ?? '').trim() || 'Untitled workflow'
}

function normalizeTimestamp(value, fallback) {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

export function normalizeWorkflowRecord(record) {
  if (!record?.id || !Array.isArray(record?.flow?.nodes)) {
    return null
  }

  const fallbackTimestamp = getTimestamp()

  return {
    id: String(record.id),
    name: normalizeWorkflowName(record.name),
    flow: cloneFlow(record.flow),
    createdAt: normalizeTimestamp(record.createdAt, fallbackTimestamp),
    updatedAt: normalizeTimestamp(record.updatedAt, fallbackTimestamp),
  }
}

export function loadWorkflowLibrary(storage = getStorage()) {
  if (!storage) {
    return []
  }

  try {
    const parsed = JSON.parse(storage.getItem(WORKFLOW_LIBRARY_STORAGE_KEY) ?? '[]')

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map(normalizeWorkflowRecord).filter(Boolean)
  } catch {
    return []
  }
}

export function persistWorkflowLibrary(workflows, storage = getStorage()) {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(WORKFLOW_LIBRARY_STORAGE_KEY, JSON.stringify(workflows))
    return true
  } catch {
    return false
  }
}

export function saveWorkflow(workflows, { id = null, name, flow, now = Date.now() }) {
  const existingWorkflow = workflows.find((workflow) => workflow.id === id) ?? null
  const timestamp = getTimestamp(now)
  const workflow = {
    id: existingWorkflow?.id ?? id ?? getWorkflowId(now),
    name: normalizeWorkflowName(name),
    flow: cloneFlow(flow),
    createdAt: existingWorkflow?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }
  const nextWorkflows = existingWorkflow
    ? workflows.map((currentWorkflow) =>
        currentWorkflow.id === workflow.id ? workflow : currentWorkflow,
      )
    : [workflow, ...workflows]

  return { workflow, workflows: nextWorkflows }
}

export function renameWorkflow(workflows, workflowId, name, now = Date.now()) {
  const timestamp = getTimestamp(now)
  const nextName = normalizeWorkflowName(name)
  const workflow = workflows.find((currentWorkflow) => currentWorkflow.id === workflowId) ?? null

  if (!workflow) {
    return { workflow: null, workflows }
  }

  const renamedWorkflow = {
    ...workflow,
    name: nextName,
    updatedAt: timestamp,
  }

  return {
    workflow: renamedWorkflow,
    workflows: workflows.map((currentWorkflow) =>
      currentWorkflow.id === workflowId ? renamedWorkflow : currentWorkflow,
    ),
  }
}

export function deleteWorkflow(workflows, workflowId) {
  return workflows.filter((workflow) => workflow.id !== workflowId)
}

function getSearchableWorkflowText(workflow) {
  const rating = getWorkflowRating(workflow.flow)
  const flowText = workflow.flow.nodes.flatMap((node) => [
    node.id,
    node.type,
    node.text,
    ...(node.options ?? []).flatMap((option) => [option.label, option.nextId]),
  ])

  return [workflow.name, rating.label, `${rating.score}/100`, ...rating.suggestions, ...flowText]
    .join(' ')
    .toLowerCase()
}

export function searchWorkflows(workflows, searchTerm) {
  const normalizedSearch = String(searchTerm ?? '')
    .trim()
    .toLowerCase()

  if (!normalizedSearch) {
    return workflows
  }

  return workflows.filter((workflow) =>
    getSearchableWorkflowText(workflow).includes(normalizedSearch),
  )
}
