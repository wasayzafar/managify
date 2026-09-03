import { useState, useEffect, useMemo } from 'react'
import { db, Asset } from '../storage'
import { loadCurrency, formatCurrency } from '../utils/currency'
import { exportAssetsToExcel } from '../utils/exportCSV'
import { usePagination } from '../hooks/usePagination'
import { StatCard } from '../ui/StatCard'
import jsPDF from 'jspdf'
import {
	PiBuildingsDuotone, PiHandCoinsDuotone, PiScalesDuotone, PiTrendDownDuotone,
	PiPlusDuotone, PiFileXlsDuotone, PiFilePdfDuotone, PiPencilDuotone, PiTrashDuotone,
	PiMagnifyingGlassDuotone, PiCalendarBlankDuotone, PiWarningCircleDuotone, PiWarningDuotone,
	PiCaretDoubleLeftDuotone, PiCaretLeftDuotone, PiCaretRightDuotone, PiCaretDoubleRightDuotone,
	PiCheckDuotone, PiXDuotone,
} from 'react-icons/pi'

const CATEGORIES = ['Equipment', 'Vehicle', 'Furniture', 'Electronics', 'Land', 'Building', 'Other']

// Straight-line depreciation useful-life defaults per category, in years.
// This app doesn't (yet) capture a per-asset useful life, so these are only
// used to ESTIMATE current book value client-side — good enough to stop
// showing every asset at its full original price forever, which was the
// real problem (a 5-year-old van isn't worth what it cost new). Land is
// deliberately excluded: under GAAP/IFRS land has an indefinite useful life
// and is never depreciated.
const USEFUL_LIFE_YEARS: Record<string, number | null> = {
	Equipment: 5,
	Vehicle: 5,
	Furniture: 7,
	Electronics: 3,
	Land: null,
	Building: 20,
	Other: 5,
}

const fieldLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 } as const

const emptyForm = { name: '', category: 'Equipment', purchaseDate: '', purchasePrice: '', description: '' }

function ageInYears(purchaseDate: string): number {
	const purchased = new Date(purchaseDate)
	if (isNaN(purchased.getTime())) return 0
	const now = new Date()
	return Math.max(0, (now.getTime() - purchased.getTime()) / (365.25 * 24 * 3600 * 1000))
}

function depreciationOf(asset: Asset) {
	// `??` would treat Land's intentional `null` (never depreciates) the same
	// as a missing/unknown category and silently fall back to 5 years — so
	// look the category up explicitly instead of coalescing.
	const life = asset.category in USEFUL_LIFE_YEARS ? USEFUL_LIFE_YEARS[asset.category] : 5
	if (life === null || life === undefined || life <= 0) {
		return { accumulatedDepreciation: 0, bookValue: asset.purchasePrice, fullyDepreciated: false }
	}
	const age = ageInYears(asset.purchaseDate)
	const annual = asset.purchasePrice / life
	const accumulatedDepreciation = Math.min(asset.purchasePrice, annual * age)
	return {
		accumulatedDepreciation,
		bookValue: Math.max(0, asset.purchasePrice - accumulatedDepreciation),
		fullyDepreciated: age >= life,
	}
}

export default function AssetsPage() {
	const [assets, setAssets] = useState<Asset[]>([])
	const [form, setForm] = useState(emptyForm)
	const [formError, setFormError] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState(emptyForm)
	const [editError, setEditError] = useState('')
	const [loading, setLoading] = useState(true)
	const [currency, setCurrency] = useState('PKR')
	const [searchTerm, setSearchTerm] = useState('')
	const [categoryFilter, setCategoryFilter] = useState('all')
	const [itemsPerPage, setItemsPerPage] = useState(10)
	const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)
	const [deleting, setDeleting] = useState(false)

	useEffect(() => {
		const load = async () => {
			try {
				const [data, curr] = await Promise.all([db.listAssets(), loadCurrency()])
				setAssets(data)
				setCurrency(curr)
			} catch (error) {
				console.error('Error loading assets:', error)
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [])

	function parsePrice(raw: string): number | null {
		const n = Number(raw)
		if (!raw.trim() || !Number.isFinite(n) || n <= 0) return null
		return n
	}

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setFormError('')
		const name = form.name.trim()
		const price = parsePrice(form.purchasePrice)
		if (!name) { setFormError('Enter an asset name.'); return }
		if (!form.purchaseDate) { setFormError('Select a purchase date.'); return }
		if (price == null) { setFormError('Enter a purchase price greater than zero.'); return }
		try {
			await db.createAsset({
				name,
				category: form.category,
				purchaseDate: form.purchaseDate,
				purchasePrice: price,
				description: form.description,
			})
			setAssets(await db.listAssets())
			setForm(emptyForm)
		} catch (error: any) {
			console.error('Error adding asset:', error)
			setFormError('Could not save asset. Please try again.')
		}
	}

	const startEdit = (asset: Asset) => {
		setEditingId(asset.id)
		setEditError('')
		setEditForm({
			name: asset.name,
			category: asset.category,
			purchaseDate: asset.purchaseDate,
			purchasePrice: String(asset.purchasePrice),
			description: asset.description || '',
		})
	}

	const saveEdit = async (id: string) => {
		setEditError('')
		const name = editForm.name.trim()
		const price = parsePrice(editForm.purchasePrice)
		if (!name) { setEditError('Enter an asset name.'); return }
		if (!editForm.purchaseDate) { setEditError('Select a purchase date.'); return }
		if (price == null) { setEditError('Enter a purchase price greater than zero.'); return }
		try {
			await db.updateAsset(id, {
				name,
				category: editForm.category,
				purchaseDate: editForm.purchaseDate,
				purchasePrice: price,
				description: editForm.description,
			})
			setAssets(await db.listAssets())
			setEditingId(null)
		} catch (error: any) {
			console.error('Error updating asset:', error)
			setEditError('Could not save changes. Please try again.')
		}
	}

	async function confirmDeleteAsset() {
		if (!deleteTarget) return
		setDeleting(true)
		try {
			await db.deleteAsset(deleteTarget.id)
			setAssets(await db.listAssets())
			setDeleteTarget(null)
		} catch (error) {
			console.error('Error deleting asset:', error)
			alert('Error deleting asset')
		} finally {
			setDeleting(false)
		}
	}

	const enrichedAssets = useMemo(() => assets.map(a => ({ ...a, ...depreciationOf(a) })), [assets])

	const filteredAssets = useMemo(() => {
		const term = searchTerm.trim().toLowerCase()
		return enrichedAssets.filter(a => {
			if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
			if (!term) return true
			return a.name.toLowerCase().includes(term) || (a.description || '').toLowerCase().includes(term)
		})
	}, [enrichedAssets, searchTerm, categoryFilter])

	const pagination = usePagination({ data: filteredAssets, itemsPerPage })
	useEffect(() => { pagination.goToPage(1) }, [searchTerm, categoryFilter, itemsPerPage])

	const stats = useMemo(() => {
		const totalInvested = assets.reduce((s, a) => s + a.purchasePrice, 0)
		const totalBookValue = enrichedAssets.reduce((s, a) => s + a.bookValue, 0)
		const totalDepreciation = enrichedAssets.reduce((s, a) => s + a.accumulatedDepreciation, 0)
		return { count: assets.length, totalInvested, totalBookValue, totalDepreciation }
	}, [assets, enrichedAssets])

	function handleExcelExport() {
		exportAssetsToExcel(filteredAssets.map(a => ({
			name: a.name,
			category: a.category,
			purchaseDate: a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : '',
			purchasePrice: a.purchasePrice,
			bookValue: a.bookValue,
			accumulatedDepreciation: a.accumulatedDepreciation,
			description: a.description || '',
		})), 'assets.xls')
	}

	function handlePdfExport() {
		// jsPDF's built-in font can't render non-ASCII currency glyphs (₹, etc.)
		// — fall back to the plain ISO code for anything but the safe $ symbol
		// so the report never silently drops the currency on every amount.
		const pdfSafeSymbol: Record<string, string> = { USD: '$', PKR: 'PKR', AED: 'AED', SAR: 'SAR' }
		const pdfCurrency = (amount: number) => {
			const symbol = pdfSafeSymbol[currency] ?? currency
			return symbol === '$' ? `$${amount.toFixed(2)}` : `${symbol} ${amount.toFixed(2)}`
		}

		const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' })
		const pageW = pdf.internal.pageSize.getWidth()
		const pageH = pdf.internal.pageSize.getHeight()
		const margin = 14; let y = margin

		pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
		pdf.text('ASSET REGISTER', pageW / 2, y, { align: 'center' }); y += 7
		pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
		pdf.text('Generated: ' + new Date().toLocaleString(), pageW / 2, y, { align: 'center' }); y += 6
		pdf.line(margin, y, pageW - margin, y); y += 5

		const cols = [
			{ label: 'Name', w: 46 }, { label: 'Category', w: 28 }, { label: 'Purchase Date', w: 26 },
			{ label: 'Purchase Price', w: 28 }, { label: 'Book Value', w: 28 }, { label: 'Depreciation', w: 28 }, { label: 'Description', w: 58 },
		]
		const tableW = cols.reduce((s, c) => s + c.w, 0)
		const startX = (pageW - tableW) / 2

		const drawHeader = () => {
			pdf.setFillColor(240, 240, 240); pdf.rect(startX, y, tableW, 7, 'F')
			pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
			let x = startX; cols.forEach(c => { pdf.text(c.label, x + 1, y + 5); x += c.w }); y += 7
		}
		drawHeader()

		let totalInvested = 0, totalBook = 0
		pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
		filteredAssets.forEach((a, idx) => {
			if (y > pageH - 20) { pdf.addPage(); y = margin; drawHeader(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5) }
			totalInvested += a.purchasePrice; totalBook += a.bookValue
			if (idx % 2 === 0) { pdf.setFillColor(252, 252, 252); pdf.rect(startX, y, tableW, 6, 'F') }
			const cells = [a.name, a.category, a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : '—', pdfCurrency(a.purchasePrice), pdfCurrency(a.bookValue), pdfCurrency(a.accumulatedDepreciation), a.description || '—']
			let x = startX
			cols.forEach((col, ci) => { const text = pdf.splitTextToSize(cells[ci], col.w - 2)[0] || ''; pdf.text(text, x + 1, y + 4); x += col.w })
			y += 6
		})

		y += 3; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
		pdf.text(`Total: ${filteredAssets.length} assets`, margin, y)
		pdf.text(`Invested: ${pdfCurrency(totalInvested)}   Book Value: ${pdfCurrency(totalBook)}`, pageW - margin, y, { align: 'right' })
		const totalPages = (pdf as any).internal.getNumberOfPages()
		for (let i = 1; i <= totalPages; i++) {
			pdf.setPage(i); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(150)
			pdf.text('Report generated by managify.online', pageW / 2, pageH - 6, { align: 'center' })
			pdf.setTextColor(0)
		}
		pdf.save('asset_register.pdf')
	}

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--text)' }}>
				Loading assets...
			</div>
		)
	}

	return (
		<div>
			{/* ── Header ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
				<div>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Assets</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>{stats.count} fixed asset{stats.count === 1 ? '' : 's'} on record</p>
				</div>
				<div style={{ display: 'flex', gap: 8 }}>
					<button className="secondary" onClick={handleExcelExport} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
						<span style={{ display: 'flex', color: 'var(--success)' }}><PiFileXlsDuotone size={15} /></span> Excel
					</button>
					<button className="secondary" onClick={handlePdfExport} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
						<span style={{ display: 'flex', color: 'var(--danger)' }}><PiFilePdfDuotone size={15} /></span> PDF
					</button>
				</div>
			</div>

			{/* ── Summary cards ── */}
			<div className="dashboard-stats">
				<StatCard icon={<PiBuildingsDuotone />} tint="accent" label="Total assets" value={stats.count} caption="Fixed assets on record" />
				<StatCard icon={<PiHandCoinsDuotone />} tint="accent" iconStyle={{ background: 'color-mix(in srgb, #8b5cf6 16%, var(--bg-elevated))', color: '#8b5cf6' }} label="Capital invested" value={formatCurrency(stats.totalInvested, currency)} caption="Total purchase price, all-time" />
				<StatCard icon={<PiScalesDuotone />} tint="success" label="Current book value" value={formatCurrency(stats.totalBookValue, currency)} caption="Est. after depreciation" />
				<StatCard icon={<PiTrendDownDuotone />} tint="warning" label="Accumulated depreciation" value={formatCurrency(stats.totalDepreciation, currency)} caption="Est. by category useful life" />
			</div>

			{/* ── Add asset ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Add Asset</h3>
				<form onSubmit={onSubmit}>
					<div className="form-grid">
						<div>
							<label style={fieldLabelStyle}>Asset Name</label>
							<input placeholder="e.g., Delivery Van, Laptop" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
						</div>
						<div>
							<label style={fieldLabelStyle}>Category</label>
							<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
								{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
							</select>
						</div>
						<div>
							<label style={fieldLabelStyle}>Purchase Date</label>
							<div style={{ position: 'relative' }}>
								<PiCalendarBlankDuotone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
								<input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} style={{ paddingLeft: 32 }} />
							</div>
						</div>
						<div>
							<label style={fieldLabelStyle}>Purchase Price</label>
							<input type="number" step="0.01" min="0.01" placeholder="Purchase Price" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} />
						</div>
						<div style={{ gridColumn: '1 / -1' }}>
							<label style={fieldLabelStyle}>Description</label>
							<input placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
						</div>
					</div>
					{formError && (
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: 'var(--danger)', fontSize: 13 }}>
							<PiWarningCircleDuotone size={15} /> {formError}
						</div>
					)}
					<div className="form-actions" style={{ marginTop: 12 }}>
						<button type="submit" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PiPlusDuotone size={15} /> Add Asset</button>
					</div>
				</form>
			</div>

			{/* ── Asset register ── */}
			<div className="card">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
						<div style={{ position: 'relative' }}>
							<PiMagnifyingGlassDuotone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
							<input
								type="text"
								placeholder="Search by name or description…"
								value={searchTerm}
								onChange={e => setSearchTerm(e.target.value)}
								style={{ padding: '7px 10px 7px 32px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-sunken)', color: 'var(--text)', minWidth: 220, fontSize: 13 }}
							/>
						</div>
						<select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: 'auto', fontSize: 13, padding: '6px 8px', borderRadius: 7 }}>
							<option value="all">All categories</option>
							{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
						</select>
						<span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Showing {pagination.currentData.length} of {pagination.totalItems} assets</span>
					</div>

					<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
						<label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
							Show
							<select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} style={{ width: 'auto', padding: '5px 8px', fontSize: 13, borderRadius: 7 }}>
								<option value={10}>10</option>
								<option value={20}>20</option>
								<option value={50}>50</option>
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
								{['Name', 'Category', 'Purchase Date', 'Purchase Price', 'Book Value', 'Description'].map(h => (
									<th key={h} style={{ padding: '10px 12px', textAlign: h === 'Purchase Price' || h === 'Book Value' ? 'right' : 'left', borderBottom: '2px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
								))}
								<th style={{ padding: '10px 12px', width: 90 }}></th>
							</tr>
						</thead>
						<tbody>
							{pagination.currentData.length === 0 && (
								<tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No assets found</td></tr>
							)}
							{pagination.currentData.map(asset => (
								<tr key={asset.id} style={{ borderBottom: '1px solid var(--border)' }}
									onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
									onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
								>
									<td style={{ padding: '10px 12px', fontWeight: 500 }}>
										{editingId === asset.id
											? <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
											: asset.name}
									</td>
									<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
										{editingId === asset.id
											? <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
													{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
												</select>
											: asset.category}
									</td>
									<td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
										{editingId === asset.id
											? <input type="date" value={editForm.purchaseDate} onChange={e => setEditForm({ ...editForm, purchaseDate: e.target.value })} />
											: (asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : 'N/A')}
									</td>
									<td style={{ padding: '10px 12px', textAlign: 'right' }}>
										{editingId === asset.id
											? <input type="number" step="0.01" min="0.01" value={editForm.purchasePrice} onChange={e => setEditForm({ ...editForm, purchasePrice: e.target.value })} style={{ textAlign: 'right', width: 110 }} />
											: formatCurrency(asset.purchasePrice, currency)}
									</td>
									<td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
										{formatCurrency(asset.bookValue, currency)}
										{asset.fullyDepreciated && <div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 400 }}>Fully depreciated</div>}
									</td>
									<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
										{editingId === asset.id
											? <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
											: (asset.description || '—')}
									</td>
									<td style={{ padding: '10px 12px' }}>
										<div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
											{editingId === asset.id ? (
												<>
													<button onClick={() => saveEdit(asset.id)} style={{ display: 'flex', padding: 6 }} title="Save"><PiCheckDuotone size={13} /></button>
													<button className="secondary" onClick={() => { setEditingId(null); setEditError('') }} style={{ display: 'flex', padding: 6 }} title="Cancel"><PiXDuotone size={13} /></button>
												</>
											) : (
												<>
													<button className="secondary" onClick={() => startEdit(asset)} style={{ display: 'flex', padding: 6 }} title="Edit"><PiPencilDuotone size={13} /></button>
													<button className="secondary" onClick={() => setDeleteTarget(asset)} style={{ display: 'flex', padding: 6, color: 'var(--danger)' }} title="Delete"><PiTrashDuotone size={13} /></button>
												</>
											)}
										</div>
									</td>
								</tr>
							))}
							{editError && editingId && (
								<tr><td colSpan={7} style={{ padding: '8px 12px', color: 'var(--danger)', fontSize: 12.5 }}>{editError}</td></tr>
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
							This removes it from your asset register. This can't be undone.
						</p>
						<div className="form-actions">
							<button className="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
							<button onClick={confirmDeleteAsset} disabled={deleting} style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiTrashDuotone size={15} /> {deleting ? 'Deleting…' : 'Delete Asset'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
