import { describe, expect, it } from 'vitest'

import analyzeFlow from './analyzeFlow.js'

describe('cycle membership', () => {
  it('finds every member of overlapping cycles and excludes entry and exit nodes', () => {
    const graph = {
      start: ['a'],
      a: ['b', 'c'],
      b: ['a', 'exit'],
      c: ['b'],
      exit: [],
      isolated: ['isolated'],
    }
    const nodes = Object.entries(graph).map(([id, targets]) => ({
      id,
      type: id === 'start' ? 'start' : targets.length ? 'question' : 'end',
      options: targets.map((nextId) => ({ nextId, label: nextId })),
    }))
    const analysis = analyzeFlow(nodes)
    expect(analysis.cycleParticipants).toEqual(new Set(['a', 'b', 'c', 'isolated']))
    expect(analysis.hasCycle).toBe(true)
    expect(analysis.unreachable.map(({ id }) => id)).toEqual(['isolated'])
  })
})
