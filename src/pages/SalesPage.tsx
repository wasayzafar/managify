import { useState, useEffect } from 'react'
import { db, Sale, Item, StoreInfo } from '../storage'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { getThermalPrintStyles, isThermalPrinting, getPrintWindowSize, getPrintPageCSS, getPrintOrientation, getPrintSize } from '../utils/thermalPrintStyles'
import { getCachedImage, preloadImageAsBase64 } from '../utils/imageCache'
import { loadCurrency, formatCurrency } from '../utils/currency'

export default function SalesPage() {
	const [invoices, setInvoices] = useState<any[]>([])
	const [allSales, setAllSales] = useState<Sale[]>([])
	const [items, setItems] = useState<Item[]>([])
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: 'Managify', phone: '', address: '', email: '', website: '', taxNumber: '', logo: '', currency: 'PKR' })
	const [loading, setLoading] = useState(true)
	const [searchTerm, setSearchTerm] = useState('')
	const [filterType, setFilterType] = useState<'all' | 'date' | 'range'>('date')
	const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
	const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
	const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)
	const [returning, setReturning] = useState(false)
	const [itemSearch, setItemSearch] = useState('')
	const [itemSearchMode, setItemSearchMode] = useState<'name' | 'sku'>('name')
	const [showItemSuggestions, setShowItemSuggestions] = useState(false)

	const loadData = async () => {
		setLoading(true)
		try {
			const [invData, salesData, itemsData, store] = await Promise.all([
				db.listInvoices(), db.listSales(), db.listItems(), db.getStoreInfo()
			])
			setInvoices(invData)
			setAllSales(salesData)
			setItems(itemsData)
			setStoreInfo(store)
			await loadCurrency()
			if (store.logo) preloadImageAsBase64(store.logo).catch(console.warn)
		} catch (err) {
			console.error('Error loading sales data:', err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => { loadData() }, [])

	const filteredInvoices = invoices.filter(inv => {
		if (searchTerm && !inv.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) && !inv.customer?.toLowerCase().includes(searchTerm.toLowerCase())) return false
		if (itemSearch.trim()) {
			const term = itemSearch.trim().toLowerCase()
			const lines: any[] = inv.lines || []
			const match = itemSearchMode === 'sku'
				? lines.some(l => l.sku?.toLowerCase() === term)
				: lines.some(l => l.name?.toLowerCase().includes(term))
			if (!match) return false
		}
		if (!inv.date) return true
		const d = new Date(inv.date)
		if (filterType === 'date') return d.toISOString().slice(0, 10) === startDate
		if (filterType === 'range') return d >= new Date(startDate) && d <= new Date(endDate + 'T23:59:59')
		return true
	})

	// Unique SKU/name suggestions for item search
	const itemSuggestions = (() => {
		if (!itemSearch.trim()) return []
		const term = itemSearch.trim().toLowerCase()
		if (itemSearchMode === 'sku') {
			const skus = new Set<string>()
			items.forEach(i => { if (i.sku?.toLowerCase().includes(term)) skus.add(i.sku) })
			return Array.from(skus).slice(0, 8)
		} else {
			const names = new Set<string>()
			items.forEach(i => { if (i.name?.toLowerCase().includes(term)) names.add(i.name) })
			return Array.from(names).slice(0, 8)
		}
	})()

	// Revenue: exclude fully returned bills, only count remaining sales for partial returns
	function activeRevenue(inv: any): number {
		const remaining = allSales.filter(s => s.invoiceNo === inv.invoiceNo)
		if (remaining.length === 0) return 0                          // fully returned
		if (remaining.length === (inv.lines || []).length) return inv.total || 0  // nothing returned
		// partial return — sum only the remaining sale records
		return remaining.reduce((sum, s) => sum + (s.actualPrice || 0) * (s.quantity || 0), 0)
	}

	const totalRevenue = filteredInvoices.reduce((s, inv) => s + activeRevenue(inv), 0)

	// Returns: compute subtotal directly from lines
	function invSubtotal(inv: any) {
		return (inv.lines || []).reduce((s: number, l: any) => {
			const t = (l.qty || 0) * (l.price || 0)
			return s + t - (t * (l.discount || 0) / 100)
		}, 0)
	}

	// Return status helpers — based on remaining sale records (no fake purchases)
	function returnStatus(inv: any): 'none' | 'partial' | 'full' {
		const expected = (inv.lines || []).length
		if (expected === 0) return 'none'
		const remaining = allSales.filter(s => s.invoiceNo === inv.invoiceNo).length
		if (remaining === 0) return 'full'
		if (remaining < expected) return 'partial'
		return 'none'
	}

	function isLineReturned(inv: any, line: any): boolean {
		// Exact match found → definitely not returned
		if (allSales.some(s => s.invoiceNo === inv.invoiceNo && s.itemId === line.itemId)) return false

		// No exact match. Could be returned OR item was deleted (sale exists with null itemId).
		// Count unmatched lines (no sale found by itemId) and null-itemId sales for this invoice.
		const unmatchedLines = (inv.lines || []).filter((l: any) =>
			!allSales.some(s => s.invoiceNo === inv.invoiceNo && s.itemId === l.itemId)
		).length
		const deletedItemSales = allSales.filter(s => s.invoiceNo === inv.invoiceNo && !s.itemId).length

		// If null-itemId sales account for all unmatched lines, this line's item was deleted — not returned
		if (deletedItemSales >= unmatchedLines) return false

		return true
	}

	async function returnWholeInvoice(inv: any) {
		if (!window.confirm(`Return entire bill ${inv.invoiceNo}? All items will be restored to inventory.`)) return
		setReturning(true)
		try {
			const invoiceSales = allSales.filter(s => s.invoiceNo === inv.invoiceNo)
			if (!invoiceSales.length) { alert('This bill has already been fully returned.'); setReturning(false); return }
			for (const s of invoiceSales) {
				await db.deleteSale(s.id)
			}
			await loadData()
			setSelectedInvoice(null)
			alert('Bill returned. Stock restored automatically.')
		} catch (err: any) {
			alert('Error returning bill: ' + (err?.message || err))
		} finally {
			setReturning(false)
		}
	}

	async function returnLineItem(inv: any, line: any) {
		const matchingSales = allSales.filter(s => s.invoiceNo === inv.invoiceNo && s.itemId === line.itemId)
		if (!matchingSales.length) { alert('This item has already been returned.'); return }
		if (!window.confirm(`Return "${line.name}" (×${line.qty})? Stock will be restored.`)) return
		setReturning(true)
		try {
			for (const s of matchingSales) {
				await db.deleteSale(s.id)
			}
			await loadData()
			alert('Item returned. Stock restored automatically.')
		} catch (err: any) {
			alert('Error returning item: ' + (err?.message || err))
		} finally {
			setReturning(false)
		}
	}

	function printInvoice(inv: any) {
		const el = document.getElementById(`inv-print-${inv.id}`)
		if (!el) return
		Array.from(el.querySelectorAll('img')).forEach(img => {
			const cached = getCachedImage(img.src)
			if (cached) img.src = cached
		})
		const { width, height } = getPrintWindowSize()
		const w = window.open('', 'PRINT', `height=${height},width=${width},top=100,left=150`)
		if (!w) return
		w.document.write(`<html><head><title>Invoice</title><style>${getPrintPageCSS()} body{margin:0;padding:0;font-family:Arial,sans-serif} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px}</style></head><body>`)
		w.document.write(el.innerHTML)
		w.document.write('</body></html>')
		w.document.close(); w.focus(); w.print(); w.close()
	}

	async function downloadInvoicePdf(inv: any) {
		const el = document.getElementById(`inv-print-${inv.id}`)
		if (!el) return
		const canvas = await html2canvas(el)
		const imgData = canvas.toDataURL('image/png')
		const size = getPrintSize()
		const orientation = (size === 'A4' || size === 'A5') && getPrintOrientation() === 'landscape' ? 'l' : 'p'
		const pdf = new jsPDF({ orientation, unit: 'mm', format: size === 'A5' ? 'a5' : 'a4' })
		const pw = pdf.internal.pageSize.getWidth()
		pdf.addImage(imgData, 'PNG', 0, 0, pw, canvas.height * pw / canvas.width)
		pdf.save(`${inv.invoiceNo || 'invoice'}.pdf`)
	}

	function downloadSalesReportPdf() {
		if (filteredInvoices.length === 0) { alert('No bills to export.'); return }
		const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
		const pageW = pdf.internal.pageSize.getWidth()
		const pageH = pdf.internal.pageSize.getHeight()
		const margin = 14
		let y = margin

		// Store header
		pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
		pdf.text(storeInfo.storeName.toUpperCase(), pageW / 2, y, { align: 'center' }); y += 7
		if (storeInfo.address) { pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.text(storeInfo.address, pageW / 2, y, { align: 'center' }); y += 5 }
		if (storeInfo.phone)   { pdf.setFontSize(9); pdf.text('Phone: ' + storeInfo.phone, pageW / 2, y, { align: 'center' }); y += 5 }
		pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
		pdf.text('Sales Report', pageW / 2, y + 2, { align: 'center' }); y += 7
		pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
		const periodLabel = filterType === 'date' ? new Date(startDate).toLocaleDateString()
			: filterType === 'range' ? `${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}`
			: 'All Time'
		pdf.text(periodLabel, pageW / 2, y, { align: 'center' }); y += 4
		pdf.text('Generated: ' + new Date().toLocaleString(), pageW / 2, y, { align: 'center' }); y += 5
		pdf.line(margin, y, pageW - margin, y); y += 5

		const cols = [
			{ label: 'SKU',       w: 22 },
			{ label: 'Item',      w: 55 },
			{ label: 'Qty',       w: 12 },
			{ label: 'Unit Price', w: 24 },
			{ label: 'Disc%',     w: 14 },
			{ label: 'Amount',    w: 26 },
		]
		const tableW = cols.reduce((s, c) => s + c.w, 0)
		const startX = margin

		const drawLineHeader = () => {
			pdf.setFillColor(230, 230, 230); pdf.rect(startX, y, tableW, 6, 'F')
			pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold')
			let x = startX; cols.forEach(c => { pdf.text(c.label, x + 1, y + 4); x += c.w }); y += 6
		}

		let grandTotal = 0

		filteredInvoices.forEach((inv, invIdx) => {
			const status = returnStatus(inv)
			const revenue = activeRevenue(inv)
			const sub = invSubtotal(inv)
			const bd = inv.billDiscount || 0
			const discAmt = (sub * bd) / 100

			// Invoice header — check page space
			if (y > pageH - 50) { pdf.addPage(); y = margin }

			// Invoice title bar
			pdf.setFillColor(34, 99, 255); pdf.rect(startX, y, pageW - margin * 2, 7, 'F')
			pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 255, 255)
			const invLabel = `${inv.invoiceNo || '—'}   Customer: ${inv.customer || 'Walk-in'}   Date: ${inv.date ? new Date(inv.date).toLocaleDateString() : '—'}`
			pdf.text(invLabel, startX + 2, y + 5)
			if (status === 'full') pdf.text('RETURNED', pageW - margin - 2, y + 5, { align: 'right' })
			else if (status === 'partial') pdf.text('PARTIAL RETURN', pageW - margin - 2, y + 5, { align: 'right' })
			pdf.setTextColor(0); y += 7

			// Line items header
			drawLineHeader()
			pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)

			;(inv.lines || []).forEach((l: any, li: number) => {
				if (y > pageH - 20) { pdf.addPage(); y = margin; drawLineHeader(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5) }
				const lineTotal = (l.qty || 0) * (l.price || 0)
				const lineAmt = lineTotal - lineTotal * (l.discount || 0) / 100
				const returned = isLineReturned(inv, l)
				if (li % 2 === 0) { pdf.setFillColor(248, 248, 248); pdf.rect(startX, y, tableW, 5.5, 'F') }
				if (returned) { pdf.setTextColor(150) }
				const cells = [l.sku || '—', l.name || '—', String(l.qty || 0), formatCurrency(l.price || 0, storeInfo.currency), `${l.discount || 0}%`, formatCurrency(lineAmt, storeInfo.currency)]
				let x = startX
				cols.forEach((col, ci) => { const txt = pdf.splitTextToSize(cells[ci], col.w - 2)[0] || ''; pdf.text(txt, x + 1, y + 4); x += col.w })
				if (returned) { pdf.setTextColor(0) }
				y += 5.5
			})

			// Invoice totals
			if (y > pageH - 20) { pdf.addPage(); y = margin }
			pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
			const totX = startX + tableW
			pdf.text(`Subtotal: ${formatCurrency(sub, storeInfo.currency)}`, totX - 2, y + 3, { align: 'right' })
			if (bd > 0) { y += 5; pdf.text(`Disc (${bd}%): −${formatCurrency(discAmt, storeInfo.currency)}`, totX - 2, y + 3, { align: 'right' }) }
			y += 5
			pdf.setFont('helvetica', 'bold')
			pdf.text(`Total: ${formatCurrency(revenue, storeInfo.currency)}`, totX - 2, y + 3, { align: 'right' })
			y += 8

			grandTotal += revenue
			if (invIdx < filteredInvoices.length - 1) {
				pdf.setDrawColor(220); pdf.line(startX, y - 2, pageW - margin, y - 2); pdf.setDrawColor(0)
			}
		})

		// Grand total
		if (y > pageH - 20) { pdf.addPage(); y = margin }
		y += 2
		pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10)
		pdf.text(`${filteredInvoices.length} bills · Grand Total: ${formatCurrency(grandTotal, storeInfo.currency)}`, pageW / 2, y, { align: 'center' })

		// Footer on every page
		const totalPages = (pdf as any).internal.getNumberOfPages()
		for (let i = 1; i <= totalPages; i++) {
			pdf.setPage(i); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(150)
			pdf.text('Report generated by managify.online', pageW / 2, pageH - 6, { align: 'center' })
			pdf.setTextColor(0)
		}
		pdf.save(`sales_report_${periodLabel.replace(/[\s–/]/g, '_')}.pdf`)
	}

	if (loading) {
		return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>Loading sales...</div>
	}

	return (
		<div className="card">
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
				<h2 style={{ margin: 0 }}>Sales</h2>
				<button className="secondary" onClick={downloadSalesReportPdf}>Download Report PDF</button>
			</div>

			{/* ── Filters ── */}
			<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
				<div>
					<label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Period</label>
					<select value={filterType} onChange={e => setFilterType(e.target.value as any)} style={{ padding: '8px 12px', border: '1px solid #243245', borderRadius: 6, background: '#0b0f14', color: '#e8eef5' }}>
						<option value="all">All Time</option>
						<option value="date">Single Day</option>
						<option value="range">Date Range</option>
					</select>
				</div>
				{filterType === 'date' && (
					<div>
						<label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Date</label>
						<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
					</div>
				)}
				{filterType === 'range' && (<>
					<div>
						<label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>From</label>
						<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
					</div>
					<div>
						<label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>To</label>
						<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
					</div>
				</>)}
				<div>
					<label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Search</label>
					<input placeholder="Invoice # or customer…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ minWidth: 200 }} />
				</div>
				{/* Item search */}
				<div style={{ position: 'relative' }}>
					<label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Search by Item</label>
					<div style={{ display: 'flex' }}>
						{/* Mode toggle */}
						<div style={{ display: 'flex', borderRadius: '8px 0 0 8px', overflow: 'hidden', border: '1px solid #243245', borderRight: 'none' }}>
							{(['name', 'sku'] as const).map(mode => (
								<button key={mode} onClick={() => { setItemSearchMode(mode); setItemSearch('') }}
									style={{
										padding: '8px 12px', fontSize: 12, fontWeight: 600,
										background: itemSearchMode === mode ? '#2263ff' : '#233043',
										color: 'white', border: 'none', cursor: 'pointer',
										borderRight: mode === 'name' ? '1px solid #243245' : 'none',
										borderRadius: 0,
									}}>
									{mode === 'name' ? 'Name' : 'SKU'}
								</button>
							))}
						</div>
						{/* Input */}
						<input
							placeholder={itemSearchMode === 'sku' ? 'Exact SKU…' : 'Item name…'}
							value={itemSearch}
							onChange={e => { setItemSearch(e.target.value); setShowItemSuggestions(true) }}
							onFocus={() => setShowItemSuggestions(true)}
							onBlur={() => setTimeout(() => setShowItemSuggestions(false), 150)}
							style={{ minWidth: 180, borderRadius: '0 8px 8px 0', borderLeft: 'none' }}
						/>
						{itemSearch.trim() && (
							<button className="secondary" onClick={() => setItemSearch('')}
								style={{ marginLeft: 8, padding: '8px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
								✕ Clear
							</button>
						)}
					</div>
					{showItemSuggestions && itemSuggestions.length > 0 && (
						<div style={{ position: 'absolute', top: '100%', left: 0, minWidth: 220, background: '#111827', border: '1px solid #243245', borderRadius: 8, zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
							{itemSuggestions.map(s => (
								<div key={s} onClick={() => { setItemSearch(s); setShowItemSuggestions(false) }}
									style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #1a2030' }}
									onMouseEnter={e => (e.currentTarget.style.background = '#1a2030')}
									onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
									{s}
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* ── Item search result banner ── */}
			{itemSearch.trim() && (
				<div style={{ background: '#1a2030', border: '1px solid #243245', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
					<span style={{ fontSize: 13, color: '#9ca3af' }}>
						{itemSearchMode === 'sku' ? 'SKU' : 'Item'} <strong style={{ color: '#e8eef5' }}>"{itemSearch}"</strong>
					</span>
					<span style={{ background: '#2263ff', color: 'white', fontWeight: 700, fontSize: 14, padding: '2px 12px', borderRadius: 20 }}>
						{filteredInvoices.length} bill{filteredInvoices.length !== 1 ? 's' : ''}
					</span>
					{itemSearchMode === 'name' && (
						<span style={{ fontSize: 12, color: '#6b7280' }}>matched by name · select SKU for exact match</span>
					)}
					{itemSearchMode === 'sku' && (
						<span style={{ fontSize: 12, color: '#6b7280' }}>exact SKU match</span>
					)}
				</div>
			)}

			{/* ── Summary ── */}
			<div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
				<div style={{ flex: 1, minWidth: 140, background: '#1a2a1a', border: '1px solid #2d5a2d', borderRadius: 8, padding: '12px 16px' }}>
					<div style={{ fontSize: 12, color: '#81c784', marginBottom: 4 }}>BILLS SHOWN</div>
					<div style={{ fontSize: 22, fontWeight: 700, color: '#a5d6a7' }}>{filteredInvoices.length}</div>
				</div>
				<div style={{ flex: 1, minWidth: 140, background: '#111827', border: '1px solid #243245', borderRadius: 8, padding: '12px 16px' }}>
					<div style={{ fontSize: 12, color: '#90caf9', marginBottom: 4 }}>TOTAL REVENUE</div>
					<div style={{ fontSize: 22, fontWeight: 700, color: '#bbdefb' }}>{formatCurrency(totalRevenue, storeInfo.currency)}</div>
				</div>
			</div>

			{/* ── Invoice Table ── */}
			<div style={{ overflowX: 'auto' }}>
				<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
					<thead>
						<tr style={{ background: '#141920' }}>
							{['Invoice #', 'Customer', 'Items', 'Total', 'Date', 'Actions'].map(h => (
								<th key={h} style={{ padding: '10px 12px', textAlign: h === 'Total' || h === 'Items' ? 'right' : 'left', borderBottom: '2px solid #243245', color: '#8899aa', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{filteredInvoices.length === 0 ? (
							<tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#4a5568' }}>No bills found</td></tr>
						) : filteredInvoices.map(inv => {
							const status = returnStatus(inv)
							return (
							<tr key={inv.id} style={{ borderBottom: '1px solid #1a2030', opacity: status === 'full' ? 0.55 : 1 }}
								onMouseEnter={e => (e.currentTarget.style.background = '#141920')}
								onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
								<td style={{ padding: '10px 12px', fontWeight: 600, color: '#60a5fa' }}>
									{inv.invoiceNo || inv.id?.slice(-6)}
									{status === 'full'    && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, background: '#7f1d1d', color: '#fca5a5', padding: '2px 7px', borderRadius: 10 }}>Returned</span>}
									{status === 'partial' && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, background: '#451a03', color: '#fdba74', padding: '2px 7px', borderRadius: 10 }}>Partial Return</span>}
								</td>
								<td style={{ padding: '10px 12px' }}>{inv.customer || 'Walk-in'}</td>
								<td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{(inv.lines || []).length}</td>
								<td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: status === 'full' ? '#6b7280' : '#4ade80' }}>
								{formatCurrency(activeRevenue(inv), storeInfo.currency)}
								{status !== 'none' && (
									<div style={{ fontSize: 11, fontWeight: 400, color: '#6b7280', marginTop: 1 }}>
										of {formatCurrency(inv.total || 0, storeInfo.currency)}
									</div>
								)}
							</td>
								<td style={{ padding: '10px 12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{inv.date ? new Date(inv.date).toLocaleString() : '—'}</td>
								<td style={{ padding: '10px 12px' }}>
									<div style={{ display: 'flex', gap: 6 }}>
										<button style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setSelectedInvoice(inv)}>View Bill</button>
										{status !== 'full' && (
											<button style={{ padding: '4px 12px', fontSize: 12, color: '#f87171', borderColor: '#7f1d1d' }} className="secondary"
												onClick={() => returnWholeInvoice(inv)} disabled={returning}>
												Return All
											</button>
										)}
									</div>
								</td>
							</tr>
							)
						})}
					</tbody>
				</table>
			</div>

			{/* ── Invoice Detail Modal ── */}
			{selectedInvoice && (
				<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1100 }}>
					<div className="card" style={{ width: '100%', maxWidth: 860, maxHeight: '92vh', overflowY: 'auto', position: 'relative' }}>
						{/* Modal header */}
						{(() => {
							const status = returnStatus(selectedInvoice)
							return (<>
								{status === 'full' && (
									<div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '8px 14px', borderRadius: 6, marginBottom: 12, fontWeight: 600, fontSize: 13 }}>
										This bill has been fully returned — all items restored to inventory
									</div>
								)}
								{status === 'partial' && (
									<div style={{ background: '#451a03', color: '#fdba74', padding: '8px 14px', borderRadius: 6, marginBottom: 12, fontWeight: 600, fontSize: 13 }}>
										Partial return — some items from this bill have been returned
									</div>
								)}
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
									<div>
										<h3 style={{ margin: 0 }}>{selectedInvoice.invoiceNo}</h3>
										<div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
											{selectedInvoice.customer || 'Walk-in'} · {selectedInvoice.date ? new Date(selectedInvoice.date).toLocaleString() : '—'}
										</div>
									</div>
									<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
										<button style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => printInvoice(selectedInvoice)}>Print</button>
										<button className="secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => downloadInvoicePdf(selectedInvoice)}>PDF</button>
										{status !== 'full' && (
											<button className="secondary" style={{ padding: '6px 14px', fontSize: 13, color: '#f87171', borderColor: '#7f1d1d' }}
												onClick={() => returnWholeInvoice(selectedInvoice)} disabled={returning}>
												Return Whole Bill
											</button>
										)}
										<button onClick={() => setSelectedInvoice(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', padding: '0 4px' }}>×</button>
									</div>
								</div>
							</>)
						})()}

						{/* Line items with per-item return */}
						<div style={{ overflowX: 'auto', marginBottom: 16 }}>
							<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
								<thead>
									<tr style={{ background: '#141920' }}>
										{['SKU', 'Item', 'Qty', 'Unit Price', 'Disc %', 'Amount', 'Return'].map(h => (
											<th key={h} style={{ padding: '9px 12px', textAlign: h === 'Qty' || h === 'Unit Price' || h === 'Amount' ? 'right' : 'left', borderBottom: '2px solid #243245', color: '#8899aa', fontWeight: 600 }}>{h}</th>
										))}
									</tr>
								</thead>
								<tbody>
									{(selectedInvoice.lines || []).map((line: any) => {
										const returned = isLineReturned(selectedInvoice, line)
										const lineTotal = (line.qty || 0) * (line.price || 0)
										const lineAmt = lineTotal - (lineTotal * (line.discount || 0) / 100)
										return (
											<tr key={line.id} style={{ borderBottom: '1px solid #1a2030', opacity: returned ? 0.45 : 1 }}>
												<td style={{ padding: '9px 12px', color: '#94a3b8' }}>{line.sku}</td>
												<td style={{ padding: '9px 12px', fontWeight: 500 }}>{line.name}</td>
												<td style={{ padding: '9px 12px', textAlign: 'right' }}>{line.qty}</td>
												<td style={{ padding: '9px 12px', textAlign: 'right' }}>{formatCurrency(line.price || 0, storeInfo.currency)}</td>
												<td style={{ padding: '9px 12px', textAlign: 'left' }}>{line.discount || 0}%</td>
												<td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(lineAmt, storeInfo.currency)}</td>
												<td style={{ padding: '9px 12px' }}>
													{returned ? (
														<span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Returned</span>
													) : (
														<button className="secondary" style={{ padding: '3px 10px', fontSize: 12, color: '#f87171', borderColor: '#7f1d1d' }}
															onClick={() => returnLineItem(selectedInvoice, line)} disabled={returning}>
															Return
														</button>
													)}
												</td>
											</tr>
										)
									})}
								</tbody>
								<tfoot>
									{(() => {
										const sub = invSubtotal(selectedInvoice)
										const bd = selectedInvoice.billDiscount || 0
										const discAmt = (sub * bd) / 100
										return (<>
											<tr>
												<td colSpan={6} style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8', borderTop: '1px solid #243245' }}>Subtotal</td>
												<td style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8', borderTop: '1px solid #243245', fontWeight: 500 }}>{formatCurrency(sub, storeInfo.currency)}</td>
											</tr>
											{bd > 0 && (
												<tr>
													<td colSpan={6} style={{ padding: '8px 12px', textAlign: 'right', color: '#f59e0b' }}>Bill Discount ({bd}%)</td>
													<td style={{ padding: '8px 12px', textAlign: 'right', color: '#f59e0b' }}>−{formatCurrency(discAmt, storeInfo.currency)}</td>
												</tr>
											)}
											<tr style={{ background: '#1a2030' }}>
												<td colSpan={6} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 15 }}>TOTAL</td>
												<td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#4ade80' }}>{formatCurrency(selectedInvoice.total || (sub - discAmt), storeInfo.currency)}</td>
											</tr>
										</>)
									})()}
								</tfoot>
							</table>
						</div>

						{/* Hidden printable invoice */}
						<div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
							<div id={`inv-print-${selectedInvoice.id}`} style={{ ...getThermalPrintStyles().container, padding: 20, width: 640, background: 'white', color: 'black' }}>
								{isThermalPrinting() ? (
									<div style={{ fontFamily: 'Arial', fontSize: 8, lineHeight: 1.2, padding: 5 }}>
										<div style={{ textAlign: 'center', marginBottom: 8 }}>
											{storeInfo.logo && <img src={storeInfo.logo} alt="" style={{ maxHeight: 20, marginBottom: 3 }} onError={e => { e.currentTarget.style.display = 'none' }} />}
											<div style={{ fontWeight: 'bold', fontSize: 10 }}>{storeInfo.storeName.toUpperCase()}</div>
											{storeInfo.phone && <div>Phone: {storeInfo.phone}</div>}
											{storeInfo.address && <div>{storeInfo.address}</div>}
										</div>
										<hr style={{ borderTop: '1px solid #000', margin: '4px 0' }} />
										<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, marginBottom: 6 }}>
											<div><div>Invoice #: {selectedInvoice.invoiceNo}</div><div>Date: {selectedInvoice.date ? new Date(selectedInvoice.date).toLocaleDateString() : '—'}</div></div>
											<div style={{ textAlign: 'right' }}><div>{selectedInvoice.customer || 'Walk-in'}</div><div>{selectedInvoice.phone || ''}</div></div>
										</div>
										<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 7, marginBottom: 5 }}>
											<thead><tr style={{ borderBottom: '1px solid #000' }}>
												{['SKU', 'Item', 'Qty', 'Price', 'Disc', 'Amt'].map(h => <th key={h} style={{ padding: '1px 2px', textAlign: 'left' }}>{h}</th>)}
											</tr></thead>
											<tbody>
												{(selectedInvoice.lines || []).map((l: any) => {
													const t = (l.qty || 0) * (l.price || 0)
													const a = t - t * (l.discount || 0) / 100
													return (
														<tr key={l.id}><td style={{ padding: '1px 2px' }}>{l.sku}</td><td style={{ padding: '1px 2px' }}>{l.name}</td><td style={{ padding: '1px 2px', textAlign: 'right' }}>{l.qty}</td><td style={{ padding: '1px 2px', textAlign: 'right' }}>{(l.price || 0).toFixed(2)}</td><td style={{ padding: '1px 2px', textAlign: 'right' }}>{l.discount || 0}%</td><td style={{ padding: '1px 2px', textAlign: 'right' }}>{a.toFixed(2)}</td></tr>
													)
												})}
											</tbody>
										</table>
										{(() => {
											const sub = invSubtotal(selectedInvoice); const bd = selectedInvoice.billDiscount || 0; const da = (sub * bd) / 100
											return (<div style={{ borderTop: '1px solid #000', paddingTop: 3 }}>
												<div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{sub.toFixed(2)}</span></div>
												{bd > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount ({bd}%)</span><span>{da.toFixed(2)}</span></div>}
												<div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #000', marginTop: 2, paddingTop: 2 }}><span>TOTAL</span><span>{(selectedInvoice.total || (sub - da)).toFixed(2)}</span></div>
											</div>)
										})()}
										<div style={{ textAlign: 'center', marginTop: 8, fontSize: 6 }}>Thank you for your business!</div>
									</div>
								) : (
									<div style={{ fontFamily: 'Arial, sans-serif' }}>
										<div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: 16, marginBottom: 24 }}>
											{storeInfo.logo && <img src={storeInfo.logo} alt="" style={{ maxHeight: 60, maxWidth: 120, objectFit: 'contain', marginBottom: 8 }} onError={e => { e.currentTarget.style.display = 'none' }} />}
											<h1 style={{ margin: 0, fontSize: 24, color: '#333' }}>{storeInfo.storeName.toUpperCase()}</h1>
											{storeInfo.address  && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>{storeInfo.address}</p>}
											{storeInfo.phone    && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>Phone: {storeInfo.phone}</p>}
											{storeInfo.email    && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>Email: {storeInfo.email}</p>}
											{storeInfo.taxNumber && <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>Tax #: {storeInfo.taxNumber}</p>}
										</div>
										<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
											<div style={{ fontSize: 13, lineHeight: 1.7 }}>
												<strong>Invoice #:</strong> {selectedInvoice.invoiceNo}<br />
												<strong>Date:</strong> {selectedInvoice.date ? new Date(selectedInvoice.date).toLocaleString() : '—'}
											</div>
											<div style={{ textAlign: 'right', fontSize: 13, lineHeight: 1.7 }}>
												<strong>Customer:</strong> {selectedInvoice.customer || 'Walk-in'}<br />
												{selectedInvoice.phone && <><strong>Phone:</strong> {selectedInvoice.phone}<br /></>}
												{selectedInvoice.customerAddress && <><strong>Address:</strong> {selectedInvoice.customerAddress}</>}
											</div>
										</div>
										<table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
											<thead>
												<tr style={{ background: '#f5f5f5' }}>
													{['SKU', 'Description', 'Qty', 'Unit Price', 'Discount', 'Amount'].map(h => (
														<th key={h} style={{ border: '1px solid #ddd', padding: 10, textAlign: h === 'Qty' || h === 'Unit Price' || h === 'Amount' ? 'right' : 'left', fontSize: 13 }}>{h}</th>
													))}
												</tr>
											</thead>
											<tbody>
												{(selectedInvoice.lines || []).map((l: any) => {
													const t = (l.qty || 0) * (l.price || 0)
													const a = t - t * (l.discount || 0) / 100
													return (
														<tr key={l.id}>
															<td style={{ border: '1px solid #ddd', padding: 10, fontSize: 13 }}>{l.sku}</td>
															<td style={{ border: '1px solid #ddd', padding: 10, fontSize: 13 }}>{l.name}</td>
															<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontSize: 13 }}>{l.qty}</td>
															<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontSize: 13 }}>{formatCurrency(l.price || 0, storeInfo.currency)}</td>
															<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontSize: 13 }}>{l.discount || 0}%</td>
															<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontSize: 13 }}>{formatCurrency(a, storeInfo.currency)}</td>
														</tr>
													)
												})}
											</tbody>
											<tfoot>
												{(() => {
													const sub = invSubtotal(selectedInvoice); const bd = selectedInvoice.billDiscount || 0; const da = (sub * bd) / 100
													return (<>
														<tr style={{ background: '#f9f9f9' }}>
															<td colSpan={5} style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontWeight: 'bold', fontSize: 13 }}>SUBTOTAL</td>
															<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontSize: 13 }}>{formatCurrency(sub, storeInfo.currency)}</td>
														</tr>
														{bd > 0 && <tr>
															<td colSpan={5} style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontWeight: 'bold', fontSize: 13 }}>BILL DISCOUNT ({bd}%)</td>
															<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right', fontSize: 13 }}>−{formatCurrency(da, storeInfo.currency)}</td>
														</tr>}
														<tr>
															<td colSpan={5} style={{ border: '1px solid #ddd', padding: 12, textAlign: 'right', fontWeight: 'bold', fontSize: 15 }}>TOTAL AMOUNT</td>
															<td style={{ border: '1px solid #ddd', padding: 12, textAlign: 'right', fontWeight: 'bold', fontSize: 15 }}>{formatCurrency(selectedInvoice.total || (sub - da), storeInfo.currency)}</td>
														</tr>
													</>)
												})()}
											</tfoot>
										</table>
										<div style={{ textAlign: 'center', fontSize: 12, color: '#999', marginTop: 16 }}>
											Thank you for your business! · Report generated by managify.online
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
