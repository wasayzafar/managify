import { useState, useEffect, useCallback } from 'react'
import { getIdToken, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase'
import { supabase } from '../supabase'
import { useAuth } from '../auth/useAuth'
import { useBranch } from '../auth/BranchContext'
import {
	PiUserPlusDuotone, PiEnvelopeSimpleDuotone, PiBuildingsDuotone, PiShieldCheckDuotone,
	PiToggleLeftDuotone, PiToggleRightDuotone, PiTrashDuotone, PiWarningCircleDuotone,
	PiWarningDuotone, PiCheckDuotone, PiXDuotone, PiPencilDuotone, PiKeyDuotone,
	PiEyeDuotone, PiEyeSlashDuotone,
} from 'react-icons/pi'

const fieldLabelStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 } as const

type Role = 'manager' | 'staff'

type StaffMember = {
	id: string
	staffUid: string
	email: string
	branchId: string
	role: Role
	isActive: boolean
}

function mapStaff(r: any): StaffMember {
	return { id: r.id, staffUid: r.staff_uid, email: r.email, branchId: r.branch_id, role: r.role, isActive: r.is_active }
}

const emptyForm = { email: '', branchId: '', role: 'staff' as Role }

export default function StaffPage() {
	const { user } = useAuth()
	const { branches, storeId, role, loading: branchLoading } = useBranch()
	const [staff, setStaff] = useState<StaffMember[]>([])
	const [loading, setLoading] = useState(true)
	const [form, setForm] = useState(emptyForm)
	const [formError, setFormError] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [message, setMessage] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState<{ branchId: string; role: Role }>({ branchId: '', role: 'staff' })
	const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null)
	const [busyId, setBusyId] = useState<string | null>(null)
	const [passwordTarget, setPasswordTarget] = useState<StaffMember | null>(null)
	const [passwordValue, setPasswordValue] = useState('')
	const [passwordConfirm, setPasswordConfirm] = useState('')
	const [passwordError, setPasswordError] = useState('')
	const [showPassword, setShowPassword] = useState(false)

	const loadStaff = useCallback(async () => {
		if (!storeId) return
		setLoading(true)
		const { data, error } = await supabase.from('staff_members').select('*').eq('store_id', storeId).order('created_at', { ascending: true })
		if (error) console.error('Error loading staff:', error)
		setStaff((data || []).map(mapStaff))
		setLoading(false)
	}, [storeId])

	useEffect(() => { loadStaff() }, [loadStaff])

	function notify(text: string) {
		setMessage(text)
		setTimeout(() => setMessage(''), 4000)
	}

	async function callStaffApi(body: object) {
		if (!user) throw new Error('Not logged in')
		const token = await getIdToken(user)
		const res = await fetch('/api/staff-users', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		if (!res.ok) {
			const err = await res.json().catch(() => ({}))
			if (res.status === 404) throw new Error('Staff actions need the deployed backend — this endpoint isn\'t available when running "npm run dev" locally.')
			throw new Error(err.error || `HTTP ${res.status}`)
		}
		return res.json()
	}

	function branchName(id: string) {
		return branches.find(b => b.id === id)?.name || 'Unknown branch'
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault()
		setFormError('')
		const email = form.email.trim().toLowerCase()
		if (!email) { setFormError('Enter an email address.'); return }
		if (!form.branchId) { setFormError('Choose a branch.'); return }
		setSubmitting(true)
		try {
			const { uid } = await callStaffApi({ action: 'invite', email })
			const { error } = await supabase.from('staff_members').insert({
				store_id: storeId,
				staff_uid: uid,
				branch_id: form.branchId,
				role: form.role,
				email,
			})
			if (error) throw error
			try { await sendPasswordResetEmail(auth, email) } catch { /* account created either way; email delivery isn't critical-path */ }
			await loadStaff()
			setForm(emptyForm)
			notify(`Invited ${email} — set a password for them with the key icon below.`)
		} catch (err: any) {
			console.error('Error inviting staff:', err)
			setFormError(err.message?.includes('duplicate') ? 'This person is already staff at this store.' : (err.message || 'Could not invite staff member.'))
		} finally {
			setSubmitting(false)
		}
	}

	function startEdit(m: StaffMember) {
		setEditingId(m.id)
		setEditForm({ branchId: m.branchId, role: m.role })
	}

	async function saveEdit(m: StaffMember) {
		try {
			const { error } = await supabase.from('staff_members').update({ branch_id: editForm.branchId, role: editForm.role }).eq('id', m.id)
			if (error) throw error
			await loadStaff()
			setEditingId(null)
		} catch (err) {
			console.error('Error updating staff member:', err)
			notify('Could not save changes.')
		}
	}

	async function toggleActive(m: StaffMember) {
		setBusyId(m.id)
		try {
			await callStaffApi({ action: m.isActive ? 'disable' : 'enable', staffUid: m.staffUid })
			const { error } = await supabase.from('staff_members').update({ is_active: !m.isActive }).eq('id', m.id)
			if (error) throw error
			await loadStaff()
		} catch (err: any) {
			console.error('Error toggling staff status:', err)
			notify('Could not update status: ' + (err.message || ''))
		} finally {
			setBusyId(null)
		}
	}

	function openSetPassword(m: StaffMember) {
		setPasswordTarget(m)
		setPasswordValue('')
		setPasswordConfirm('')
		setPasswordError('')
		setShowPassword(false)
	}

	async function confirmSetPassword() {
		if (!passwordTarget) return
		setPasswordError('')
		if (passwordValue.length < 6) { setPasswordError('Password must be at least 6 characters.'); return }
		if (passwordValue !== passwordConfirm) { setPasswordError('Passwords do not match.'); return }
		setBusyId(passwordTarget.id)
		try {
			await callStaffApi({ action: 'setPassword', staffUid: passwordTarget.staffUid, password: passwordValue })
			notify(`Password set for ${passwordTarget.email}. Share it with them directly.`)
			setPasswordTarget(null)
		} catch (err: any) {
			console.error('Error setting staff password:', err)
			setPasswordError(err.message || 'Could not set password.')
		} finally {
			setBusyId(null)
		}
	}

	async function confirmDelete() {
		if (!deleteTarget) return
		setBusyId(deleteTarget.id)
		try {
			await callStaffApi({ action: 'delete', staffUid: deleteTarget.staffUid })
			const { error } = await supabase.from('staff_members').delete().eq('id', deleteTarget.id)
			if (error) throw error
			await loadStaff()
			setDeleteTarget(null)
		} catch (err: any) {
			console.error('Error deleting staff member:', err)
			notify('Could not remove staff member: ' + (err.message || ''))
		} finally {
			setBusyId(null)
		}
	}

	if (branchLoading) {
		return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--text)' }}>Loading…</div>
	}

	if (role !== 'owner') {
		return (
			<div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
				<PiWarningCircleDuotone size={24} style={{ marginBottom: 10 }} />
				<p style={{ margin: 0 }}>Only the store owner can manage staff.</p>
			</div>
		)
	}

	const isError = message.toLowerCase().includes('could not') || message.toLowerCase().includes('error')

	return (
		<div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
				<div>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Staff</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>Invite staff with their own login, scoped to one branch. Staff have no self-service way to set a password — use the key icon to set one directly.</p>
				</div>
			</div>

			{/* ── Invite form ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Invite Staff Member</h3>
				<form onSubmit={onSubmit}>
					<div className="form-grid">
						<div>
							<label style={fieldLabelStyle}><PiEnvelopeSimpleDuotone size={15} /> Email</label>
							<input type="email" placeholder="name@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
						</div>
						<div>
							<label style={fieldLabelStyle}><PiBuildingsDuotone size={15} /> Branch</label>
							<select value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })}>
								<option value="">Select branch…</option>
								{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
							</select>
						</div>
						<div>
							<label style={fieldLabelStyle}><PiShieldCheckDuotone size={15} /> Permission</label>
							<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>
								<option value="staff">Staff</option>
								<option value="manager">Manager</option>
							</select>
						</div>
					</div>
					{formError && (
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: 'var(--danger)', fontSize: 13 }}>
							<PiWarningCircleDuotone size={15} /> {formError}
						</div>
					)}
					<div className="form-actions" style={{ marginTop: 12 }}>
						<button type="submit" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.6 : 1 }}>
							<PiUserPlusDuotone size={15} /> {submitting ? 'Inviting…' : 'Invite Staff Member'}
						</button>
					</div>
				</form>
			</div>

			{/* ── Staff list ── */}
			<div className="card">
				<div style={{ overflowX: 'auto' }}>
					<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
						<thead>
							<tr style={{ background: 'var(--bg-sunken)' }}>
								{['Email', 'Branch', 'Permission', 'Status'].map(h => (
									<th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
								))}
								<th style={{ padding: '10px 12px', width: 100 }}></th>
							</tr>
						</thead>
						<tbody>
							{!loading && staff.length === 0 && (
								<tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No staff invited yet</td></tr>
							)}
							{loading && (
								<tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
							)}
							{staff.map(m => (
								<tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}
									onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
									onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
								>
									<td style={{ padding: '10px 12px', fontWeight: 500 }}>{m.email}</td>
									<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
										{editingId === m.id
											? <select value={editForm.branchId} onChange={e => setEditForm({ ...editForm, branchId: e.target.value })}>
													{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
												</select>
											: branchName(m.branchId)}
									</td>
									<td style={{ padding: '10px 12px' }}>
										{editingId === m.id
											? <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value as Role })}>
													<option value="staff">Staff</option>
													<option value="manager">Manager</option>
												</select>
											: <span className="badge" style={{ fontSize: 11, textTransform: 'capitalize' }}>{m.role}</span>}
									</td>
									<td style={{ padding: '10px 12px' }}>
										<button
											onClick={() => toggleActive(m)}
											disabled={busyId === m.id}
											title={m.isActive ? 'Active — click to disable login' : 'Disabled — click to re-enable login'}
											style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, cursor: busyId === m.id ? 'wait' : 'pointer', color: m.isActive ? 'var(--success)' : 'var(--text-faint)', fontSize: 13, fontWeight: 600 }}
										>
											{m.isActive ? <PiToggleRightDuotone size={20} /> : <PiToggleLeftDuotone size={20} />}
											{m.isActive ? 'Active' : 'Disabled'}
										</button>
									</td>
									<td style={{ padding: '10px 12px' }}>
										<div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
											{editingId === m.id ? (
												<>
													<button onClick={() => saveEdit(m)} style={{ display: 'flex', padding: 6 }} title="Save"><PiCheckDuotone size={13} /></button>
													<button className="secondary" onClick={() => setEditingId(null)} style={{ display: 'flex', padding: 6 }} title="Cancel"><PiXDuotone size={13} /></button>
												</>
											) : (
												<>
													<button className="secondary" onClick={() => openSetPassword(m)} style={{ display: 'flex', padding: 6 }} title="Set Password"><PiKeyDuotone size={13} /></button>
													<button className="secondary" onClick={() => startEdit(m)} style={{ display: 'flex', padding: 6 }} title="Edit"><PiPencilDuotone size={13} /></button>
													<button className="secondary" onClick={() => setDeleteTarget(m)} style={{ display: 'flex', padding: 6, color: 'var(--danger)' }} title="Remove"><PiTrashDuotone size={13} /></button>
												</>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* ── Toast ── */}
			{message && (
				<div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, maxWidth: 380, boxShadow: '0 8px 24px var(--overlay)', background: isError ? 'var(--danger-bg)' : 'var(--success-bg)', color: isError ? 'var(--danger)' : 'var(--success)', border: `1px solid ${isError ? 'var(--danger)' : 'var(--success)'}` }}>
					{isError ? <PiWarningCircleDuotone size={17} style={{ flexShrink: 0 }} /> : <PiCheckDuotone size={17} style={{ flexShrink: 0 }} />}
					{message}
				</div>
			)}

			{/* ── Set password ── */}
			{passwordTarget && (
				<div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
					onClick={() => busyId !== passwordTarget.id && setPasswordTarget(null)}
				>
					<div className="card" style={{ maxWidth: 400, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
							<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 16%, var(--bg-elevated))', color: 'var(--accent)', flexShrink: 0 }}>
								<PiKeyDuotone size={17} />
							</span>
							<h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Set password for {passwordTarget.email}</h3>
						</div>
						<p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
							This immediately replaces their current password. Share the new one with them directly — they won't be notified.
						</p>
						<label style={fieldLabelStyle}>New Password</label>
						<div style={{ position: 'relative', marginBottom: 12 }}>
							<input
								type={showPassword ? 'text' : 'password'}
								value={passwordValue}
								onChange={e => setPasswordValue(e.target.value)}
								placeholder="At least 6 characters"
								style={{ paddingRight: 36 }}
								autoFocus
							/>
							<button type="button" onClick={() => setShowPassword(s => !s)} title={showPassword ? 'Hide' : 'Show'}
								style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
								{showPassword ? <PiEyeSlashDuotone size={16} /> : <PiEyeDuotone size={16} />}
							</button>
						</div>
						<label style={fieldLabelStyle}>Confirm Password</label>
						<input
							type={showPassword ? 'text' : 'password'}
							value={passwordConfirm}
							onChange={e => setPasswordConfirm(e.target.value)}
							placeholder="Re-enter password"
							onKeyDown={e => { if (e.key === 'Enter') confirmSetPassword() }}
						/>
						{passwordError && (
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: 'var(--danger)', fontSize: 13 }}>
								<PiWarningCircleDuotone size={15} /> {passwordError}
							</div>
						)}
						<div className="form-actions" style={{ marginTop: 14 }}>
							<button className="secondary" onClick={() => setPasswordTarget(null)} disabled={busyId === passwordTarget.id}>Cancel</button>
							<button onClick={confirmSetPassword} disabled={busyId === passwordTarget.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiKeyDuotone size={15} /> {busyId === passwordTarget.id ? 'Setting…' : 'Set Password'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Remove confirmation ── */}
			{deleteTarget && (
				<div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
					onClick={() => busyId !== deleteTarget.id && setDeleteTarget(null)}
				>
					<div className="card" style={{ maxWidth: 400, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
							<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', flexShrink: 0 }}>
								<PiWarningDuotone size={17} />
							</span>
							<h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Remove {deleteTarget.email}?</h3>
						</div>
						<p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
							This permanently deletes their login and revokes access immediately. This can't be undone.
						</p>
						<div className="form-actions">
							<button className="secondary" onClick={() => setDeleteTarget(null)} disabled={busyId === deleteTarget.id}>Cancel</button>
							<button onClick={confirmDelete} disabled={busyId === deleteTarget.id} style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiTrashDuotone size={15} /> {busyId === deleteTarget.id ? 'Removing…' : 'Remove Staff Member'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
