import { useMemo, useState } from 'react'

type Point = { label: string; value: number }

function niceMax(v: number) {
	if (v <= 0) return 10
	const magnitude = Math.pow(10, Math.floor(Math.log10(v)))
	const residual = v / magnitude
	const step = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1
	return step * magnitude
}

function compactNumber(v: number) {
	if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
	if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + 'K'
	return String(Math.round(v))
}

export default function AreaChart({ data, formatValue }: { data: Point[]; formatValue: (v: number) => string }) {
	const [hoverIdx, setHoverIdx] = useState<number | null>(null)
	const W = 1000, H = 170, padL = 40, padR = 10, padT = 12, padB = 22
	const innerW = W - padL - padR, innerH = H - padT - padB

	const max = useMemo(() => {
		const dataMax = Math.max(1, ...data.map(d => d.value))
		return niceMax(dataMax * 1.15)
	}, [data])

	const ticks = 4
	const tickValues = Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * i)

	const points = useMemo(() => {
		if (data.length === 0) return []
		const stepX = data.length > 1 ? innerW / (data.length - 1) : 0
		return data.map((d, i) => {
			const x = padL + (data.length > 1 ? i * stepX : innerW / 2)
			const y = padT + innerH * (1 - Math.min(1, d.value / max))
			return { x, y, ...d }
		})
	}, [data, max, innerW, innerH])

	if (points.length === 0) {
		return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: H, color: 'var(--text-muted)', fontSize: 13.5 }}>No sales in this period</div>
	}

	const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
	const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${padT + innerH} L${points[0].x.toFixed(1)},${padT + innerH} Z`

	// show roughly 6-8 x-axis labels max, evenly spaced
	const labelStride = Math.max(1, Math.ceil(points.length / 7))

	const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
		const rect = e.currentTarget.getBoundingClientRect()
		const relX = ((e.clientX - rect.left) / rect.width) * W
		let nearest = 0, best = Infinity
		points.forEach((p, i) => { const d = Math.abs(p.x - relX); if (d < best) { best = d; nearest = i } })
		setHoverIdx(nearest)
	}

	const hp = hoverIdx !== null ? points[hoverIdx] : null

	return (
		<div style={{ position: 'relative', width: '100%' }}>
			<svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
				{tickValues.map((tv, i) => {
					const y = padT + innerH * (1 - tv / max)
					return (
						<g key={i}>
							<line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
							<text x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--text-faint)">{compactNumber(tv)}</text>
						</g>
					)
				})}

				<path d={areaPath} fill="var(--accent)" opacity={0.1} stroke="none" />
				<path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

				{points.map((p, i) => (i % labelStride === 0 || i === points.length - 1) && (
					<text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--text-faint)">{p.label}</text>
				))}

				{hp && (
					<>
						<line x1={hp.x} x2={hp.x} y1={padT} y2={padT + innerH} stroke="var(--border-strong)" strokeWidth={1} />
						<circle cx={hp.x} cy={hp.y} r={4.5} fill="var(--accent)" stroke="var(--bg-elevated)" strokeWidth={2} />
					</>
				)}

				<rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent"
					onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)} />
			</svg>
			{hp && (
				<div style={{
					position: 'absolute', pointerEvents: 'none',
					left: `${(hp.x / W) * 100}%`, top: `${(hp.y / H) * 100}%`,
					transform: `translate(${hp.x > W * 0.7 ? '-100%' : '12px'}, -120%)`,
					background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8,
					padding: '6px 10px', fontSize: 12.5, boxShadow: '0 4px 16px var(--overlay)', whiteSpace: 'nowrap',
				}}>
					<div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{hp.label}</div>
					<div style={{ color: 'var(--text)', fontWeight: 700 }}>{formatValue(hp.value)}</div>
				</div>
			)}
		</div>
	)
}
