import { useEffect, useRef, useState } from 'react'
import { db, Item, Purchase, StoreInfo } from '../storage'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { auth } from '../firebase'
import { loadCurrency, formatCurrency } from '../utils/currency'
import { getThermalPrintStyles, getPrintWindowSize, getPrintPageCSS, getPrintOrientation, getPrintSize } from '../utils/thermalPrintStyles'

export default function PurchasesPage() {
	const [rows, setRows] = useState<Purchase[]>([])
	const [items, setItems] = useState<Item[]>([])
	const [suppliers, setSuppliers] = useState<any[]>([])
	const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
	const [sku, setSku] = useState('')
	const [qty, setQty] = useState('1')
	const [costPrice, setCostPrice] = useState('')
	const [newPrice, setNewPrice] = useState('')
	const [newName, setNewName] = useState('')
	const [supplier, setSupplier] = useState('')
	const [supplierPhone, setSupplierPhone] = useState('')
	const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 16))
	const [note, setNote] = useState('')
	const [paymentType, setPaymentType] = useState<'debit' | 'credit'>('debit')
	const [creditDeadline, setCreditDeadline] = useState('')
	const [showAllPurchases, setShowAllPurchases] = useState(false)
	const [paymentFilter, setPaymentFilter] = useState<'all' | 'debit' | 'credit'>('all')
	const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7))
	const [reportStart, setReportStart] = useState(() => new Date().toISOString().slice(0, 10))
	const [reportEnd, setReportEnd] = useState(() => new Date().toISOString().slice(0, 10))
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: 'Managify', phone: '', address: '', email: '', website: '', taxNumber: '', logo: '', currency: 'PKR' })
	const [loading, setLoading] = useState(true)
	const [submitting, setSubmitting] = useState(false)

	const existing = items.find(i => i.sku === sku)

	// Close supplier dropdown on outside click
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (showSupplierDropdown && !(e.target as HTMLElement).closest('[data-supplier-dropdown]'))
				setShowSupplierDropdown(false)
		}
		document.addEventListener('click', handler)
		return () => document.removeEventListener('click', handler)
	}, [showSupplierDropdown])

	useEffect(() => {
		const loadData = async () => {
			try {
				const [purchasesData, itemsData, storeData, suppliersData] = await Promise.all([
					db.listPurchases(), db.listItems(), db.getStoreInfo(), db.listSuppliers()
				])
				setRows(purchasesData); setItems(itemsData); setStoreInfo(storeData); setSuppliers(suppliersData)
				await loadCurrency()
			} catch (err) {
				console.error('Error loading data:', err)
			} finally {
				setLoading(false)
			}
		}
		loadData()
	}, [])

	// Ctrl+M shortcut
	useEffect(() => {
		const handler = (e: KeyboardEvent) => { if (e.ctrlKey && e.key === 'm') { e.preventDefault(); onSubmit() } }
		document.addEventListener('keydown', handler)
		return () => document.removeEventListener('keydown', handler)
	}, [sku, qty, costPrice, supplier, supplierPhone, purchasedAt, note, paymentType, creditDeadline, newName, newPrice])

	const [scanEnabled, setScanEnabled] = useState(false)
	const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
	const { videoRef, isScanning, error: scanError } = useBarcodeScanner(code => setSku(code), scanEnabled && isMobile)

	const onSubmit = async () => {
		if (submitting) return
		const qtyNum = Number(qty || '0')
		if (!qtyNum) { alert('Please enter a quantity'); return }
		if (!sku)    { alert('Please enter a SKU'); return }
		setSubmitting(true)
		try {
			let found = existing
			if (!found) {
				found = await db.createItem({ sku, name: newName || sku, price: newPrice ? Number(newPrice) : 0 })
				setItems(await db.listItems())
			} else if (newPrice && Number(newPrice) !== found.price) {
				await db.updateItem(found.id, { price: Number(newPrice) })
				setItems(await db.listItems())
			}
			if (supplier && !suppliers.find(s => s.name === supplier)) {
				await db.createSupplier({ name: supplier, phone: supplierPhone || '', address: '' })
				setSuppliers(await db.listSuppliers())
			}
			await db.createPurchase({
				itemId: found.id, qty: qtyNum,
				costPrice: Number(costPrice || '0'),
				supplier: supplier || 'Unknown',
				supplierPhone: supplierPhone || '',
				note: note || '',
				purchasedAt,
				paymentType,
				creditDeadline: paymentType === 'credit' ? creditDeadline : ''
			})
			await new Promise(r => setTimeout(r, 400))
			const [updatedPurchases, updatedItems] = await Promise.all([db.listPurchases(), db.listItems()])
			setRows(updatedPurchases); setItems(updatedItems)
			setSku(''); setQty('1'); setCostPrice(''); setSupplier(''); setSupplierPhone('')
			setNote(''); setNewName(''); setNewPrice(''); setShowSupplierDropdown(false)
			setPurchasedAt(new Date().toISOString().slice(0, 16))
			alert('Purchase added successfully!')
		} catch (err: any) {
			console.error('Error creating purchase:', err)
			alert('Error creating purchase: ' + (err?.message || err))
		} finally {
			setSubmitting(false)
		}
	}

	function printInvoice(row: Purchase) {
		const el = document.getElementById(`purch-invoice-${row.id}`)
		if (!el) return
		const { width, height } = getPrintWindowSize()
		const w = window.open('', 'PRINT', `height=${height},width=${width},top=100,left=150`)
		if (!w) return
		w.document.write(`<html><head><title>Purchase Invoice</title><style>${getPrintPageCSS()} body{margin:0;padding:0;font-family:Arial,sans-serif;} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px;text-align:left}</style></head><body>`)
		w.document.write(el.innerHTML)
		w.document.write('</body></html>')
		w.document.close(); w.focus(); w.print(); w.close()
	}

	async function downloadInvoicePdf(row: Purchase) {
		const el = document.getElementById(`purch-invoice-${row.id}`)
		if (!el) return
		const canvas = await html2canvas(el)
		const imgData = canvas.toDataURL('image/png')
		const size = getPrintSize()
		const orientation = (size === 'A4' || size === 'A5') && getPrintOrientation() === 'landscape' ? 'l' : 'p'
		const pdf = new jsPDF({ orientation, unit: 'mm', format: size === 'A5' ? 'a5' : 'a4' })
		const pw = pdf.internal.pageSize.getWidth()
		pdf.addImage(imgData, 'PNG', 0, 0, pw, canvas.height * pw / canvas.width)
		pdf.save(`purchase_${row.id.slice(-6)}.pdf`)
	}

	function downloadBulkPdf(filtered: Purchase[], title: string, subtitle: string) {
		const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
		const pageW = pdf.internal.pageSize.getWidth()
		const pageH = pdf.internal.pageSize.getHeight()
		const margin = 14; let y = margin

		pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
		pdf.text(storeInfo.storeName.toUpperCase(), pageW / 2, y, { align: 'center' }); y += 7
		if (storeInfo.address) { pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.text(storeInfo.address, pageW / 2, y, { align: 'center' }); y += 5 }
		if (storeInfo.phone)   { pdf.setFontSize(9); pdf.text('Phone: ' + storeInfo.phone, pageW / 2, y, { align: 'center' }); y += 5 }
		pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
		pdf.text(title, pageW / 2, y + 2, { align: 'center' }); y += 7
		pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
		pdf.text(subtitle, pageW / 2, y, { align: 'center' }); y += 4
		pdf.text('Generated: ' + new Date().toLocaleString(), pageW / 2, y, { align: 'center' }); y += 6
		pdf.line(margin, y, pageW - margin, y); y += 5

		const cols = [
			{ label: 'Date', w: 22 }, { label: 'SKU', w: 22 }, { label: 'Item', w: 44 },
			{ label: 'Qty', w: 12 }, { label: 'Cost/Unit', w: 24 }, { label: 'Total', w: 24 },
			{ label: 'Supplier', w: 30 }, { label: 'Payment', w: 22 },
		]
		const tableW = cols.reduce((s, c) => s + c.w, 0)
		const startX = (pageW - tableW) / 2

		const drawHeader = () => {
			pdf.setFillColor(240, 240, 240); pdf.rect(startX, y, tableW, 7, 'F')
			pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
			let x = startX; cols.forEach(c => { pdf.text(c.label, x + 1, y + 5); x += c.w }); y += 7
		}
		drawHeader()

		let totalCost = 0
		pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
		filtered.forEach((r, idx) => {
			if (y > pageH - 20) { pdf.addPage(); y = margin; drawHeader(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5) }
			const item = items.find(i => i.id === r.itemId)
			const q = r.quantity || r.qty || 0; const c = r.costPrice || 0; const t = q * c
			totalCost += t
			if (idx % 2 === 0) { pdf.setFillColor(252, 252, 252); pdf.rect(startX, y, tableW, 6, 'F') }
			const cells = [r.date ? new Date(r.date).toLocaleDateString() : '—', item?.sku || '—', item?.name || 'Unknown', String(q), c ? formatCurrency(c, storeInfo.currency) : '—', t ? formatCurrency(t, storeInfo.currency) : '—', r.supplier || '—', r.paymentType === 'credit' ? 'Credit' : 'Debit']
			let x = startX; cols.forEach((col, ci) => { const text = pdf.splitTextToSize(cells[ci], col.w - 2)[0] || ''; pdf.text(text, x + 1, y + 4); x += col.w }); y += 6
		})

		y += 2; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
		pdf.text(`Total: ${filtered.length} purchases`, margin, y)
		pdf.text(`Total Cost: ${formatCurrency(totalCost, storeInfo.currency)}`, pageW - margin, y, { align: 'right' })

		const totalPages = (pdf as any).internal.getNumberOfPages()
		for (let i = 1; i <= totalPages; i++) {
			pdf.setPage(i); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(150)
			pdf.text('Report generated by managify.online', pageW / 2, pageH - 6, { align: 'center' })
			pdf.setTextColor(0)
		}
		pdf.save(`purchases_${title.replace(/\s+/g, '_').toLowerCase()}.pdf`)
	}

	function downloadMonthPdf() {
		const [year, month] = reportMonth.split('-').map(Number)
		const start = new Date(year, month - 1, 1); const end = new Date(year, month, 0, 23, 59, 59)
		const filtered = rows.filter(r => { const d = r.date ? new Date(r.date) : null; return d && d >= start && d <= end })
		downloadBulkPdf(filtered, 'Purchase Report', new Date(year, month - 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }))
	}

	function downloadAllTimePdf() {
		downloadBulkPdf([...rows].sort((a, b) => new Date(a.date || '').getTime() - new Date(b.date || '').getTime()), 'Purchase Report', 'All Time')
	}

	function downloadDateRangePdf() {
		if (!reportStart || !reportEnd) { alert('Please select both start and end dates'); return }
		const start = new Date(reportStart); const end = new Date(reportEnd + 'T23:59:59')
		if (start > end) { alert('Start date must be before end date'); return }
		const filtered = rows.filter(r => { const d = r.date ? new Date(r.date) : null; return d && d >= start && d <= end })
		downloadBulkPdf(filtered, 'Purchase Report', `${new Date(reportStart).toLocaleDateString()} – ${new Date(reportEnd).toLocaleDateString()}`)
	}

	async function handleDeletePurchase(id: string) {
		if (!window.confirm('Delete this purchase? Stock will be reduced automatically.')) return
		try {
			await db.deletePurchase(id)
			const [p, i] = await Promise.all([db.listPurchases(), db.listItems()])
			setRows(p); setItems(i)
		} catch (err: any) {
			alert('Error deleting purchase: ' + (err?.message || err))
		}
	}

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading purchases...
			</div>
		)
	}

	const filteredRows = showAllPurchases
		? rows.filter(r => paymentFilter === 'all' || r.paymentType === paymentFilter)
		: rows.slice(0, 5)

	return (
		<div className="card">
			<div style={{ marginBottom: 4 }}>
				<h2 style={{ margin: '0 0 4px 0' }}>Purchases</h2>
				<p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Press Ctrl + M to quickly add a purchase</p>
			</div>

			{/* ── Add Purchase ── */}
			<div className="card" style={{ marginTop: 16, opacity: submitting ? 0.7 : 1, pointerEvents: submitting ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
				<h3 style={{ marginTop: 0 }}>
					Add Purchase
					{submitting && <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: '#f59e0b' }}>Saving…</span>}
				</h3>
				<div className="form-grid">
					<div>
						<label>SKU</label>
						<input value={sku} onChange={e => setSku(e.target.value)} placeholder="Scan or enter SKU" autoFocus />
					</div>
					<div>
						<label>Quantity</label>
						<input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty" />
					</div>
					<div>
						<label>Cost Price</label>
						<input type="number" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="Cost Price" />
					</div>
					<div>
						<label>Selling Price</label>
						<input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Selling Price" />
					</div>
					<div style={{ position: 'relative' }} data-supplier-dropdown>
						<label>Supplier Name</label>
						<input value={supplier} onChange={e => setSupplier(e.target.value)} onFocus={() => setShowSupplierDropdown(true)} placeholder="Supplier" />
						{showSupplierDropdown && suppliers.length > 0 && (
							<div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', zIndex: 1000, color: 'black' }}>
								{suppliers.filter(s => s.name.toLowerCase().includes(supplier.toLowerCase())).map(s => (
									<div key={s.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
										onClick={() => { setSupplier(s.name); setSupplierPhone(s.phone); setShowSupplierDropdown(false) }}
										onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
										onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
										<div style={{ fontWeight: 'bold' }}>{s.name}</div>
										<div style={{ fontSize: 12, color: '#666' }}>{s.phone}</div>
									</div>
								))}
							</div>
						)}
					</div>
					<div>
						<label>Supplier Phone</label>
						<input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} placeholder="Phone" />
					</div>
					<div>
						<label>Time of Purchase</label>
						<input type="datetime-local" value={purchasedAt} onChange={e => setPurchasedAt(e.target.value)} />
					</div>
					<div>
						<label>Note</label>
						<input value={note} onChange={e => setNote(e.target.value)} placeholder="Note" />
					</div>
					<div>
						<label>Payment Type</label>
						<select value={paymentType} onChange={e => setPaymentType(e.target.value as 'debit' | 'credit')}>
							<option value="debit">Debit Purchase</option>
							<option value="credit">Credit Purchase</option>
						</select>
					</div>
					{paymentType === 'credit' && (
						<div>
							<label>Credit Deadline</label>
							<input type="date" value={creditDeadline} onChange={e => setCreditDeadline(e.target.value)} />
						</div>
					)}
					{isMobile && (
						<div style={{ gridColumn: '1 / -1' }}>
							<label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
								<input type="checkbox" checked={scanEnabled} onChange={e => setScanEnabled(e.target.checked)} />
								Enable Barcode Scanner
							</label>
							{scanEnabled && (
								<>
									<video ref={videoRef} style={{ width: '100%', maxHeight: 220, background: '#111', borderRadius: 12, marginTop: 8 }} muted playsInline />
									{scanError && <div className="badge" style={{ background: '#ff4444', marginTop: 8 }}>{scanError}</div>}
									{isScanning && <div className="badge" style={{ marginTop: 8 }}>Scanner active — point camera at barcode</div>}
								</>
							)}
						</div>
					)}
					{sku && !existing && (
						<div>
							<label>Item Name <span style={{ color: '#f59e0b', fontSize: 12 }}>(new product)</span></label>
							<input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Item Name" />
						</div>
					)}
					<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
						<button onClick={onSubmit} disabled={submitting} style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
						{submitting ? 'Adding…' : 'Add Purchase'}
					</button>
					</div>
				</div>
			</div>

			{/* ── Download Report ── */}
			<div className="card" style={{ marginTop: 16 }}>
				<h3 style={{ marginTop: 0 }}>Download Purchase Report</h3>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
					<div style={{ flex: 1, minWidth: 200 }}>
						<label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#9ca3af' }}>By Month</label>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} style={{ flex: 1 }} />
							<button onClick={downloadMonthPdf} style={{ whiteSpace: 'nowrap' }}>Download</button>
						</div>
					</div>
					<div style={{ flex: 2, minWidth: 280 }}>
						<label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#9ca3af' }}>By Date Range</label>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
							<input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
							<span style={{ color: '#6b7280' }}>to</span>
							<input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
							<button onClick={downloadDateRangePdf} style={{ whiteSpace: 'nowrap' }}>Download</button>
						</div>
					</div>
					<div style={{ display: 'flex', alignItems: 'flex-end' }}>
						<button className="secondary" onClick={downloadAllTimePdf}>All Time PDF</button>
					</div>
				</div>
			</div>

			{/* ── Purchase List ── */}
			<div className="card" style={{ marginTop: 16 }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
					<h3 style={{ margin: 0 }}>
						{showAllPurchases ? 'All Purchases' : 'Recent Purchases'}
						<span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: '#6b7280' }}>({rows.length} total)</span>
					</h3>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						{showAllPurchases && (
							<select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as 'all' | 'debit' | 'credit')} style={{ fontSize: 13 }}>
								<option value="all">All</option>
								<option value="debit">Debit</option>
								<option value="credit">Credit</option>
							</select>
						)}
						<button className="secondary" onClick={() => setShowAllPurchases(!showAllPurchases)}>
							{showAllPurchases ? 'Show Recent' : 'Show All'}
						</button>
					</div>
				</div>

				{filteredRows.length === 0 ? (
					<div style={{ textAlign: 'center', padding: 32, color: '#4b5563' }}>No purchases found</div>
				) : (
					<div style={{ overflowX: 'auto' }}>
						<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
							<thead>
								<tr style={{ background: '#141920' }}>
									{['Date', 'SKU', 'Item', 'Qty', 'Cost/Unit', 'Total', 'Supplier', 'Payment', 'Actions'].map(h => (
										<th key={h} style={{ padding: '10px 12px', textAlign: h === 'Qty' || h === 'Cost/Unit' || h === 'Total' ? 'right' : 'left', borderBottom: '2px solid #243245', color: '#8899aa', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{filteredRows.map(r => {
									const item = items.find(i => i.id === r.itemId)
									const q = r.quantity || r.qty || 0
									const total = q * (r.costPrice || 0)
									return (
										<tr key={r.id} style={{ borderBottom: '1px solid #1a2030' }}
											onMouseEnter={e => (e.currentTarget.style.background = '#141920')}
											onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
											<td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#94a3b8' }}>{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
											<td style={{ padding: '10px 12px', color: '#94a3b8' }}>{item?.sku || '—'}</td>
											<td style={{ padding: '10px 12px', fontWeight: 500 }}>{item?.name || 'Unknown'}</td>
											<td style={{ padding: '10px 12px', textAlign: 'right' }}>{q}</td>
											<td style={{ padding: '10px 12px', textAlign: 'right' }}>{r.costPrice ? formatCurrency(r.costPrice, storeInfo.currency) : '—'}</td>
											<td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{total ? formatCurrency(total, storeInfo.currency) : '—'}</td>
											<td style={{ padding: '10px 12px', color: '#94a3b8' }}>{r.supplier || '—'}</td>
											<td style={{ padding: '10px 12px' }}>
												<span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: r.paymentType === 'credit' ? '#451a03' : '#052e16', color: r.paymentType === 'credit' ? '#fb923c' : '#4ade80' }}>
													{r.paymentType === 'credit' ? 'Credit' : 'Debit'}
												</span>
											</td>
											<td style={{ padding: '10px 12px' }}>
												<div style={{ display: 'flex', gap: 6 }}>
													<button style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => printInvoice(r)}>Print</button>
													<button className="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => downloadInvoicePdf(r)}>PDF</button>
													<button className="secondary" style={{ padding: '4px 10px', fontSize: 12, color: '#f87171', borderColor: '#7f1d1d' }} onClick={() => handleDeletePurchase(r.id)}>Delete</button>
												</div>
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Hidden invoice divs for print/PDF — rendered off-screen */}
			<div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
				{filteredRows.map(r => {
					const item = items.find(i => i.id === r.itemId)
					return (
						<div key={r.id} id={`purch-invoice-${r.id}`} style={{ ...getThermalPrintStyles().container, padding: 20, width: 600 }}>
							<div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #333', paddingBottom: 16 }}>
								{storeInfo.logo && <img src={storeInfo.logo} alt="" style={{ maxHeight: 60, maxWidth: 120, objectFit: 'contain', marginBottom: 8 }} onError={e => { e.currentTarget.style.display = 'none' }} />}
								<h1 style={{ margin: 0, fontSize: 24, color: '#333' }}>{storeInfo.storeName.toUpperCase()}</h1>
								{storeInfo.address  && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>{storeInfo.address}</p>}
								{storeInfo.phone    && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>Phone: {storeInfo.phone}</p>}
								{storeInfo.email    && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>Email: {storeInfo.email}</p>}
								{storeInfo.website  && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>{storeInfo.website}</p>}
								{storeInfo.taxNumber && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>Tax #: {storeInfo.taxNumber}</p>}
								<p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#666' }}>Purchase Invoice</p>
							</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
								<div style={{ fontSize: 13, lineHeight: 1.7 }}>
									<strong>PO #:</strong> {r.id.slice(-6)}<br />
									<strong>Date:</strong> {r.date ? new Date(r.date).toLocaleDateString() : 'N/A'}<br />
									<strong>Payment:</strong> {r.paymentType === 'credit' ? 'Credit' : 'Debit'}<br />
									{r.paymentType === 'credit' && r.creditDeadline && <><strong>Deadline:</strong> {new Date(r.creditDeadline).toLocaleDateString()}<br /></>}
								</div>
								<div style={{ fontSize: 13, lineHeight: 1.7, textAlign: 'right' }}>
									<strong>Supplier:</strong> {r.supplier || 'N/A'}<br />
									<strong>Phone:</strong> {r.supplierPhone || 'N/A'}
								</div>
							</div>
							<table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
								<thead>
									<tr style={{ background: '#f5f5f5' }}>
										{['SKU', 'Description', 'Qty', 'Unit Cost', 'Total'].map(h => (
											<th key={h} style={{ border: '1px solid #ddd', padding: 10, textAlign: h === 'Qty' || h === 'Unit Cost' || h === 'Total' ? 'right' : 'left', fontSize: 13 }}>{h}</th>
										))}
									</tr>
								</thead>
								<tbody>
									<tr>
										<td style={{ border: '1px solid #ddd', padding: 10, fontSize: 13 }}>{item?.sku || 'N/A'}</td>
										<td style={{ border: '1px solid #ddd', padding: 10, fontSize: 13 }}>{item?.name || 'Unknown'}</td>
										<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontSize: 13 }}>{r.quantity || r.qty || 0}</td>
										<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontSize: 13 }}>{r.costPrice ? formatCurrency(r.costPrice, storeInfo.currency) : 'N/A'}</td>
										<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontSize: 13 }}>
											{r.costPrice && (r.quantity || r.qty) ? formatCurrency(r.costPrice * (r.quantity || r.qty || 0), storeInfo.currency) : 'N/A'}
										</td>
									</tr>
								</tbody>
								<tfoot>
									<tr style={{ background: '#f9f9f9' }}>
										<td colSpan={4} style={{ border: '1px solid #ddd', padding: 12, textAlign: 'right', fontWeight: 'bold', fontSize: 14 }}>TOTAL</td>
										<td style={{ border: '1px solid #ddd', padding: 12, textAlign: 'right', fontWeight: 'bold', fontSize: 14 }}>
											{r.costPrice && (r.quantity || r.qty) ? formatCurrency(r.costPrice * (r.quantity || r.qty || 0), storeInfo.currency) : 'N/A'}
										</td>
									</tr>
								</tfoot>
							</table>
							<div style={{ textAlign: 'center', fontSize: 11, color: '#999', marginTop: 16 }}>
								Report generated by managify.online
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
