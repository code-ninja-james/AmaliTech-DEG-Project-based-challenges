/**
 * Presents structural validation results for the current SupportFlow graph.
 *
 * Flow Health gives authors immediate feedback about configuration problems
 * that may not be visible on the canvas. Errors represent broken execution
 * paths, while warnings identify potentially unintended graph structure.
 */

export default function FlowHealthPanel({ issues }) {
  const errors = issues.filter((issue) => issue.severity === 'error')

  const warnings = issues.filter((issue) => issue.severity === 'warning')

  const isHealthy = issues.length === 0

  return (
    <aside className="flow-health" aria-label="Flow health">
      <header className="flow-health__header">
        <div>
          <p className="flow-health__eyebrow">X-Ray</p>
          <h2 className="flow-health__title">Flow Health</h2>
        </div>

        <span
          className={[
            'flow-health__status',
            isHealthy ? 'flow-health__status--healthy' : 'flow-health__status--issues',
          ].join(' ')}
        >
          {isHealthy ? 'Healthy' : `${issues.length} issues`}
        </span>
      </header>

      <div className="flow-health__summary">
        <div>
          <span>Errors</span>
          <strong>{errors.length}</strong>
        </div>

        <div>
          <span>Warnings</span>
          <strong>{warnings.length}</strong>
        </div>
      </div>

      {isHealthy ? (
        <div className="flow-health__empty">
          <span className="flow-health__check" aria-hidden="true">
            ✓
          </span>

          <h3>No structural issues detected</h3>

          <p>
            Every node is reachable, route targets resolve correctly, and the flow can be traversed
            safely from Start to Terminal.
          </p>
        </div>
      ) : (
        <div className="flow-health__issues">
          {issues.map((issue) => (
            <article
              className={`flow-health__issue flow-health__issue--${issue.severity}`}
              key={issue.id}
            >
              <div className="flow-health__issue-header">
                <span>{issue.severity}</span>

                {issue.nodeId && <code>#{issue.nodeId}</code>}
              </div>

              <p>{issue.message}</p>
            </article>
          ))}
        </div>
      )}
    </aside>
  )
}
