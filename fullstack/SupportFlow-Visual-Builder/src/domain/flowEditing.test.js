import { describe, expect, it } from 'vitest'

import flowData from '../../flow_data.json'
import {
  addNode,
  addRoute,
  getNextNodeId,
  removeNode,
  removeRoute,
  updateRoute,
} from './flowEditing.js'

describe('flow editing helpers', () => {
  it('creates connected question nodes without mutating the source flow', () => {
    const nextFlow = addNode(flowData, { id: getNextNodeId(flowData.nodes), sourceNodeId: '2' })

    expect(nextFlow.nodes).toHaveLength(7)
    expect(nextFlow.nodes.at(-1)).toMatchObject({
      id: '7',
      type: 'question',
      text: 'New question',
      options: [],
    })
    expect(nextFlow.nodes.find((node) => node.id === '2').options.at(-1)).toEqual({
      label: 'New question route',
      nextId: '7',
    })
    expect(flowData.nodes).toHaveLength(6)
  })

  it('edits and removes routes by index', () => {
    const withRoute = addRoute(flowData, '2')
    const updated = updateRoute(withRoute, '2', 2, {
      label: 'Escalate',
      nextId: '6',
    })
    const trimmed = removeRoute(updated, '2', 2)

    expect(updated.nodes.find((node) => node.id === '2').options.at(-1)).toEqual({
      label: 'Escalate',
      nextId: '6',
    })
    expect(trimmed.nodes.find((node) => node.id === '2').options).toHaveLength(2)
  })

  it('adds a route to an explicit target node', () => {
    const nextFlow = addRoute(flowData, '2', '6')

    expect(nextFlow.nodes.find((node) => node.id === '2').options.at(-1)).toEqual({
      label: 'Route to #6',
      nextId: '6',
    })
  })

  it('does not add outbound routes to terminal nodes', () => {
    const nextFlow = addRoute(flowData, '4')

    expect(nextFlow.nodes.find((node) => node.id === '4').options).toEqual([])
  })

  it('removes question or terminal nodes and incoming routes that targeted them', () => {
    const nextFlow = removeNode(flowData, '6')

    expect(nextFlow.nodes.map((node) => node.id)).not.toContain('6')
    expect(nextFlow.nodes.find((node) => node.id === '3').options).toEqual([])
    expect(flowData.nodes.find((node) => node.id === '3').options).toHaveLength(2)
  })

  it('protects the start node from deletion', () => {
    expect(removeNode(flowData, '1')).toBe(flowData)
  })
})
