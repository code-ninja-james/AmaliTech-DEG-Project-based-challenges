/**
 * Tests the preview traversal rules independently from the UI.
 *
 * These tests protect the Start-node lookup and nextId resolution that drive
 * SupportFlow's chat simulation.
 */

import { describe, expect, it } from 'vitest'

import flowData from '../../flow_data.json'
import { getNextNode, getNodeById, getStartNode } from './traverseFlow.js'

describe('traverseFlow', () => {
  it('finds the configured Start node', () => {
    expect(getStartNode(flowData.nodes)?.id).toBe('1')
  })

  it('resolves a node by id', () => {
    expect(getNodeById(flowData.nodes, '4')?.type).toBe('end')
  })

  it('returns null for a missing node', () => {
    expect(getNodeById(flowData.nodes, '999')).toBeNull()
  })

  it('follows an option nextId to the target node', () => {
    const startNode = getStartNode(flowData.nodes)
    const nextNode = getNextNode(flowData.nodes, startNode.options[0])

    expect(nextNode?.id).toBe('2')
  })
})
