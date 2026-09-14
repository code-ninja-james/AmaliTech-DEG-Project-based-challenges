/**
 * Measures rendered flow nodes relative to the SupportFlow canvas.
 *
 * Node x/y values come from flow_data.json, but their final rendered dimensions
 * depend on their content. Measurements are normalised back into canvas units
 * so connectors remain correct even when the editor applies visual zoom.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export default function useNodeMeasurements(nodes, scale = 1) {
  const canvasRef = useRef(null)
  const nodeElementsRef = useRef(new Map())
  const [nodeRects, setNodeRects] = useState({})

  const registerNode = useCallback((nodeId, element) => {
    if (element) {
      nodeElementsRef.current.set(nodeId, element)
      return
    }

    nodeElementsRef.current.delete(nodeId)
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return undefined
    }

    const measureNodes = () => {
      const canvasRect = canvas.getBoundingClientRect()
      const safeScale = scale || 1
      const nextRects = {}

      nodeElementsRef.current.forEach((element, nodeId) => {
        const rect = element.getBoundingClientRect()

        nextRects[nodeId] = {
          x: (rect.left - canvasRect.left) / safeScale,
          y: (rect.top - canvasRect.top) / safeScale,
          width: rect.width / safeScale,
          height: rect.height / safeScale,
        }
      })

      setNodeRects(nextRects)
    }

    measureNodes()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureNodes)

    if (observer) {
      observer.observe(canvas)

      nodeElementsRef.current.forEach((element) => {
        observer.observe(element)
      })
    }

    window.addEventListener('resize', measureNodes)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measureNodes)
    }
  }, [nodes, scale])

  return {
    canvasRef,
    nodeRects,
    registerNode,
  }
}
