/**
 * Measures rendered flow nodes relative to the SupportFlow canvas.
 *
 * Node x/y values come from flow_data.json, but their final rendered dimensions
 * depend on their content. Measuring the DOM gives the SVG connector layer
 * accurate card boundaries without introducing a graph-layout dependency.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export default function useNodeMeasurements(nodes) {
  const canvasRef = useRef(null)
  const nodeElementsRef = useRef(new Map())
  const [nodeRects, setNodeRects] = useState({})

  /**
   * Stores each rendered node element without coupling FlowNode to connector
   * logic. React calls this callback with null when an element unmounts.
   */
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
      const nextRects = {}

      nodeElementsRef.current.forEach((element, nodeId) => {
        const rect = element.getBoundingClientRect()

        // Convert viewport coordinates into canvas-local coordinates so SVG
        // paths and absolutely positioned nodes share one coordinate system.
        nextRects[nodeId] = {
          x: rect.left - canvasRect.left,
          y: rect.top - canvasRect.top,
          width: rect.width,
          height: rect.height,
        }
      })

      setNodeRects(nextRects)
    }

    measureNodes()

    // ResizeObserver keeps connectors correct if editing changes a card's
    // rendered height. jsdom does not provide it, hence the defensive guard.
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
  }, [nodes])

  return {
    canvasRef,
    nodeRects,
    registerNode,
  }
}
