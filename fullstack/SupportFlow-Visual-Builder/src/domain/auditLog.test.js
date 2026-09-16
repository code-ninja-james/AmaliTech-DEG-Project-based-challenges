import { describe, expect, it } from 'vitest'

import {
  AUDIT_LOG_STORAGE_KEY,
  AUDIT_USER_STORAGE_KEY,
  appendAuditEntry,
  createAuditCsvExport,
  createAuditJsonExport,
  loadAuditLog,
  loadAuditUser,
  persistAuditLog,
  persistAuditUser,
  searchAuditEntries,
} from './auditLog.js'

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues))

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

describe('auditLog', () => {
  it('persists and loads the current audit user', () => {
    const storage = createMemoryStorage()

    expect(loadAuditUser(storage)).toBe('Demo manager')

    expect(persistAuditUser('Jameson', storage)).toBe(true)
    expect(storage.getItem(AUDIT_USER_STORAGE_KEY)).toBe('Jameson')
    expect(loadAuditUser(storage)).toBe('Jameson')
  })

  it('appends normalized entries newest first and searches them', () => {
    const entries = appendAuditEntry([], {
      actor: 'Jameson',
      action: 'route.added',
      targetType: 'route',
      targetId: '2-0',
      targetLabel: '"Billing" from node #2',
      summary: 'Added route "Billing" from node #2 to node #4.',
      details: 'Target node: terminal node #4.',
      workflowName: 'Main Flow',
      now: Date.UTC(2026, 8, 15, 12, 0, 0),
    })
    const nextEntries = appendAuditEntry(entries, {
      actor: 'Admin',
      action: 'node.edited',
      targetType: 'node',
      targetId: '2',
      summary: 'Edited question node #2.',
      now: Date.UTC(2026, 8, 15, 12, 1, 0),
    })

    expect(nextEntries).toHaveLength(2)
    expect(nextEntries[0].summary).toBe('Edited question node #2.')
    expect(searchAuditEntries(nextEntries, { searchTerm: 'billing' })).toHaveLength(1)
    expect(searchAuditEntries(nextEntries, { action: 'node.edited' })).toHaveLength(1)
  })

  it('persists the audit log and ignores corrupt storage', () => {
    const storage = createMemoryStorage()
    const entries = appendAuditEntry([], {
      actor: 'Jameson',
      action: 'workflow.saved',
      targetType: 'workflow',
      summary: 'Saved workflow "Billing".',
    })

    expect(persistAuditLog(entries, storage)).toBe(true)
    expect(JSON.parse(storage.getItem(AUDIT_LOG_STORAGE_KEY))).toHaveLength(1)
    expect(loadAuditLog(storage)).toHaveLength(1)

    const corruptStorage = createMemoryStorage({ [AUDIT_LOG_STORAGE_KEY]: '{broken' })

    expect(loadAuditLog(corruptStorage)).toEqual([])
  })

  it('exports audit entries as JSON and CSV', () => {
    const entries = appendAuditEntry([], {
      actor: 'Jameson',
      action: 'route.deleted',
      targetType: 'route',
      targetId: '2-1',
      targetLabel: '"No" from node #2',
      summary: 'Deleted route "No".',
      details: 'Removed route from node #2 to node #5.',
      workflowName: 'Main Flow',
      now: Date.UTC(2026, 8, 15, 12, 0, 0),
    })

    expect(createAuditJsonExport(entries)).toContain('"summary": "Deleted route \\"No\\"."')
    expect(createAuditCsvExport(entries)).toContain('actor,action,targetType,targetId,targetLabel')
    expect(createAuditCsvExport(entries)).toContain('"Deleted route ""No""."')
  })
})
