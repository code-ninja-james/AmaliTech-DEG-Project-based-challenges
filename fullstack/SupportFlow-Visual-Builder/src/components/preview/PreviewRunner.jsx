/**
 * Runs the current SupportFlow configuration as a lightweight chat simulation.
 *
 * The runner starts at the configured Start node, records the user's selected
 * answers, and follows each option's nextId through the flow until it reaches
 * a terminal node. Restart resets only the simulation, never the editor state.
 */

import { useState } from 'react'

import { getNextNode, getStartNode } from '../../domain/traverseFlow.js'

function createInitialConversation(startNode) {
  if (!startNode) {
    return []
  }

  return [
    {
      id: `node-${startNode.id}`,
      role: 'assistant',
      text: startNode.text,
    },
  ]
}

export default function PreviewRunner({ flow }) {
  const startNode = getStartNode(flow.nodes)

  const [currentNodeId, setCurrentNodeId] = useState(startNode?.id ?? null)
  const [conversation, setConversation] = useState(() => createInitialConversation(startNode))

  const currentNode = flow.nodes.find((node) => node.id === currentNodeId) ?? null

  const isTerminal = currentNode?.type === 'end' || currentNode?.options.length === 0

  const handleOptionSelect = (option) => {
    const nextNode = getNextNode(flow.nodes, option)

    if (!nextNode) {
      return
    }

    setConversation((currentConversation) => [
      ...currentConversation,
      {
        id: `answer-${currentConversation.length}-${option.nextId}`,
        role: 'user',
        text: option.label,
      },
      {
        id: `node-${nextNode.id}-${currentConversation.length}`,
        role: 'assistant',
        text: nextNode.text,
      },
    ])

    setCurrentNodeId(nextNode.id)
  }

  const handleRestart = () => {
    setCurrentNodeId(startNode?.id ?? null)
    setConversation(createInitialConversation(startNode))
  }

  if (!startNode) {
    return (
      <section className="preview-runner" aria-label="Flow preview">
        <div className="preview-runner__state">
          <p className="preview-runner__eyebrow">Preview unavailable</p>
          <h2>No Start node found</h2>
          <p>Add a Start node before running this support flow.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="preview-runner" aria-label="Flow preview">
      <div className="preview-runner__frame">
        <header className="preview-runner__header">
          <div>
            <p className="preview-runner__eyebrow">Live simulation</p>
            <h2 className="preview-runner__title">Support conversation</h2>
          </div>

          <span className="preview-runner__status">Node #{currentNode?.id}</span>
        </header>

        <div className="preview-runner__conversation" aria-live="polite">
          {conversation.map((message) => (
            <div className={`preview-message preview-message--${message.role}`} key={message.id}>
              <span className="preview-message__role">
                {message.role === 'assistant' ? 'Support' : 'You'}
              </span>

              <p>{message.text}</p>
            </div>
          ))}
        </div>

        <footer className="preview-runner__actions">
          {!isTerminal &&
            currentNode?.options.map((option) => (
              <button
                className="preview-option"
                key={`${currentNode.id}-${option.label}-${option.nextId}`}
                type="button"
                onClick={() => handleOptionSelect(option)}
              >
                <span>{option.label}</span>
                <span aria-hidden="true">→</span>
              </button>
            ))}

          {isTerminal && (
            <button className="preview-restart" type="button" onClick={handleRestart}>
              Restart conversation
            </button>
          )}
        </footer>
      </div>
    </section>
  )
}
