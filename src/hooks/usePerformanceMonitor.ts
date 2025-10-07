import { useEffect, useRef } from 'react'

interface PerformanceMetrics {
  queryTime: number
  renderTime: number
  totalTime: number
}

export function usePerformanceMonitor(queryName: string) {
  const startTime = useRef<number>(0)
  const queryStartTime = useRef<number>(0)
  const renderStartTime = useRef<number>(0)

  const startQuery = () => {
    queryStartTime.current = performance.now()
  }

  const endQuery = () => {
    const queryTime = performance.now() - queryStartTime.current
    console.log(`[Performance] ${queryName} query took ${queryTime.toFixed(2)}ms`)
    return queryTime
  }

  const startRender = () => {
    renderStartTime.current = performance.now()
  }

  const endRender = () => {
    const renderTime = performance.now() - renderStartTime.current
    console.log(`[Performance] ${queryName} render took ${renderTime.toFixed(2)}ms`)
    return renderTime
  }

  const startTotal = () => {
    startTime.current = performance.now()
  }

  const endTotal = (): PerformanceMetrics => {
    const totalTime = performance.now() - startTime.current
    const queryTime = queryStartTime.current ? performance.now() - queryStartTime.current : 0
    const renderTime = renderStartTime.current ? performance.now() - renderStartTime.current : 0
    
    console.log(`[Performance] ${queryName} total time: ${totalTime.toFixed(2)}ms`)
    
    return {
      queryTime,
      renderTime,
      totalTime
    }
  }

  // Log performance metrics to console in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] Monitoring ${queryName}`)
    }
  }, [queryName])

  return {
    startQuery,
    endQuery,
    startRender,
    endRender,
    startTotal,
    endTotal
  }
}
