/**
 * Displays compact runtime context at the bottom of SupportFlow Studio.
 *
 * The status bar mirrors the Make design while deriving node, edge, mode and
 * selection metadata from the live flow. The command-palette affordance is
 * wired to a real application action rather than being decorative chrome.
 */

export default function StatusBar({ flow, selectedNodeId, mode, onCommandPalette = null }) {
  const edgeCount = flow.nodes.reduce((count, node) => count + node.options.length, 0)

  const modeClass = mode.toLowerCase().replaceAll(' ', '-')

  return (
    <footer className="status-bar">
      <span>flow_data.json</span>
      <span className="status-bar__divider" />
      <span>
        {flow.nodes.length} nodes · {edgeCount} edges
      </span>

      {selectedNodeId && (
        <>
          <span className="status-bar__divider" />
          <span>node_{String(selectedNodeId).padStart(3, '0')} selected</span>
          <span className="status-bar__divider" />
        </>
      )}

      <span className={`status-bar__mode status-bar__mode--${modeClass}`}>
        <span aria-hidden="true" />
        {mode.toUpperCase()}
      </span>

      <span className="status-bar__spacer" />

      {onCommandPalette && (
        <button className="status-bar__command" type="button" onClick={onCommandPalette}>
          ⌘K · Command palette
        </button>
      )}

      <span className="status-bar__divider" />
      <span>100%</span>
    </footer>
  )
}
