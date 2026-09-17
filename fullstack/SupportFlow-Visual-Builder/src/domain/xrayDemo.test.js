import { describe, expect, it } from 'vitest'

import analyzeFlow from './analyzeFlow.js'
import validateFlow from './validateFlow.js'
import createXrayDemo from './xrayDemo.js'

const importedLikeFlow = {
  meta: {
    theme: 'dark',
    canvas_size: { w: 1200, h: 800 },
  },
  nodes: [
    {
      id: 'start-node',
      type: 'start',
      text: 'Welcome to support.',
      position: { x: 500, y: 60 },
      options: [
        { label: 'Billing', nextId: 'billing-node' },
        { label: 'Tech support', nextId: 'tech-node' },
      ],
    },
    {
      id: 'billing-node',
      type: 'question',
      text: 'Is this personal or business?',
      position: { x: 250, y: 260 },
      options: [
        { label: 'Personal', nextId: 'personal-terminal' },
        { label: 'Business', nextId: 'business-terminal' },
      ],
    },
    {
      id: 'tech-node',
      type: 'question',
      text: 'Have you restarted?',
      position: { x: 760, y: 260 },
      options: [{ label: 'Still down', nextId: 'tech-terminal' }],
    },
    {
      id: 'personal-terminal',
      type: 'end',
      text: 'Connecting to personal billing.',
      position: { x: 120, y: 500 },
      options: [],
    },
    {
      id: 'business-terminal',
      type: 'end',
      text: 'Connecting to business billing.',
      position: { x: 370, y: 500 },
      options: [],
    },
    {
      id: 'tech-terminal',
      type: 'end',
      text: 'Connecting to technical support.',
      position: { x: 760, y: 500 },
      options: [],
    },
  ],
}

function cloneFlow(flow) {
  return JSON.parse(JSON.stringify(flow))
}

describe('X-Ray diagnostic examples', () => {
  it('preserves the current flow object for current or unknown scenarios', () => {
    expect(createXrayDemo(importedLikeFlow, 'current')).toBe(importedLikeFlow)
    expect(createXrayDemo(importedLikeFlow, 'unknown')).toBe(importedLikeFlow)
  })

  it('generates temporary diagnostics from custom/imported node ids without mutating the source', () => {
    const before = cloneFlow(importedLikeFlow)

    for (const scenario of [
      'broken-reference',
      'unreachable-branch',
      'cycle',
      'question-no-routes',
    ]) {
      createXrayDemo(importedLikeFlow, scenario)
      expect(importedLikeFlow).toEqual(before)
    }
  })

  it('creates a broken reference in the active workflow', () => {
    const demo = createXrayDemo(importedLikeFlow, 'broken-reference')
    const analysis = analyzeFlow(demo.nodes)

    expect(analysis.brokenReferences).toEqual([
      {
        sourceId: 'billing-node',
        targetId: 'missing-demo-node',
        label: 'X-Ray missing target',
      },
    ])
    expect(analysis.reachable.size).toBe(importedLikeFlow.nodes.length)
    expect(validateFlow(demo.nodes).map(({ code }) => code)).toEqual(['missing-target-2'])
  })

  it('disconnects a current branch without adding broken references', () => {
    const demo = createXrayDemo(importedLikeFlow, 'unreachable-branch')
    const analysis = analyzeFlow(demo.nodes)

    expect(analysis.unreachable.map(({ id }) => id)).toEqual([
      'billing-node',
      'personal-terminal',
      'business-terminal',
    ])
    expect(analysis.brokenReferences).toEqual([])
    expect(validateFlow(demo.nodes).map(({ code }) => code)).toEqual([
      'unreachable-node',
      'unreachable-node',
      'unreachable-node',
    ])
  })

  it('creates a reachable cycle in the active workflow', () => {
    const demo = createXrayDemo(importedLikeFlow, 'cycle')
    const analysis = analyzeFlow(demo.nodes)

    expect(analysis.cycleParticipants).toEqual(new Set(['billing-node']))
    expect(analysis.reachable.size).toBe(importedLikeFlow.nodes.length)
    expect(validateFlow(demo.nodes).map(({ code }) => code)).toEqual(['cycle-detected'])
  })

  it('creates a reachable question with no routes', () => {
    const demo = createXrayDemo(importedLikeFlow, 'question-no-routes')
    const analysis = analyzeFlow(demo.nodes)
    const issueCodes = validateFlow(demo.nodes).map(({ code }) => code)

    expect(analysis.questionsWithoutRoutes.map(({ id }) => id)).toEqual([
      'question-with-no-routes-demo',
    ])
    expect(analysis.reachable.has('question-with-no-routes-demo')).toBe(true)
    expect(issueCodes).toEqual(['unexpected-dead-end'])
  })
})
