/**
 * Tests SupportFlow's connector geometry independently from the DOM.
 *
 * Keeping these calculations deterministic gives us confidence that SVG paths
 * remain stable even as visual components evolve around them.
 */

import { describe, expect, it } from 'vitest'

import { createBezierPath, getBezierPoint } from './createBezierPath.js'

describe('createBezierPath', () => {
  it('creates a deterministic cubic path between two anchors', () => {
    const path = createBezierPath({ x: 100, y: 100 }, { x: 300, y: 300 })

    expect(path).toBe('M 100 100 C 100 190, 300 210, 300 300')
  })

  it('uses a minimum control offset for short connections', () => {
    const path = createBezierPath({ x: 50, y: 100 }, { x: 50, y: 150 })

    expect(path).toBe('M 50 100 C 50 164, 50 86, 50 150')
  })
})

describe('getBezierPoint', () => {
  it('returns a point on the curve for connector labels', () => {
    const point = getBezierPoint({ x: 100, y: 100 }, { x: 300, y: 300 }, 0.5)

    expect(point.x).toBeCloseTo(200)
    expect(point.y).toBeCloseTo(200)
  })
})
