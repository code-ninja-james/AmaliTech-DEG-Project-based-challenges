import { useMemo, useState } from 'react'

import { getAuditActions, normalizeAuditUser, searchAuditEntries } from '../../domain/auditLog.js'

const ACTION_LABELS = {
  'delete.undone': 'Undo delete',
  'import.completed': 'Import',
  'node.added': 'Add node',
  'node.deleted': 'Delete node',
  'node.edited': 'Edit node',
  'node.moved': 'Move node',
  'route.added': 'Add route',
  'route.deleted': 'Delete route',
  'route.edited': 'Edit route',
  'route.rewired': 'Rewire route',
  'workflow.deleted': 'Delete workflow',
  'workflow.renamed': 'Rename workflow',
  'workflow.saved': 'Save workflow',
  'workflow.used': 'Use workflow',
}

function formatAction(action) {
  return ACTION_LABELS[action] ?? action.replaceAll('.', ' ')
}

function formatAuditDate(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function AuditLogPanel({
  open,
  entries,
  currentUser,
  onCurrentUserChange,
  onClose,
  onExport,
}) {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const actions = useMemo(() => getAuditActions(entries), [entries])
  const visibleEntries = useMemo(
    () => searchAuditEntries(entries, { searchTerm: search, action: actionFilter }),
    [actionFilter, entries, search],
  )
  const activeUser = normalizeAuditUser(currentUser)

  if (!open) {
    return null
  }

  return (
    <div
      className="audit-log__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="audit-log" role="dialog" aria-modal="true" aria-label="Audit log">
        <header className="audit-log__header">
          <div>
            <span>Security Audit</span>
            <h2>Track who changed the flow</h2>
          </div>
          <button
            type="button"
            className="audit-log__close"
            aria-label="Close audit log"
            onClick={onClose}
          >
            x
          </button>
        </header>

        <div className="audit-log__body">
          <section className="audit-log__identity" aria-label="Audit identity">
            <label>
              <span>Current user</span>
              <input
                aria-label="Audit current user"
                value={currentUser}
                onChange={(event) => onCurrentUserChange(event.target.value)}
              />
            </label>
            <div>
              <span>Writing as</span>
              <strong>{activeUser}</strong>
            </div>
            <div>
              <span>Total entries</span>
              <strong>{entries.length}</strong>
            </div>
          </section>

          <div className="audit-log__controls">
            <label>
              <span>Search audit log</span>
              <input
                aria-label="Search audit log"
                placeholder="Search user, action, node, route, or workflow"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label>
              <span>Filter action</span>
              <select
                aria-label="Audit action filter"
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
              >
                <option value="all">All actions</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {formatAction(action)}
                  </option>
                ))}
              </select>
            </label>

            <div className="audit-log__exports">
              <button
                type="button"
                disabled={entries.length === 0}
                onClick={() => onExport('json')}
              >
                Export JSON
              </button>
              <button type="button" disabled={entries.length === 0} onClick={() => onExport('csv')}>
                Export CSV
              </button>
            </div>
          </div>

          <div className="audit-log__list" role="list" aria-label="Audit entries">
            {visibleEntries.length === 0 && (
              <p className="audit-log__empty">
                {entries.length === 0 ? 'No changes recorded yet.' : 'No audit entries match.'}
              </p>
            )}

            {visibleEntries.map((entry) => (
              <article className="audit-log__entry" key={entry.id} role="listitem">
                <header>
                  <span className={`audit-log__badge audit-log__badge--${entry.targetType}`}>
                    {formatAction(entry.action)}
                  </span>
                  <strong>{entry.summary}</strong>
                </header>

                <dl>
                  <div>
                    <dt>User</dt>
                    <dd>{entry.actor}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{formatAuditDate(entry.createdAt)}</dd>
                  </div>
                  {entry.targetLabel && (
                    <div>
                      <dt>Target</dt>
                      <dd>{entry.targetLabel}</dd>
                    </div>
                  )}
                  {entry.workflowName && (
                    <div>
                      <dt>Workflow</dt>
                      <dd>{entry.workflowName}</dd>
                    </div>
                  )}
                </dl>

                {entry.details && <p>{entry.details}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
