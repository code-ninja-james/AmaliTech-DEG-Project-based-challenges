/**
 * Displays compact runtime context at the bottom of SupportFlow Studio.
 *
 * Every value is derived from the current flow and selection instead of being
 * decorative metadata, keeping the product shell accurate as editing occurs.
 */

export default function StatusBar({ flow, selectedNodeId, mode }) {
  const edgeCount = flow.nodes.reduce(
    (count, node) => count + node.options.length,
    0,
  )

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
          <span>#{selectedNodeId} selected</span>
        </>
      )}

      <span className="status-bar__spacer" />

      <span className={`status-bar__mode status-bar__mode--${modeClass}`}>
        <span aria-hidden="true" />
        {mode.toUpperCase()}
      </span>
    </footer>
  )
}
