import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

// Shared header for public pages. Section links point at the landing page
// unless `anchorPrefix` is set (the landing page itself passes '').
export default function PublicNav({ anchorPrefix = '/welcome' }: { anchorPrefix?: string }) {
	const { user } = useAuth()
	return (
		<nav style={s.nav}>
			<div style={s.navInner} className="pub-nav-inner">
				<Link to="/welcome" style={s.navBrand}>
					<img src="./logo.png" alt="Managify" width={30} style={{ borderRadius: 7 }} />
					<span style={s.navBrandName}>Managify</span>
				</Link>
				<div style={s.navLinks}>
					<div className="pub-nav-feature-links">
						<a href={`${anchorPrefix}#features`} className="pub-nav-link" style={s.navLink}>Features</a>
						<a href={`${anchorPrefix}#industries`} className="pub-nav-link" style={s.navLink}>Industries</a>
						<a href={`${anchorPrefix}#custom`} className="pub-nav-link" style={s.navLink}>Custom Solutions</a>
						<a href={`${anchorPrefix}#why`} className="pub-nav-link" style={s.navLink}>Why Managify</a>
						<Link to="/pricing" className="pub-nav-link" style={s.navLink}>Pricing</Link>
						<Link to="/contact" className="pub-nav-link" style={s.navLink}>Contact</Link>
					</div>
					{user
						? <Link to="/" className="pub-nav-login" style={s.navLogin}>Dashboard</Link>
						: <Link to="/login" className="pub-nav-login" style={s.navLogin}>Sign In</Link>}
				</div>
			</div>
		</nav>
	)
}

const s: Record<string, React.CSSProperties> = {
	nav: {
		position: 'fixed',
		top: 16, left: 16, right: 16,
		zIndex: 100,
		background: 'rgba(255,255,255,0.85)',
		backdropFilter: 'blur(12px)',
		border: '1px solid #e2e8f0',
		borderRadius: 14,
		boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
	},
	navInner: {
		maxWidth: 1200,
		margin: '0 auto',
		padding: '0 32px',
		height: 64,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	navBrand: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
	navBrandName: { fontSize: 18, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.3px' },
	navLinks: { display: 'flex', alignItems: 'center', gap: 32 },
	navLink: { fontSize: 14, color: '#475569', textDecoration: 'none', fontWeight: 500 },
	navLogin: {
		fontSize: 14, fontWeight: 500, color: '#0f172a', textDecoration: 'none',
		background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 18px',
	},
}
