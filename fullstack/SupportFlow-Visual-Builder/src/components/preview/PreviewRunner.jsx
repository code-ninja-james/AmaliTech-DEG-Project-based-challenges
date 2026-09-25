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

export default function PreviewRunner({
  flow,
  onBack = null,
  onNodeSelect = () => {},
  onNodeEdit = null,
}) {
  const startNode = getStartNode(flow.nodes)
  const scrollRef = useRef(null)
  const pressRef = useRef(null)
  const dialogRef = useRef(null)
  const [actionNodeId, setActionNodeId] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState('')
  const actionNode = flow.nodes.find((node) => node.id === actionNodeId)
  const actionType = actionNode?.type === 'end' ? 'terminal' : actionNode?.type

  const cancelPress = () => {
    window.clearTimeout(pressRef.current?.timer)
    pressRef.current = null
  }

  useEffect(() => () => window.clearTimeout(pressRef.current?.timer), [])

  useEffect(() => {
    if (actionNodeId) dialogRef.current?.showModal()
  }, [actionNodeId])

  const openActions = (nodeId) => {
    cancelPress()
    setIsEditing(false)
    setActionNodeId(nodeId)
  }

  const startPress = (event, nodeId) => {
    if (!onNodeEdit || event.button > 0 || event.isPrimary === false) return
    cancelPress()
    pressRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      timer: window.setTimeout(() => openActions(nodeId), 400),
    }
  }

  const movePress = (event) => {
    const press = pressRef.current
    if (
      press &&
      (event.pointerId !== press.pointerId ||
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10)
    )
      cancelPress()
  }

  const closeActions = () => {
    dialogRef.current?.close()
    setActionNodeId(null)
    setIsEditing(false)
  }
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
            aria-label="Back to editor"
            onClick={onBack}
          >
            ← Back to editor
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

      {onNodeEdit && <p className="studio-preview__edit-hint">Hold a message to edit its node</p>}
      <div
        ref={scrollRef}
        className="studio-preview__conversation"
        aria-live="polite"
        onScroll={cancelPress}
      >
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
                  <p
                    className={onNodeEdit ? 'studio-preview__editable-message' : undefined}
                    role={onNodeEdit ? 'button' : undefined}
                    tabIndex={onNodeEdit ? 0 : undefined}
                    aria-label={
                      onNodeEdit
                        ? `${flow.nodes.find((node) => node.id === message.nodeId)?.text ?? message.text}. Open edit options`
                        : undefined
                    }
                    aria-haspopup={onNodeEdit ? 'dialog' : undefined}
                    onPointerDown={(event) => startPress(event, message.nodeId)}
                    onPointerMove={movePress}
                    onPointerUp={cancelPress}
                    onPointerCancel={cancelPress}
                    onPointerLeave={cancelPress}
                    onContextMenu={(event) => {
                      if (!onNodeEdit) return
                      event.preventDefault()
                      openActions(message.nodeId)
                    }}
                    onKeyDown={(event) => {
                      if (onNodeEdit && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault()
                        openActions(message.nodeId)
                      }
                    }}
                  >
                    {flow.nodes.find((node) => node.id === message.nodeId)?.text ?? message.text}
                  </p>
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
      {actionNode && (
        <dialog
          ref={dialogRef}
          className="preview-node-actions"
          aria-labelledby="preview-action-title"
          onCancel={closeActions}
          onClose={() => setActionNodeId(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeActions()
          }}
        >
          <div className="preview-node-actions__surface">
            <span className="preview-node-actions__grip" aria-hidden="true" />
            <header>
              <div>
                <span className="preview-node-actions__eyebrow">
                  {actionType} · #{actionNode.id}
                </span>
                <h2 id="preview-action-title">
                  {isEditing ? `Edit ${actionType}` : 'Message options'}
                </h2>
              </div>
              <button
                type="button"
                className="preview-node-actions__close"
                aria-label="Close message options"
                onClick={closeActions}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </header>
            {isEditing ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!draftText.trim()) return
                  onNodeEdit(actionNode.id, actionNode.text, draftText.trim())
                  closeActions()
                }}
              >
                <label htmlFor="preview-node-text">Message</label>
                <textarea
                  id="preview-node-text"
                  autoFocus
                  rows="5"
                  value={draftText}
                  onChange={(event) => setDraftText(event.target.value)}
                />
                <p className="preview-node-actions__note">
                  Updates this node throughout the workflow. Your preview stays in place.
                </p>
                <footer>
                  <button type="button" onClick={closeActions}>
                    Cancel
                  </button>
                  <button
                    className="preview-node-actions__save"
                    type="submit"
                    disabled={!draftText.trim()}
                  >
                    Save changes
                  </button>
                </footer>
              </form>
            ) : (
              <>
                <p className="preview-node-actions__quote">{actionNode.text}</p>
                <button
                  className="preview-node-actions__edit"
                  type="button"
                  onClick={() => {
                    setDraftText(actionNode.text)
                    setIsEditing(true)
                  }}
                >
                  <span aria-hidden="true">✎</span> Edit {actionType}
                  <span aria-hidden="true">›</span>
                </button>
              </>
            )}
          </div>
        </dialog>
      )}
    </section>
  )
}
