import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { db, TaxRate, TaxAppliesTo } from '../storage'
import { useTaxRates, queryKeys } from '../hooks/useDataQueries'
import { useBranch } from '../auth/BranchContext'
import {
	PiPercentDuotone, PiPlusDuotone, PiPencilDuotone, PiTrashDuotone,
	PiWarningCircleDuotone, PiWarningDuotone, PiToggleLeftDuotone, PiToggleRightDuotone,
	PiCheckDuotone, PiXDuotone,
} from 'react-icons/pi'

const fieldLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 } as const

const APPLIES_TO_LABEL: Record<TaxAppliesTo, string> = { purchase: 'Purchases only', sales: 'Sales only', both: 'Purchases & Sales' }

const emptyForm = { name: '', rate: '', appliesTo: 'both' as TaxAppliesTo }

export default function TaxesPage() {
	const { role, loading: branchLoading } = useBranch()
	const { data: taxRates = [], isLoading } = useTaxRates()
	const queryClient = useQueryClient()
	const [form, setForm] = useState(emptyForm)
	const [formError, setFormError] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState(emptyForm)
	const [editError, setEditError] = useState('')
	const [deleteTarget, setDeleteTarget] = useState<TaxRate | null>(null)
	const [deleting, setDeleting] = useState(false)
	const [busyId, setBusyId] = useState<string | null>(null)

	async function refresh() {
		await queryClient.invalidateQueries({ queryKey: queryKeys.taxRates })
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault()
		setFormError('')
		const name = form.name.trim()
		const rate = Number(form.rate)
		if (!name) { setFormError('Enter a tax name.'); return }
		if (!form.rate || isNaN(rate) || rate < 0 || rate > 100) { setFormError('Enter a rate between 0 and 100.'); return }
		setSubmitting(true)
		try {
			await db.createTaxRate({ name, rate, appliesTo: form.appliesTo })
			await refresh()
			setForm(emptyForm)
		} catch (error) {
			console.error('Error creating tax rate:', error)
			setFormError('Could not save tax. Please try again.')
		} finally {
			setSubmitting(false)
		}
	}

	function startEdit(tax: TaxRate) {
		setEditingId(tax.id)
		setEditError('')
		setEditForm({ name: tax.name, rate: String(tax.rate), appliesTo: tax.appliesTo })
	}

	async function saveEdit(id: string) {
		setEditError('')
		const name = editForm.name.trim()
		const rate = Number(editForm.rate)
		if (!name) { setEditError('Enter a tax name.'); return }
		if (!editForm.rate || isNaN(rate) || rate < 0 || rate > 100) { setEditError('Enter a rate between 0 and 100.'); return }
		try {
			await db.updateTaxRate(id, { name, rate, appliesTo: editForm.appliesTo })
			await refresh()
			setEditingId(null)
		} catch (error) {
			console.error('Error updating tax rate:', error)
			setEditError('Could not save changes. Please try again.')
		}
	}

	async function toggleActive(tax: TaxRate) {
		setBusyId(tax.id)
		try {
			await db.updateTaxRate(tax.id, { isActive: !tax.isActive })
			await refresh()
		} catch (error) {
			console.error('Error updating tax rate:', error)
		} finally {
			setBusyId(null)
		}
	}

	async function confirmDelete() {
		if (!deleteTarget) return
		setDeleting(true)
		try {
			await db.deleteTaxRate(deleteTarget.id)
			await refresh()
			setDeleteTarget(null)
		} catch (error: any) {
			console.error('Error deleting tax rate:', error)
			alert('Cannot delete this tax: ' + (error?.message || 'it may already be used on past purchases or invoices.'))
		} finally {
			setDeleting(false)
		}
	}

	if (branchLoading) {
		return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--text)' }}>Loading…</div>
	}

	if (role !== 'owner') {
		return (
			<div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
				<PiWarningCircleDuotone size={24} style={{ marginBottom: 10 }} />
				<p style={{ margin: 0 }}>Only the store owner can manage taxes.</p>
			</div>
		)
	}

	return (
		<div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
				<div>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Taxes</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>Define tax rates once, then apply them when recording a purchase or a bill.</p>
				</div>
			</div>

			{/* ── Add tax ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Add Tax</h3>
				<form onSubmit={onSubmit}>
					<div className="form-grid">
						<div>
							<label style={fieldLabelStyle}><PiPercentDuotone size={15} style={{ color: 'var(--text-muted)' }} /> Tax Name</label>
							<input placeholder="e.g., GST, Sales Tax" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
						</div>
						<div>
							<label style={fieldLabelStyle}>Rate (%)</label>
							<input type="number" min="0" max="100" step="0.01" placeholder="e.g., 17" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
						</div>
						<div>
							<label style={fieldLabelStyle}>Applies To</label>
							<select value={form.appliesTo} onChange={e => setForm({ ...form, appliesTo: e.target.value as TaxAppliesTo })}>
								<option value="both">Purchases & Sales</option>
								<option value="purchase">Purchases only</option>
								<option value="sales">Sales only</option>
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
							<PiPlusDuotone size={15} /> {submitting ? 'Adding…' : 'Add Tax'}
						</button>
					</div>
				</form>
			</div>

			{/* ── Tax list ── */}
			<div className="card">
				<div style={{ overflowX: 'auto' }}>
					<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
						<thead>
							<tr style={{ background: 'var(--bg-sunken)' }}>
								{['Name', 'Rate', 'Applies To', 'Status'].map(h => (
									<th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
								))}
								<th style={{ padding: '10px 12px', width: 90 }}></th>
							</tr>
						</thead>
						<tbody>
							{!isLoading && taxRates.length === 0 && (
								<tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No taxes yet</td></tr>
							)}
							{isLoading && (
								<tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
							)}
							{taxRates.map(tax => (
								<tr key={tax.id} style={{ borderBottom: '1px solid var(--border)' }}
									onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
									onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
								>
									<td style={{ padding: '10px 12px', fontWeight: 500 }}>
										{editingId === tax.id
											? <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
											: tax.name}
									</td>
									<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
										{editingId === tax.id
											? <input type="number" min="0" max="100" step="0.01" value={editForm.rate} onChange={e => setEditForm({ ...editForm, rate: e.target.value })} style={{ width: 90 }} />
											: `${tax.rate}%`}
									</td>
									<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
										{editingId === tax.id
											? <select value={editForm.appliesTo} onChange={e => setEditForm({ ...editForm, appliesTo: e.target.value as TaxAppliesTo })}>
													<option value="both">Purchases & Sales</option>
													<option value="purchase">Purchases only</option>
													<option value="sales">Sales only</option>
												</select>
											: APPLIES_TO_LABEL[tax.appliesTo]}
									</td>
									<td style={{ padding: '10px 12px' }}>
										<button
											onClick={() => toggleActive(tax)}
											disabled={busyId === tax.id}
											title={tax.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
											style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, cursor: busyId === tax.id ? 'wait' : 'pointer', color: tax.isActive ? 'var(--success)' : 'var(--text-faint)', fontSize: 13, fontWeight: 600 }}
										>
											{tax.isActive ? <PiToggleRightDuotone size={20} /> : <PiToggleLeftDuotone size={20} />}
											{tax.isActive ? 'Active' : 'Inactive'}
										</button>
									</td>
									<td style={{ padding: '10px 12px' }}>
										<div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
											{editingId === tax.id ? (
												<>
													<button onClick={() => saveEdit(tax.id)} style={{ display: 'flex', padding: 6 }} title="Save"><PiCheckDuotone size={13} /></button>
													<button className="secondary" onClick={() => { setEditingId(null); setEditError('') }} style={{ display: 'flex', padding: 6 }} title="Cancel"><PiXDuotone size={13} /></button>
												</>
											) : (
												<>
													<button className="secondary" onClick={() => startEdit(tax)} style={{ display: 'flex', padding: 6 }} title="Edit"><PiPencilDuotone size={13} /></button>
													<button className="secondary" onClick={() => setDeleteTarget(tax)} style={{ display: 'flex', padding: 6, color: 'var(--danger)' }} title="Delete"><PiTrashDuotone size={13} /></button>
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
							Past purchases and invoices that used this tax keep their recorded amount — this only removes it from the picker going forward.
						</p>
						<div className="form-actions">
							<button className="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
							<button onClick={confirmDelete} disabled={deleting} style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiTrashDuotone size={15} /> {deleting ? 'Deleting…' : 'Delete Tax'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
