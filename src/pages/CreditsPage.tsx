import React, { useState, useEffect, useMemo } from 'react'
import { db, Purchase, Sale, Item, StoreInfo } from '../storage'
import { loadCurrency, formatCurrency } from '../utils/currency'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { getPrintWindowSize, getPrintPageCSS } from '../utils/thermalPrintStyles'
import { InvoiceHeader, InvoiceFooter, preloadBrandingLogos } from '../utils/invoiceHeader'
import { FiDownload, FiCheck, FiEdit2, FiUser, FiPhone, FiDollarSign, FiX } from 'react-icons/fi'

type Tab = 'purchase' | 'sale'

const getDaysUntil = (deadline: string) =>
	Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)

const statusBadge = (days: number | null, isPaid: boolean, isSale = false, paidAmount = 0, total = 0) => {
	if (isPaid) return { label: isSale ? 'Returned' : 'Paid', bg: '#052e16', color: '#4ade80' }
	if (isSale && paidAmount > 0 && paidAmount < total)
		return { label: 'Partial', bg: '#292200', color: '#fbbf24' }
	if (days === null) return { label: 'No deadline', bg: '#1e293b', color: '#94a3b8' }
	if (days < 0) return { label: `${Math.abs(days)}d overdue`, bg: '#450a0a', color: '#f87171' }
	if (days === 0) return { label: 'Due today', bg: '#451a03', color: '#fb923c' }
	if (days <= 7) return { label: `${days}d left`, bg: '#451a03', color: '#fb923c' }
	return { label: `${days}d left`, bg: '#052e16', color: '#4ade80' }
}

type CreditSale = Sale & { item?: Item }

type InvoiceCredit = {
	invoiceKey: string
	invoiceNo: string
	customerName: string
	customerPhone: string
	date: string
	creditDeadline?: string
	isPaid: boolean
	totalAmount: number
	creditAmount?: number
	paidAmount: number
	saleIds: string[]
}

export default function CreditsPage() {
	const [tab, setTab] = useState<Tab>('purchase')
	const [loading, setLoading] = useState(true)
	const [currency, setCurrency] = useState('PKR')
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: 'Managify', phone: '', address: '', email: '', website: '', taxNumber: '', logo: '' })

	const [creditPurchases, setCreditPurchases] = useState<(Purchase & { item?: Item })[]>([])
	const [selectedPurchase, setSelectedPurchase] = useState<(Purchase & { item?: Item }) | null>(null)
	const [creditSales, setCreditSales] = useState<CreditSale[]>([])

	const [searchTerm, setSearchTerm] = useState('')
	const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all')

	// Inline credit amount editing
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingVal, setEditingVal] = useState('')

	// Partial payment
	const [paymentId, setPaymentId] = useState<string | null>(null)
	const [paymentVal, setPaymentVal] = useState('')
	const [paymentSaving, setPaymentSaving] = useState(false)

	useEffect(() => { loadAll() }, [])

	async function loadAll() {
		setLoading(true)
		try {
			const [purchases, sales, items, store] = await Promise.all([
				db.listPurchases(), db.listSales(), db.listItems(), db.getStoreInfo()
			])
			setStoreInfo(store)
			setCurrency(await loadCurrency())
			preloadBrandingLogos().catch(console.warn)

			setCreditPurchases(
				purchases
					.filter(p => p.paymentType === 'credit')
					.map(p => ({ ...p, item: items.find(i => i.id === p.itemId) }))
					.sort((a, b) => {
						if (!a.creditDeadline) return 1
						if (!b.creditDeadline) return -1
						return new Date(a.creditDeadline).getTime() - new Date(b.creditDeadline).getTime()
					})
			)
			setCreditSales(
				sales
					.filter(s => s.paymentType === 'credit')
					.map(s => ({ ...s, item: items.find(i => i.id === s.itemId) }))
					.sort((a, b) => {
						if (!a.creditDeadline) return 1
						if (!b.creditDeadline) return -1
						return new Date(a.creditDeadline).getTime() - new Date(b.creditDeadline).getTime()
					})
			)
		} catch (err) {
			console.error('Error loading credits:', err)
		} finally {
			setLoading(false)
		}
	}

	// Collapse per-item sale rows into invoice-level records
	const invoiceCredits = useMemo<InvoiceCredit[]>(() => {
		const map = new Map<string, InvoiceCredit>()
		for (const s of creditSales) {
			const key = s.invoiceNo || s.id
			if (!map.has(key)) {
				map.set(key, {
					invoiceKey: key,
					invoiceNo: s.invoiceNo || s.id.slice(-6),
					customerName: s.customerName || 'Unknown',
					customerPhone: s.customerPhone || '',
					date: s.date || '',
					creditDeadline: s.creditDeadline,
					isPaid: s.isPaid || false,
					totalAmount: (s.quantity || 0) * (s.actualPrice || 0),
					creditAmount: s.creditAmount,
					paidAmount: s.paidAmount || 0,
					saleIds: [s.id],
				})
			} else {
				const inv = map.get(key)!
				inv.totalAmount += (s.quantity || 0) * (s.actualPrice || 0)
				if (s.creditAmount !== undefined) inv.creditAmount = s.creditAmount
				if (s.paidAmount) inv.paidAmount = s.paidAmount // first record holds it
				inv.saleIds.push(s.id)
				if (!s.isPaid) inv.isPaid = false
			}
		}
		return [...map.values()].sort((a, b) => {
			if (!a.creditDeadline) return 1
			if (!b.creditDeadline) return -1
			return new Date(a.creditDeadline).getTime() - new Date(b.creditDeadline).getTime()
		})
	}, [creditSales])

	function getInvoiceTotal(inv: InvoiceCredit) {
		return inv.creditAmount ?? inv.totalAmount
	}
	function getInvoiceRemaining(inv: InvoiceCredit) {
		return Math.max(0, getInvoiceTotal(inv) - inv.paidAmount)
	}

	const purchaseAlerts = creditPurchases.filter(p => !p.isPaid && p.creditDeadline && getDaysUntil(p.creditDeadline) <= 7).length
	const saleAlerts = invoiceCredits.filter(inv => !inv.isPaid && inv.creditDeadline && getDaysUntil(inv.creditDeadline) <= 7).length
	const totalAlerts = purchaseAlerts + saleAlerts

	const filteredPurchases = creditPurchases.filter(p => {
		const paid = filter === 'all' || (filter === 'paid' ? p.isPaid : !p.isPaid)
		const search = !searchTerm || (p.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) || p.id.slice(-6).includes(searchTerm)
		return paid && search
	})

	const filteredInvoices = invoiceCredits.filter(inv => {
		const paid = filter === 'all' || (filter === 'paid' ? inv.isPaid : !inv.isPaid)
		const search = !searchTerm
			|| inv.customerName.toLowerCase().includes(searchTerm.toLowerCase())
			|| inv.customerPhone.includes(searchTerm)
			|| inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase())
		return paid && search
	})

	const customerGroups = useMemo(() => {
		const map = new Map<string, { name: string; phone: string; invoices: InvoiceCredit[] }>()
		for (const inv of filteredInvoices) {
			const key = `${inv.customerName}||${inv.customerPhone}`
			if (!map.has(key)) map.set(key, { name: inv.customerName, phone: inv.customerPhone, invoices: [] })
			map.get(key)!.invoices.push(inv)
		}
		return [...map.values()].sort((a, b) => {
			const aOut = a.invoices.reduce((s, i) => s + getInvoiceRemaining(i), 0)
			const bOut = b.invoices.reduce((s, i) => s + getInvoiceRemaining(i), 0)
			return bOut - aOut
		})
	}, [filteredInvoices])

	async function saveEditedAmount(inv: InvoiceCredit) {
		const val = parseFloat(editingVal)
		if (!isNaN(val) && val > 0) {
			await db.updateSale(inv.saleIds[0], { creditAmount: val })
			setCreditSales(prev => prev.map(s => s.id === inv.saleIds[0] ? { ...s, creditAmount: val } : s))
		}
		setEditingId(null)
	}

	async function markReturned(inv: InvoiceCredit) {
		await Promise.all(inv.saleIds.map(id => db.updateSale(id, { isPaid: true })))
		setCreditSales(prev => prev.map(s => inv.saleIds.includes(s.id) ? { ...s, isPaid: true } : s))
	}

	async function addPayment(inv: InvoiceCredit) {
		const amount = parseFloat(paymentVal)
		if (isNaN(amount) || amount <= 0) return
		setPaymentSaving(true)
		try {
			const newPaid = inv.paidAmount + amount
			const total = getInvoiceTotal(inv)
			const fullyPaid = newPaid >= total
			await db.updateSale(inv.saleIds[0], { paidAmount: newPaid, ...(fullyPaid ? { isPaid: true } : {}) })
			if (fullyPaid && inv.saleIds.length > 1)
				await Promise.all(inv.saleIds.slice(1).map(id => db.updateSale(id, { isPaid: true })))
			setCreditSales(prev => prev.map(s => {
				if (s.id === inv.saleIds[0]) return { ...s, paidAmount: newPaid, ...(fullyPaid ? { isPaid: true } : {}) }
				if (fullyPaid && inv.saleIds.includes(s.id)) return { ...s, isPaid: true }
				return s
			}))
			setPaymentId(null)
			setPaymentVal('')
		} finally {
			setPaymentSaving(false)
		}
	}

	function downloadCustomerReport(name: string, phone: string, invoices: InvoiceCredit[]) {
		const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
		const pageW = 210, m = 18

		pdf.setFontSize(17); pdf.setFont('helvetica', 'bold')
		pdf.text(storeInfo.storeName || 'Managify', pageW / 2, 22, { align: 'center' })
		pdf.setFontSize(10); pdf.setFont('helvetica', 'normal')
		if (storeInfo.phone) pdf.text(storeInfo.phone, pageW / 2, 29, { align: 'center' })
		if (storeInfo.address) pdf.text(storeInfo.address, pageW / 2, 34, { align: 'center' })

		pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
		pdf.text('CREDIT LEDGER REPORT', pageW / 2, 43, { align: 'center' })
		pdf.setLineWidth(0.5); pdf.line(m, 46, pageW - m, 46)

		let y = 54
		pdf.setFontSize(10)
		pdf.setFont('helvetica', 'bold'); pdf.text('Customer:', m, y)
		pdf.setFont('helvetica', 'normal'); pdf.text(name, m + 24, y); y += 7
		if (phone) {
			pdf.setFont('helvetica', 'bold'); pdf.text('Phone:', m, y)
			pdf.setFont('helvetica', 'normal'); pdf.text(phone, m + 24, y); y += 7
		}
		pdf.setFont('helvetica', 'bold'); pdf.text('Generated:', m, y)
		pdf.setFont('helvetica', 'normal'); pdf.text(new Date().toLocaleDateString(), m + 24, y); y += 10

		pdf.setFillColor(240, 240, 240)
		pdf.rect(m, y - 5, pageW - m * 2, 8, 'F')
		pdf.setFontSize(9); pdf.setFont('helvetica', 'bold')
		const cols = [m, 40, 76, 108, 134, 158, 177]
		const headers = ['Invoice #', 'Date', 'Total', 'Paid', 'Remaining', 'Status']
		headers.forEach((h, i) => pdf.text(h, cols[i], y))
		y += 3; pdf.line(m, y, pageW - m, y); y += 6

		pdf.setFont('helvetica', 'normal')
		let totalOut = 0, totalPaid = 0, totalReturned = 0

		for (const inv of invoices) {
			const total = getInvoiceTotal(inv)
			const paid = inv.paidAmount
			const remaining = getInvoiceRemaining(inv)
			if (inv.isPaid) totalReturned += total
			else { totalOut += remaining; totalPaid += paid }

			const days = inv.creditDeadline ? getDaysUntil(inv.creditDeadline) : null
			const badge = statusBadge(days, inv.isPaid, true, paid, total)
			pdf.text(inv.invoiceNo, cols[0], y)
			pdf.text(inv.date ? new Date(inv.date).toLocaleDateString() : '-', cols[1], y)
			pdf.text(formatCurrency(total, currency), cols[2], y)
			pdf.text(formatCurrency(paid, currency), cols[3], y)
			pdf.text(formatCurrency(remaining, currency), cols[4], y)
			pdf.text(badge.label, cols[5], y)
			y += 7
			if (y > 270) { pdf.addPage(); y = 20 }
		}

		y += 2; pdf.setLineWidth(0.4); pdf.line(m, y, pageW - m, y); y += 7

		const tCol = 110, vCol = 175
		pdf.setFontSize(10)
		pdf.setFont('helvetica', 'normal')
		pdf.text('Total Collected:', tCol, y)
		pdf.text(formatCurrency(totalPaid + totalReturned, currency), vCol, y, { align: 'right' }); y += 7
		pdf.setFont('helvetica', 'bold')
		pdf.setFillColor(255, 235, 235)
		pdf.rect(tCol - 2, y - 5, pageW - m - tCol + 2, 8, 'F')
		pdf.text('Total Outstanding:', tCol, y)
		pdf.text(formatCurrency(totalOut, currency), vCol, y, { align: 'right' }); y += 12

		pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(120)
		pdf.text(`${storeInfo.storeName} · ${storeInfo.phone || ''} · ${storeInfo.website || ''}`, pageW / 2, 285, { align: 'center' })
		pdf.save(`credit_report_${name.replace(/\s+/g, '_')}.pdf`)
	}

	if (loading) return (
		<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
			Loading credits...
		</div>
	)

	const s = {
		amtCell: { fontSize: 13, fontWeight: 600 } as React.CSSProperties,
		paid: { color: '#4ade80' } as React.CSSProperties,
		remaining: { color: '#f87171' } as React.CSSProperties,
		muted: { color: '#6b7a8d', fontSize: 11 } as React.CSSProperties,
	}

	return (
		<div className="card">
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
				<h2 style={{ margin: 0 }}>Credits</h2>
				{totalAlerts > 0 && (
					<span style={{ background: '#451a03', color: '#fb923c', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
						{totalAlerts} due within 7 days
					</span>
				)}
			</div>

			{/* Tabs */}
			<div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #243245' }}>
				{([['purchase', 'Purchase Credits'], ['sale', 'Sales Credits']] as [Tab, string][]).map(([key, label]) => (
					<button
						key={key}
						onClick={() => setTab(key)}
						style={{ padding: '8px 24px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontWeight: tab === key ? 700 : 400, fontSize: 14, background: tab === key ? '#2263ff' : 'transparent', color: tab === key ? 'white' : '#8899aa', borderBottom: tab === key ? '2px solid #2263ff' : 'none' }}
					>
						{label}
						{key === 'purchase' && purchaseAlerts > 0 && <span style={{ marginLeft: 6, background: '#fb923c', color: '#1c0a00', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{purchaseAlerts}</span>}
						{key === 'sale' && saleAlerts > 0 && <span style={{ marginLeft: 6, background: '#fb923c', color: '#1c0a00', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{saleAlerts}</span>}
					</button>
				))}
			</div>

			{/* Filters */}
			<div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
				<input
					placeholder={tab === 'purchase' ? 'Search supplier or PO #' : 'Search customer, phone, invoice #'}
					value={searchTerm}
					onChange={e => setSearchTerm(e.target.value)}
					style={{ flex: 1, minWidth: 200 }}
				/>
				<select value={filter} onChange={e => setFilter(e.target.value as any)} style={{ minWidth: 130 }}>
					<option value="all">All</option>
					<option value="unpaid">Pending</option>
					<option value="paid">Returned / Paid</option>
				</select>
			</div>

			{/* ── PURCHASE CREDITS ── */}
			{tab === 'purchase' && (
				<>
					{filteredPurchases.length === 0 ? (
						<div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>No purchase credits found.</div>
					) : (
						<table className="table">
							<thead>
								<tr>
									<th>PO #</th><th>Supplier</th><th>Phone</th><th>Item</th>
									<th>Amount</th><th>Purchase Date</th><th>Due Date</th><th>Status</th><th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filteredPurchases.map(p => {
									const days = p.creditDeadline ? getDaysUntil(p.creditDeadline) : null
									const amount = (p.quantity || p.qty || 0) * (p.costPrice || 0)
									const badge = statusBadge(days, p.isPaid || false)
									return (
										<tr key={p.id}>
											<td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.id.slice(-6)}</td>
											<td>{p.supplier || '—'}</td>
											<td>{p.supplierPhone || '—'}</td>
											<td>{p.item?.name || '—'}</td>
											<td>{formatCurrency(amount, currency)}</td>
											<td>{p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
											<td>{p.creditDeadline ? new Date(p.creditDeadline).toLocaleDateString() : '—'}</td>
											<td><span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span></td>
											<td style={{ display: 'flex', gap: 4 }}>
												<button style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setSelectedPurchase(p)}>View</button>
												{!p.isPaid && (
													<button
														style={{ fontSize: 12, padding: '3px 10px', background: '#4ade80', color: '#052e16', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
														onClick={async () => {
															await db.updatePurchase(p.id, { isPaid: true })
															setCreditPurchases(prev => prev.map(x => x.id === p.id ? { ...x, isPaid: true } : x))
														}}
													>Mark Paid</button>
												)}
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					)}
				</>
			)}

			{/* ── SALES CREDITS ── */}
			{tab === 'sale' && (
				<>
					{/* Summary bar */}
					{invoiceCredits.length > 0 && (
						<div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
							{[
								{ label: 'Total Customers', value: new Set(invoiceCredits.map(i => i.customerName)).size, color: '#60a5fa', isNum: true },
								{ label: 'Outstanding', value: formatCurrency(invoiceCredits.reduce((sum, i) => sum + getInvoiceRemaining(i), 0), currency), color: '#f87171', isNum: false },
								{ label: 'Collected', value: formatCurrency(invoiceCredits.reduce((sum, i) => sum + i.paidAmount, 0), currency), color: '#4ade80', isNum: false },
							].map(stat => (
								<div key={stat.label} style={{ background: '#0d1521', border: '1px solid #1a2a3a', borderRadius: 10, padding: '10px 18px', minWidth: 150 }}>
									<div style={{ fontSize: 11, color: '#6b7a8d', marginBottom: 3 }}>{stat.label}</div>
									<div style={{ fontSize: 16, fontWeight: 700, color: stat.color }}>{stat.value}</div>
								</div>
							))}
						</div>
					)}

					{customerGroups.length === 0 ? (
						<div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>No sales credits found.</div>
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
							{customerGroups.map(group => {
								const outstanding = group.invoices.reduce((sum, i) => sum + getInvoiceRemaining(i), 0)
								const collected = group.invoices.reduce((sum, i) => sum + i.paidAmount, 0)
								return (
									<div key={group.name + group.phone} style={{ border: '1px solid #1a2a3a', borderRadius: 12, overflow: 'hidden' }}>
										{/* Customer header */}
										<div style={{ background: '#0d1521', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
												<div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a2a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', flexShrink: 0 }}>
													<FiUser size={16} />
												</div>
												<div>
													<div style={{ fontWeight: 700, fontSize: 15, color: '#e8eef5' }}>{group.name}</div>
													{group.phone && (
														<div style={{ fontSize: 12, color: '#6b7a8d', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
															<FiPhone size={11} /> {group.phone}
														</div>
													)}
												</div>
											</div>
											<div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
												{collected > 0 && (
													<div style={{ textAlign: 'right' }}>
														<div style={{ fontSize: 11, color: '#6b7a8d' }}>Collected</div>
														<div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>{formatCurrency(collected, currency)}</div>
													</div>
												)}
												{outstanding > 0 && (
													<div style={{ textAlign: 'right' }}>
														<div style={{ fontSize: 11, color: '#6b7a8d' }}>Outstanding</div>
														<div style={{ fontSize: 15, fontWeight: 700, color: '#f87171' }}>{formatCurrency(outstanding, currency)}</div>
													</div>
												)}
												<button
													onClick={() => downloadCustomerReport(group.name, group.phone, group.invoices)}
													style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#1a2a4a', border: '1px solid #2a3a5a', borderRadius: 8, color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
												>
													<FiDownload size={13} /> PDF Report
												</button>
											</div>
										</div>

										{/* Invoices table */}
										<div style={{ overflowX: 'auto' }}>
											<table className="table" style={{ margin: 0 }}>
												<thead>
													<tr>
														<th>Invoice #</th>
														<th>Date</th>
														<th>Total Credit</th>
														<th>Amount Paid</th>
														<th>Remaining</th>
														<th>Due Date</th>
														<th>Status</th>
														<th>Actions</th>
													</tr>
												</thead>
												<tbody>
													{group.invoices.map(inv => {
														const total = getInvoiceTotal(inv)
														const remaining = getInvoiceRemaining(inv)
														const days = inv.creditDeadline ? getDaysUntil(inv.creditDeadline) : null
														const badge = statusBadge(days, inv.isPaid, true, inv.paidAmount, total)
														const isPaying = paymentId === inv.invoiceKey

														return (
															<React.Fragment key={inv.invoiceKey}>
																<tr style={{ background: isPaying ? '#0a111a' : undefined }}>
																	<td style={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.invoiceNo}</td>
																	<td style={s.muted}>{inv.date ? new Date(inv.date).toLocaleDateString() : '—'}</td>

																	{/* Total Credit - editable */}
																	<td>
																		{editingId === inv.invoiceKey ? (
																			<div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
																				<input
																					value={editingVal}
																					onChange={e => setEditingVal(e.target.value)}
																					onBlur={() => saveEditedAmount(inv)}
																					onKeyDown={e => { if (e.key === 'Enter') saveEditedAmount(inv); if (e.key === 'Escape') setEditingId(null) }}
																					autoFocus
																					style={{ width: 90, padding: '2px 6px', fontSize: 13 }}
																				/>
																				<FiX size={13} style={{ cursor: 'pointer', color: '#6b7a8d' }} onClick={() => setEditingId(null)} />
																			</div>
																		) : (
																			<span
																				onClick={() => { if (!inv.isPaid) { setEditingId(inv.invoiceKey); setEditingVal(String(total)) } }}
																				style={{ ...s.amtCell, cursor: inv.isPaid ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
																				title={inv.isPaid ? '' : 'Click to edit credit amount'}
																			>
																				{formatCurrency(total, currency)}
																				{!inv.isPaid && <FiEdit2 size={11} style={{ opacity: 0.35 }} />}
																			</span>
																		)}
																	</td>

																	{/* Paid */}
																	<td>
																		<span style={{ ...s.amtCell, ...s.paid }}>
																			{inv.paidAmount > 0 ? formatCurrency(inv.paidAmount, currency) : <span style={s.muted}>—</span>}
																		</span>
																	</td>

																	{/* Remaining */}
																	<td>
																		<span style={{ ...s.amtCell, ...(inv.isPaid ? s.paid : remaining > 0 ? s.remaining : s.paid) }}>
																			{inv.isPaid ? formatCurrency(0, currency) : formatCurrency(remaining, currency)}
																		</span>
																	</td>

																	<td style={s.muted}>{inv.creditDeadline ? new Date(inv.creditDeadline).toLocaleDateString() : '—'}</td>

																	<td>
																		<span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: badge.bg, color: badge.color }}>
																			{badge.label}
																		</span>
																	</td>

																	<td>
																		{!inv.isPaid && (
																			<div style={{ display: 'flex', gap: 6 }}>
																				<button
																					onClick={() => { setPaymentId(isPaying ? null : inv.invoiceKey); setPaymentVal('') }}
																					style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 10px', background: isPaying ? '#1a2a1a' : '#052e16', color: '#4ade80', border: '1px solid #166534', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
																				>
																					<FiDollarSign size={12} /> {isPaying ? 'Cancel' : 'Add Payment'}
																				</button>
																				{remaining === 0 && (
																					<button
																						onClick={() => markReturned(inv)}
																						style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 10px', background: '#052e16', color: '#4ade80', border: '1px solid #166534', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
																					>
																						<FiCheck size={12} /> Mark Returned
																					</button>
																				)}
																			</div>
																		)}
																	</td>
																</tr>

																{/* Payment input row */}
																{isPaying && (
																	<tr>
																		<td colSpan={8} style={{ background: '#081018', padding: '12px 16px', borderTop: '1px solid #1a2a3a' }}>
																			<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
																				<span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Payment received:</span>
																				<input
																					type="number"
																					min="0"
																					placeholder="Enter amount"
																					value={paymentVal}
																					onChange={e => setPaymentVal(e.target.value)}
																					onKeyDown={e => e.key === 'Enter' && addPayment(inv)}
																					autoFocus
																					style={{ width: 130, padding: '6px 10px', fontSize: 14, fontWeight: 600 }}
																				/>
																				<button
																					onClick={() => addPayment(inv)}
																					disabled={paymentSaving || !paymentVal}
																					style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', background: '#166534', color: '#4ade80', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
																				>
																					<FiCheck size={14} /> {paymentSaving ? 'Saving…' : 'Save Payment'}
																				</button>
																				<span style={{ fontSize: 12, color: '#6b7a8d' }}>
																					Remaining after: <strong style={{ color: '#f87171' }}>
																						{formatCurrency(Math.max(0, remaining - (parseFloat(paymentVal) || 0)), currency)}
																					</strong>
																				</span>
																			</div>
																		</td>
																	</tr>
																)}
															</React.Fragment>
														)
													})}
												</tbody>
											</table>
										</div>
									</div>
								)
							})}
						</div>
					)}
				</>
			)}

			{/* Purchase invoice modal */}
			{selectedPurchase && (
				<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
					<div className="card" style={{ width: '100%', maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
							<h3>Purchase Invoice</h3>
							<div style={{ display: 'flex', gap: 8 }}>
								<button onClick={() => {
									const el = document.getElementById('credit-bill-print')
									if (!el) return
									const { width, height } = getPrintWindowSize()
									const w = window.open('', 'PRINT', `height=${height},width=${width},top=100,left=150`)
									if (!w) return
									w.document.write(`<html><head><title>Purchase Invoice</title><style>${getPrintPageCSS()} body{margin:0;padding:20px;font-family:Arial,sans-serif;} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body>`)
									w.document.write(el.innerHTML)
									w.document.write('</body></html>')
									w.document.close(); w.focus(); w.print(); w.close()
								}}>Print</button>
								<button onClick={async () => {
									const el = document.getElementById('credit-bill-print')
									if (!el) return
									const canvas = await html2canvas(el)
									const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
									const pageWidth = pdf.internal.pageSize.getWidth()
									const imgHeight = canvas.height * pageWidth / canvas.width
									pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, imgHeight)
									pdf.save(`purchase_credit_${selectedPurchase.id.slice(-6)}.pdf`)
								}}>Download PDF</button>
								<button className="secondary" onClick={() => setSelectedPurchase(null)}>Close</button>
							</div>
						</div>
						<div id="credit-bill-print" style={{ background: 'white', color: 'black', padding: 24, borderRadius: 8, fontFamily: 'Arial, sans-serif' }}>
							<InvoiceHeader storeInfo={storeInfo} width={600} />
							<p style={{ margin: '-16px 0 20px', textAlign: 'center', fontSize: 13, color: '#444', fontWeight: 600 }}>PURCHASE CREDIT INVOICE</p>
							<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
								<div style={{ fontSize: 13, lineHeight: 1.7 }}>
									<div><strong>PO #:</strong> {selectedPurchase.id.slice(-6)}</div>
									<div><strong>Date:</strong> {selectedPurchase.date ? new Date(selectedPurchase.date).toLocaleDateString() : '—'}</div>
									<div><strong>Payment:</strong> Credit</div>
									{selectedPurchase.creditDeadline && <div><strong>Due Date:</strong> {new Date(selectedPurchase.creditDeadline).toLocaleDateString()}</div>}
									<div><strong>Status:</strong> {selectedPurchase.isPaid ? 'PAID' : 'UNPAID'}</div>
								</div>
								<div style={{ fontSize: 13, lineHeight: 1.7, textAlign: 'right' }}>
									<div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>SUPPLIER</div>
									<div><strong>{selectedPurchase.supplier || '—'}</strong></div>
									{selectedPurchase.supplierPhone && <div>Phone: {selectedPurchase.supplierPhone}</div>}
									{selectedPurchase.supplierAddress && <div>Address: {selectedPurchase.supplierAddress}</div>}
								</div>
							</div>
							<table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
								<thead>
									<tr style={{ background: '#f5f5f5' }}>
										<th style={{ border: '1px solid #ddd', padding: 10, textAlign: 'left' }}>SKU</th>
										<th style={{ border: '1px solid #ddd', padding: 10, textAlign: 'left' }}>Item</th>
										<th style={{ border: '1px solid #ddd', padding: 10, textAlign: 'center' }}>Qty</th>
										<th style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right' }}>Unit Cost</th>
										<th style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right' }}>Total</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td style={{ border: '1px solid #ddd', padding: 10 }}>{selectedPurchase.item?.sku || '—'}</td>
										<td style={{ border: '1px solid #ddd', padding: 10 }}>{selectedPurchase.item?.name || '—'}</td>
										<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'center' }}>{selectedPurchase.quantity || selectedPurchase.qty || 0}</td>
										<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right' }}>{formatCurrency(selectedPurchase.costPrice || 0, currency)}</td>
										<td style={{ border: '1px solid #ddd', padding: 10, textAlign: 'right' }}>{formatCurrency((selectedPurchase.quantity || selectedPurchase.qty || 0) * (selectedPurchase.costPrice || 0), currency)}</td>
									</tr>
								</tbody>
								<tfoot>
									<tr style={{ background: '#f9f9f9' }}>
										<td colSpan={4} style={{ border: '1px solid #ddd', padding: 12, textAlign: 'right', fontWeight: 700, fontSize: 15 }}>TOTAL DUE</td>
										<td style={{ border: '1px solid #ddd', padding: 12, textAlign: 'right', fontWeight: 700, fontSize: 15 }}>{formatCurrency((selectedPurchase.quantity || selectedPurchase.qty || 0) * (selectedPurchase.costPrice || 0), currency)}</td>
									</tr>
								</tfoot>
							</table>
							<InvoiceFooter storeInfo={storeInfo} />
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
