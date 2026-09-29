import { Link } from 'react-router-dom'
import { PiCrownDuotone, PiXDuotone } from 'react-icons/pi'

export default function UpgradeModal({ feature, onClose }: { feature: string; onClose: () => void }) {
	return (
		<div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
			<div className="card" style={{ maxWidth: 360, width: '100%', marginBottom: 0, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
				<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
					<button className="secondary" onClick={onClose} style={{ display: 'flex', padding: 6 }} aria-label="Close"><PiXDuotone size={14} /></button>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, background: 'color-mix(in srgb, #f59e0b 16%, var(--bg-elevated))', color: '#f59e0b', margin: '0 auto 14px' }}>
					<PiCrownDuotone size={24} />
				</div>
				<h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>{feature} is a Max plan feature</h3>
				<p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
					Upgrade to Max to unlock {feature.toLowerCase()}, multiple branches, and staff accounts.
				</p>
				<Link to="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>
					View Plans
				</Link>
			</div>
		</div>
	)
}
