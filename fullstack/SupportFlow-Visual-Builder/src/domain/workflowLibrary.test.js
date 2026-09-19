import { describe, expect, it } from 'vitest'

import {
  deleteWorkflow,
  getImportedWorkflowName,
  getWorkflowRating,
  loadWorkflowLibrary,
  loadWorkspaceSession,
  persistWorkflowLibrary,
  persistWorkspaceSession,
  renameWorkflow,
  saveWorkflow,
  searchWorkflows,
  WORKSPACE_SESSION_STORAGE_KEY,
  WORKFLOW_LIBRARY_STORAGE_KEY,
} from './workflowLibrary.js'

const flow = {
  meta: {
    theme: 'dark',
    canvas_size: { w: 1200, h: 800 },
  },
  nodes: [
    {
      id: '1',
      type: 'start',
      text: 'Welcome to support.',
      position: { x: 500, y: 50 },
      options: [{ label: 'Billing', nextId: '2' }],
    },
    {
      id: '2',
      type: 'end',
      text: 'Connecting you to billing.',
      position: { x: 500, y: 250 },
      options: [],
    },
  ],
}

function createStorageMock(seed = null) {
  let lastKey = null

  return {
    getItem: () => seed,
    setItem: (_key, nextValue) => {
      lastKey = _key
      seed = nextValue
    },
    get lastKey() {
      return lastKey
    },
  }
}

describe('workflowLibrary', () => {
  it('formats imported workflow names from source files', () => {
    expect(
      getImportedWorkflowName('Excel workbook', 'supportflow_low_rating_blocked_workflow.xlsx'),
    ).toBe('Imported Supportflow Low Rating Blocked Workflow')
    expect(getImportedWorkflowName('JSON', 'billing-flow.json')).toBe('Imported Billing Flow')
    expect(getImportedWorkflowName('spreadsheet', 'vipCustomerEscalation.csv')).toBe(
      'Imported Vip Customer Escalation',
    )
    expect(getImportedWorkflowName('JSON')).toBe('Imported JSON Workflow')
  })

  it('saves, renames, searches, and deletes workflow records', () => {
    const saved = saveWorkflow([], {
      id: 'workflow-1',
      name: 'Billing workflow',
      flow,
      now: Date.UTC(2026, 8, 15, 7),
    })

    expect(saved.workflow).toMatchObject({
      id: 'workflow-1',
      name: 'Billing workflow',
      createdAt: '2026-09-15T07:00:00.000Z',
      updatedAt: '2026-09-15T07:00:00.000Z',
    })
    expect(searchWorkflows(saved.workflows, 'connecting you')).toHaveLength(1)

    const renamed = renameWorkflow(
      saved.workflows,
      'workflow-1',
      'Router fallback',
      Date.UTC(2026, 8, 15, 8),
    )

    expect(renamed.workflow).toMatchObject({
      name: 'Router fallback',
      updatedAt: '2026-09-15T08:00:00.000Z',
    })
    expect(searchWorkflows(renamed.workflows, 'billing')).toHaveLength(1)
    expect(deleteWorkflow(renamed.workflows, 'workflow-1')).toEqual([])
  })

  it('rates workflows and returns improvement suggestions', () => {
    expect(getWorkflowRating(flow)).toMatchObject({
      score: 100,
      label: 'Launch ready',
      tone: 'excellent',
      issueCount: 0,
      breakdown: [
        { label: 'Structure', score: 100, detail: 'No graph issues' },
        { label: 'Route labels', score: 100, detail: 'Labels are clear' },
        { label: 'Content', score: 100, detail: 'Messages are filled' },
        { label: 'Endings', score: 80, detail: '1 terminal exit' },
      ],
      suggestions: ['Ready to preview. Test each route once before sharing the workflow.'],
    })

    const brokenFlow = {
      ...flow,
      nodes: [
        {
          ...flow.nodes[0],
          options: [{ label: 'Route', nextId: '99' }],
        },
        flow.nodes[1],
      ],
    }
    const rating = getWorkflowRating(brokenFlow)

    expect(rating.score).toBeLessThan(80)
    expect(rating.label).toBe('Needs review')
    expect(rating.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Structure', score: 65, detail: '1 error · 1 warning' }),
        expect.objectContaining({ label: 'Route labels', score: 75, detail: '1 generic label' }),
      ]),
    )
    expect(rating.suggestions).toContain('Reconnect routes that point to missing nodes.')
    expect(rating.suggestions).toContain('Connect unreachable nodes back into the Start path.')
    expect(rating.suggestions).toContain('Rename 1 generic route label.')
  })

  it('loads only valid workflows from localStorage', () => {
    const storage = createStorageMock(
      JSON.stringify([
        {
          id: 'workflow-1',
          name: 'Saved workflow',
          flow,
          createdAt: '2026-09-15T07:00:00.000Z',
          updatedAt: '2026-09-15T07:00:00.000Z',
        },
        { id: 'broken' },
      ]),
    )

    const workflows = loadWorkflowLibrary(storage)

    expect(workflows).toHaveLength(1)
    expect(workflows[0]).toMatchObject({ id: 'workflow-1', name: 'Saved workflow' })
  })

  it('persists workflow JSON under the library key', () => {
    const storage = createStorageMock()

    expect(
      persistWorkflowLibrary([{ id: 'workflow-1', name: 'Saved workflow', flow }], storage),
    ).toBe(true)
    expect(JSON.parse(storage.getItem(WORKFLOW_LIBRARY_STORAGE_KEY))).toEqual([
      {
        id: 'workflow-1',
        name: 'Saved workflow',
        flow,
      },
    ])
  })

  it('persists and restores the active workspace session', () => {
    const storage = createStorageMock()

    expect(
      persistWorkspaceSession(
        {
          flow,
          workflowName: 'Imported Excel Workflow',
          activeWorkflowId: 'workflow-1',
          selectedNodeId: '2',
        },
        storage,
      ),
    ).toBe(true)
    expect(storage.lastKey).toBe(WORKSPACE_SESSION_STORAGE_KEY)

    expect(loadWorkspaceSession(storage)).toMatchObject({
      workflowName: 'Imported Excel Workflow',
      activeWorkflowId: 'workflow-1',
      selectedNodeId: '2',
      flow,
    })
  })
})
