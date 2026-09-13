/**
 * Renders the editing panel for the currently selected SupportFlow node.
 *
 * The inspector edits only the local React flow state. Changes are deliberately
 * not persisted to a backend because the challenge requires local/in-memory
 * editing and immediate visual feedback on the graph.
 */

export default function NodeInspector({ node, onTextChange = () => {} }) {
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

  const textFieldLabel = node.type === 'end' ? 'Message Text' : 'Question Text'

  return (
    <aside className="node-inspector" aria-label="Node inspector">
      <header className="node-inspector__header">
        <div>
          <p className="node-inspector__eyebrow">Inspector</p>
          <h2 className="node-inspector__title">Node #{node.id}</h2>
        </div>

        <span className={`node-inspector__type node-inspector__type--${node.type}`}>
          {node.type === 'end' ? 'Terminal' : node.type}
        </span>
      </header>

      <div className="node-inspector__section">
        <label className="node-inspector__label" htmlFor={`node-text-${node.id}`}>
          {textFieldLabel}
        </label>

        <textarea
          id={`node-text-${node.id}`}
          className="node-inspector__textarea"
          value={node.text}
          rows="5"
          onChange={(event) => onTextChange(node.id, event.target.value)}
        />

        <p className="node-inspector__hint">Changes are applied to the canvas immediately.</p>
      </div>

      <div className="node-inspector__section">
        <p className="node-inspector__section-title">Node data</p>

        <dl className="node-inspector__metadata">
          <div>
            <dt>ID</dt>
            <dd>#{node.id}</dd>
          </div>

          <div>
            <dt>Type</dt>
            <dd>{node.type}</dd>
          </div>

          <div>
            <dt>X</dt>
            <dd>{node.position.x}</dd>
          </div>

          <div>
            <dt>Y</dt>
            <dd>{node.position.y}</dd>
          </div>

          <div>
            <dt>Routes</dt>
            <dd>{node.options.length}</dd>
          </div>
        </dl>
      </div>
    </aside>
  )
}
