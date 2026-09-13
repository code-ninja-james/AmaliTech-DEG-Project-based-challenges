/**
 * Renders SupportFlow Studio's primary product toolbar.
 *
 * Build and X-Ray map onto the editor's existing inspector and Flow Health
 * states. Preview remains a separate execution mode, so the toolbar reflects
 * real application behaviour rather than presenting decorative controls.
 */

export default function AppToolbar({
  activePanel,
  healthIssueCount,
  isPreviewMode,
  onBuild,
  onXray,
  onPreviewToggle,
}) {
  const isBuildActive = !isPreviewMode && activePanel !== 'health'
  const isXrayActive = !isPreviewMode && activePanel === 'health'

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
        <strong>Main Flow</strong>
      </nav>

      <div className="app-toolbar__spacer" />

      <div className="app-mode-switch" role="group" aria-label="Editor mode">
        <button
          className={
            isBuildActive
              ? 'app-mode-switch__button app-mode-switch__button--build app-mode-switch__button--active'
              : 'app-mode-switch__button'
          }
          type="button"
          onClick={onBuild}
        >
          Build
        </button>

        <button
          className={
            isXrayActive
              ? 'app-mode-switch__button app-mode-switch__button--xray app-mode-switch__button--active'
              : 'app-mode-switch__button'
          }
          type="button"
          aria-label={`Flow Health, ${healthIssueCount} issues`}
          onClick={onXray}
        >
          X-Ray
          <span className="app-mode-switch__count" aria-hidden="true">
            {healthIssueCount}
          </span>
        </button>
      </div>

      <div className="app-toolbar__spacer" />

      {isPreviewMode && (
        <span className="app-preview-indicator">
          <span aria-hidden="true" />
          Preview
        </span>
      )}

      <button
        className={
          isPreviewMode
            ? 'app-preview-button app-preview-button--secondary'
            : 'app-preview-button'
        }
        type="button"
        aria-label={isPreviewMode ? 'Back to editor' : 'Play preview'}
        onClick={onPreviewToggle}
      >
        {isPreviewMode ? 'Back to editor' : '▶ Play preview'}
      </button>
    </header>
  )
}
