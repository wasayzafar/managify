import { useState, FormEvent } from 'react'
import {
	EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail,
} from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../auth/useAuth'
import {
	PiEnvelopeSimpleDuotone, PiKeyDuotone, PiEyeDuotone, PiEyeSlashDuotone,
	PiWarningCircleDuotone, PiCheckCircleDuotone, PiInfoDuotone,
} from 'react-icons/pi'

const MIN_PASSWORD_LENGTH = 6
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fieldLabelStyle = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontWeight: 700, fontSize: 13, color: 'var(--text)' } as const

function authErrorMessage(err: any): string {
	switch (err?.code) {
		case 'auth/wrong-password':
		case 'auth/invalid-credential':
		case 'auth/invalid-login-credentials':
			return 'Current password is incorrect.'
		case 'auth/too-many-requests':
			return 'Too many attempts. Wait a few minutes and try again.'
		case 'auth/weak-password':
			return `New password is too weak — use at least ${MIN_PASSWORD_LENGTH} characters.`
		case 'auth/requires-recent-login':
			return 'For security, please log out and log back in, then try again.'
		case 'auth/email-already-in-use':
			return 'That email is already used by another account.'
		case 'auth/invalid-email':
			return 'Enter a valid email address.'
		case 'auth/network-request-failed':
			return 'Network error. Check your connection and try again.'
		default:
			return err?.message || 'Something went wrong. Please try again.'
	}
}

function PasswordField({ label, value, onChange, autoComplete, placeholder, error }: {
	label: string
	value: string
	onChange: (next: string) => void
	autoComplete: 'current-password' | 'new-password'
	placeholder?: string
	error?: string
}) {
	const [show, setShow] = useState(false)
	return (
		<div style={{ marginBottom: 14 }}>
			<label style={fieldLabelStyle}>{label}</label>
			<div style={{ position: 'relative' }}>
				<input
					type={show ? 'text' : 'password'}
					value={value}
					onChange={e => onChange(e.target.value)}
					autoComplete={autoComplete}
					placeholder={placeholder}
					style={{ paddingRight: 36 }}
				/>
				<button
					type="button"
					onClick={() => setShow(s => !s)}
					title={show ? 'Hide' : 'Show'}
					aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
					style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
				>
					{show ? <PiEyeSlashDuotone size={16} /> : <PiEyeDuotone size={16} />}
				</button>
			</div>
			{error && <p style={{ margin: '6px 0 0', color: 'var(--danger)', fontSize: 12 }}>{error}</p>}
		</div>
	)
}

function InlineError({ text }: { text: string }) {
	if (!text) return null
	return (
		<div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, color: 'var(--danger)', fontSize: 13 }}>
			<PiWarningCircleDuotone size={15} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{text}</span>
		</div>
	)
}

export default function AccountSecurity({ onNotify }: { onNotify: (text: string) => void }) {
	const { user } = useAuth()
	const currentEmail = user?.email ?? ''
	// Users who signed in through a third-party provider have no password to
	// verify against, so re-authentication (required by Firebase for both
	// operations) can't work for them.
	const hasPasswordLogin = !!user?.providerData.some(p => p.providerId === 'password')

	// ── Change email ──
	const [newEmail, setNewEmail] = useState('')
	const [emailPassword, setEmailPassword] = useState('')
	const [emailError, setEmailError] = useState('')
	const [emailBusy, setEmailBusy] = useState(false)
	const [pendingEmail, setPendingEmail] = useState('')

	// ── Change password ──
	const [oldPassword, setOldPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [passwordError, setPasswordError] = useState('')
	const [passwordBusy, setPasswordBusy] = useState(false)

	async function reauthenticate(password: string) {
		const current = auth.currentUser
		if (!current || !current.email) throw new Error('You are not signed in. Please log in again.')
		await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password))
		return current
	}

	async function handleChangeEmail(e: FormEvent) {
		e.preventDefault()
		setEmailError('')
		setPendingEmail('')
		const target = newEmail.trim()
		if (!EMAIL_PATTERN.test(target)) { setEmailError('Enter a valid email address.'); return }
		if (target.toLowerCase() === currentEmail.toLowerCase()) { setEmailError('That is already your login email.'); return }
		if (!emailPassword) { setEmailError('Enter your current password to confirm this change.'); return }

		setEmailBusy(true)
		try {
			const current = await reauthenticate(emailPassword)
			// Sends a verification link to the NEW address; the login email only
			// switches once that link is opened. Safer than an immediate swap — a
			// typo can't lock the owner out — and it works with Firebase's email
			// enumeration protection, which blocks the immediate updateEmail().
			await verifyBeforeUpdateEmail(current, target)
			setPendingEmail(target)
			setNewEmail('')
			setEmailPassword('')
			onNotify(`Verification link sent to ${target}.`)
		} catch (err: any) {
			setEmailError(authErrorMessage(err))
		} finally {
			setEmailBusy(false)
		}
	}

	async function handleChangePassword(e: FormEvent) {
		e.preventDefault()
		setPasswordError('')
		if (!oldPassword) { setPasswordError('Enter your current password.'); return }
		if (newPassword.length < MIN_PASSWORD_LENGTH) { setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return }
		if (newPassword === oldPassword) { setPasswordError('New password must be different from your current password.'); return }
		if (newPassword !== confirmPassword) { setPasswordError('New password and confirmation do not match.'); return }

		setPasswordBusy(true)
		try {
			const current = await reauthenticate(oldPassword)
			await updatePassword(current, newPassword)
			setOldPassword('')
			setNewPassword('')
			setConfirmPassword('')
			onNotify('Password updated successfully.')
		} catch (err: any) {
			setPasswordError(authErrorMessage(err))
		} finally {
			setPasswordBusy(false)
		}
	}

	if (!hasPasswordLogin) {
		return (
			<div className="card">
				<h3 style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
					<PiInfoDuotone size={16} style={{ color: 'var(--text-muted)' }} /> Sign-in managed elsewhere
				</h3>
				<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
					This account doesn't sign in with an email and password, so its email and password are managed by the sign-in provider rather than here.
				</p>
			</div>
		)
	}

	const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword

	return (
		<>
			{/* ── Login email ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
					<PiEnvelopeSimpleDuotone size={16} style={{ color: 'var(--text-muted)' }} /> Login Email
				</h3>
				<p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
					The email you sign in with. This is separate from the store contact email shown on invoices.
				</p>

				<div style={{ maxWidth: 420 }}>
					<label style={fieldLabelStyle}>Current Email</label>
					<input value={currentEmail} readOnly disabled style={{ marginBottom: 14 }} />

					<form onSubmit={handleChangeEmail}>
						<label style={fieldLabelStyle}>New Email</label>
						<input
							type="email"
							value={newEmail}
							onChange={e => setNewEmail(e.target.value)}
							placeholder="you@newdomain.com"
							autoComplete="email"
							style={{ marginBottom: 14 }}
						/>
						<PasswordField
							label="Current Password"
							value={emailPassword}
							onChange={setEmailPassword}
							autoComplete="current-password"
							placeholder="Confirm it's you"
						/>
						<InlineError text={emailError} />
						{pendingEmail && (
							<div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', fontSize: 13, lineHeight: 1.5 }}>
								<PiCheckCircleDuotone size={16} style={{ flexShrink: 0, marginTop: 1 }} />
								<span>
									We sent a verification link to <strong>{pendingEmail}</strong>. Your login email changes once you open it — then sign in again with the new address. Until then, keep using <strong>{currentEmail}</strong>.
								</span>
							</div>
						)}
						<button type="submit" disabled={emailBusy || !newEmail.trim() || !emailPassword} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							<PiEnvelopeSimpleDuotone size={15} /> {emailBusy ? 'Sending…' : 'Send Verification Link'}
						</button>
					</form>
				</div>
			</div>

			{/* ── Password ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
					<PiKeyDuotone size={16} style={{ color: 'var(--text-muted)' }} /> Change Password
				</h3>
				<p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
					Use a password you don't reuse anywhere else.
				</p>

				<form onSubmit={handleChangePassword} style={{ maxWidth: 420 }}>
					{/* Lets password managers attach the saved login to this form. */}
					<input type="text" name="username" value={currentEmail} autoComplete="username" readOnly tabIndex={-1} aria-hidden="true"
						style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
					<PasswordField label="Old Password" value={oldPassword} onChange={setOldPassword} autoComplete="current-password" />
					<PasswordField
						label="New Password"
						value={newPassword}
						onChange={setNewPassword}
						autoComplete="new-password"
						placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
					/>
					<PasswordField
						label="Confirm Password"
						value={confirmPassword}
						onChange={setConfirmPassword}
						autoComplete="new-password"
						placeholder="Re-enter new password"
						error={confirmMismatch ? 'Passwords do not match.' : undefined}
					/>
					<InlineError text={passwordError} />
					<button type="submit" disabled={passwordBusy || !oldPassword || !newPassword || !confirmPassword} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<PiKeyDuotone size={15} /> {passwordBusy ? 'Updating…' : 'Update Password'}
					</button>
				</form>
			</div>
		</>
	)
}
