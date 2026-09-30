import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { supabase } from '../supabase'
import { useAuth } from '../auth/useAuth'
import {
	PiCheckCircleDuotone, PiWarningCircleDuotone, PiSpinnerGapBold, PiEyeDuotone, PiEyeSlashDuotone,
} from 'react-icons/pi'

type PlanKey = 'pro' | 'max'
const PLAN_NAMES: Record<PlanKey, string> = { pro: 'Pro', max: 'Max' }

type RegisterState = {
	plan: PlanKey
	email: string
	customerId: string
	transactionId: string
	trial: string | null
}

function isPlanKey(v: unknown): v is PlanKey {
	return v === 'pro' || v === 'max'
}

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
		case 'auth/weak-password': return 'Password must be at least 6 characters.'
		case 'auth/invalid-email': return 'Enter a valid email address.'
		case 'auth/network-request-failed': return 'Network error. Check your connection and try again.'
		default: return err?.message || 'Something went wrong. Please try again.'
	}
}

export default function RegisterPage() {
	const { user } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()
	const state = (location.state || {}) as Partial<RegisterState>

	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [signupError, setSignupError] = useState('')
	const [signupBusy, setSignupBusy] = useState(false)
	const [activating, setActivating] = useState(false)
	const [activateError, setActivateError] = useState('')

	if (!isPlanKey(state.plan)) {
		return (
			<div style={s.page}>
				<style>{RP_CSS}</style>
				<nav style={s.nav}>
					<Link to="/welcome" style={s.navBrand}>
						<img src="./logo.png" alt="Managify" width={30} style={{ borderRadius: 7 }} />
						<span style={s.navBrandName}>Managify</span>
					</Link>
				</nav>
				<div style={s.wrap}>
					<div style={{ ...s.card, textAlign: 'center' }}>
						<h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Pick a plan to get started</h2>
						<p style={{ margin: '0 0 20px', color: '#475569', fontSize: 13.5, lineHeight: 1.5 }}>
							Registration happens right after checkout — choose Pro or Max first and we'll bring you back here.
						</p>
						<Link to="/pricing" className="rp-cta" style={s.ctaPrimary}>View Plans</Link>
					</div>
				</div>
			</div>
		)
	}

	const plan = state.plan
	const checkoutEmail = state.email || ''
	const customerId = state.customerId || ''
	const transactionId = state.transactionId || ''
	const trial = state.trial || null

	// Already-logged-in visitor (e.g. a Pro owner upgrading) — apply the plan
	// to their existing account directly, no new credentials needed.
	async function activateForCurrentUser() {
		if (!user) return
		setActivating(true)
		setActivateError('')
		try {
			const { error } = await supabase.from('user_registry').upsert({
				uid: user.uid,
				email: user.email || '',
				plan,
				paddle_customer_id: customerId || null,
				paddle_transaction_id: transactionId || null,
			}, { onConflict: 'uid' })
			if (error) throw error
			navigate('/')
		} catch (err: any) {
			setActivateError(err?.message || 'Could not activate your plan. Contact support with your transaction ID: ' + transactionId)
		} finally {
			setActivating(false)
		}
	}

	async function handleSignup(e: React.FormEvent) {
		e.preventDefault()
		setSignupError('')
		if (password.length < 6) { setSignupError('Password must be at least 6 characters.'); return }
		if (password !== confirmPassword) { setSignupError('Passwords do not match.'); return }
		setSignupBusy(true)
		try {
			const cred = await createUserWithEmailAndPassword(auth, checkoutEmail, password)
			const { error } = await supabase.from('user_registry').upsert({
				uid: cred.user.uid,
				email: checkoutEmail,
				plan,
				paddle_customer_id: customerId || null,
				paddle_transaction_id: transactionId || null,
			}, { onConflict: 'uid' })
			if (error) throw error
			navigate('/')
		} catch (err: any) {
			if (err?.code === 'auth/email-already-in-use') {
				setSignupError(`An account already exists for ${checkoutEmail}. Log in, then contact support with transaction ${transactionId} to apply this purchase.`)
			} else {
				setSignupError(authErrorMessage(err))
			}
		} finally {
			setSignupBusy(false)
		}
	}

	return (
		<div style={s.page}>
			<style>{RP_CSS}</style>
			<nav style={s.nav}>
				<Link to="/welcome" style={s.navBrand}>
					<img src="./logo.png" alt="Managify" width={30} style={{ borderRadius: 7 }} />
					<span style={s.navBrandName}>Managify</span>
				</Link>
			</nav>
			<div style={s.wrap}>
				<div style={s.card}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
						<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', color: '#16a34a', flexShrink: 0 }}>
							<PiCheckCircleDuotone size={18} />
						</span>
						<h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{trial ? 'Trial started' : 'Payment received'}</h2>
					</div>

					{user ? (
						<>
							<p style={{ margin: '0 0 16px', color: '#475569', fontSize: 13.5, lineHeight: 1.6 }}>
								Apply the <strong style={{ color: '#0f172a' }}>{PLAN_NAMES[plan]}</strong> plan to your account ({user.email}).
								{trial && <> Your {trial.replace(' free trial', '')} free trial has started — you won't be charged until it ends.</>}
							</p>
							{activateError && (
								<div role="alert" style={s.errorRow}>
									<PiWarningCircleDuotone size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{activateError}</span>
								</div>
							)}
							<button onClick={activateForCurrentUser} disabled={activating} className="rp-cta" style={{ ...s.ctaPrimary, width: '100%', justifyContent: 'center', opacity: activating ? 0.7 : 1 }}>
								{activating ? <><PiSpinnerGapBold size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Activating…</> : `Activate ${PLAN_NAMES[plan]}`}
							</button>
						</>
					) : (
						<>
							<p style={{ margin: '0 0 16px', color: '#475569', fontSize: 13.5, lineHeight: 1.6 }}>
								Create your login for the <strong style={{ color: '#0f172a' }}>{PLAN_NAMES[plan]}</strong> plan. We'll use the email from your Paddle receipt.
								{trial && <> Your {trial.replace(' free trial', '')} free trial has started — you won't be charged until it ends.</>}
							</p>
							<form onSubmit={handleSignup}>
								<label style={s.fieldLabel}>Email</label>
								<input value={checkoutEmail} readOnly disabled style={{ ...s.input, marginBottom: 14, opacity: 0.7 }} />
								<PasswordField label="Password" value={password} onChange={setPassword} />
								<PasswordField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} />
								{signupError && (
									<div role="alert" style={s.errorRow}>
										<PiWarningCircleDuotone size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{signupError}</span>
									</div>
								)}
								<button type="submit" disabled={signupBusy} className="rp-cta" style={{ ...s.ctaPrimary, width: '100%', justifyContent: 'center', opacity: signupBusy ? 0.7 : 1 }}>
									{signupBusy ? <><PiSpinnerGapBold size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Creating account…</> : 'Create Account'}
								</button>
							</form>
						</>
					)}
				</div>
			</div>
		</div>
	)
}

const RP_CSS = `
.rp-cta { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.rp-cta:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(34,99,255,0.3); }
.rp-cta:active:not(:disabled) { transform: translateY(0); }
.rp-cta:focus-visible { outline: 2px solid #2263ff; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
	.rp-cta:hover:not(:disabled) { transform: none; }
}
`

const s: Record<string, React.CSSProperties> = {
	page: { background: '#ffffff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif', minHeight: '100vh' },
	nav: {
		position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
		background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
		borderBottom: '1px solid rgba(0,0,0,0.06)',
		padding: '0 32px', height: 64, display: 'flex', alignItems: 'center',
	},
	navBrand: { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' },
	navBrandName: { fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' },
	wrap: { maxWidth: 420, margin: '0 auto', padding: '150px 20px 60px' },
	card: {
		background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
		padding: 28,
	},
	fieldLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 },
	input: {
		width: '100%', boxSizing: 'border-box', background: '#f8fafc', border: '1px solid #cbd5e1',
		borderRadius: 8, padding: '10px 12px', color: '#0f172a', fontSize: 14,
	},
	errorRow: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, color: '#dc2626', fontSize: 13 },
	ctaPrimary: {
		display: 'inline-flex', alignItems: 'center', gap: 8,
		background: '#2263ff', color: 'white',
		border: 'none', borderRadius: 8, padding: '13px 20px', fontSize: 14.5, fontWeight: 700,
		textDecoration: 'none', cursor: 'pointer',
	},
}
