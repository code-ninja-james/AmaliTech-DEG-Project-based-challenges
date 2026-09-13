/**
 * Provides the command palette advertised by the Make status bar.
 *
 * The original prototype only displayed the keyboard hint. This implementation
 * makes the affordance real by exposing mode switching and Preview through the
 * same handlers used by the primary toolbar.
 */

export default function CommandPalette({
  open,
  onClose,
  onModeChange,
  onPreviewStart,
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
            <button
              key={command.label}
              type="button"
              onClick={() => runCommand(command)}
            >
              <span>{command.label}</span>
              <kbd>{command.shortcut}</kbd>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
