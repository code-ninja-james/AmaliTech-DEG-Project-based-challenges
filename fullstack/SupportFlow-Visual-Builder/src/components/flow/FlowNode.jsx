/**
 * Renders an interactive SupportFlow node at the exact position supplied by
 * flow_data.json.
 *
 * The card mirrors the Make prototype's selection, hover, X-Ray and port
 * treatments while keeping keyboard access and challenge coordinates intact.
 */

const NODE_LABELS = {
  start: 'Start',
  question: 'Question',
  end: 'Terminal',
}

const NODE_GLYPHS = {
  start: '▶',
  question: '◇',
  end: '■',
}

export default function FlowNode({
  node,
  nodeRef,
  isSelected = false,
  isHovered = false,
  isXray = false,
  isReachable = true,
  incomingCount = 0,
  onSelect = () => {},
  onHover = () => {},
}) {
  const nodeType = NODE_LABELS[node.type] ?? node.type
  const glyph = NODE_GLYPHS[node.type] ?? '•'

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
      className={[
        'flow-node',
        `flow-node--${node.type}`,
        isSelected ? 'flow-node--selected' : '',
        isHovered ? 'flow-node--hovered' : '',
        isXray ? 'flow-node--xray' : '',
        isXray && !isReachable ? 'flow-node--xray-error studio-xray-enter' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`flow-node-${node.id}`}
      role="button"
      tabIndex="0"
      aria-pressed={isSelected}
      onClick={() => onSelect(node.id)}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
      }}
    >
      {isSelected && <span className="flow-node__selection-ring" aria-hidden="true" />}

      <header className="flow-node__header">
        <span className="flow-node__type">
          <span className="flow-node__glyph" aria-hidden="true">
            {glyph}
          </span>
          {nodeType}
        </span>

        <span className="flow-node__header-meta">
          {incomingCount > 0 && (
            <span className="flow-node__incoming" aria-label={`${incomingCount} incoming routes`}>
              {incomingCount}
            </span>
          )}
          <span className="flow-node__id">node_{String(node.id).padStart(3, '0')}</span>
        </span>
      </header>

      <div className="flow-node__body">
        <p className="flow-node__text">{node.text}</p>

        {node.options.length > 0 && (
          <div className="flow-node__route-list">
            {node.options.map((option) => (
              <div
                className="flow-node__route-preview"
                key={`${node.id}-${option.nextId}-${option.label}`}
              >
                <span className="flow-node__route-accent" aria-hidden="true" />
                <span>{option.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {node.type !== 'start' && <span className="flow-node__port flow-node__port--input" aria-hidden="true" />}

      {node.options.map((option, optionIndex) => (
        <span
          className="flow-node__port flow-node__port--output"
          aria-hidden="true"
          key={`${node.id}-${optionIndex}-${option.nextId}`}
          style={{
            left: `${((optionIndex + 1) / (node.options.length + 1)) * 100}%`,
          }}
        />
      ))}
    </article>
  )
}
