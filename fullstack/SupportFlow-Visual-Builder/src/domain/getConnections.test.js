/**
 * Verifies the transformation from flow_data.json options into graph edges.
 *
 * These tests protect the relationship model independently from SVG or React,
 * making failures easier to diagnose as the editor becomes more interactive.
 */

import { describe, expect, it } from 'vitest'

import flowData from '../../flow_data.json'
import getConnections from './getConnections.js'

describe('getConnections', () => {
  it('creates one directed connection for every configured route', () => {
    const connections = getConnections(flowData.nodes)

    expect(connections).toHaveLength(6)
  })

  it('preserves route labels and target node ids', () => {
    const connections = getConnections(flowData.nodes)

    expect(connections).toContainEqual(
      expect.objectContaining({
        sourceId: '1',
        targetId: '2',
        label: 'Internet is down',
      }),
    )

    expect(connections).toContainEqual(
      expect.objectContaining({
        sourceId: '2',
        targetId: '4',
        label: "Yes, didn't work",
      }),
    )
  })

  it('keeps parallel routes unique when they share the same target', () => {
    const billingRoutes = getConnections(flowData.nodes).filter(
      (connection) => connection.sourceId === '3',
    )

    expect(billingRoutes).toHaveLength(2)
    expect(billingRoutes[0].id).not.toBe(billingRoutes[1].id)
    expect(billingRoutes.every(({ targetId }) => targetId === '6')).toBe(true)
  })
})
