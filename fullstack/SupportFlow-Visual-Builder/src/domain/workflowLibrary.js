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
  const flowText = workflow.flow.nodes.flatMap((node) => [
    node.id,
    node.type,
    node.text,
    ...(node.options ?? []).flatMap((option) => [option.label, option.nextId]),
  ])

  return [workflow.name, ...flowText].join(' ').toLowerCase()
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
