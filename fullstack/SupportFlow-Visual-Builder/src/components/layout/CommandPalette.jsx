/**
 * Provides a keyboard-driven command palette for SupportFlow Studio.
 *
 * It exposes the same mode switching and Preview actions as the primary toolbar
 * so keyboard users can navigate the editor without duplicating application
 * state or maintaining a second command model.
 */

export default function CommandPalette({
  open,
  onClose,
  onModeChange,
  onPreviewStart,
  onSpreadsheetImport,
  onWorkflowLibrary,
  onAuditLog,
}) {
  if (!open) {
    return null
  }

  const commands = [
    {
      label: 'Open Build mode',
      shortcut: 'B',
      action: () => onModeChange('Build'),
    },
    {
      label: 'Open X-Ray analysis',
      shortcut: 'X',
      action: () => onModeChange('X-Ray'),
    },
    {
      label: 'Open Spatial topology',
      shortcut: 'S',
      action: () => onModeChange('Spatial'),
    },
    {
      label: 'Run Preview',
      shortcut: 'P',
      action: onPreviewStart,
    },
    {
      label: 'Import Flow',
      shortcut: 'I',
      action: onSpreadsheetImport,
    },
    {
      label: 'Open Workflows',
      shortcut: 'W',
      action: onWorkflowLibrary,
    },
    {
      label: 'Open Audit Log',
      shortcut: 'A',
      action: onAuditLog,
    },
  ]

  const runCommand = (command) => {
    command.action()
    onClose()
  }

  return (
    <div
      className="command-palette__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <header>
          <span>Command Palette</span>
          <button type="button" aria-label="Close command palette" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="command-palette__commands">
          {commands.map((command) => (
            <button key={command.label} type="button" onClick={() => runCommand(command)}>
              <span>{command.label}</span>
              <kbd>{command.shortcut}</kbd>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
