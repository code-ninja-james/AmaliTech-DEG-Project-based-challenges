import { describe, expect, it } from 'vitest'

import flowData from '../../flow_data.json'
import analyzeFlow from './analyzeFlow.js'
import validateFlow from './validateFlow.js'
import createXrayDemo from './xrayDemo.js'

describe('X-Ray diagnostic examples', () => {
  it('preserves the current flow, edits, node identities and challenge coordinates', () => {
    const editedFlow = structuredClone(flowData)
    editedFlow.nodes[1].text = 'An unsaved edit'
    const before = structuredClone(editedFlow)

    for (const scenario of ['broken-reference', 'unreachable-branch', 'cycle']) {
      const demo = createXrayDemo(editedFlow, scenario)
      expect(demo.nodes.map(({ id, position, text }) => ({ id, position, text }))).toEqual(
        before.nodes.map(({ id, position, text }) => ({ id, position, text })),
      )
      expect(editedFlow).toEqual(before)
      expect(demo.meta).toEqual(before.meta)
    }

    expect(createXrayDemo(editedFlow, 'current')).toBe(editedFlow)
    expect(createXrayDemo(editedFlow, 'unknown')).toBe(editedFlow)
    expect(validateFlow(flowData.nodes)).toEqual([])
  })

  it('creates a broken reference without making existing nodes unreachable', () => {
    const demo = createXrayDemo(flowData, 'broken-reference')
    const analysis = analyzeFlow(demo.nodes)
    expect(analysis.brokenReferences).toEqual([
      { sourceId: '3', targetId: 'missing-billing', label: 'Business' },
    ])
    expect(analysis.reachable.size).toBe(6)
    expect(validateFlow(demo.nodes).map(({ code }) => code)).toEqual(['missing-target-1'])
  })

  it('disconnects the billing branch without adding broken routes', () => {
    const demo = createXrayDemo(flowData, 'unreachable-branch')
    const analysis = analyzeFlow(demo.nodes)
    expect(analysis.unreachable.map(({ id }) => id)).toEqual(['3', '6'])
    expect(analysis.reachable.size).toBe(4)
    expect(analysis.brokenReferences).toEqual([])
    expect(validateFlow(demo.nodes).map(({ code }) => code)).toEqual([
      'unreachable-node',
      'unreachable-node',
    ])
  })

  it('creates a cycle that includes only the looping question', () => {
    const demo = createXrayDemo(flowData, 'cycle')
    const analysis = analyzeFlow(demo.nodes)
    expect(analysis.cycleParticipants).toEqual(new Set(['3']))
    expect(analysis.reachable.size).toBe(6)
    expect(validateFlow(demo.nodes).map(({ code }) => code)).toEqual(['cycle-detected'])
  })
})
