import { useState, useEffect } from 'react'
import { db, Purchase, Sale, Item, StoreInfo } from '../storage'
import { loadCurrency, formatCurrency } from '../utils/currency'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { getPrintWindowSize, getPrintPageCSS } from '../utils/thermalPrintStyles'
import { InvoiceHeader, InvoiceFooter, preloadBrandingLogos } from '../utils/invoiceHeader'

type Tab = 'purchase' | 'sale'

const getDaysUntil = (deadline: string) => {
	const diff = new Date(deadline).getTime() - new Date().getTime()
	return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const statusBadge = (days: number | null, isPaid: boolean) => {
	if (isPaid) return { label: 'Paid', bg: '#052e16', color: '#4ade80' }
	if (days === null) return { label: 'No deadline', bg: '#1e293b', color: '#94a3b8' }
	if (days < 0) return { label: `${Math.abs(days)}d overdue`, bg: '#450a0a', color: '#f87171' }
	if (days === 0) return { label: 'Due today', bg: '#451a03', color: '#fb923c' }
	if (days <= 7) return { label: `${days}d left`, bg: '#451a03', color: '#fb923c' }
	return { label: `${days}d left`, bg: '#052e16', color: '#4ade80' }
}

export default function CreditsPage() {
	const [tab, setTab] = useState<Tab>('purchase')
	const [loading, setLoading] = useState(true)
	const [currency, setCurrency] = useState('PKR')
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: 'Managify', phone: '', address: '', email: '', website: '', taxNumber: '', logo: '' })

	// Purchase credits
	const [creditPurchases, setCreditPurchases] = useState<(Purchase & { item?: Item })[]>([])
	const [selectedPurchase, setSelectedPurchase] = useState<(Purchase & { item?: Item }) | null>(null)

	// Sales credits
	const [creditSales, setCreditSales] = useState<(Sale & { item?: Item })[]>([])

	const [searchTerm, setSearchTerm] = useState('')
	const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('unpaid')

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

	// --- alert counts ---
	const purchaseAlerts = creditPurchases.filter(p => !p.isPaid && p.creditDeadline && getDaysUntil(p.creditDeadline) <= 7).length
	const saleAlerts = creditSales.filter(s => !s.isPaid && s.creditDeadline && getDaysUntil(s.creditDeadline) <= 7).length
	const totalAlerts = purchaseAlerts + saleAlerts

	// --- filtered lists ---
	const filteredPurchases = creditPurchases.filter(p => {
		const paid = filter === 'all' || (filter === 'paid' ? p.isPaid : !p.isPaid)
		const search = !searchTerm || (p.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) || p.id.slice(-6).includes(searchTerm)
		return paid && search
	})

	const filteredSales = creditSales.filter(s => {
		const paid = filter === 'all' || (filter === 'paid' ? s.isPaid : !s.isPaid)
		const search = !searchTerm || (s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.customerPhone || '').includes(searchTerm) || (s.invoiceNo || '').includes(searchTerm)
		return paid && search
	})

	if (loading) return (
		<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
			Loading credits...
		</div>
	)

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
					>{label}{key === 'purchase' && purchaseAlerts > 0 && <span style={{ marginLeft: 6, background: '#fb923c', color: '#1c0a00', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{purchaseAlerts}</span>}
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
					<option value="unpaid">Unpaid</option>
					<option value="all">All</option>
					<option value="paid">Paid</option>
				</select>
			</div>

			{/* â”€â”€ PURCHASE CREDITS â”€â”€ */}
			{tab === 'purchase' && (
				<>
					{filteredPurchases.length === 0 ? (
						<div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>No purchase credits found.</div>
					) : (
						<table className="table">
							<thead>
								<tr>
									<th>PO #</th>
									<th>Supplier</th>
									<th>Phone</th>
									<th>Item</th>
									<th>Amount</th>
									<th>Purchase Date</th>
									<th>Due Date</th>
									<th>Status</th>
									<th>Actions</th>
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
											<td>{p.supplier || 'â€”'}</td>
											<td>{p.supplierPhone || 'â€”'}</td>
											<td>{p.item?.name || 'â€”'}</td>
											<td>{formatCurrency(amount, currency)}</td>
											<td>{p.date ? new Date(p.date).toLocaleDateString() : 'â€”'}</td>
											<td>{p.creditDeadline ? new Date(p.creditDeadline).toLocaleDateString() : 'â€”'}</td>
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

			{/* â”€â”€ SALES CREDITS â”€â”€ */}
			{tab === 'sale' && (
				<>
					{filteredSales.length === 0 ? (
						<div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>No sales credits found.</div>
					) : (
						<table className="table">
							<thead>
								<tr>
									<th>Invoice #</th>
									<th>Customer</th>
									<th>Phone</th>
									<th>Amount</th>
									<th>Sale Date</th>
									<th>Due Date</th>
									<th>Status</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filteredSales.map(s => {
									const days = s.creditDeadline ? getDaysUntil(s.creditDeadline) : null
									const badge = statusBadge(days, s.isPaid || false)
									const amount = (s.quantity || 0) * (s.actualPrice || 0)
									return (
										<tr key={s.id}>
											<td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.invoiceNo || s.id.slice(-6)}</td>
											<td>{s.customerName || 'â€”'}</td>
											<td>{s.customerPhone || 'â€”'}</td>
											<td>{formatCurrency(amount, currency)}</td>
											<td>{s.date ? new Date(s.date).toLocaleDateString() : 'â€”'}</td>
											<td>{s.creditDeadline ? new Date(s.creditDeadline).toLocaleDateString() : 'â€”'}</td>
											<td><span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span></td>
											<td>
												{!s.isPaid && (
													<button
														style={{ fontSize: 12, padding: '3px 10px', background: '#4ade80', color: '#052e16', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
														onClick={async () => {
															await db.updateSale(s.id, { isPaid: true })
															setCreditSales(prev => prev.map(x => x.id === s.id ? { ...x, isPaid: true } : x))
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
									const imgWidth = pageWidth
									const imgHeight = canvas.height * imgWidth / canvas.width
									pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight)
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
									<div><strong>Date:</strong> {selectedPurchase.date ? new Date(selectedPurchase.date).toLocaleDateString() : 'â€”'}</div>
									<div><strong>Payment:</strong> Credit</div>
									{selectedPurchase.creditDeadline && <div><strong>Due Date:</strong> {new Date(selectedPurchase.creditDeadline).toLocaleDateString()}</div>}
									<div><strong>Status:</strong> {selectedPurchase.isPaid ? 'PAID' : 'UNPAID'}</div>
								</div>
								<div style={{ fontSize: 13, lineHeight: 1.7, textAlign: 'right' }}>
									<div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>SUPPLIER</div>
									<div><strong>{selectedPurchase.supplier || 'â€”'}</strong></div>
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
										<td style={{ border: '1px solid #ddd', padding: 10 }}>{selectedPurchase.item?.sku || 'â€”'}</td>
										<td style={{ border: '1px solid #ddd', padding: 10 }}>{selectedPurchase.item?.name || 'â€”'}</td>
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
