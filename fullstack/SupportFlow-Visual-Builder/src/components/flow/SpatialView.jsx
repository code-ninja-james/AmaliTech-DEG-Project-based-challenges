/**
 * Renders the alternate spatial topology view from the Figma Make prototype.
 *
 * The view is intentionally derived from the same six challenge nodes rather
 * than maintaining a duplicate graph model. Selecting a topology point updates
 * the shared editor selection and the adjacent inspector immediately.
 */

const TYPE_COLOR = {
  start: '#10b981',
  question: '#4f8ff7',
  end: '#f59e0b',
}

const TYPE_GLYPH = {
  start: '▶',
  question: '◇',
  end: '■',
}

const SPATIAL_POSITIONS = {
  '1': [0, 0, 0],
  '2': [580, -230, 180],
  '3': [580, 240, 180],
  '4': [1010, -280, 330],
  '5': [1010, -70, 330],
  '6': [1010, 250, 330],
}

const SPATIAL_LABELS = {
  '1': 'Welcome',
  '2': 'Restart router?',
  '3': 'Account type',
  '4': 'Technician visit',
  '5': 'Restart guidance',
  '6': 'Billing agent',
}

function buildEdges(nodes) {
  return nodes.flatMap((node) =>
    node.options.map((option, optionIndex) => ({
      id: `${node.id}-${optionIndex}-${option.nextId}`,
      from: node.id,
      to: option.nextId,
    })),
  )
}

export default function SpatialView({ flow, selectedNodeId, onNodeSelect }) {
  const viewportWidth = 1100
  const viewportHeight = 640
  const focal = 1600
  const centerX = 100
  const centerY = 320
  const nodeMap = new Map(flow.nodes.map((node) => [node.id, node]))
  const spatialNodes = flow.nodes.filter((node) => SPATIAL_POSITIONS[node.id])
  const edges = buildEdges(spatialNodes).filter((edge) => nodeMap.has(edge.to))

  const project = ([x, y, z]) => {
    const scale = focal / (focal + z)
    return {
      x: centerX + x * scale,
      y: centerY + y * scale,
      scale,
    }
  }

  const projected = Object.fromEntries(
    spatialNodes.map((node) => [node.id, project(SPATIAL_POSITIONS[node.id])]),
  )

  const edgePath = (from, to) => {
    const source = projected[from]
    const target = projected[to]
    const dx = target.x - source.x
    const dy = target.y - source.y
    const length = Math.hypot(dx, dy) || 1
    const bend = Math.min(Math.max(length * 0.2, 40), 110)
    const nx = -dy / length
    const ny = dx / length

    return [
      `M${source.x.toFixed(1)},${source.y.toFixed(1)}`,
      `C${(source.x + dx * 0.33 + nx * bend).toFixed(1)},${(source.y + dy * 0.33 + ny * bend).toFixed(1)}`,
      `${(target.x - dx * 0.33 + nx * bend).toFixed(1)},${(target.y - dy * 0.33 + ny * bend).toFixed(1)}`,
      `${target.x.toFixed(1)},${target.y.toFixed(1)}`,
    ].join(' ')
  }

  const connected = new Set([selectedNodeId])
  edges.forEach((edge) => {
    if (edge.from === selectedNodeId) {
      connected.add(edge.to)
    }
    if (edge.to === selectedNodeId) {
      connected.add(edge.from)
    }
  })

  const atmosphericPoints = Array.from({ length: 32 }, (_, index) => ({
    cx: 40 + ((index * 191 + index * index * 13) % (viewportWidth - 80)),
    cy: 30 + ((index * 113 + index * 37) % (viewportHeight - 60)),
    radius: 0.5 + (index % 5) * 0.18,
    opacity: 0.028 + (index % 8) * 0.015,
  }))

  const sortedNodes = [...spatialNodes].sort(
    (a, b) => SPATIAL_POSITIONS[b.id][2] - SPATIAL_POSITIONS[a.id][2],
  )

  return (
    <section className="spatial-view" aria-label="Spatial topology">
      <div className="spatial-view__badge">
        <span className="studio-blink" />
        SPATIAL · 3D Topology
      </div>

      <svg
        viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="spatial-view__svg"
      >
        <defs>
          <radialGradient id="spatial-bg" cx="38%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#070a1e" />
            <stop offset="100%" stopColor="#020204" />
          </radialGradient>
          <radialGradient id="spatial-vignette" cx="50%" cy="50%" r="55%">
            <stop offset="42%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.60)" />
          </radialGradient>
          <filter id="spatial-blur-4" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="spatial-blur-9" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="spatial-blur-16" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="16" />
          </filter>

          {edges.map((edge) => {
            const sourceNode = nodeMap.get(edge.from)
            const targetNode = nodeMap.get(edge.to)
            const source = projected[edge.from]
            const target = projected[edge.to]

            return (
              <linearGradient
                key={`gradient-${edge.id}`}
                id={`spatial-gradient-${edge.id}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={TYPE_COLOR[sourceNode.type]} stopOpacity="0.88" />
                <stop offset="100%" stopColor={TYPE_COLOR[targetNode.type]} stopOpacity="0.52" />
              </linearGradient>
            )
          })}
        </defs>

        <rect width={viewportWidth} height={viewportHeight} fill="url(#spatial-bg)" />
        <rect width={viewportWidth} height={viewportHeight} fill="url(#spatial-vignette)" />

        {[0.28, 0.42, 0.58, 0.72].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            y1={viewportHeight * ratio}
            x2={viewportWidth}
            y2={viewportHeight * ratio}
            stroke="rgba(110,130,230,0.03)"
            strokeWidth="0.8"
          />
        ))}

        {atmosphericPoints.map((point, index) => (
          <circle
            key={index}
            cx={point.cx}
            cy={point.cy}
            r={point.radius}
            fill="rgba(255,255,255,0.9)"
            opacity={point.opacity}
          />
        ))}

        {edges.map((edge) => {
          const sourceNode = nodeMap.get(edge.from)
          const isRelated = connected.has(edge.from) && connected.has(edge.to)
          const isParticle = edge.from === selectedNodeId
          const path = edgePath(edge.from, edge.to)
          const color = TYPE_COLOR[sourceNode.type]

          return (
            <g key={edge.id}>
              {isRelated && (
                <>
                  <path d={path} fill="none" stroke={color} strokeWidth="30" opacity="0.07" filter="url(#spatial-blur-9)" />
                  <path d={path} fill="none" stroke={color} strokeWidth="12" opacity="0.15" filter="url(#spatial-blur-4)" />
                </>
              )}

              <path
                d={path}
                fill="none"
                stroke={isRelated ? `url(#spatial-gradient-${edge.id})` : 'rgba(255,255,255,0.11)'}
                strokeWidth={isRelated ? 2 : 0.9}
                opacity={isRelated ? 0.92 : 0.68}
              />

              {isParticle && (
                <g>
                  <circle r="9" fill={color}>
                    <animate attributeName="opacity" values="0;0.18;0.18;0" keyTimes="0;0.07;0.87;1" dur="2.8s" repeatCount="indefinite" />
                    <animateMotion dur="2.8s" repeatCount="indefinite" path={path} />
                  </circle>
                  <circle r="3.2" fill={color}>
                    <animate attributeName="opacity" values="0;0.92;0.92;0" keyTimes="0;0.07;0.87;1" dur="2.8s" repeatCount="indefinite" />
                    <animateMotion dur="2.8s" repeatCount="indefinite" path={path} />
                  </circle>
                </g>
              )}
            </g>
          )
        })}

        {sortedNodes.map((node) => {
          const point = projected[node.id]
          const color = TYPE_COLOR[node.type]
          const selected = node.id === selectedNodeId
          const dimmed = selectedNodeId && !connected.has(node.id)
          const core = 20 * point.scale * (node.type === 'start' ? 1.22 : 1)
          const glow = core * 2.1
          const ring = core * 3.5

          return (
            <g
              key={node.id}
              className="spatial-view__node"
              opacity={dimmed ? 0.12 : 1}
              onClick={() => onNodeSelect(node.id)}
            >
              <circle cx={point.x} cy={point.y} r={ring * 1.8} fill={color} opacity={selected ? 0.07 : 0.025} filter="url(#spatial-blur-16)" />
              {selected && (
                <circle cx={point.x} cy={point.y} r={ring * 1.55} fill="none" stroke={color} strokeWidth="0.8" opacity="0.22" />
              )}
              <circle cx={point.x} cy={point.y} r={ring} fill="none" stroke={color} strokeWidth={selected ? 1.4 : 0.9} opacity={selected ? 0.75 : 0.3} />
              <circle cx={point.x} cy={point.y} r={glow} fill={color} opacity={selected ? 0.34 : 0.15} filter="url(#spatial-blur-9)" />
              <circle cx={point.x} cy={point.y} r={core} fill={color} opacity={selected ? 1 : 0.84} />
              <circle cx={point.x - core * 0.28} cy={point.y - core * 0.29} r={core * 0.36} fill="rgba(255,255,255,0.4)" />

              <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="central" fontSize={core * 0.65} fontFamily="JetBrains Mono, monospace" fontWeight="700" fill="rgba(255,255,255,0.96)">
                {TYPE_GLYPH[node.type]}
              </text>
              <text x={point.x} y={point.y - ring - 10} textAnchor="middle" fontSize={Math.max(7, 8.5 * point.scale)} fontFamily="JetBrains Mono, monospace" fill={color} opacity="0.68" letterSpacing="1">
                {node.type === 'end' ? 'TERMINAL' : node.type.toUpperCase()}
              </text>
              <text x={point.x} y={point.y + ring + 15} textAnchor="middle" fontSize={Math.max(9.5, 11.5 * point.scale)} fontFamily="JetBrains Mono, monospace" fontWeight="500" fill="rgba(255,255,255,0.82)">
                {SPATIAL_LABELS[node.id] ?? `Node ${node.id}`}
              </text>
              <text x={point.x} y={point.y + ring + 28} textAnchor="middle" fontSize={Math.max(6, 7.5 * point.scale)} fontFamily="JetBrains Mono, monospace" fill="rgba(255,255,255,0.3)">
                node_{String(node.id).padStart(3, '0')}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="spatial-view__controls" aria-hidden="true">
        <button type="button">−</button>
        <button type="button">+</button>
        <span>100%</span>
        <button type="button">⊡</button>
      </div>
    </section>
  )
}
