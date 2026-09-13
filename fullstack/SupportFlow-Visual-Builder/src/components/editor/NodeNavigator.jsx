/**
 * Provides a searchable node navigator beside the visual flow canvas.
 *
 * The navigator reads directly from the current in-memory flow so node text
 * edits appear here immediately. Selecting a node delegates to the same
 * selection state used by the canvas and inspector.
 */

import { useState } from 'react'

const NODE_GROUPS = [
  { type: 'start', label: 'Start' },
  { type: 'question', label: 'Question' },
  { type: 'end', label: 'Terminal' },
]

function getIncomingCount(nodes, targetId) {
  return nodes.reduce(
    (count, node) =>
      count + node.options.filter((option) => option.nextId === targetId).length,
    0,
  )
}

export default function NodeNavigator({ flow, selectedNodeId, onNodeSelect }) {
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const searchTerm = search.trim().toLowerCase()

  const toggleGroup = (type) => {
    setCollapsedGroups((currentGroups) => {
      const nextGroups = new Set(currentGroups)

      if (nextGroups.has(type)) {
        nextGroups.delete(type)
      } else {
        nextGroups.add(type)
      }

      return nextGroups
    })
  }

  return (
    <aside className="node-navigator" aria-label="Flow nodes">
      <header className="node-navigator__header">
        <span>Flow Nodes</span>
        <span className="node-navigator__count">{flow.nodes.length}</span>
      </header>

      <div className="node-navigator__search">
        <input
          aria-label="Find node"
          placeholder="Find node…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="node-navigator__groups">
        {NODE_GROUPS.map(({ type, label }) => {
          const nodes = flow.nodes.filter((node) => {
            if (node.type !== type) {
              return false
            }

            if (!searchTerm) {
              return true
            }

            return (
              node.text.toLowerCase().includes(searchTerm) ||
              node.id.toLowerCase().includes(searchTerm)
            )
          })

          if (nodes.length === 0) {
            return null
          }

          const isCollapsed = collapsedGroups.has(type)

          return (
            <section className="node-navigator__group" key={type}>
              <button
                className="node-navigator__group-toggle"
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => toggleGroup(type)}
              >
                <span
                  className={`node-navigator__type-dot node-navigator__type-dot--${type}`}
                  aria-hidden="true"
                />
                <span>{label}</span>
                <span className="node-navigator__group-count">{nodes.length}</span>
                <span
                  className={
                    isCollapsed
                      ? 'node-navigator__chevron node-navigator__chevron--collapsed'
                      : 'node-navigator__chevron'
                  }
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {!isCollapsed &&
                nodes.map((node) => {
                  const isSelected = node.id === selectedNodeId
                  const incomingCount = getIncomingCount(flow.nodes, node.id)

                  return (
                    <button
                      className={[
                        'node-navigator__item',
                        `node-navigator__item--${node.type}`,
                        isSelected ? 'node-navigator__item--selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      data-testid={`navigator-node-${node.id}`}
                      type="button"
                      aria-pressed={isSelected}
                      key={node.id}
                      onClick={() => onNodeSelect(node.id)}
                    >
                      <span className="node-navigator__id">#{node.id}</span>
                      <span className="node-navigator__text">{node.text}</span>

                      {isSelected && (
                        <span className="node-navigator__connections">
                          {incomingCount}↙ {node.options.length}↗
                        </span>
                      )}
                    </button>
                  )
                })}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
