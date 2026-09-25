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

const MOBILE_POINTER_QUERY = '(max-width: 720px)'

function getDisplayNodeId(nodeId) {
  const id = String(nodeId)

  return /^\d+$/.test(id) ? `node_${id.padStart(3, '0')}` : id
}

function shouldDelayMoveStart(event) {
  if (event.pointerType === 'touch') {
    return true
  }

  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_POINTER_QUERY).matches
  )
}

export default function FlowNode({
  node,
  nodeRef,
  isSelected = false,
  isHovered = false,
  isXray = false,
  isReachable = true,
  hasDiagnosticIssue = false,
  isCycleParticipant = false,
  hasBrokenRoute = false,
  incomingCount = 0,
  issues = [],
  isConnectable = false,
  isConnectionTarget = false,
  isConnectionSource = false,
  isMovable = false,
  isMoving = false,
  onRouteDraftStart = () => {},
  onMoveStart = () => {},
  onSelect = () => {},
  onHover = () => {},
}) {
  const nodeType = NODE_LABELS[node.type] ?? node.type
  const glyph = NODE_GLYPHS[node.type] ?? '•'
  const displayNodeId = getDisplayNodeId(node.id)
  const issueCount = issues.length
  const issueSeverity = issues.some((issue) => issue.severity === 'error') ? 'error' : 'warning'

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
        isXray && (!isReachable || hasDiagnosticIssue)
          ? 'flow-node--xray-error studio-xray-enter'
          : '',
        isXray && hasBrokenRoute ? 'flow-node--xray-broken' : '',
        isXray && isCycleParticipant ? 'flow-node--xray-cycle' : '',
        !isXray && issueCount > 0 ? `flow-node--has-${issueSeverity}` : '',
        isConnectionTarget ? 'flow-node--connect-target' : '',
        isConnectionSource ? 'flow-node--connect-source' : '',
        isMovable ? 'flow-node--movable' : '',
        isMoving ? 'flow-node--moving' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`flow-node-${node.id}`}
      data-flow-node-id={node.id}
      role="button"
      tabIndex="0"
      aria-pressed={isSelected}
      onClick={() => onSelect(node.id)}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onPointerDown={(event) => {
        if (
          !isMovable ||
          event.button !== 0 ||
          event.target.closest('.flow-node__connect-handle')
        ) {
          return
        }

        if (!shouldDelayMoveStart(event)) {
          event.preventDefault()
        }

        event.stopPropagation()
        onMoveStart(node.id, event)
      }}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
      }}
    >
      {isSelected && <span className="flow-node__selection-ring" aria-hidden="true" />}

      <header
        className={['flow-node__header', isMovable ? 'flow-node__header--movable' : '']
          .filter(Boolean)
          .join(' ')}
        data-testid={`node-move-header-${node.id}`}
        title={isMovable ? 'Drag this card to move it' : undefined}
      >
        <span className="flow-node__header-left">
          <span className="flow-node__type">
            <span className="flow-node__glyph" aria-hidden="true">
              {glyph}
            </span>
            {nodeType}
          </span>
        </span>

        <span className="flow-node__header-meta">
          {!isXray && issueCount > 0 && (
            <span
              className={`flow-node__issue-badge flow-node__issue-badge--${issueSeverity}`}
              aria-label={`${issueCount} validation ${issueCount === 1 ? 'issue' : 'issues'}`}
              title={issues.map((issue) => issue.message).join('\n')}
            >
              {issueCount}
            </span>
          )}
          {incomingCount > 0 && (
            <span className="flow-node__incoming" aria-label={`${incomingCount} incoming routes`}>
              {incomingCount}
            </span>
          )}
          <span className="flow-node__id" title={`Node ID: ${node.id}`}>
            {displayNodeId}
          </span>
        </span>
      </header>

      <div className="flow-node__body">
        <p className="flow-node__text">{node.text}</p>

        {isXray && (!isReachable || hasBrokenRoute || isCycleParticipant) && (
          <p className="flow-node__diagnostic">
            {[
              !isReachable && 'Unreachable',
              hasBrokenRoute && 'Broken route',
              isCycleParticipant && 'Cycle',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {node.options.length > 0 && (
          <div className="flow-node__route-list">
            {node.options.map((option, optionIndex) => (
              <div
                className="flow-node__route-preview"
                key={`${node.id}-${optionIndex}-${option.nextId}-${option.label}`}
              >
                <span className="flow-node__route-accent" aria-hidden="true" />
                <span>{option.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {node.type !== 'start' && (
        <span className="flow-node__port flow-node__port--input" aria-hidden="true" />
      )}

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

      {isConnectable && (
        <span
          className="flow-node__connect-handle"
          role="button"
          tabIndex="0"
          aria-label={`Drag new route from node ${node.id}`}
          title="Drag to connect a new route"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRouteDraftStart(node.id, event)
          }}
        >
          +
        </span>
      )}
    </article>
  )
}
