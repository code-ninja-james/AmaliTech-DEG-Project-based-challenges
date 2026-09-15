/**
 * Renders the complete SupportFlow Studio toolbar from the Make prototype.
 *
 * Build, X-Ray and Spatial are real application modes, while Preview is an
 * execution state layered on top of Build. The controls intentionally reflect
 * actual behavior rather than decorative prototype-only actions.
 */

const MODE_CLASS = {
  Build: 'build',
  'X-Ray': 'xray',
  Spatial: 'spatial',
}

export default function AppToolbar({
  workflowName = 'Main Flow',
  mode,
  isPreviewMode,
  healthIssueCount,
  onModeChange,
  onPreviewStart,
  onSpreadsheetImport,
  onWorkflowLibrary,
}) {
  return (
    <header className="app-toolbar">
      <div className="app-brand">
        <span className="app-brand__mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>

        <h1 className="app-brand__name">
          SupportFlow <span>Studio</span>
        </h1>
      </div>

      <div className="app-toolbar__divider" />

      <nav className="app-breadcrumb" aria-label="Workspace location">
        <span>Workspace</span>
        <span>/</span>
        <span>Support</span>
        <span>/</span>
        <strong>{workflowName}</strong>
      </nav>

      <div className="app-toolbar__spacer" />

      <div className="app-mode-switch" role="group" aria-label="Editor mode">
        {['Build', 'X-Ray', 'Spatial'].map((item) => (
          <button
            key={item}
            className={[
              'app-mode-switch__button',
              `app-mode-switch__button--${MODE_CLASS[item]}`,
              mode === item && !isPreviewMode ? 'app-mode-switch__button--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            type="button"
            aria-label={item === 'X-Ray' ? `Flow Health, ${healthIssueCount} issues` : item}
            onClick={() => onModeChange(item)}
          >
            {item}
            {item === 'X-Ray' && (
              <span className="app-mode-switch__count" aria-hidden="true">
                {healthIssueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="app-toolbar__spacer" />

      {mode === 'Build' && !isPreviewMode && (
        <div className="app-toolbar__build-actions">
          <button
            className="app-workflow-button"
            type="button"
            aria-label="Open workflows"
            onClick={onWorkflowLibrary}
          >
            Workflows
          </button>
          <button
            className="app-import-button"
            type="button"
            aria-label="Import flow"
            onClick={onSpreadsheetImport}
          >
            Import flow
          </button>
          <button
            className="app-preview-button"
            type="button"
            aria-label="Play preview"
            onClick={onPreviewStart}
          >
            ▶ Preview
          </button>
        </div>
      )}

      {isPreviewMode && (
        <span className="app-preview-indicator">
          <span className="studio-blink" aria-hidden="true" />
          Preview
        </span>
      )}
    </header>
  )
}
