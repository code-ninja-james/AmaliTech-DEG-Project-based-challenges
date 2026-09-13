/**
 * Provides the geometry used by SupportFlow's native SVG connectors.
 *
 * Connectors use cubic Bézier curves because they remain readable when nodes
 * are horizontally separated while still communicating the graph's primary
 * top-to-bottom direction. The implementation is intentionally framework-free
 * to satisfy the challenge requirement that line logic is built from scratch.
 */

/**
 * Calculates the two control points shared by the rendered path and its label.
 *
 * @param {{ x: number, y: number }} source
 * @param {{ x: number, y: number }} target
 * @returns {{
 *   control1: { x: number, y: number },
 *   control2: { x: number, y: number }
 * }}
 */
function getControlPoints(source, target) {
  const verticalDistance = Math.abs(target.y - source.y)
  const direction = target.y >= source.y ? 1 : -1

  // A minimum offset prevents short connections from becoming nearly straight.
  // Longer connections scale naturally with the distance between their nodes.
  const controlOffset = Math.max(64, verticalDistance * 0.45)

  return {
    control1: {
      x: source.x,
      y: source.y + controlOffset * direction,
    },
    control2: {
      x: target.x,
      y: target.y - controlOffset * direction,
    },
  }
}

/**
 * Creates SVG path data for a cubic Bézier connection.
 *
 * @param {{ x: number, y: number }} source
 * @param {{ x: number, y: number }} target
 * @returns {string} SVG path data.
 */
export function createBezierPath(source, target) {
  const { control1, control2 } = getControlPoints(source, target)

  return [
    `M ${source.x} ${source.y}`,
    `C ${control1.x} ${control1.y},`,
    `${control2.x} ${control2.y},`,
    `${target.x} ${target.y}`,
  ].join(' ')
}

/**
 * Returns a point along the same Bézier curve used by the connector.
 *
 * The connector label uses this instead of a simple linear midpoint so the
 * label remains attached to the visible curve when nodes are far apart.
 *
 * @param {{ x: number, y: number }} source
 * @param {{ x: number, y: number }} target
 * @param {number} t Position along the curve from 0 to 1.
 * @returns {{ x: number, y: number }}
 */
export function getBezierPoint(source, target, t = 0.5) {
  const { control1, control2 } = getControlPoints(source, target)
  const inverseT = 1 - t

  return {
    x:
      inverseT ** 3 * source.x +
      3 * inverseT ** 2 * t * control1.x +
      3 * inverseT * t ** 2 * control2.x +
      t ** 3 * target.x,
    y:
      inverseT ** 3 * source.y +
      3 * inverseT ** 2 * t * control1.y +
      3 * inverseT * t ** 2 * control2.y +
      t ** 3 * target.y,
  }
}
