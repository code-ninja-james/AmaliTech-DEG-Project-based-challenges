import { useMemo, useState } from 'react'

import {
  getWorkflowRating,
  getWorkflowStats,
  searchWorkflows,
} from '../../domain/workflowLibrary.js'

function formatSavedDate(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function RatingBreakdown({ rating, label }) {
  return (
    <div className="workflow-library__rating-breakdown" role="group" aria-label={label}>
      {rating.breakdown.map((item) => (
        <div className="workflow-library__rating-metric" key={item.label}>
          <div>
            <span>{item.label}</span>
            <strong className={`workflow-library__metric-score--${item.tone}`}>
              {item.score}/100
            </strong>
          </div>
          <div
            className={`workflow-library__metric-bar workflow-library__metric-bar--${item.tone}`}
            aria-hidden="true"
          >
            <span style={{ width: `${item.score}%` }} />
          </div>
          <p>{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

export default function WorkflowLibraryPanel({
  open,
  workflows,
  activeWorkflowId,
  currentFlow,
  onClose,
  onUseWorkflow,
  onRenameWorkflow,
  onDeleteWorkflow,
}) {
  const [search, setSearch] = useState('')
  const [editingWorkflowId, setEditingWorkflowId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const currentStats = getWorkflowStats(currentFlow)
  const currentRating = getWorkflowRating(currentFlow)
  const visibleWorkflows = useMemo(() => searchWorkflows(workflows, search), [workflows, search])

  if (!open) {
    return null
  }

  const startRename = (workflow) => {
    setEditingWorkflowId(workflow.id)
    setEditingName(workflow.name)
  }

  const saveRename = () => {
    onRenameWorkflow(editingWorkflowId, editingName)
    setEditingWorkflowId(null)
    setEditingName('')
  }

  return (
    <div
      className="workflow-library__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="workflow-library"
        role="dialog"
        aria-modal="true"
        aria-label="Workflow library"
      >
        <header className="workflow-library__header">
          <div>
            <span>Workflow Library</span>
            <h2>Reuse saved support flows</h2>
          </div>
          <button type="button" aria-label="Close workflow library" onClick={onClose}>
            x
          </button>
        </header>

        <div className="workflow-library__body">
          <section className="workflow-library__save" aria-label="Current canvas summary">
            <div>
              <strong>Current canvas</strong>
              <p>Uploaded workflows are saved automatically after import.</p>
            </div>
            <div className="workflow-library__current-stats">
              <span>
                {currentStats.nodeCount} nodes · {currentStats.routeCount} routes
              </span>
              <strong
                className={`workflow-library__rating-pill workflow-library__rating-pill--${currentRating.tone}`}
              >
                {currentRating.score}/100 · {currentRating.label}
              </strong>
            </div>
            <RatingBreakdown rating={currentRating} label="Current canvas rating breakdown" />
          </section>

          <label className="workflow-library__search" htmlFor="workflow-search">
            <span>Search workflows</span>
            <input
              id="workflow-search"
              placeholder="Search by name, node, route, or ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="workflow-library__list" role="list" aria-label="Saved workflows">
            {visibleWorkflows.length === 0 && (
              <p className="workflow-library__empty">
                {workflows.length === 0
                  ? 'No saved workflows yet.'
                  : 'No workflows match this search.'}
              </p>
            )}

            {visibleWorkflows.map((workflow) => {
              const stats = getWorkflowStats(workflow.flow)
              const rating = getWorkflowRating(workflow.flow)
              const isActive = workflow.id === activeWorkflowId
              const isEditing = workflow.id === editingWorkflowId

              return (
                <article
                  className={[
                    'workflow-library__item',
                    isActive ? 'workflow-library__item--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-testid={`workflow-${workflow.id}`}
                  key={workflow.id}
                  role="listitem"
                >
                  <div className="workflow-library__item-main">
                    {!isEditing && (
                      <>
                        <div className="workflow-library__item-title">
                          <strong>{workflow.name}</strong>
                          <span
                            className={`workflow-library__rating-pill workflow-library__rating-pill--${rating.tone}`}
                            aria-label={`${workflow.name} readiness rating ${rating.score} out of 100, ${rating.label}`}
                          >
                            {rating.score}/100 · {rating.label}
                          </span>
                        </div>
                        <span>
                          {stats.nodeCount} nodes · {stats.routeCount} routes · Saved{' '}
                          {formatSavedDate(workflow.updatedAt)}
                        </span>
                        <RatingBreakdown
                          rating={rating}
                          label={`Rating breakdown for ${workflow.name}`}
                        />
                        <ul
                          className="workflow-library__suggestions"
                          aria-label={`Suggestions for ${workflow.name}`}
                        >
                          {rating.suggestions.map((suggestion) => (
                            <li key={suggestion}>{suggestion}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    {isEditing && (
                      <label>
                        <span>Workflow name</span>
                        <input
                          aria-label={`Workflow name for ${workflow.name}`}
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                        />
                      </label>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="workflow-library__actions">
                      <button type="button" onClick={() => onUseWorkflow(workflow.id)}>
                        Use workflow
                      </button>
                      <button type="button" onClick={() => startRename(workflow)}>
                        Edit name
                      </button>
                      <button
                        className="workflow-library__delete"
                        type="button"
                        onClick={() => onDeleteWorkflow(workflow.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  {isEditing && (
                    <div className="workflow-library__actions">
                      <button type="button" onClick={saveRename}>
                        Save name
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorkflowId(null)
                          setEditingName('')
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
