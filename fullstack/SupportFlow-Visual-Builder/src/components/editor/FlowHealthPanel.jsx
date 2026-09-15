/**
 * Presents the complete X-Ray analysis rail from the product design.
 *
 * The panel combines computed graph diagnostics with the existing wildcard
 * validation results so authors can understand both overall flow health and
 * the concrete issues that would affect a customer journey.
 */

import { useMemo, useState } from 'react'

import analyzeFlow from '../../domain/analyzeFlow.js'
import createXrayReport from '../../domain/xrayReport.js'
import { XRAY_DEMO_SCENARIOS } from '../../domain/xrayDemo.js'

export default function FlowHealthPanel({
  flow,
  issues = [],
  demoScenario = 'current',
  onDemoChange,
  onNodeSelect,
}) {
  const analysis = useMemo(() => analyzeFlow(flow?.nodes ?? []), [flow])
  const scenario = XRAY_DEMO_SCENARIOS.find(({ id }) => id === demoScenario)
  const isDemo = demoScenario !== 'current'
  const [copyState, setCopyState] = useState({ status: 'idle', reportText: null })

  const reportText = useMemo(
    () =>
      createXrayReport({
        flow,
        analysis,
        issues,
        scenarioLabel: scenario?.label ?? 'Current flow',
        isDemo,
      }),
    [analysis, flow, isDemo, issues, scenario?.label],
  )

  const copyStatus = copyState.reportText === reportText ? copyState.status : 'idle'

  const handleCopyReport = async () => {
    setCopyState({ status: 'copying', reportText })

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }

      await navigator.clipboard.writeText(reportText)
      setCopyState({ status: 'copied', reportText })
    } catch {
      setCopyState({ status: 'error', reportText })
    }
  }

  const diagnostics = [
    {
      label: 'Reachable',
      value: `${analysis.reachable.size} / ${flow?.nodes.length ?? 0}`,
      ok: analysis.unreachable.length === 0,
    },
    {
      label: 'Unreachable',
      value: String(analysis.unreachable.length),
      ok: analysis.unreachable.length === 0,
    },
    {
      label: 'Broken refs',
      value: String(analysis.brokenReferences.length),
      ok: analysis.brokenReferences.length === 0,
    },
    {
      label: 'Cycles',
      value: analysis.hasCycle ? 'detected' : 'none',
      ok: !analysis.hasCycle,
    },
    {
      label: 'Start nodes',
      value: String(analysis.startCount),
      ok: analysis.startCount === 1,
    },
    {
      label: 'Terminals with routes',
      value: String(analysis.terminalsWithRoutes.length),
      ok: analysis.terminalsWithRoutes.length === 0,
    },
    {
      label: 'Questions no routes',
      value: String(analysis.questionsWithoutRoutes.length),
      ok: analysis.questionsWithoutRoutes.length === 0,
    },
    {
      label: 'Max depth',
      value: String(analysis.maxDepth),
      ok: true,
    },
  ]

  return (
    <aside className="flow-health studio-xray" aria-label="Flow health">
      <header className="studio-xray__header">
        <span className="studio-xray__pulse" aria-hidden="true" />
        <h2>X-Ray Analysis</h2>
      </header>

      <div className="studio-xray__body">
        {onDemoChange && (
          <section className="studio-xray__demo" aria-label="Diagnostic demo">
            <label htmlFor="xray-demo-scenario">Diagnostic demo</label>
            <select
              id="xray-demo-scenario"
              value={demoScenario}
              aria-describedby="xray-demo-description"
              onChange={(event) => onDemoChange(event.target.value)}
            >
              {XRAY_DEMO_SCENARIOS.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <p id="xray-demo-description" role="status">
              {scenario?.description}
            </p>
            {isDemo && (
              <>
                <p className="studio-xray__demo-notice">
                  Temporary example · your edits are preserved.
                </p>
                <button type="button" onClick={() => onDemoChange('current')}>
                  Return to current flow
                </button>
              </>
            )}
          </section>
        )}

        <p className="studio-xray__section-label">Legend</p>
        {[
          ['#10b981', 'Reachable node'],
          ['#f59e0b', 'Terminal exit'],
          ['#ef4444', 'Unreachable / broken route'],
          ['#4f8ff7', 'Cycle participant'],
        ].map(([color, label]) => (
          <div className="studio-xray__legend" key={label}>
            <span style={{ background: color }} />
            <p>{label}</p>
          </div>
        ))}

        <div className="studio-xray__separator" />
        <p className="studio-xray__section-label">Computed Diagnostics</p>

        {diagnostics.map((diagnostic) => (
          <div className="studio-xray__diagnostic" key={diagnostic.label}>
            <span className={diagnostic.ok ? 'studio-xray__dot--ok' : 'studio-xray__dot--error'} />
            <p>{diagnostic.label}</p>
            <strong
              className={diagnostic.ok ? 'studio-xray__value--ok' : 'studio-xray__value--error'}
            >
              {diagnostic.value}
            </strong>
          </div>
        ))}

        {analysis.brokenReferences.length > 0 && (
          <>
            <div className="studio-xray__separator" />
            <p className="studio-xray__section-label">Broken References</p>
            {analysis.brokenReferences.map((reference) => (
              <code
                className="studio-xray__broken"
                key={`${reference.sourceId}-${reference.targetId}-${reference.label}`}
              >
                #{reference.sourceId} → #{reference.targetId}
              </code>
            ))}
          </>
        )}

        {analysis.cycleParticipants.size > 0 && (
          <>
            <div className="studio-xray__separator" />
            <p className="studio-xray__section-label">Cycle participants</p>
            <p className="studio-xray__healthy-copy">
              {[...analysis.cycleParticipants].map((id) => `#${id}`).join(', ')}
            </p>
          </>
        )}

        <div className="studio-xray__separator" />
        <p className="studio-xray__section-label">Flow Report</p>

        <div
          className={
            analysis.isHealthy
              ? 'studio-xray__report studio-xray__report--healthy'
              : 'studio-xray__report studio-xray__report--error'
          }
        >
          <span />
          <p>
            {analysis.isHealthy
              ? `Flow is valid. All ${flow.nodes.length} nodes reachable. ${analysis.terminalCount} terminal exits. No cycles or broken references.`
              : `Issues detected: ${analysis.unreachable.length} unreachable, ${analysis.brokenReferences.length} broken refs${analysis.hasCycle ? ', cycle detected' : ''}.`}
          </p>
        </div>

        <div className="studio-xray__report-actions">
          <button type="button" onClick={handleCopyReport} disabled={copyStatus === 'copying'}>
            {copyStatus === 'copying' ? 'Copying report...' : 'Copy diagnostic report'}
          </button>
          {copyStatus === 'copied' && <span role="status">Report copied</span>}
          {copyStatus === 'error' && <span role="alert">Copy unavailable</span>}
        </div>

        {analysis.isHealthy && (
          <>
            <h3>No structural issues detected</h3>
            <p className="studio-xray__healthy-copy">
              Every node is reachable, route targets resolve correctly, and the flow can be
              traversed safely from Start to Terminal.
            </p>
          </>
        )}

        {issues.length > 0 && (
          <div className="studio-xray__validation-list">
            {issues.map((issue) => (
              <article key={issue.id}>
                <strong>{issue.severity}</strong>
                <span>{issue.message}</span>
                {issue.nodeId && onNodeSelect && (
                  <button type="button" onClick={() => onNodeSelect(issue.nodeId)}>
                    Select node #{issue.nodeId}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}

        {analysis.isHealthy && (
          <div className="studio-xray__suggestion">
            <span />
            <p>
              Routes that converge on the same terminal can share maintenance paths, reducing
              duplicated support-flow updates.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
