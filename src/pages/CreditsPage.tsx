import { useState, useEffect } from 'react'
import { db, Purchase, Item, StoreInfo } from '../storage'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export default function CreditsPage() {
	const [creditPurchases, setCreditPurchases] = useState<(Purchase & { item?: Item })[]>([])
	const [loading, setLoading] = useState(true)
	const [selectedPurchase, setSelectedPurchase] = useState<(Purchase & { item?: Item }) | null>(null)
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({ store_name: 'Managify', phone: '', address: '', email: '', website: '', tax_number: '', logo: '' })
	const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
	const [searchTerm, setSearchTerm] = useState('')

	useEffect(() => {
		const loadCredits = async () => {
			try {
				const [purchases, items, store] = await Promise.all([
					db.listPurchases(),
					db.listItems(),
					db.getStoreInfo()
				])
				setStoreInfo(store)
				
				const credits = purchases
					.filter(p => p.paymentType === 'credit')
					.map(p => ({ ...p, item: items.find(i => i.id === p.itemId) }))
					.sort((a, b) => {
						if (!a.creditDeadline) return 1
						if (!b.creditDeadline) return -1
						return new Date(a.creditDeadline).getTime() - new Date(b.creditDeadline).getTime()
					})
				
				setCreditPurchases(credits)
			} catch (error) {
				console.error('Error loading credits:', error)
			} finally {
				setLoading(false)
			}
		}
		loadCredits()
	}, [])

	const getDaysUntilDeadline = (deadline: string) => {
		const today = new Date()
		const deadlineDate = new Date(deadline)
		const diffTime = deadlineDate.getTime() - today.getTime()
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
	}

	const getStatusColor = (days: number) => {
		if (days < 0) return '#f44336' // Overdue - red
		if (days <= 7) return '#ff9800' // Due soon - orange
		return '#4caf50' // Safe - green
	}

	const nearDeadlineCount = creditPurchases.filter(p => 
		p.creditDeadline && getDaysUntilDeadline(p.creditDeadline) <= 7
	).length

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading credits...
			</div>
		)
	}

	return (
		<div className="card">
			<h2>Credit Purchases</h2>
			
			{nearDeadlineCount > 0 && (
				<div className="card" style={{ background: '#fff3cd', border: '1px solid #ffeaa7', marginBottom: 16 }}>
					<h3 style={{ color: '#856404', margin: '0 0 8px 0' }}>⚠️ Deadline Alert</h3>
					<p style={{ color: '#856404', margin: 0 }}>
						{nearDeadlineCount} credit purchase{nearDeadlineCount > 1 ? 's' : ''} due within 7 days
					</p>
				</div>
			)}

			<div className="form-grid" style={{ marginBottom: 16 }}>
				<div>
					<label>Search by Supplier or ID</label>
					<input 
						placeholder="Search supplier name or PO ID" 
						value={searchTerm} 
						onChange={e => setSearchTerm(e.target.value)} 
					/>
				</div>
				<div>
					<label>Filter by Payment Status</label>
					<select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as 'all' | 'paid' | 'unpaid')}>
						<option value="all">All Credits</option>
						<option value="paid">Paid</option>
						<option value="unpaid">Unpaid</option>
					</select>
				</div>
			</div>

			{(() => {
				const filteredPurchases = creditPurchases.filter(p => {
					// Payment filter
					let passesPaymentFilter = true
					if (paymentFilter === 'paid') passesPaymentFilter = p.isPaid || false
					if (paymentFilter === 'unpaid') passesPaymentFilter = !(p.isPaid || false)
					
					// Search filter
					let passesSearchFilter = true
					if (searchTerm) {
						const term = searchTerm.toLowerCase()
						const supplierMatch = (p.supplier || '').toLowerCase().includes(term)
						const idMatch = p.id.slice(-6).toLowerCase().includes(term)
						passesSearchFilter = supplierMatch || idMatch
					}
					
					return passesPaymentFilter && passesSearchFilter
				})

				if (filteredPurchases.length === 0) {
					return (
						<div className="card" style={{ textAlign: 'center', padding: '40px' }}>
							<h3>No {paymentFilter === 'all' ? 'Credit Purchases' : paymentFilter === 'paid' ? 'Paid Credits' : 'Unpaid Credits'}</h3>
							<p>{paymentFilter === 'all' ? 'All purchases have been made with debit payments' : `No ${paymentFilter} credit purchases found`}</p>
						</div>
					)
				}

				return (
						<table className="table">
							<thead>
								<tr>
									<th>PO #</th>
									<th>Supplier</th>
									<th>Amount</th>
									<th>Purchase Date</th>
									<th>Deadline</th>
									<th>Status</th>
									<th>Paid</th>
									<th>Action</th>
								</tr>
							</thead>
							<tbody>
								{filteredPurchases.map(p => {
							const days = p.creditDeadline ? getDaysUntilDeadline(p.creditDeadline) : null
							const amount = (p.quantity || 0) * (p.costPrice || 0)
							
							return (
								<tr key={p.id}>
									<td>{p.id.slice(-6)}</td>
									<td>{p.supplier || 'N/A'}</td>
									<td>price {amount.toFixed(2)}</td>
									<td>{p.date ? new Date(p.date).toLocaleDateString() : 'N/A'}</td>
									<td>{p.creditDeadline ? new Date(p.creditDeadline).toLocaleDateString() : 'No deadline'}</td>
									<td>
										{p.isPaid ? (
											<span className="badge" style={{ background: '#4caf50', color: 'white' }}>Paid</span>
										) : days !== null ? (
											<span 
												className="badge" 
												style={{ 
													background: getStatusColor(days),
													color: 'white'
												}}
											>
												{days < 0 ? `${Math.abs(days)} days overdue` : 
												 days === 0 ? 'Due today' : 
												 `${days} days left`}
											</span>
										) : (
											<span className="badge">No deadline</span>
										)}
									</td>
									<td style={{ textAlign: 'center' }}>
										<label style={{ 
											display: 'inline-flex', 
											alignItems: 'center', 
											cursor: 'pointer',
											position: 'relative'
										}}>
											<input 
												type="checkbox" 
												checked={p.isPaid || false}
												style={{
													width: '18px',
													height: '18px',
													accentColor: '#4caf50',
													cursor: 'pointer'
												}}
												onChange={async (e) => {
													try {
														await db.updatePurchase(p.id, { isPaid: e.target.checked })
														setCreditPurchases(prev => prev.map(purchase => 
															purchase.id === p.id ? { ...purchase, isPaid: e.target.checked } : purchase
														))
													} catch (error) {
														console.error('Error updating payment status:', error)
													}
												}}
											/>
										</label>
									</td>
									<td style={{ display: 'flex', gap: '4px' }}>
										<button 
											style={{ padding: '4px 8px', fontSize: '12px' }}
											onClick={() => setSelectedPurchase(p)}
										>
											View Bill
										</button>
										{!p.isPaid && (
											<button 
												style={{ padding: '4px 8px', fontSize: '12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '3px' }}
												onClick={async () => {
													try {
														await db.updatePurchase(p.id, { isPaid: true })
														setCreditPurchases(prev => prev.map(purchase => 
															purchase.id === p.id ? { ...purchase, isPaid: true } : purchase
														))
														alert(`Credit of ${amount.toFixed(2)} paid for ${p.supplier}`)
													} catch (error) {
														console.error('Error paying credit:', error)
														alert('Error paying credit')
													}
												}}
											>
												Pay Credit
											</button>
										)}
									</td>
								</tr>
							)
							})}
							</tbody>
						</table>
					)
				})()}

			{selectedPurchase && (
				<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
					<div className="card" style={{ width: '100%', maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
							<h3>Purchase Invoice</h3>
							<div>
								<button onClick={async () => {
									const el = document.getElementById('credit-bill-print')
									if (!el) return
									const canvas = await html2canvas(el)
									const imgData = canvas.toDataURL('image/png')
									const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
									const pageWidth = pdf.internal.pageSize.getWidth()
									const imgWidth = pageWidth
									const imgHeight = canvas.height * imgWidth / canvas.width
									pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
									pdf.save(`credit_purchase_${selectedPurchase?.id.slice(-6)}.pdf`)
								}} style={{ marginRight: 8 }}>Download</button>
								<button onClick={() => setSelectedPurchase(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
							</div>
						</div>
						<div id="credit-bill-print" style={{ fontFamily: 'Arial, sans-serif', padding: '20px', background: 'white', color: 'black', borderRadius: '8px' }}>
							<div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
								<h1 style={{ margin: '0', fontSize: '28px', color: '#333' }}>{storeInfo.store_name.toUpperCase()}</h1>
								{storeInfo.address && <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>{storeInfo.address}</p>}
								{storeInfo.phone && <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>Phone: {storeInfo.phone}</p>}
								<p style={{ margin: '10px 0 5px 0', fontSize: '14px', color: '#666' }}>Purchase Invoice</p>
							</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
								<div>
									<h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#333' }}>PURCHASE ORDER</h3>
									<div style={{ fontSize: '14px', lineHeight: '1.6' }}>
										<div><strong>PO #:</strong> {selectedPurchase.id.slice(-6)}</div>
										<div><strong>Date:</strong> {selectedPurchase.date ? new Date(selectedPurchase.date).toLocaleDateString() : 'N/A'}</div>
										<div><strong>Payment:</strong> Credit Purchase</div>
										{selectedPurchase.creditDeadline && <div><strong>Credit Deadline:</strong> {new Date(selectedPurchase.creditDeadline).toLocaleDateString()}</div>}
									</div>
								</div>
								<div style={{ textAlign: 'right' }}>
									<h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#333' }}>SUPPLIER</h3>
									<div style={{ fontSize: '14px', lineHeight: '1.6' }}>
										<div><strong>Name:</strong> {selectedPurchase.supplier || 'N/A'}</div>
										<div><strong>Phone:</strong> {selectedPurchase.supplierPhone || 'N/A'}</div>
									</div>
								</div>
							</div>
							<table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
								<thead>
									<tr style={{ background: '#f5f5f5' }}>
										<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>SKU</th>
										<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>Item Description</th>
										<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>Quantity</th>
										<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Unit Cost</th>
										<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Total Cost</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{selectedPurchase.item?.sku || 'N/A'}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{selectedPurchase.item?.name || 'Unknown'}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{selectedPurchase.quantity || 0}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>price {selectedPurchase.costPrice?.toFixed(2) || '0.00'}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>price {((selectedPurchase.quantity || 0) * (selectedPurchase.costPrice || 0)).toFixed(2)}</td>
									</tr>
								</tbody>
								<tfoot>
									<tr style={{ background: '#f9f9f9' }}>
										<td colSpan={4} style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>TOTAL COST</td>
										<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>price {((selectedPurchase.quantity || 0) * (selectedPurchase.costPrice || 0)).toFixed(2)}</td>
									</tr>
								</tfoot>
							</table>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}