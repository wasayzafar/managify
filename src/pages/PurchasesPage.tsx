import { useEffect, useMemo, useState } from 'react'
import { db, Item, Purchase, StoreInfo } from '../storage'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import { usePagination } from '../hooks/usePagination'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { loadCurrency, formatCurrency } from '../utils/currency'
import { getThermalPrintStyles, getPrintWindowSize, getPrintPageCSS, getPrintOrientation, getPrintSize } from '../utils/thermalPrintStyles'
import { StatCard } from '../ui/StatCard'
import {
	PiShoppingBagDuotone, PiMoneyDuotone, PiCreditCardDuotone, PiStorefrontDuotone,
	PiTagDuotone, PiPhoneDuotone, PiCalendarBlankDuotone, PiBarcodeDuotone, PiPlusDuotone,
	PiMagnifyingGlassDuotone, PiDotsThreeVerticalDuotone, PiPrinterDuotone, PiFilePdfDuotone,
	PiTrashDuotone, PiWarningCircleDuotone, PiWarningDuotone, PiCaretDownDuotone,
	PiCaretDoubleLeftDuotone, PiCaretLeftDuotone, PiCaretRightDuotone, PiCaretDoubleRightDuotone,
	PiDownloadDuotone,
} from 'react-icons/pi'

const fieldLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 } as const

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
	const [paymentFilter, setPaymentFilter] = useState<'all' | 'debit' | 'credit'>('all')
	const [searchTerm, setSearchTerm] = useState('')
	const [itemsPerPage, setItemsPerPage] = useState(10)
	const [openRowMenu, setOpenRowMenu] = useState<string | null>(null)
	const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null)
	const [deleting, setDeleting] = useState(false)
	const [formError, setFormError] = useState('')
	const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7))
	const [reportStart, setReportStart] = useState(() => new Date().toISOString().slice(0, 10))
	const [reportEnd, setReportEnd] = useState(() => new Date().toISOString().slice(0, 10))
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: 'Managify', phone: '', address: '', email: '', website: '', taxNumber: '', logo: '', currency: 'PKR' })
	const [loading, setLoading] = useState(true)
	const [submitting, setSubmitting] = useState(false)
	const [mobilePOS] = useState(() => localStorage.getItem('mobilePOS') === 'true')
	const [isMobilePhone, setIsMobilePhone] = useState(false)
	type ImeiPair = { imei1: string; imei2: string; warrantyTill: string }
	const [imeiPairs, setImeiPairs] = useState<ImeiPair[]>([])

	// Match SKUs case-insensitively and ignore stray whitespace — otherwise a
	// scanned/typed SKU that differs only in case or padding from an existing
	// item's SKU silently creates a duplicate item instead of recognizing it.
	const trimmedSku = sku.trim()
	const existing = trimmedSku ? items.find(i => i.sku.trim().toLowerCase() === trimmedSku.toLowerCase()) : undefined

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

	// Sync IMEI pair count with qty when mobile phone mode is active
	useEffect(() => {
		if (!isMobilePhone) return
		const n = Math.max(0, Number(qty) || 0)
		setImeiPairs(prev => {
			if (prev.length === n) return prev
			const arr = [...prev]
			while (arr.length < n) arr.push({ imei1: '', imei2: '', warrantyTill: '' })
			arr.length = n
			return arr
		})
	}, [qty, isMobilePhone])

	function updateImeiPair(index: number, field: 'imei1' | 'imei2' | 'warrantyTill', value: string) {
		setImeiPairs(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
	}

	const [scanEnabled, setScanEnabled] = useState(false)
	const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
	const { videoRef, isScanning, error: scanError } = useBarcodeScanner(code => setSku(code), scanEnabled && isMobile)

	const onSubmit = async () => {
		if (submitting) return
		setFormError('')
		const qtyNum = Number(qty || '0')
		if (!trimmedSku)             { setFormError('Please enter a SKU.'); return }
		if (!qtyNum || qtyNum <= 0)  { setFormError('Please enter a valid quantity.'); return }
		setSubmitting(true)
		try {
			let found = existing
			if (!found) {
				found = await db.createItem({
					sku: trimmedSku, name: newName || trimmedSku,
					price: newPrice ? Number(newPrice) : 0,
					costPrice: costPrice ? Number(costPrice) : 0,
				})
				setItems(await db.listItems())
			} else if (newPrice && Number(newPrice) !== found.price) {
				await db.updateItem(found.id, { price: Number(newPrice) })
				setItems(await db.listItems())
			}
			if (supplier && !suppliers.find(s => s.name === supplier)) {
				await db.createSupplier({ name: supplier, phone: supplierPhone || '', address: '' })
				setSuppliers(await db.listSuppliers())
			}
			const newPurchase = await db.createPurchase({
				itemId: found.id, qty: qtyNum,
				costPrice: Number(costPrice || '0'),
				supplier: supplier || 'Unknown',
				supplierPhone: supplierPhone || '',
				note: note || '',
				purchasedAt,
				paymentType,
				creditDeadline: paymentType === 'credit' ? creditDeadline : ''
			})
			// Save IMEIs if mobile phone purchase
			if (isMobilePhone && imeiPairs.length > 0) {
				const validPairs = imeiPairs.filter(p => p.imei1.trim())
				if (validPairs.length > 0) {
					await db.addImeis(validPairs.map(p => ({
						purchaseId: newPurchase.id,
						itemId: found.id,
						imei1: p.imei1.trim(),
						imei2: p.imei2.trim(),
						warrantyTill: p.warrantyTill || undefined
					})))
				}
			}
			await new Promise(r => setTimeout(r, 400))
			const [updatedPurchases, updatedItems] = await Promise.all([db.listPurchases(), db.listItems()])
			setRows(updatedPurchases); setItems(updatedItems)
			setSku(''); setQty('1'); setCostPrice(''); setSupplier(''); setSupplierPhone('')
			setNote(''); setNewName(''); setNewPrice(''); setShowSupplierDropdown(false)
			setPurchasedAt(new Date().toISOString().slice(0, 16))
			setIsMobilePhone(false); setImeiPairs([])
		} catch (err: any) {
			console.error('Error creating purchase:', err)
			setFormError('Could not save purchase. Please try again.')
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
		// jsPDF's built-in fonts only cover WinAnsi/Latin-1, not currency glyphs
		// like ₹ (INR) — those render as blank boxes. Fall back to the plain
		// ISO code for anything outside the safe ASCII symbols ($) so the
		// report never silently loses the currency on every price cell.
		const pdfSafeSymbol: Record<string, string> = { USD: '$', PKR: 'PKR', AED: 'AED', SAR: 'SAR' }
		const pdfCurrency = (amount: number) => {
			const symbol = pdfSafeSymbol[storeInfo.currency] ?? storeInfo.currency
			return symbol === '$' ? `$${amount.toFixed(2)}` : `${symbol} ${amount.toFixed(2)}`
		}

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
			{ label: 'Vendor', w: 30 }, { label: 'Payment', w: 22 },
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
			const cells = [r.date ? new Date(r.date).toLocaleDateString() : '—', item?.sku || '—', item?.name || 'Unknown', String(q), c ? pdfCurrency(c) : '—', t ? pdfCurrency(t) : '—', r.supplier || '—', r.paymentType === 'credit' ? 'Credit' : 'Debit']
			let x = startX; cols.forEach((col, ci) => { const text = pdf.splitTextToSize(cells[ci], col.w - 2)[0] || ''; pdf.text(text, x + 1, y + 4); x += col.w }); y += 6
		})

		y += 2; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
		pdf.text(`Total: ${filtered.length} purchases`, margin, y)
		pdf.text(`Total Cost: ${pdfCurrency(totalCost)}`, pageW - margin, y, { align: 'right' })

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

	async function confirmDeletePurchase() {
		if (!deleteTarget) return
		setDeleting(true)
		try {
			await db.deletePurchase(deleteTarget.id)
			const [p, i] = await Promise.all([db.listPurchases(), db.listItems()])
			setRows(p); setItems(i)
			setDeleteTarget(null)
		} catch (err: any) {
			alert('Error deleting purchase: ' + (err?.message || err))
		} finally {
			setDeleting(false)
		}
	}

	const stats = useMemo(() => {
		const totalPurchases = rows.length
		const totalSpend = rows.reduce((s, r) => s + (r.quantity || r.qty || 0) * (r.costPrice || 0), 0)
		const creditRows = rows.filter(r => r.paymentType === 'credit')
		const creditTotal = creditRows.reduce((s, r) => s + (r.quantity || r.qty || 0) * (r.costPrice || 0), 0)
		return { totalPurchases, totalSpend, creditTotal, creditCount: creditRows.length }
	}, [rows])

	const filteredRows = useMemo(() => {
		const term = searchTerm.trim().toLowerCase()
		return rows.filter(r => {
			if (paymentFilter !== 'all' && r.paymentType !== paymentFilter) return false
			if (!term) return true
			const item = items.find(i => i.id === r.itemId)
			return (item?.sku || '').toLowerCase().includes(term) || (item?.name || '').toLowerCase().includes(term) || (r.supplier || '').toLowerCase().includes(term)
		})
	}, [rows, items, paymentFilter, searchTerm])

	const pagination = usePagination({ data: filteredRows, itemsPerPage })
	useEffect(() => { pagination.goToPage(1) }, [searchTerm, paymentFilter, itemsPerPage])

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--text)' }}>
				Loading purchases...
			</div>
		)
	}

	return (
		<div>
			{/* ── Header ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
				<div>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Purchases</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>{stats.totalPurchases} purchase order{stats.totalPurchases === 1 ? '' : 's'} recorded · Press Ctrl + M to quick-add</p>
				</div>
			</div>

			{/* ── Summary cards ── */}
			<div className="dashboard-stats">
				<StatCard icon={<PiShoppingBagDuotone />} tint="accent" label="Total purchases" value={stats.totalPurchases} caption="All-time purchase orders" />
				<StatCard icon={<PiMoneyDuotone />} tint="accent" iconStyle={{ background: 'color-mix(in srgb, #8b5cf6 16%, var(--bg-elevated))', color: '#8b5cf6' }} label="Total spend" value={formatCurrency(stats.totalSpend, storeInfo.currency)} caption="Cost of goods purchased" />
				<StatCard icon={<PiCreditCardDuotone />} tint={stats.creditTotal > 0 ? 'warning' : 'neutral'} label="Credit owed" value={formatCurrency(stats.creditTotal, storeInfo.currency)} caption={`${stats.creditCount} unpaid credit purchase${stats.creditCount === 1 ? '' : 's'}`} captionColor={stats.creditTotal > 0 ? 'var(--warning)' : undefined} />
				<StatCard icon={<PiStorefrontDuotone />} tint="accent" label="Vendors" value={suppliers.length} caption="Active vendors on record" />
			</div>

			{/* ── Add Purchase ── */}
			<div className="card" style={{ opacity: submitting ? 0.7 : 1, pointerEvents: submitting ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
				<h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>
					Add Purchase
					{submitting && <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: 'var(--warning)' }}>Saving…</span>}
				</h3>
				<div className="form-grid">
					<div>
						<label style={fieldLabelStyle}>SKU</label>
						<div style={{ position: 'relative' }}>
							<PiTagDuotone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
							<input value={sku} onChange={e => setSku(e.target.value)} placeholder="Scan or enter SKU" autoFocus style={{ paddingLeft: 32 }} />
						</div>
					</div>
					<div>
						<label style={fieldLabelStyle}>Quantity</label>
						<input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty" />
					</div>
					<div>
						<label style={fieldLabelStyle}>Cost Price</label>
						<input type="number" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="Cost Price" />
					</div>
					<div>
						<label style={fieldLabelStyle}>Selling Price</label>
						<input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Selling Price" />
					</div>
					<div style={{ position: 'relative' }} data-supplier-dropdown>
						<label style={fieldLabelStyle}>Vendor</label>
						<div style={{ position: 'relative' }}>
							<PiStorefrontDuotone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
							<input value={supplier} onChange={e => setSupplier(e.target.value)} onFocus={() => setShowSupplierDropdown(true)} placeholder="Vendor name" style={{ paddingLeft: 32, paddingRight: 32 }} />
							<PiCaretDownDuotone style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 13, pointerEvents: 'none' }} />
						</div>
						{showSupplierDropdown && suppliers.length > 0 && (
							<div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px var(--overlay)', zIndex: 1000 }}>
								{suppliers.filter(s => s.name.toLowerCase().includes(supplier.toLowerCase())).map(s => (
									<button key={s.id} type="button"
										onMouseDown={() => { setSupplier(s.name); setSupplierPhone(s.phone); setShowSupplierDropdown(false) }}
										style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
										onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
										onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
									>
										<PiStorefrontDuotone style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
										<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
										{s.phone && <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{s.phone}</span>}
									</button>
								))}
							</div>
						)}
					</div>
					<div>
						<label style={fieldLabelStyle}>Vendor Phone</label>
						<div style={{ position: 'relative' }}>
							<input value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} placeholder="Phone" style={{ paddingRight: 34 }} />
							<PiPhoneDuotone style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
						</div>
					</div>
					<div>
						<label style={fieldLabelStyle}>Time of Purchase</label>
						<div style={{ position: 'relative' }}>
							<PiCalendarBlankDuotone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
							<input type="datetime-local" value={purchasedAt} onChange={e => setPurchasedAt(e.target.value)} style={{ paddingLeft: 32 }} />
						</div>
					</div>
					<div>
						<label style={fieldLabelStyle}>Note</label>
						<input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" />
					</div>

					{isMobile && (
						<div style={{ gridColumn: '1 / -1' }}>
							<label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
								<input type="checkbox" checked={scanEnabled} onChange={e => setScanEnabled(e.target.checked)} style={{ width: 'auto' }} />
								<PiBarcodeDuotone size={15} /> Enable Barcode Scanner
							</label>
							{scanEnabled && (
								<>
									<video ref={videoRef} style={{ width: '100%', maxHeight: 220, background: '#111', borderRadius: 12, marginTop: 8 }} muted playsInline />
									{scanError && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: 'var(--danger)', fontSize: 13 }}><PiWarningCircleDuotone size={15} /> {scanError}</div>}
									{isScanning && <div className="badge" style={{ marginTop: 8 }}>Scanner active — point camera at barcode</div>}
								</>
							)}
						</div>
					)}

					{sku && !existing && (
						<div>
							<label style={fieldLabelStyle}>Item Name <span style={{ color: 'var(--warning)', fontWeight: 400 }}>(new product)</span></label>
							<input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Item Name" />
						</div>
					)}

					{mobilePOS && (
						<div style={{ gridColumn: '1 / -1' }}>
							<label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
								<input
									type="checkbox"
									checked={isMobilePhone}
									style={{ width: 'auto', cursor: 'pointer', accentColor: 'var(--accent)' }}
									onChange={e => {
										const checked = e.target.checked
										setIsMobilePhone(checked)
										if (!checked) {
											setImeiPairs([])
										} else {
											const n = Math.max(0, Number(qty) || 0)
											setImeiPairs(Array.from({ length: n }, () => ({ imei1: '', imei2: '', warrantyTill: '' })))
										}
									}}
								/>
								<span style={{ fontWeight: 600, fontSize: 14 }}>Mobile Phone Purchase</span>
								{isMobilePhone && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— enter 2 IMEIs per unit</span>}
							</label>
						</div>
					)}
					{mobilePOS && isMobilePhone && imeiPairs.length > 0 && (
						<div style={{ gridColumn: '1 / -1' }}>
							<label style={{ display: 'block', marginBottom: 10, fontSize: 13, color: 'var(--text-muted)' }}>
								IMEI Numbers ({imeiPairs.length} {imeiPairs.length === 1 ? 'unit' : 'units'})
							</label>
							<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
								{imeiPairs.map((pair, i) => (
									<div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 150px', gap: 8, alignItems: 'end' }}>
										<span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, paddingBottom: 8 }}>Unit {i + 1}</span>
										<div>
											<label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>IMEI 1</label>
											<input
												placeholder="IMEI 1"
												value={pair.imei1}
												onChange={e => updateImeiPair(i, 'imei1', e.target.value)}
												style={{ fontFamily: 'monospace', width: '100%' }}
											/>
										</div>
										<div>
											<label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>IMEI 2</label>
											<input
												placeholder="IMEI 2"
												value={pair.imei2}
												onChange={e => updateImeiPair(i, 'imei2', e.target.value)}
												style={{ fontFamily: 'monospace', width: '100%' }}
											/>
										</div>
										<div>
											<label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Warranty Till</label>
											<input
												type="date"
												value={pair.warrantyTill}
												onChange={e => updateImeiPair(i, 'warrantyTill', e.target.value)}
												style={{ width: '100%' }}
											/>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					<div style={{ gridColumn: '1 / -1' }}>
						<label style={fieldLabelStyle}>Payment Type</label>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
							<button type="button" onClick={() => setPaymentType('debit')}
								style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, border: '1px solid', fontSize: 13, background: paymentType === 'debit' ? 'color-mix(in srgb, var(--success) 14%, var(--bg-elevated))' : 'transparent', color: 'var(--success)', borderColor: paymentType === 'debit' ? 'var(--success)' : 'var(--border-strong)', cursor: 'pointer', fontWeight: paymentType === 'debit' ? 700 : 500 }}
							><PiMoneyDuotone size={15} /> Debit Purchase</button>
							<button type="button" onClick={() => setPaymentType('credit')}
								style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, border: '1px solid', fontSize: 13, background: paymentType === 'credit' ? 'color-mix(in srgb, var(--warning) 14%, var(--bg-elevated))' : 'transparent', color: 'var(--warning)', borderColor: paymentType === 'credit' ? 'var(--warning)' : 'var(--border-strong)', cursor: 'pointer', fontWeight: paymentType === 'credit' ? 700 : 500 }}
							><PiCreditCardDuotone size={15} /> Credit Purchase</button>
							{paymentType === 'credit' && (
								<>
									<span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Due Date:</span>
									<input type="date" value={creditDeadline} onChange={e => setCreditDeadline(e.target.value)} style={{ fontSize: 13, width: 'auto' }} />
								</>
							)}
						</div>
					</div>

					{formError && (
						<div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontSize: 13 }}>
							<PiWarningCircleDuotone size={15} /> {formError}
						</div>
					)}

					<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
						<button onClick={onSubmit} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
							<PiPlusDuotone size={15} /> {submitting ? 'Adding…' : 'Add Purchase'}
						</button>
					</div>
				</div>
			</div>

			{/* ── Download Report ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Download Purchase Report</h3>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
					<div style={{ flex: 1, minWidth: 200 }}>
						<label style={fieldLabelStyle}>By Month</label>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} style={{ flex: 1 }} />
							<button className="secondary" onClick={downloadMonthPdf} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><PiFilePdfDuotone size={14} /> Download</button>
						</div>
					</div>
					<div style={{ flex: 2, minWidth: 280 }}>
						<label style={fieldLabelStyle}>By Date Range</label>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
							<input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
							<span style={{ color: 'var(--text-muted)' }}>to</span>
							<input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
							<button className="secondary" onClick={downloadDateRangePdf} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><PiFilePdfDuotone size={14} /> Download</button>
						</div>
					</div>
					<div style={{ display: 'flex', alignItems: 'flex-end' }}>
						<button className="secondary" onClick={downloadAllTimePdf} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PiDownloadDuotone size={14} /> All Time PDF</button>
					</div>
				</div>
			</div>

			{/* ── Purchase List ── */}
			<div className="card">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
						<div style={{ position: 'relative' }}>
							<PiMagnifyingGlassDuotone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
							<input
								type="text"
								placeholder="Search by SKU, item, or vendor…"
								value={searchTerm}
								onChange={e => setSearchTerm(e.target.value)}
								style={{ padding: '7px 10px 7px 32px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-sunken)', color: 'var(--text)', minWidth: 220, fontSize: 13 }}
							/>
						</div>
						<select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as 'all' | 'debit' | 'credit')} style={{ width: 'auto', fontSize: 13, padding: '6px 8px', borderRadius: 7 }}>
							<option value="all">All payments</option>
							<option value="debit">Debit</option>
							<option value="credit">Credit</option>
						</select>
						<span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Showing {pagination.currentData.length} of {pagination.totalItems} purchases</span>
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

				{pagination.currentData.length === 0 ? (
					<div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No purchases found</div>
				) : (
					<div style={{ overflowX: 'auto' }}>
						<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
							<thead>
								<tr style={{ background: 'var(--bg-sunken)' }}>
									{['Date', 'SKU', 'Item', 'Qty', 'Cost/Unit', 'Total', 'Vendor', 'Payment'].map(h => (
										<th key={h} style={{ padding: '10px 12px', textAlign: h === 'Qty' || h === 'Cost/Unit' || h === 'Total' ? 'right' : 'left', borderBottom: '2px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
									))}
									<th style={{ padding: '10px 12px', width: 40 }}></th>
								</tr>
							</thead>
							<tbody>
								{pagination.currentData.map(r => {
									const item = items.find(i => i.id === r.itemId)
									const q = r.quantity || r.qty || 0
									const total = q * (r.costPrice || 0)
									return (
										<tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}
											onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
											onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
											<td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
											<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item?.sku || '—'}</td>
											<td style={{ padding: '10px 12px', fontWeight: 500 }}>{item?.name || 'Unknown'}</td>
											<td style={{ padding: '10px 12px', textAlign: 'right' }}>{q}</td>
											<td style={{ padding: '10px 12px', textAlign: 'right' }}>{r.costPrice != null ? formatCurrency(r.costPrice, storeInfo.currency) : '—'}</td>
											<td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{total ? formatCurrency(total, storeInfo.currency) : '—'}</td>
											<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{r.supplier || '—'}</td>
											<td style={{ padding: '10px 12px' }}>
												<span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: r.paymentType === 'credit' ? 'var(--warning-bg)' : 'var(--success-bg)', color: r.paymentType === 'credit' ? 'var(--warning)' : 'var(--success)' }}>
													{r.paymentType === 'credit' ? 'Credit' : 'Debit'}
												</span>
											</td>
											<td style={{ padding: '10px 12px', textAlign: 'center', position: 'relative' }}>
												<div tabIndex={-1} onBlur={() => setTimeout(() => setOpenRowMenu(m => m === r.id ? null : m), 150)}>
													<button className="secondary" onClick={() => setOpenRowMenu(m => m === r.id ? null : r.id)} style={{ display: 'inline-flex', padding: 6, background: 'transparent', color: 'var(--text-muted)' }}>
														<PiDotsThreeVerticalDuotone size={16} />
													</button>
													{openRowMenu === r.id && (
														<div style={{ position: 'absolute', top: '100%', right: 8, marginTop: 2, minWidth: 160, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px var(--overlay)', zIndex: 100, overflow: 'hidden', textAlign: 'left' }}>
															<button
																onMouseDown={() => { printInvoice(r); setOpenRowMenu(null) }}
																style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
																onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
																onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
															><PiPrinterDuotone size={14} /> Print</button>
															<button
																onMouseDown={() => { downloadInvoicePdf(r); setOpenRowMenu(null) }}
																style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
																onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
																onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
															><PiFilePdfDuotone size={14} /> Download PDF</button>
															<button
																onMouseDown={() => { setDeleteTarget(r); setOpenRowMenu(null) }}
																style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: 13, cursor: 'pointer' }}
																onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
																onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
															><PiTrashDuotone size={14} /> Delete</button>
														</div>
													)}
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
							<h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Delete this purchase?</h3>
						</div>
						<p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
							Stock added by this purchase will be reduced automatically. This can't be undone.
						</p>
						<div className="form-actions">
							<button className="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
							<button onClick={confirmDeletePurchase} disabled={deleting} style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiTrashDuotone size={15} /> {deleting ? 'Deleting…' : 'Delete Purchase'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Hidden invoice divs for print/PDF — rendered off-screen */}
			<div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
				{pagination.currentData.map(r => {
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
									<strong>Vendor:</strong> {r.supplier || 'N/A'}<br />
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
