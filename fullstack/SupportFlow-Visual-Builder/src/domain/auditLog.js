export const AUDIT_LOG_STORAGE_KEY = 'supportflow.audit-log.v1'
export const AUDIT_USER_STORAGE_KEY = 'supportflow.audit-user.v1'
export const DEFAULT_AUDIT_USER = 'Demo manager'
export const MAX_AUDIT_ENTRIES = 250

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function getTimestamp(now = Date.now()) {
  return new Date(now).toISOString()
}

function getAuditId(now = Date.now()) {
  if (globalThis.crypto?.randomUUID) {
    return `audit-${globalThis.crypto.randomUUID()}`
  }

  return `audit-${now}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTimestamp(value, fallback) {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function normalizeDetails(details) {
  if (details === null || details === undefined) {
    return ''
  }

  return String(details)
}

function normalizeMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return {}
  }

  return { ...meta }
}

export function normalizeAuditUser(user) {
  return String(user ?? '').trim() || DEFAULT_AUDIT_USER
}

export function loadAuditUser(storage = getStorage()) {
  if (!storage) {
    return DEFAULT_AUDIT_USER
  }

  try {
    return normalizeAuditUser(storage.getItem(AUDIT_USER_STORAGE_KEY))
  } catch {
    return DEFAULT_AUDIT_USER
  }
}

export function persistAuditUser(user, storage = getStorage()) {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(AUDIT_USER_STORAGE_KEY, String(user ?? ''))
    return true
  } catch {
    return false
  }
}

export function normalizeAuditEntry(entry, fallbackTimestamp = getTimestamp()) {
  if (!entry?.id || !entry?.action || !entry?.summary) {
    return null
  }

  return {
    id: String(entry.id),
    actor: normalizeAuditUser(entry.actor),
    action: String(entry.action),
    targetType: String(entry.targetType ?? 'flow'),
    targetId: String(entry.targetId ?? ''),
    targetLabel: String(entry.targetLabel ?? ''),
    summary: String(entry.summary),
    details: normalizeDetails(entry.details),
    workflowName: String(entry.workflowName ?? ''),
    createdAt: normalizeTimestamp(entry.createdAt, fallbackTimestamp),
    meta: normalizeMeta(entry.meta),
  }
}

export function loadAuditLog(storage = getStorage()) {
  if (!storage) {
    return []
  }

  try {
    const parsed = JSON.parse(storage.getItem(AUDIT_LOG_STORAGE_KEY) ?? '[]')

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map((entry) => normalizeAuditEntry(entry)).filter(Boolean)
  } catch {
    return []
  }
}

export function persistAuditLog(entries, storage = getStorage()) {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_AUDIT_ENTRIES)))
    return true
  } catch {
    return false
  }
}

export function createAuditEntry({
  actor,
  action,
  targetType = 'flow',
  targetId = '',
  targetLabel = '',
  summary,
  details = '',
  workflowName = '',
  meta = {},
  now = Date.now(),
}) {
  const timestamp = getTimestamp(now)

  return normalizeAuditEntry(
    {
      id: getAuditId(now),
      actor,
      action,
      targetType,
      targetId,
      targetLabel,
      summary,
      details,
      workflowName,
      createdAt: timestamp,
      meta,
    },
    timestamp,
  )
}

export function appendAuditEntry(entries, event, { maxEntries = MAX_AUDIT_ENTRIES } = {}) {
  const entry = event?.id ? normalizeAuditEntry(event) : createAuditEntry(event ?? {})

  if (!entry) {
    return entries
  }

  return [entry, ...entries].slice(0, maxEntries)
}

function getSearchableText(entry) {
  return [
    entry.actor,
    entry.action,
    entry.targetType,
    entry.targetId,
    entry.targetLabel,
    entry.summary,
    entry.details,
    entry.workflowName,
    ...Object.values(entry.meta ?? {}).map((value) => String(value)),
  ]
    .join(' ')
    .toLowerCase()
}

export function getAuditActions(entries) {
  return [...new Set(entries.map((entry) => entry.action))].sort()
}

export function searchAuditEntries(entries, { searchTerm = '', action = 'all' } = {}) {
  const normalizedSearch = String(searchTerm ?? '')
    .trim()
    .toLowerCase()

  return entries.filter((entry) => {
    const actionMatches = action === 'all' || entry.action === action
    const searchMatches = !normalizedSearch || getSearchableText(entry).includes(normalizedSearch)

    return actionMatches && searchMatches
  })
}

export function createAuditJsonExport(entries) {
  return JSON.stringify([...entries].reverse(), null, 2)
}

function escapeCsvCell(value) {
  const cell = String(value ?? '')

  if (!/[",\n\r]/.test(cell)) {
    return cell
  }

  return `"${cell.replaceAll('"', '""')}"`
}

export function createAuditCsvExport(entries) {
  const headers = [
    'createdAt',
    'actor',
    'action',
    'targetType',
    'targetId',
    'targetLabel',
    'workflowName',
    'summary',
    'details',
  ]
  const rows = [...entries]
    .reverse()
    .map((entry) => headers.map((header) => escapeCsvCell(entry[header])).join(','))

  return [headers.join(','), ...rows].join('\n')
}
