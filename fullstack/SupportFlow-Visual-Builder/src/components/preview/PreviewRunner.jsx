/**
 * Runs the current SupportFlow configuration as the Make-style chat preview.
 *
 * The runner maintains a real traversal path, auto-scrolls as the conversation
 * grows, updates shared selection when embedded in the studio, and exposes the
 * terminal restart experience required by the challenge.
 */

import { useEffect, useRef, useState } from 'react'

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
      nodeId: startNode.id,
    },
  ]
}

export default function PreviewRunner({ flow, onBack = null, onNodeSelect = () => {} }) {
  const startNode = getStartNode(flow.nodes)
  const scrollRef = useRef(null)
  const [currentNodeId, setCurrentNodeId] = useState(startNode?.id ?? null)
  const [conversation, setConversation] = useState(() => createInitialConversation(startNode))

  const currentNode = flow.nodes.find((node) => node.id === currentNodeId) ?? null
  const isTerminal = currentNode?.type === 'end' || currentNode?.options.length === 0

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversation.length])

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
        nodeId: nextNode.id,
      },
    ])

    setCurrentNodeId(nextNode.id)
    onNodeSelect(nextNode.id)
  }

  const handleRestart = () => {
    setCurrentNodeId(startNode?.id ?? null)
    setConversation(createInitialConversation(startNode))

    if (startNode) {
      onNodeSelect(startNode.id)
    }
  }

  if (!startNode) {
    return (
      <section className="preview-runner studio-preview" aria-label="Flow preview">
        <div className="preview-runner__state">
          <p className="preview-runner__eyebrow">Preview unavailable</p>
          <h2>No Start node found</h2>
          <p>Add a Start node before running this support flow.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="preview-runner studio-preview" aria-label="Flow preview">
      <header className="studio-preview__header">
        {onBack ? (
          <button
            type="button"
            className="studio-preview__back"
            aria-label="Back to Build"
            onClick={onBack}
          >
            ← Back to Build
          </button>
        ) : (
          <span />
        )}

        <div className="studio-preview__title">
          <span className="studio-blink" />
          <strong>PREVIEW · Support Flow</strong>
        </div>

        <div className="studio-preview__meta">
          <span>
            {Math.ceil(conversation.length / 2)} step
            {conversation.length > 2 ? 's' : ''}
          </span>
          {isTerminal && (
            <button type="button" onClick={handleRestart}>
              ↺ Restart
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="studio-preview__conversation" aria-live="polite">
        <div className="studio-preview__thread">
          {conversation.map((message, index) => (
            <div
              className={[
                'studio-preview__row',
                `studio-preview__row--${message.role}`,
                index === conversation.length - 1 && message.role === 'assistant'
                  ? 'studio-message-arrive'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={message.id}
            >
              {message.role === 'assistant' ? (
                <div className="studio-preview__assistant">
                  <span className="studio-preview__avatar">◈</span>
                  <p>{message.text}</p>
                </div>
              ) : (
                <p className="studio-preview__user-message">{message.text}</p>
              )}
            </div>
          ))}

          {!isTerminal && currentNode?.options.length > 0 && (
            <div className="studio-preview__answers">
              {currentNode.options.map((option) => (
                <button
                  key={`${currentNode.id}-${option.label}-${option.nextId}`}
                  type="button"
                  onClick={() => handleOptionSelect(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {isTerminal && (
            <div className="studio-preview__terminal-actions">
              <button type="button" aria-label="Restart conversation" onClick={handleRestart}>
                ↺ Restart conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
