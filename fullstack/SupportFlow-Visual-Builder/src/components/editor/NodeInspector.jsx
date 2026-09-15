/**
 * Renders the detailed SupportFlow node inspector.
 *
 * The panel exposes Properties, Routes and Health tabs while keeping edits in
 * the parent-owned flow state. That preserves the challenge's in-memory model
 * and ensures canvas, preview and diagnostics all observe the same data.
 */

import { useMemo, useState } from 'react'

import analyzeFlow from '../../domain/analyzeFlow.js'

const NODE_META = {
  start: { label: 'START', glyph: '▶', color: '#10b981' },
  question: { label: 'QUESTION', glyph: '◇', color: '#4f8ff7' },
  end: { label: 'TERMINAL', glyph: '■', color: '#f59e0b' },
}

const NODE_SIZE = {
  start: { width: 196, height: 88 },
  question: { width: 196, height: 88 },
  end: { width: 180, height: 64 },
}

function SectionLabel({ children }) {
  return <p className="studio-inspector__section-label">{children}</p>
}

function PropertyRow({ label, value, mono = false }) {
  return (
    <div className="studio-inspector__property-row">
      <span>{label}</span>
      <strong className={mono ? 'studio-inspector__mono' : ''}>{value}</strong>
    </div>
  )
}

function ValidationSummary({ node, issues = [], onIssueSelect = () => {} }) {
  if (issues.length === 0) {
    return null
  }

  const nodeIssues = issues.filter((issue) => issue.nodeId === node.id)
  const visibleIssues = nodeIssues.length > 0 ? nodeIssues : issues.slice(0, 3)
  const errorCount = issues.filter((issue) => issue.severity === 'error').length
  const warningCount = issues.length - errorCount

  return (
    <section className="studio-inspector__validation" aria-label="Editor validation hints">
      <header>
        <span>Flow checks</span>
        <strong>
          {errorCount} errors · {warningCount} warnings
        </strong>
      </header>

      {nodeIssues.length === 0 && (
        <p className="studio-inspector__validation-note">
          Selected node is clean. Other flow issues need attention.
        </p>
      )}

      <div className="studio-inspector__validation-list">
        {visibleIssues.map((issue) => (
          <article
            className={`studio-inspector__validation-item studio-inspector__validation-item--${issue.severity}`}
            key={issue.id}
          >
            <span>{issue.severity}</span>
            <p>{issue.message}</p>
            {issue.nodeId && issue.nodeId !== node.id && (
              <button type="button" onClick={() => onIssueSelect(issue.nodeId)}>
                Select node #{issue.nodeId}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function PropertiesTab({ node, analysis, onTextChange, onNodeRemove }) {
  const size = NODE_SIZE[node.type] ?? { width: 180, height: 80 }
  const textFieldLabel = node.type === 'end' ? 'Message Text' : 'Question Text'
  const canDeleteNode = node.type !== 'start'

  return (
    <div className="studio-inspector__tab-content">
      <SectionLabel>{textFieldLabel}</SectionLabel>

      <label className="studio-inspector__sr-label" htmlFor={`node-text-${node.id}`}>
        {textFieldLabel}
      </label>
      <textarea
        id={`node-text-${node.id}`}
        className="studio-inspector__textarea"
        value={node.text}
        rows="3"
        onChange={(event) => onTextChange(node.id, event.target.value)}
      />

      <div className="studio-inspector__textarea-meta">
        <span>
          Supports {'{'}variables{'}'}
        </span>
        <span>{node.text.length} chars</span>
      </div>

      <div className="studio-inspector__separator" />
      <SectionLabel>Node Info</SectionLabel>

      <PropertyRow label="Depth" value={String(analysis.depthById.get(node.id) ?? 0)} />
      <PropertyRow label="Position" value={`${node.position.x}, ${node.position.y}`} mono />
      <PropertyRow label="Size" value={`${size.width} × ${size.height}`} mono />
      <PropertyRow label="Routes" value={String(node.options.length)} />
      <PropertyRow label="Storage" value="In-memory session" />

      <div className="studio-inspector__separator" />
      <SectionLabel>Node Actions</SectionLabel>

      {canDeleteNode ? (
        <div className="studio-inspector__node-actions">
          <button type="button" onClick={() => onNodeRemove(node.id)}>
            Delete node
          </button>
          <p>Removes this node and any routes that point to it.</p>
        </div>
      ) : (
        <p className="studio-inspector__route-help">
          Start is the entry point and cannot be deleted.
        </p>
      )}
    </div>
  )
}

function RoutesTab({
  node,
  flow,
  onNodeAdd = () => {},
  onRouteAdd = () => {},
  onRouteChange = () => {},
  onRouteRemove = () => {},
}) {
  const meta = NODE_META[node.type] ?? NODE_META.question
  const nodeMap = new Map(flow.nodes.map((candidate) => [candidate.id, candidate]))
  const canAddRoutes = node.type !== 'end'

  return (
    <div className="studio-inspector__tab-content">
      <SectionLabel>Routes · {node.options.length}</SectionLabel>

      {node.options.length === 0 ? (
        <div className="studio-inspector__empty-routes">
          <span className="studio-inspector__empty-glyph">{meta.glyph}</span>
          <p>{node.type === 'end' ? 'Terminal - no outbound routes' : 'No outbound routes yet'}</p>
        </div>
      ) : (
        <div className="studio-inspector__routes">
          {node.options.map((option, index) => {
            const target = nodeMap.get(option.nextId)
            const targetMeta = target ? (NODE_META[target.type] ?? NODE_META.question) : null

            return (
              <article
                className="studio-inspector__route-card"
                key={`${node.id}-${index}-${option.nextId}`}
              >
                <header>
                  <span
                    className="studio-inspector__route-accent"
                    style={{ background: meta.color }}
                  />
                  <strong>{option.label}</strong>
                  <code>route_{index}</code>
                  {canAddRoutes && (
                    <button type="button" onClick={() => onRouteRemove(node.id, index)}>
                      Remove
                    </button>
                  )}
                </header>

                <div className="studio-inspector__route-target">
                  <span>→</span>
                  {targetMeta ? (
                    <>
                      <span style={{ color: targetMeta.color }}>{targetMeta.glyph}</span>
                      <code style={{ color: targetMeta.color }}>#{target.id}</code>
                      <span>{target.text}</span>
                    </>
                  ) : (
                    <span className="studio-inspector__route-missing">
                      Missing target #{option.nextId}
                    </span>
                  )}
                </div>

                {canAddRoutes && (
                  <div className="studio-inspector__route-fields">
                    <label>
                      <span>Route label</span>
                      <input
                        aria-label={`Route ${index} label`}
                        value={option.label}
                        onChange={(event) =>
                          onRouteChange(node.id, index, { label: event.target.value })
                        }
                      />
                    </label>

                    <label>
                      <span>Target node</span>
                      <select
                        aria-label={`Route ${index} target`}
                        value={option.nextId}
                        onChange={(event) =>
                          onRouteChange(node.id, index, { nextId: event.target.value })
                        }
                      >
                        {!nodeMap.has(option.nextId) && (
                          <option value={option.nextId}>Missing target #{option.nextId}</option>
                        )}
                        {flow.nodes.map((targetNode) => (
                          <option key={targetNode.id} value={targetNode.id}>
                            #{targetNode.id} {NODE_META[targetNode.type]?.label ?? targetNode.type}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {canAddRoutes ? (
        <div className="studio-inspector__route-actions">
          <button type="button" onClick={() => onRouteAdd(node.id)}>
            Add route
          </button>
          <button
            type="button"
            onClick={() => onNodeAdd({ type: 'question', sourceNodeId: node.id })}
          >
            Add question node
          </button>
          <button type="button" onClick={() => onNodeAdd({ type: 'end', sourceNodeId: node.id })}>
            Add terminal node
          </button>
        </div>
      ) : (
        <p className="studio-inspector__route-help">
          Terminal nodes end the journey. Select a Start or Question node to add outbound routes.
        </p>
      )}
    </div>
  )
}

function HealthTab({ node, flow, analysis }) {
  const incoming = flow.nodes.reduce(
    (count, candidate) =>
      count + candidate.options.filter((option) => option.nextId === node.id).length,
    0,
  )
  const size = NODE_SIZE[node.type] ?? { width: 180, height: 80 }
  const checks = [
    {
      label: 'Connected to flow',
      ok: incoming > 0 || node.type === 'start',
    },
    {
      label: 'All routes have targets',
      ok: node.options.every((option) => analysis.nodeMap.has(option.nextId)),
    },
    {
      label: 'Reachable from entry',
      ok: analysis.reachable.has(node.id),
    },
    {
      label: 'No cycle involvement',
      ok: !analysis.cycleParticipants.has(node.id),
    },
    {
      label: 'Message text present',
      ok: node.text.trim().length > 0,
    },
  ]
  const score = checks.filter((check) => check.ok).length

  return (
    <div className="studio-inspector__tab-content">
      <SectionLabel>Node Metrics</SectionLabel>

      <div className="studio-inspector__metrics">
        {[
          ['Incoming', incoming],
          ['Outgoing', node.options.length],
          ['Depth', analysis.depthById.get(node.id) ?? 0],
          ['Position', `${node.position.x}, ${node.position.y}`],
          ['Width', `${size.width}px`],
          ['Height', `${size.height}px`],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="studio-inspector__separator" />
      <SectionLabel>Health Checks</SectionLabel>

      <div className="studio-inspector__checks">
        {checks.map((check) => (
          <div key={check.label}>
            <span
              className={
                check.ok
                  ? 'studio-inspector__check-dot studio-inspector__check-dot--ok'
                  : 'studio-inspector__check-dot studio-inspector__check-dot--warn'
              }
            />
            <span>{check.label}</span>
            <strong>{check.ok ? 'OK' : 'WARN'}</strong>
          </div>
        ))}
      </div>

      <div
        className={
          score === checks.length
            ? 'studio-inspector__health-summary studio-inspector__health-summary--ok'
            : 'studio-inspector__health-summary studio-inspector__health-summary--warn'
        }
      >
        <span />
        <p>
          {score}/{checks.length} checks passing ·{' '}
          {score === checks.length ? 'Node is healthy.' : 'Review warnings.'}
        </p>
      </div>
    </div>
  )
}

export default function NodeInspector({
  node,
  flow,
  selectedConnection = null,
  autoFocusRouteId = null,
  issues = [],
  onIssueSelect = () => {},
  onTextChange = () => {},
  onNodeAdd = () => {},
  onRouteAdd = () => {},
  onRouteChange = () => {},
  onRouteRemove = () => {},
  onNodeRemove = () => {},
}) {
  const [tab, setTab] = useState('Properties')
  const analysis = useMemo(() => analyzeFlow(flow?.nodes ?? []), [flow])

  if (!node) {
    return (
      <aside className="node-inspector" aria-label="Node inspector">
        <div className="node-inspector__empty">
          <p className="node-inspector__eyebrow">Inspector</p>
          <h2 className="node-inspector__title">No node selected</h2>
          <p className="node-inspector__description">
            Select a node on the canvas to inspect and edit its content.
          </p>
        </div>
      </aside>
    )
  }

  const meta = NODE_META[node.type] ?? NODE_META.question

  return (
    <aside className="node-inspector studio-inspector" aria-label="Node inspector">
      <header className="studio-inspector__header">
        <span style={{ color: meta.color }}>{meta.glyph}</span>
        <strong style={{ color: meta.color }}>{meta.label}</strong>
        <code style={{ color: meta.color }}>#{node.id}</code>
      </header>
      {selectedConnection && (
        <section className="studio-inspector__selected-route">
          <p className="studio-inspector__section-label">Selected Route</p>

          <strong>{selectedConnection.label}</strong>

          <label className="studio-inspector__selected-route-field">
            <span>Route label</span>
            <input
              aria-label="Selected route label"
              autoFocus={selectedConnection.id === autoFocusRouteId}
              value={selectedConnection.label}
              onChange={(event) =>
                onRouteChange(selectedConnection.sourceId, selectedConnection.optionIndex, {
                  label: event.target.value,
                })
              }
              onFocus={(event) => event.target.select()}
            />
          </label>

          <div className="studio-inspector__selected-route-path">
            <code>#{selectedConnection.sourceId}</code>
            <span>→</span>
            <code>#{selectedConnection.targetId}</code>
          </div>

          <span className="studio-inspector__route-status">
            <span aria-hidden="true" />
            Route target resolved
          </span>

          <button
            type="button"
            className="studio-inspector__selected-route-delete"
            onClick={() =>
              onRouteRemove(selectedConnection.sourceId, selectedConnection.optionIndex)
            }
          >
            Delete route
          </button>
        </section>
      )}

      <ValidationSummary node={node} issues={issues} onIssueSelect={onIssueSelect} />

      <nav className="studio-inspector__tabs" aria-label="Inspector sections">
        {['Properties', 'Routes', 'Health'].map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? 'studio-inspector__tab--active' : ''}
            style={{ '--studio-node-color': meta.color }}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div key={`${node.id}-${tab}`} className="studio-inspector__content">
        {tab === 'Properties' && (
          <PropertiesTab
            node={node}
            analysis={analysis}
            onTextChange={onTextChange}
            onNodeRemove={onNodeRemove}
          />
        )}
        {tab === 'Routes' && (
          <RoutesTab
            node={node}
            flow={flow}
            onNodeAdd={onNodeAdd}
            onRouteAdd={onRouteAdd}
            onRouteChange={onRouteChange}
            onRouteRemove={onRouteRemove}
          />
        )}
        {tab === 'Health' && <HealthTab node={node} flow={flow} analysis={analysis} />}
      </div>
    </aside>
  )
}
