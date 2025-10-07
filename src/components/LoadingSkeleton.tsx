import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  style?: React.CSSProperties
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = '20px', 
  className = '', 
  style = {} 
}) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        background: 'linear-gradient(90deg, #1a1f2e 25%, #243245 50%, #1a1f2e 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-loading 1.5s infinite',
        borderRadius: '4px',
        ...style
      }}
    />
  )
}

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => {
  return (
    <div className="table-skeleton">
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="40px" style={{ flex: 1 }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} height="32px" style={{ flex: 1 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export const CardSkeleton: React.FC = () => {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <Skeleton height="24px" width="60%" style={{ marginBottom: '16px' }} />
      <Skeleton height="16px" width="100%" style={{ marginBottom: '8px' }} />
      <Skeleton height="16px" width="80%" style={{ marginBottom: '8px' }} />
      <Skeleton height="16px" width="90%" />
    </div>
  )
}

export const StatsSkeleton: React.FC = () => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

// Add CSS animation
const style = document.createElement('style')
style.textContent = `
  @keyframes skeleton-loading {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  
  .skeleton {
    display: inline-block;
  }
  
  .table-skeleton {
    padding: 16px;
  }
`
document.head.appendChild(style)
