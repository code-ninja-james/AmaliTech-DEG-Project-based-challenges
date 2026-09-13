/**
 * Covers the structural rules enforced by SupportFlow's Flow Health feature.
 *
 * Each test introduces one malformed graph condition so validation failures
 * remain easy to diagnose and the healthy challenge fixture stays unchanged.
 */

import { describe, expect, it } from 'vitest'

import flowData from '../../flow_data.json'
import validateFlow from './validateFlow.js'

function cloneFlowNodes() {
  return structuredClone(flowData.nodes)
}

describe('validateFlow', () => {
  it('reports no issues for the supplied challenge flow', () => {
    expect(validateFlow(cloneFlowNodes())).toEqual([])
  })

  it('detects duplicate node ids', () => {
    const nodes = cloneFlowNodes()

    nodes.push({
      ...structuredClone(nodes[5]),
      id: '2',
    })

    expect(validateFlow(nodes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'duplicate-id',
          severity: 'error',
          nodeId: '2',
        }),
      ]),
    )
  })

  it('requires exactly one Start node', () => {
    const nodes = cloneFlowNodes()

    nodes[0].type = 'question'

    expect(validateFlow(nodes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-start-count',
          severity: 'error',
        }),
      ]),
    )
  })

  it('detects routes that point to missing nodes', () => {
    const nodes = cloneFlowNodes()

    nodes[0].options[0].nextId = '999'

    expect(validateFlow(nodes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          nodeId: '1',
          message: expect.stringContaining('missing node #999'),
        }),
      ]),
    )
  })

  it('detects unreachable nodes', () => {
    const nodes = cloneFlowNodes()

    nodes[0].options = nodes[0].options.filter((option) => option.nextId !== '3')

    expect(validateFlow(nodes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unreachable-node',
          severity: 'warning',
          nodeId: '3',
        }),
        expect.objectContaining({
          code: 'unreachable-node',
          severity: 'warning',
          nodeId: '6',
        }),
      ]),
    )
  })

  it('detects unexpected dead ends', () => {
    const nodes = cloneFlowNodes()

    nodes[1].options = []

    expect(validateFlow(nodes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'unexpected-dead-end',
          severity: 'error',
          nodeId: '2',
        }),
      ]),
    )
  })

  it('detects Terminal nodes with outgoing routes', () => {
    const nodes = cloneFlowNodes()

    nodes[3].options = [
      {
        label: 'Continue',
        nextId: '5',
      },
    ]

    expect(validateFlow(nodes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'terminal-has-routes',
          severity: 'error',
          nodeId: '4',
        }),
      ]),
    )
  })

  it('detects cycles in the flow graph', () => {
    const nodes = cloneFlowNodes()

    nodes[3].type = 'question'
    nodes[3].options = [
      {
        label: 'Try again',
        nextId: '2',
      },
    ]

    expect(validateFlow(nodes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'cycle-detected',
          severity: 'error',
        }),
      ]),
    )
  })
})
