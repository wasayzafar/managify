import type { ReactNode } from 'react'
import { PiCaretUpDuotone, PiCaretDownDuotone } from 'react-icons/pi'

export type Tint = 'accent' | 'success' | 'danger' | 'warning' | 'neutral'

export function tintStyle(tint: Tint) {
	if (tint === 'neutral') return { background: 'var(--bg-sunken)', color: 'var(--text-muted)' }
	return { background: `color-mix(in srgb, var(--${tint}) 14%, var(--bg-elevated))`, color: `var(--${tint})` }
}

function Sparkline({ data, tint }: { data: number[]; tint: Tint }) {
	if (data.length < 2) return null
	const w = 100, h = 18, pad = 2
	const min = Math.min(...data), max = Math.max(...data)
	const range = max - min || 1
	const stepX = (w - pad * 2) / (data.length - 1)
	const points = data.map((v, i) => {
		const x = pad + i * stepX
		const y = pad + (h - pad * 2) * (1 - (v - min) / range)
		return [x, y] as const
	})
	const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
	const area = `${line} L${points[points.length - 1][0].toFixed(1)},${h - pad} L${points[0][0].toFixed(1)},${h - pad} Z`
	const color = tint === 'neutral' ? 'var(--text-faint)' : `var(--${tint})`
	const last = points[points.length - 1]
	return (
		<svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: 'block', marginTop: 6, overflow: 'visible' }} preserveAspectRatio="none">
			<path d={area} fill={color} opacity={0.12} stroke="none" />
			<path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
			<circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
		</svg>
	)
}

export function StatCard({ icon, tint, iconStyle, label, value, valueColor, caption, captionIcon, captionColor, delta, sparkline }: {
	icon: ReactNode
	tint: Tint
	/** full override for the icon badge background/color, for a one-off decorative tint that isn't a semantic status */
	iconStyle?: { background: string; color: string }
	label: string
	value: ReactNode
	valueColor?: string
	caption?: ReactNode
	captionIcon?: ReactNode
	captionColor?: string
	/** signed percentage change vs. a prior period; omit when there's no meaningful baseline */
	delta?: number
	/** short recent history, oldest → newest, rendered as a mini trend line */
	sparkline?: number[]
}) {
	const hasDelta = delta !== undefined && Number.isFinite(delta)
	const deltaColor = !hasDelta || delta === 0 ? 'var(--text-muted)' : delta! > 0 ? 'var(--success)' : 'var(--danger)'
	return (
		<div className="stat-card">
			<div className="kpi-icon" style={iconStyle || tintStyle(tint)}>{icon}</div>
			<h3>{label}</h3>
			<p className="value" style={valueColor ? { color: valueColor } : undefined}>{value}</p>
			{(caption || hasDelta) && (
				<p className="change" style={{ justifyContent: 'space-between' }}>
					<span style={{ display: 'flex', alignItems: 'center', gap: 5, color: captionColor || 'var(--text-muted)' }}>{captionIcon}{caption}</span>
					{hasDelta && (
						<span style={{ display: 'flex', alignItems: 'center', gap: 2, color: deltaColor, fontWeight: 600, flexShrink: 0 }}>
							{delta === 0 ? '—' : delta! > 0 ? <PiCaretUpDuotone size={11} /> : <PiCaretDownDuotone size={11} />}
							{delta !== 0 && `${Math.abs(delta!).toFixed(1)}%`}
						</span>
					)}
				</p>
			)}
			{sparkline && sparkline.length > 1 && <Sparkline data={sparkline} tint={tint} />}
		</div>
	)
}
