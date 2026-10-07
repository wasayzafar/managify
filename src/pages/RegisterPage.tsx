import { useLandingFont } from '../utils/landingFont'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../auth/useAuth'
import PublicNav from '../components/PublicNav'
import {
	PiWarningCircleDuotone, PiSpinnerGapBold, PiEyeDuotone, PiEyeSlashDuotone,
	PiCheckCircleDuotone, PiShieldCheckDuotone,
} from 'react-icons/pi'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 6

const BENEFITS = [
	'Inventory, purchases and billing in one place',
	'Sales analytics and profit & loss reports',
	'Works in any browser — desktop, tablet or phone',
]

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
	const [show, setShow] = useState(false)
	return (
		<div style={{ marginBottom: 14 }}>
			<label style={s.fieldLabel}>{label}</label>
			<div style={{ position: 'relative' }}>
				<input
					type={show ? 'text' : 'password'}
					value={value}
					onChange={e => onChange(e.target.value)}
					autoComplete="new-password"
					style={{ ...s.input, paddingRight: 36 }}
				/>
				<button
					type="button"
					onClick={() => setShow(v => !v)}
					aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
					style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', padding: 4, display: 'flex', cursor: 'pointer' }}
				>
					{show ? <PiEyeSlashDuotone size={16} /> : <PiEyeDuotone size={16} />}
				</button>
			</div>
		</div>
	)
}

function authErrorMessage(err: any): string {
	switch (err?.code) {
		case 'auth/weak-password': return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
		case 'auth/invalid-email': return 'Enter a valid email address.'
		case 'auth/network-request-failed': return 'Network error. Check your connection and try again.'
		case 'auth/too-many-requests': return 'Too many attempts. Wait a few minutes and try again.'
		default: return err?.message || 'Something went wrong. Please try again.'
	}
}

export default function RegisterPage() {
	useLandingFont()
	const { user, loading } = useAuth()
	const navigate = useNavigate()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)

	if (!loading && user) return <Navigate to="/pricing" replace />

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError('')
		const target = email.trim()
		if (!EMAIL_PATTERN.test(target)) { setError('Enter a valid email address.'); return }
		if (password.length < MIN_PASSWORD_LENGTH) { setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return }
		if (password !== confirmPassword) { setError('Passwords do not match.'); return }

		setBusy(true)
		try {
			await createUserWithEmailAndPassword(auth, target, password)
			navigate('/pricing', { replace: true })
		} catch (err: any) {
			if (err?.code === 'auth/email-already-in-use') {
				setError('An account already exists for this email. Log in instead.')
			} else {
				setError(authErrorMessage(err))
			}
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="pub-page" style={s.page}>
			<PublicNav />
			<div style={s.wrap}>
				<div className="rp-grid">
					<div>
						<div style={s.stepPill}>
							<span style={s.stepTag}>Step 1 of 2</span>
							<span style={s.stepText}>Create your login</span>
						</div>
						<h1 style={s.heading}>Create your account</h1>
						<p style={s.sub}>
							Then choose a plan and start your free trial. Your data stays in your account, and you can cancel anytime.
						</p>
						<ul style={s.benefitList}>
							{BENEFITS.map(b => (
								<li key={b} style={s.benefitItem}>
									<span style={s.benefitIcon}><PiCheckCircleDuotone size={18} /></span>
									<span>{b}</span>
								</li>
							))}
						</ul>
						<div style={s.trustRow}>
							<PiShieldCheckDuotone size={15} />
							<span>Free 30-day trial on every plan · Cancel anytime before it ends</span>
						</div>
					</div>

					<div style={s.card}>
						<h2 style={s.cardTitle}>Your login details</h2>
						<p style={s.cardSub}>You'll use these to sign in.</p>

						<form onSubmit={handleSubmit}>
							<label style={s.fieldLabel}>Email</label>
							<input
								type="email"
								value={email}
								onChange={e => setEmail(e.target.value)}
								placeholder="you@example.com"
								autoComplete="email"
								required
								style={{ ...s.input, marginBottom: 14 }}
							/>
							<PasswordField label="Password" value={password} onChange={setPassword} />
							<PasswordField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} />

							{error && (
								<div role="alert" style={s.errorRow}>
									<PiWarningCircleDuotone size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
								</div>
							)}

							<button type="submit" disabled={busy} className="pub-cta-primary" style={{ ...s.ctaPrimary, width: '100%', justifyContent: 'center', opacity: busy ? 0.7 : 1 }}>
								{busy ? <><PiSpinnerGapBold size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Creating account…</> : 'Create account'}
							</button>
						</form>

						<p style={s.loginLine}>
							Already have an account?{' '}
							<Link to="/login" style={s.loginLink}>Log in</Link>
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}

const s: Record<string, React.CSSProperties> = {
	page: {
		background: '#f8fafc', color: '#0f172a',
		fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
		minHeight: '100vh',
	},
	wrap: { padding: '150px 24px 80px' },
	stepPill: {
		display: 'inline-flex', alignItems: 'center', gap: 10,
		background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 999,
		padding: '4px 14px 4px 4px', marginBottom: 22,
	},
	stepTag: {
		background: '#2563eb', color: '#ffffff', borderRadius: 999, padding: '3px 9px',
		fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
	},
	stepText: { fontSize: 13.5, fontWeight: 500, color: '#0f172a' },
	heading: {
		fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 600, lineHeight: 1.15,
		letterSpacing: '-1px', color: '#0f172a', margin: '0 0 16px',
	},
	sub: { fontSize: 16, lineHeight: 1.65, color: '#475569', margin: '0 0 28px', maxWidth: 480 },
	benefitList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 },
	benefitItem: { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: '#334155', lineHeight: 1.5 },
	benefitIcon: { display: 'flex', color: '#16a34a', flexShrink: 0, marginTop: 1 },
	trustRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 26, color: '#64748b', fontSize: 13 },

	card: {
		background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14,
		padding: 28, boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
	},
	cardTitle: { margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: '#0f172a' },
	cardSub: { margin: '0 0 22px', fontSize: 13.5, color: '#475569' },
	fieldLabel: { display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 6 },
	input: {
		width: '100%', boxSizing: 'border-box', background: '#f8fafc', border: '1px solid #cbd5e1',
		borderRadius: 8, padding: '10px 12px', color: '#0f172a', fontSize: 14,
	},
	errorRow: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, color: '#dc2626', fontSize: 13 },
	ctaPrimary: {
		display: 'inline-flex', alignItems: 'center', gap: 8,
		background: '#2263ff', color: 'white',
		border: 'none', borderRadius: 8, padding: '13px 20px', fontSize: 14.5, fontWeight: 600,
		textDecoration: 'none', cursor: 'pointer',
	},
	loginLine: { margin: '18px 0 0', textAlign: 'center', color: '#475569', fontSize: 13.5 },
	loginLink: { color: '#2263ff', fontWeight: 500, textDecoration: 'none' },
}
