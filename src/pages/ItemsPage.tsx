import { FormEvent, useMemo, useState, useEffect } from 'react'
import { db, Item } from '../storage'
import { supabase } from '../supabase'
import { auth } from '../firebase'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import { useItems, usePurchases } from '../hooks/useDataQueries'
import { usePagination } from '../hooks/usePagination'
import { loadCurrency, formatCurrency } from '../utils/currency'
import { exportItemsToShopifyCSV } from '../utils/exportCSV'
import { StatCard } from '../ui/StatCard'
import {
	PiCubeDuotone, PiTagDuotone, PiChartLineUpDuotone, PiWarningCircleDuotone,
	PiStorefrontDuotone, PiBarcodeDuotone, PiPlusDuotone, PiPencilDuotone, PiTrashDuotone,
	PiDotsThreeVerticalDuotone, PiMagnifyingGlassDuotone, PiCheckDuotone, PiXDuotone,
	PiCaretDoubleLeftDuotone, PiCaretLeftDuotone, PiCaretRightDuotone, PiCaretDoubleRightDuotone,
	PiWarningDuotone,
} from 'react-icons/pi'

const fieldLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 } as const

export default function ItemsPage() {
	const [searchTerm, setSearchTerm] = useState('')
	const [form, setForm] = useState({ sku: '', name: '', price: '', costPrice: '' })
	const [formError, setFormError] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState<{ sku: string, name: string, price: string, costPrice: string }>({ sku: '', name: '', price: '', costPrice: '' })
	const [editError, setEditError] = useState('')
	const [scannerEnabled, setScannerEnabled] = useState(false)
	const [currency, setCurrency] = useState('PKR')
	const [itemsPerPage, setItemsPerPage] = useState(20)
	const [openRowMenu, setOpenRowMenu] = useState<string | null>(null)
	const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
	const [deleting, setDeleting] = useState(false)

	useEffect(() => {
		loadCurrency().then(curr => setCurrency(curr))
	}, [])

	const { data: items = [], isLoading: itemsLoading, refetch } = useItems()
	const { data: purchases = [] } = usePurchases()

	const { videoRef, isScanning, error: scanError } = useBarcodeScanner(
		(code) => setForm(prev => ({ ...prev, sku: code })),
		scannerEnabled
	)

	const enrichedItems = useMemo(() => {
		return items.map(item => {
			const itemPurchases = purchases.filter(p => p.itemId === item.id)
			const latestPurchase = itemPurchases.slice().sort((a, b) =>
				new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
			)[0]
			// Prefer the most recent purchase's cost (reflects what was actually
			// last paid); fall back to the item's own recorded cost price when
			// there's no purchase history yet, instead of silently showing 0.
			const costPrice = latestPurchase?.costPrice ?? item.costPrice ?? 0

			return { ...item, costPrice }
		})
	}, [items, purchases])

	const filtered = useMemo(() => enrichedItems.filter(i => (
		i.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
		i.name.toLowerCase().includes(searchTerm.toLowerCase())
	)), [enrichedItems, searchTerm])

	const pagination = usePagination({ data: filtered, itemsPerPage })
	useEffect(() => { pagination.goToPage(1) }, [searchTerm, itemsPerPage])

	const stats = useMemo(() => {
		const totalItems = enrichedItems.length
		const avgPrice = totalItems > 0 ? enrichedItems.reduce((s, i) => s + i.price, 0) / totalItems : 0
		const margins = enrichedItems.filter(i => i.price > 0).map(i => ((i.price - i.costPrice) / i.price) * 100)
		const avgMargin = margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : 0
		const missingCost = enrichedItems.filter(i => !i.costPrice).length
		return { totalItems, avgPrice, avgMargin, missingCost }
	}, [enrichedItems])

	function isDuplicateSku(sku: string, excludeId?: string) {
		const norm = sku.trim().toLowerCase()
		return enrichedItems.some(i => i.id !== excludeId && i.sku.trim().toLowerCase() === norm)
	}

	async function onSubmit(e: FormEvent) {
		e.preventDefault()
		setFormError('')
		const sku = form.sku.trim()
		const name = form.name.trim()
		if (!sku || !name) { setFormError('SKU and Name are required.'); return }
		if (isDuplicateSku(sku)) { setFormError(`An item with SKU "${sku}" already exists.`); return }
		try {
			const price = Number(form.price || '0')
			const costPrice = Number(form.costPrice || '0')
			await db.createItem({ sku, name, price, costPrice })
			refetch()
			setForm({ sku: '', name: '', price: '', costPrice: '' })
		} catch (error) {
			console.error('Error creating item:', error)
			setFormError('Could not save item. Please try again.')
		}
	}

	function startEdit(item: Item) {
		setEditingId(item.id)
		setEditError('')
		setEditForm({ sku: item.sku, name: item.name, price: String(item.price), costPrice: String(item.costPrice || 0) })
	}

	async function saveEdit(id: string) {
		const sku = editForm.sku.trim()
		const name = editForm.name.trim()
		if (!sku || !name) { setEditError('SKU and Name are required.'); return }
		if (isDuplicateSku(sku, id)) { setEditError(`An item with SKU "${sku}" already exists.`); return }
		try {
			const price = Number(editForm.price || '0')
			const costPrice = Number(editForm.costPrice || '0')
			await db.updateItem(id, { sku, name, price, costPrice })
			refetch()
			setEditingId(null)
			setEditError('')
		} catch (error) {
			console.error('Error updating item:', error)
			setEditError('Could not save changes. Please try again.')
		}
	}

	function cancelEdit() {
		setEditingId(null)
		setEditError('')
	}

	async function confirmDelete() {
		if (!deleteTarget) return
		setDeleting(true)
		try {
			const userId = auth.currentUser?.uid
			if (!userId) throw new Error('Not authenticated')

			// Nullify item_id on sales so history is preserved (requires FK to be ON DELETE SET NULL)
			await supabase.from('sales').update({ item_id: null }).eq('item_id', deleteTarget.id).eq('user_id', userId)
			await supabase.from('purchases').delete().eq('item_id', deleteTarget.id).eq('user_id', userId)
			await db.deleteItem(deleteTarget.id)
			refetch()
			setDeleteTarget(null)
		} catch (error: any) {
			console.error('Error deleting item:', error)
			alert('Cannot delete item: ' + (error?.message || 'Unknown error'))
		} finally {
			setDeleting(false)
		}
	}

	if (itemsLoading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--text)' }}>
				Loading items...
			</div>
		)
	}

	return (
		<div>
			{/* ── Header ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
				<div>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Items</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>{stats.totalItems} products in your catalog</p>
				</div>
				<button
					onClick={() => exportItemsToShopifyCSV(
						filtered.map(i => ({ sku: i.sku, name: i.name, price: i.price, costPrice: i.costPrice })),
						'items_shopify.csv'
					)}
					style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border-strong)' }}
				>
					<span style={{ display: 'flex', color: 'var(--success)' }}><PiStorefrontDuotone size={15} /></span> Shopify CSV
				</button>
			</div>

			{/* ── Summary cards ── */}
			<div className="dashboard-stats">
				<StatCard icon={<PiCubeDuotone />} tint="accent" label="Total items" value={stats.totalItems} caption="Products in catalog" />
				<StatCard icon={<PiTagDuotone />} tint="accent" iconStyle={{ background: 'color-mix(in srgb, #8b5cf6 16%, var(--bg-elevated))', color: '#8b5cf6' }} label="Avg. selling price" value={formatCurrency(stats.avgPrice, currency)} caption="Across all items" />
				<StatCard icon={<PiChartLineUpDuotone />} tint={stats.avgMargin >= 0 ? 'success' : 'danger'} label="Avg. margin" value={`${stats.avgMargin.toFixed(1)}%`} valueColor={stats.avgMargin >= 0 ? 'var(--success)' : 'var(--danger)'} caption="Selling vs. cost price" />
				<StatCard icon={<PiWarningCircleDuotone />} tint={stats.missingCost > 0 ? 'warning' : 'neutral'} label="Missing cost price" value={stats.missingCost} caption={stats.missingCost > 0 ? 'Add a cost to track margin' : 'All items have a cost'} captionColor={stats.missingCost > 0 ? 'var(--warning)' : undefined} />
			</div>

			{/* ── Add item ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Add Item</h3>
				<form onSubmit={onSubmit}>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
						<div>
							<label style={fieldLabelStyle}>SKU</label>
							<input placeholder="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
						</div>
						<div>
							<label style={fieldLabelStyle}>Name</label>
							<input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
						</div>
						<div>
							<label style={fieldLabelStyle}>Price</label>
							<input placeholder="Price" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
						</div>
						<div>
							<label style={fieldLabelStyle}>Cost Price</label>
							<input placeholder="Cost Price" type="number" step="0.01" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} />
						</div>
					</div>

					{formError && (
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: 'var(--danger)', fontSize: 13 }}>
							<PiWarningCircleDuotone size={15} /> {formError}
						</div>
					)}

					<div className="form-actions" style={{ marginTop: 12 }}>
						{/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
							<button type="button" className="secondary" onClick={() => setScannerEnabled(!scannerEnabled)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiBarcodeDuotone size={15} /> {scannerEnabled ? 'Hide Scanner' : 'Scan SKU'}
							</button>
						)}
						<button type="submit" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PiPlusDuotone size={15} /> Add Item</button>
					</div>

					{scannerEnabled && (
						<div style={{ marginTop: 8 }}>
							<video ref={videoRef} style={{ width: '100%', maxHeight: 220, background: '#111', borderRadius: 12 }} muted playsInline />
							{scanError && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: 'var(--danger)', fontSize: 13 }}><PiWarningCircleDuotone size={15} /> {scanError}</div>}
							{isScanning && <div className="badge" style={{ marginTop: 8 }}>Scanner active — point camera at barcode</div>}
						</div>
					)}
				</form>
			</div>

			{/* ── Catalog ── */}
			<div className="card">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
						<div style={{ position: 'relative' }}>
							<PiMagnifyingGlassDuotone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
							<input
								type="text"
								placeholder="Search by SKU or name…"
								value={searchTerm}
								onChange={e => setSearchTerm(e.target.value)}
								style={{ padding: '7px 10px 7px 32px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-sunken)', color: 'var(--text)', minWidth: 200, fontSize: 13 }}
							/>
						</div>
						<span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Showing {pagination.currentData.length} of {pagination.totalItems} items</span>
					</div>

					<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
						<label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
							Show
							<select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} style={{ width: 'auto', padding: '5px 8px', fontSize: 13, borderRadius: 7 }}>
								<option value={10}>10</option>
								<option value={20}>20</option>
								<option value={50}>50</option>
								<option value={100}>100</option>
							</select>
							per page
						</label>

						{pagination.totalPages > 1 && (
							<div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
								<button className="secondary" onClick={pagination.goToFirstPage} disabled={!pagination.hasPrevPage} style={{ display: 'flex', padding: 6 }}><PiCaretDoubleLeftDuotone size={13} /></button>
								<button className="secondary" onClick={pagination.prevPage}      disabled={!pagination.hasPrevPage} style={{ display: 'flex', padding: 6 }}><PiCaretLeftDuotone size={13} /></button>
								<span style={{ padding: '0 6px', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Page {pagination.currentPage} of {pagination.totalPages}</span>
								<button className="secondary" onClick={pagination.nextPage}      disabled={!pagination.hasNextPage} style={{ display: 'flex', padding: 6 }}><PiCaretRightDuotone size={13} /></button>
								<button className="secondary" onClick={pagination.goToLastPage}  disabled={!pagination.hasNextPage} style={{ display: 'flex', padding: 6 }}><PiCaretDoubleRightDuotone size={13} /></button>
							</div>
						)}
					</div>
				</div>

				<div style={{ overflowX: 'auto' }}>
					<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
						<thead>
							<tr style={{ background: 'var(--bg-sunken)' }}>
								{['SKU', 'Name', 'Price', 'Cost Price', 'Created'].map(h => (
									<th key={h} style={{ padding: '10px 12px', textAlign: h === 'SKU' || h === 'Name' ? 'left' : 'right', borderBottom: '2px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
								))}
								<th style={{ padding: '10px 12px', width: 40 }}></th>
							</tr>
						</thead>
						<tbody>
							{pagination.currentData.map(i => (
								<tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}
									onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
									onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
								>
									<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
										{editingId === i.id ? (
											<input value={editForm.sku} onChange={e => setEditForm({ ...editForm, sku: e.target.value })} style={{ width: 100 }} />
										) : i.sku}
									</td>
									<td style={{ padding: '10px 12px', fontWeight: 500 }}>
										{editingId === i.id ? (
											<input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
										) : i.name}
									</td>
									<td style={{ padding: '10px 12px', textAlign: 'right' }}>
										{editingId === i.id ? (
											<input type="number" step="0.01" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} style={{ width: 90, textAlign: 'right' }} />
										) : formatCurrency(i.price, currency)}
									</td>
									<td style={{ padding: '10px 12px', textAlign: 'right', color: !i.costPrice ? 'var(--warning)' : 'var(--text-muted)' }}>
										{editingId === i.id ? (
											<input type="number" step="0.01" value={editForm.costPrice} onChange={e => setEditForm({ ...editForm, costPrice: e.target.value })} style={{ width: 90, textAlign: 'right' }} />
										) : formatCurrency(i.costPrice || 0, currency)}
									</td>
									<td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{i.createdAt ? new Date(i.createdAt).toLocaleDateString() : 'N/A'}</td>
									<td style={{ padding: '10px 12px', textAlign: 'center', position: 'relative' }}>
										{editingId === i.id ? (
											<div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
												<button onClick={() => saveEdit(i.id)} style={{ display: 'flex', padding: 6 }} title="Save"><PiCheckDuotone size={13} /></button>
												<button className="secondary" onClick={cancelEdit} style={{ display: 'flex', padding: 6 }} title="Cancel"><PiXDuotone size={13} /></button>
											</div>
										) : (
											<div tabIndex={-1} onBlur={() => setTimeout(() => setOpenRowMenu(m => m === i.id ? null : m), 150)}>
												<button className="secondary" onClick={() => setOpenRowMenu(m => m === i.id ? null : i.id)} style={{ display: 'inline-flex', padding: 6, background: 'transparent', color: 'var(--text-muted)' }}>
													<PiDotsThreeVerticalDuotone size={16} />
												</button>
												{openRowMenu === i.id && (
													<div style={{ position: 'absolute', top: '100%', right: 8, marginTop: 2, minWidth: 140, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px var(--overlay)', zIndex: 100, overflow: 'hidden', textAlign: 'left' }}>
														<button
															onMouseDown={() => { startEdit(i); setOpenRowMenu(null) }}
															style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
															onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
															onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
														><PiPencilDuotone size={14} /> Edit</button>
														<button
															onMouseDown={() => { setDeleteTarget(i); setOpenRowMenu(null) }}
															style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: 13, cursor: 'pointer' }}
															onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
															onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
														><PiTrashDuotone size={14} /> Delete</button>
													</div>
												)}
											</div>
										)}
									</td>
								</tr>
							))}
							{editError && editingId && (
								<tr>
									<td colSpan={6} style={{ padding: '8px 12px', color: 'var(--danger)', fontSize: 12.5 }}>{editError}</td>
								</tr>
							)}
							{pagination.currentData.length === 0 && (
								<tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No items found</td></tr>
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
					<div className="card" style={{ maxWidth: 380, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
							<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', flexShrink: 0 }}>
								<PiWarningDuotone size={17} />
							</span>
							<h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Delete "{deleteTarget.name}"?</h3>
						</div>
						<p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
							Purchase records for this item will be removed. Sales history will be preserved but no longer linked to it. This can't be undone.
						</p>
						<div className="form-actions">
							<button className="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
							<button onClick={confirmDelete} disabled={deleting} style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiTrashDuotone size={15} /> {deleting ? 'Deleting…' : 'Delete Item'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
