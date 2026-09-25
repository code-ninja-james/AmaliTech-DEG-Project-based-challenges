/**
 * Renders the complete SupportFlow Studio toolbar from the Make prototype.
 *
 * Build, X-Ray and Spatial are real application modes, while Preview is an
 * execution state layered on top of Build. The controls intentionally reflect
 * actual behavior rather than decorative prototype-only actions.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

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
  auditEntryCount = 0,
  currentUser,
  onModeChange,
  onPreviewStart,
  onSpreadsheetImport,
  onWorkflowLibrary,
  onAuditLog,
  onCurrentUserChange,
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef(null)
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), [])

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!mobileMenuRef.current?.contains(event.target)) {
        closeMobileMenu()
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMobileMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMobileMenu, isMobileMenuOpen])

  return (
    <header className="app-toolbar">
      <div className="app-brand">
        <span className="app-brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path className="app-brand__mark-link app-brand__mark-link--primary" d="M9 6h6" />
            <path className="app-brand__mark-link app-brand__mark-link--secondary" d="M18 9v6" />
            <rect
              className="app-brand__mark-node app-brand__mark-node--primary"
              x="2"
              y="2"
              width="8"
              height="8"
              rx="3"
            />
            <rect
              className="app-brand__mark-node app-brand__mark-node--secondary"
              x="14"
              y="2"
              width="8"
              height="8"
              rx="3"
            />
            <rect
              className="app-brand__mark-node app-brand__mark-node--active"
              x="14"
              y="14"
              width="8"
              height="8"
              rx="3"
            />
          </svg>
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
            onClick={() => {
              closeMobileMenu()
              onModeChange(item)
            }}
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

      <div className="app-mobile-menu" ref={mobileMenuRef}>
        {mode === 'Build' && !isPreviewMode && (
          <button
            className="app-mobile-menu__preview"
            type="button"
            aria-label="Play preview from mobile toolbar"
            onClick={() => {
              closeMobileMenu()
              onPreviewStart()
            }}
          >
            ▶ Preview
          </button>
        )}

        <button
          className="app-mobile-menu__button"
          type="button"
          aria-label={isMobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="app-mobile-menu-panel"
          onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
        >
          Menu
        </button>

        <div
          id="app-mobile-menu-panel"
          className={[
            'app-mobile-menu__panel',
            isMobileMenuOpen ? 'app-mobile-menu__panel--open' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {mode === 'Build' && !isPreviewMode && (
            <>
              <button
                className="app-mobile-menu__item app-mobile-menu__item--workflow"
                type="button"
                aria-label="Open workflows from mobile menu"
                onClick={() => {
                  onWorkflowLibrary()
                  closeMobileMenu()
                }}
              >
                Workflows
              </button>
              <button
                className="app-mobile-menu__item app-mobile-menu__item--import"
                type="button"
                aria-label="Import flow from mobile menu"
                onClick={() => {
                  onSpreadsheetImport()
                  closeMobileMenu()
                }}
              >
                Import Flow
              </button>
            </>
          )}
          <button
            className="app-mobile-menu__item app-mobile-menu__item--audit"
            type="button"
            aria-label={`Open audit log from mobile menu, ${auditEntryCount} entries`}
            onClick={() => {
              onAuditLog()
              closeMobileMenu()
            }}
          >
            Audit
            <span aria-hidden="true">{auditEntryCount}</span>
          </button>
        </div>
      </div>

      <div className="app-toolbar__spacer" />

      <div className="app-toolbar__security-actions">
        <label className="app-current-user">
          <span>User</span>
          <input
            aria-label="Current user"
            value={currentUser}
            onChange={(event) => onCurrentUserChange(event.target.value)}
          />
        </label>
        <button
          className="app-audit-button"
          type="button"
          aria-label={`Open audit log, ${auditEntryCount} entries`}
          onClick={onAuditLog}
        >
          Audit
          <span aria-hidden="true">{auditEntryCount}</span>
        </button>
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
            Import Flow
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
