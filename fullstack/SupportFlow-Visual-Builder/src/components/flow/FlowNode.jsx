/**
 * Renders an interactive SupportFlow node at the exact position supplied by
 * flow_data.json.
 *
 * The node remains presentation-focused but exposes selection through a small
 * callback API. Mouse and keyboard interactions are both supported so the
 * custom graph does not depend on inaccessible click-only behaviour.
 */

const NODE_LABELS = {
  start: 'Start',
  question: 'Question',
  end: 'Terminal',
}

export default function FlowNode({ node, nodeRef, isSelected = false, onSelect = () => {} }) {
  const nodeType = NODE_LABELS[node.type] ?? node.type

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    onSelect(node.id)
  }

  return (
    <article
      ref={nodeRef}
      className={['flow-node', `flow-node--${node.type}`, isSelected ? 'flow-node--selected' : '']
        .filter(Boolean)
        .join(' ')}
      data-testid={`flow-node-${node.id}`}
      role="button"
      tabIndex="0"
      aria-pressed={isSelected}
      onClick={() => onSelect(node.id)}
      onKeyDown={handleKeyDown}
      style={{
        // Preserve the exact x/y values supplied by the challenge data.
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
      }}
    >
      <header className="flow-node__header">
        <span className="flow-node__type">{nodeType}</span>
        <span className="flow-node__id">#{node.id}</span>
      </header>

      <p className="flow-node__text">{node.text}</p>

      {node.options.length > 0 && (
        <div className="flow-node__routes">
          {node.options.map((option) => (
            <div className="flow-node__route" key={`${node.id}-${option.nextId}-${option.label}`}>
              <span>{option.label}</span>

              {/*
                Route targets are lightweight metadata. The SVG layer renders
                the actual directed connection between these node boundaries.
              */}
              <span className="flow-node__route-target">→ #{option.nextId}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
