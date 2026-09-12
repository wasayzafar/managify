import { useState } from 'react'
import { db, Branch } from '../storage'
import { useBranch } from '../auth/BranchContext'
import {
	PiBuildingsDuotone, PiMapPinLineDuotone, PiPhoneDuotone, PiPlusDuotone,
	PiPencilDuotone, PiTrashDuotone, PiWarningCircleDuotone, PiWarningDuotone,
	PiToggleLeftDuotone, PiToggleRightDuotone, PiCheckDuotone, PiXDuotone,
} from 'react-icons/pi'

const fieldLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 } as const

const emptyForm = { name: '', address: '', phone: '' }

export default function BranchesPage() {
	const { branches, mainBranchId, refreshBranches, loading: branchContextLoading, role } = useBranch()
	const [form, setForm] = useState(emptyForm)
	const [formError, setFormError] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState(emptyForm)
	const [editError, setEditError] = useState('')
	const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null)
	const [deleting, setDeleting] = useState(false)

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault()
		setFormError('')
		const name = form.name.trim()
		if (!name) { setFormError('Enter a branch name.'); return }
		setSubmitting(true)
		try {
			await db.createBranch({ name, address: form.address.trim(), phone: form.phone.trim() })
			await refreshBranches()
			setForm(emptyForm)
		} catch (error) {
			console.error('Error creating branch:', error)
			setFormError('Could not save branch. Please try again.')
		} finally {
			setSubmitting(false)
		}
	}

	function startEdit(branch: Branch) {
		setEditingId(branch.id)
		setEditError('')
		setEditForm({ name: branch.name, address: branch.address || '', phone: branch.phone || '' })
	}

	async function saveEdit(id: string) {
		setEditError('')
		const name = editForm.name.trim()
		if (!name) { setEditError('Enter a branch name.'); return }
		try {
			await db.updateBranch(id, { name, address: editForm.address.trim(), phone: editForm.phone.trim() })
			await refreshBranches()
			setEditingId(null)
		} catch (error) {
			console.error('Error updating branch:', error)
			setEditError('Could not save changes. Please try again.')
		}
	}

	async function toggleActive(branch: Branch) {
		try {
			await db.updateBranch(branch.id, { isActive: !branch.isActive })
			await refreshBranches()
		} catch (error) {
			console.error('Error updating branch:', error)
		}
	}

	async function confirmDelete() {
		if (!deleteTarget) return
		setDeleting(true)
		try {
			await db.deleteBranch(deleteTarget.id)
			await refreshBranches()
			setDeleteTarget(null)
		} catch (error: any) {
			console.error('Error deleting branch:', error)
			alert('Cannot delete branch: ' + (error?.message || 'it may still have purchases, sales, or other records attached.'))
		} finally {
			setDeleting(false)
		}
	}

	if (branchContextLoading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--text)' }}>
				Loading branches...
			</div>
		)
	}

	if (role !== 'owner') {
		return (
			<div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
				<PiWarningCircleDuotone size={24} style={{ marginBottom: 10 }} />
				<p style={{ margin: 0 }}>Only the store owner can manage branches.</p>
			</div>
		)
	}

	return (
		<div>
			{/* ── Header ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
				<div>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Branches</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>{branches.length} location{branches.length === 1 ? '' : 's'} — switch between them from the header</p>
				</div>
			</div>

			{/* ── Add branch ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Add Branch</h3>
				<form onSubmit={onSubmit}>
					<div className="form-grid">
						<div>
							<label style={fieldLabelStyle}><PiBuildingsDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Branch Name</label>
							<input placeholder="e.g., Downtown Branch" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
						</div>
						<div>
							<label style={fieldLabelStyle}><PiPhoneDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Phone</label>
							<input placeholder="Phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
						</div>
						<div style={{ gridColumn: '1 / -1' }}>
							<label style={fieldLabelStyle}><PiMapPinLineDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Address</label>
							<input placeholder="Address (optional) — prints on this branch's invoices" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
						</div>
					</div>
					{formError && (
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: 'var(--danger)', fontSize: 13 }}>
							<PiWarningCircleDuotone size={15} /> {formError}
						</div>
					)}
					<div className="form-actions" style={{ marginTop: 12 }}>
						<button type="submit" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.6 : 1 }}>
							<PiPlusDuotone size={15} /> {submitting ? 'Adding…' : 'Add Branch'}
						</button>
					</div>
				</form>
			</div>

			{/* ── Branch list ── */}
			<div className="card">
				<div style={{ overflowX: 'auto' }}>
					<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
						<thead>
							<tr style={{ background: 'var(--bg-sunken)' }}>
								{['Name', 'Phone', 'Address', 'Status'].map(h => (
									<th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
								))}
								<th style={{ padding: '10px 12px', width: 90 }}></th>
							</tr>
						</thead>
						<tbody>
							{branches.length === 0 && (
								<tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No branches yet</td></tr>
							)}
							{branches.map(branch => (
								<tr key={branch.id} style={{ borderBottom: '1px solid var(--border)' }}
									onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
									onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
								>
									<td style={{ padding: '10px 12px', fontWeight: 500 }}>
										{editingId === branch.id
											? <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
											: (<span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{branch.name}{branch.id === mainBranchId && <span className="badge" style={{ fontSize: 11 }}>Main</span>}</span>)}
									</td>
									<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
										{editingId === branch.id
											? <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
											: (branch.phone || '—')}
									</td>
									<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
										{editingId === branch.id
											? <input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
											: (branch.address || '—')}
									</td>
									<td style={{ padding: '10px 12px' }}>
										<button
											onClick={() => toggleActive(branch)}
											title={branch.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
											style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: branch.isActive ? 'var(--success)' : 'var(--text-faint)', fontSize: 13, fontWeight: 600 }}
										>
											{branch.isActive ? <PiToggleRightDuotone size={20} /> : <PiToggleLeftDuotone size={20} />}
											{branch.isActive ? 'Active' : 'Inactive'}
										</button>
									</td>
									<td style={{ padding: '10px 12px' }}>
										<div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
											{editingId === branch.id ? (
												<>
													<button onClick={() => saveEdit(branch.id)} style={{ display: 'flex', padding: 6 }} title="Save"><PiCheckDuotone size={13} /></button>
													<button className="secondary" onClick={() => { setEditingId(null); setEditError('') }} style={{ display: 'flex', padding: 6 }} title="Cancel"><PiXDuotone size={13} /></button>
												</>
											) : (
												<>
													<button className="secondary" onClick={() => startEdit(branch)} style={{ display: 'flex', padding: 6 }} title="Edit"><PiPencilDuotone size={13} /></button>
													<button className="secondary" onClick={() => setDeleteTarget(branch)} style={{ display: 'flex', padding: 6, color: 'var(--danger)' }} title="Delete"><PiTrashDuotone size={13} /></button>
												</>
											)}
										</div>
									</td>
								</tr>
							))}
							{editError && editingId && (
								<tr><td colSpan={5} style={{ padding: '8px 12px', color: 'var(--danger)', fontSize: 12.5 }}>{editError}</td></tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* ── Delete confirmation ── */}
			{deleteTarget && (
				<div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
					onClick={() => !deleting && setDeleteTarget(null)}
				>
					<div className="card" style={{ maxWidth: 400, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
							<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', flexShrink: 0 }}>
								<PiWarningDuotone size={17} />
							</span>
							<h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Delete "{deleteTarget.name}"?</h3>
						</div>
						<p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
							This can't be undone. If any purchases, sales, expenses, assets, or staff are still assigned to this branch, deletion will be blocked — reassign or remove them first.
						</p>
						<div className="form-actions">
							<button className="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
							<button onClick={confirmDelete} disabled={deleting} style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiTrashDuotone size={15} /> {deleting ? 'Deleting…' : 'Delete Branch'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
