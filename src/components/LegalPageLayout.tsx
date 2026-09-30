import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default function LegalPageLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
	return (
		<div style={s.page}>
			<style>{CSS}</style>
			<nav style={s.nav}>
				<div style={s.navInner}>
					<Link to="/welcome" style={s.navBrand}>
						<img src="./logo.png" alt="Managify" width={30} style={{ borderRadius: 7 }} />
						<span style={s.navBrandName}>Managify</span>
					</Link>
					<Link to="/welcome" className="pub-nav-link" style={s.backLink}>Back to home</Link>
				</div>
			</nav>

			<div style={s.wrap}>
				<h1 style={s.h1}>{title}</h1>
				<p style={s.updated}>Last updated {updated}</p>
				<div className="legal-prose">{children}</div>
			</div>
		</div>
	)
}

const CSS = `
.legal-prose h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 32px 0 10px; }
.legal-prose h2:first-child { margin-top: 0; }
.legal-prose p { font-size: 14.5px; line-height: 1.75; color: #475569; margin: 0 0 14px; }
.legal-prose ul { margin: 0 0 14px; padding-left: 22px; }
.legal-prose li { font-size: 14.5px; line-height: 1.75; color: #475569; margin-bottom: 6px; }
.legal-prose strong { color: #0f172a; }
.legal-prose a { color: #2263ff; text-decoration: none; }
.legal-prose a:hover { text-decoration: underline; }
`

const s: Record<string, React.CSSProperties> = {
	page: { background: '#ffffff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif', minHeight: '100vh' },
	nav: {
		position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
		background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
		borderBottom: '1px solid rgba(0,0,0,0.06)',
	},
	navInner: {
		maxWidth: 860, margin: '0 auto', padding: '0 24px', height: 64,
		display: 'flex', alignItems: 'center', justifyContent: 'space-between',
	},
	navBrand: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
	navBrandName: { fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' },
	backLink: { fontSize: 13.5, fontWeight: 600, color: '#475569', textDecoration: 'none' },
	wrap: { maxWidth: 720, margin: '0 auto', padding: '128px 24px 100px' },
	h1: { fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 8px' },
	updated: { fontSize: 13, color: '#94a3b8', margin: '0 0 36px' },
}
