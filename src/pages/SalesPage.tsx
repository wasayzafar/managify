import { FormEvent, useState, useEffect } from 'react'
import { db, Item, Sale, StoreInfo } from '../storage'
import { Link } from 'react-router-dom'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export default function SalesPage() {
	const [sales, setSales] = useState<Sale[]>([])
	const [items, setItems] = useState<Item[]>([])

	const [sku, setSku] = useState('')
	const [qty, setQty] = useState('')
	const [loading, setLoading] = useState(true)
	const [scannerEnabled, setScannerEnabled] = useState(false)
	const [searchTerm, setSearchTerm] = useState('')
	const [dateFilter, setDateFilter] = useState('')

	const { videoRef, isScanning, error: scanError } = useBarcodeScanner(
		(code) => setSku(code),
		scannerEnabled
	)
	const [selectedSale, setSelectedSale] = useState<(Sale & { item?: Item, storeInfo?: any }) | null>(null)
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({
		storeName: 'Managify',
		phone: '',
		address: '',
		email: '',
		website: '',
		taxNumber: '',
		logo: ''
	})

	const item = items.find(i => i.sku === sku)

	useEffect(() => {
		const loadData = async () => {
			try {
				const [salesData, itemsData, storeData] = await Promise.all([
					db.listSales(),
					db.listItems(),
					db.getStoreInfo()
				])
				setSales(salesData)
				setItems(itemsData)
				setStoreInfo(storeData)
			} catch (error) {
				console.error('Error loading data:', error)
			} finally {
				setLoading(false)
			}
		}
		loadData()
	}, [])

	async function addLine(e: FormEvent) {
		e.preventDefault()
		if (!item) return
		const q = Number(qty || '0'); if (!q) return
		try {
			await db.createSale({ itemId: item.id, quantity: q, date: new Date().toISOString() })
			const salesData = await db.listSales()
			setSales(salesData)
			setSku(''); setQty('')
		} catch (error) {
			console.error('Error adding sale:', error)
		}
	}

	const downloadSalePdf = async () => {
		const el = document.getElementById('sale-bill-print')
		if (!el) return
		const canvas = await html2canvas(el)
		const imgData = canvas.toDataURL('image/png')
		const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
		const pageWidth = pdf.internal.pageSize.getWidth()
		const imgWidth = pageWidth
		const imgHeight = canvas.height * imgWidth / canvas.width
		pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
		pdf.save(`sale_${selectedSale?.id.slice(-6)}.pdf`)
	}

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading sales...
			</div>
		)
	}

	return (
		<div className="card">
			<h2>Sales</h2>


			<div className="form-grid" style={{ marginBottom: 16 }}>
				<input 
					placeholder="Search by Sale ID" 
					value={searchTerm} 
					onChange={e => setSearchTerm(e.target.value)} 
				/>
				<input 
					type="date" 
					value={dateFilter} 
					onChange={e => setDateFilter(e.target.value)}
					placeholder="Filter by date"
				/>
			</div>

			<div className="table-container">
				<table className="table">
					<thead>
						<tr>
							<th>Sale ID</th>
							<th>Item</th>
							<th>Quantity</th>
							<th>Date</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{sales.filter(s => {
							const matchesSearch = !searchTerm || s.id.toLowerCase().includes(searchTerm.toLowerCase())
							const matchesDate = !dateFilter || (s.date && new Date(s.date).toISOString().slice(0, 10) === dateFilter)
							return matchesSearch && matchesDate
						}).map(s => {
							const saleItem = items.find(i => i.id === s.itemId)
							return (
								<tr key={s.id}>
									<td>{s.id}</td>
									<td>{saleItem?.name || 'Unknown'}</td>
									<td>Qty: {s.quantity || 0}</td>
									<td>{s.date ? new Date(s.date).toLocaleString() : 'N/A'}</td>
									<td>
										<button 
											style={{ padding: '4px 8px', fontSize: '12px' }}
											onClick={() => setSelectedSale({ ...s, item: saleItem })}
										>
											View Bill
										</button>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>

			{selectedSale && (
				<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
					<div className="card" style={{ width: '100%', maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
							<h3>Sale Receipt</h3>
							<div>
								<button onClick={downloadSalePdf} style={{ marginRight: 8 }}>Download PDF</button>
								<button onClick={() => setSelectedSale(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
							</div>
						</div>
						<div id="sale-bill-print" style={{ fontFamily: 'Arial, sans-serif', padding: '40px', background: 'white', color: 'black', maxWidth: '800px', margin: '0 auto' }}>
							<div style={{ textAlign: 'center', marginBottom: '40px' }}>
								{(selectedSale.storeInfo?.logo || storeInfo.logo) && (
									<img 
										src={selectedSale.storeInfo?.logo || storeInfo.logo} 
										alt="Store Logo" 
										style={{ 
											maxHeight: '60px', 
											maxWidth: '120px', 
											objectFit: 'contain',
											marginBottom: '10px'
										}}
										onError={(e) => {
											e.currentTarget.style.display = 'none'
										}}
									/>
								)}
								<h1 style={{ margin: '0', fontSize: '36px', color: '#333', fontWeight: 'bold', letterSpacing: '2px' }}>{((selectedSale.storeInfo?.storeName || storeInfo.storeName) || 'MANAGIFY').toUpperCase()}</h1>
								{(selectedSale.storeInfo?.address || storeInfo.address) && (
									<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
										{selectedSale.storeInfo?.address || storeInfo.address}
									</p>
								)}
								{(selectedSale.storeInfo?.phone || storeInfo.phone) && (
									<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
										Phone: {selectedSale.storeInfo?.phone || storeInfo.phone}
									</p>
								)}
								{(selectedSale.storeInfo?.email || storeInfo.email) && (
									<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
										Email: {selectedSale.storeInfo?.email || storeInfo.email}
									</p>
								)}
								{(selectedSale.storeInfo?.website || storeInfo.website) && (
									<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
										Website: {selectedSale.storeInfo?.website || storeInfo.website}
									</p>
								)}
								{(selectedSale.storeInfo?.taxNumber || storeInfo.taxNumber) && (
									<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
										Tax #: {selectedSale.storeInfo?.taxNumber || storeInfo.taxNumber}
									</p>
								)}
								<hr style={{ border: 'none', borderTop: '2px solid #333', margin: '20px 0' }} />
							</div>
							<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
								<div>
									<h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#333', fontWeight: 'bold' }}>INVOICE</h3>
									<div style={{ fontSize: '14px', lineHeight: '1.8' }}>
										<div><strong>Invoice #:</strong> {selectedSale.invoiceNo || selectedSale.id.slice(-8)}</div>
										<div><strong>Date:</strong> {selectedSale.date ? new Date(selectedSale.date).toLocaleDateString() + ', ' + new Date(selectedSale.date).toLocaleTimeString() : 'N/A'}</div>
									</div>
								</div>
								<div style={{ textAlign: 'right' }}>
									<h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#333', fontWeight: 'bold' }}>BILL TO</h3>
									<div style={{ fontSize: '14px', lineHeight: '1.8' }}>
										<div><strong>Customer:</strong> {selectedSale.customerName || 'Walk-in Customer'}</div>
										<div><strong>Phone:</strong> {selectedSale.customerPhone || '-'}</div>
									</div>
								</div>
							</div>
							<table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', border: '1px solid #ddd' }}>
								<thead>
									<tr style={{ background: '#f8f9fa' }}>
										<th style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>SKU</th>
										<th style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>Item Description</th>
										<th style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>Qty</th>
										<th style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Unit Price</th>
										<th style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>Discount</th>
										<th style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Amount</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td style={{ border: '1px solid #ddd', padding: '15px', fontSize: '13px' }}>{selectedSale.item?.sku || selectedSale.id.slice(-15)}</td>
										<td style={{ border: '1px solid #ddd', padding: '15px', fontSize: '13px' }}>{selectedSale.item?.name || 'Unknown Item'}</td>
										<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'center', fontSize: '13px' }}>{selectedSale.quantity || 0}</td>
										<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '13px' }}>Price {(selectedSale.originalPrice || selectedSale.item?.price || 0).toFixed(2)}</td>
										<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'center', fontSize: '13px' }}>{selectedSale.itemDiscount || 0}%</td>
										<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '13px' }}>Price {((selectedSale.actualPrice || selectedSale.item?.price || 0) * (selectedSale.quantity || 0)).toFixed(2)}</td>
									</tr>
								</tbody>
							</table>
							<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
								<div style={{ minWidth: '300px' }}>
									<div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
										<span style={{ fontSize: '16px', fontWeight: 'bold' }}>SUBTOTAL</span>
										<span style={{ fontSize: '16px' }}>Price {(() => {
											const originalTotal = (selectedSale.originalPrice || selectedSale.item?.price || 0) * (selectedSale.quantity || 0)
											const itemDiscountAmount = (originalTotal * (selectedSale.itemDiscount || 0)) / 100
											return (originalTotal - itemDiscountAmount).toFixed(2)
										})()}</span>
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
										<span style={{ fontSize: '16px', fontWeight: 'bold' }}>BILL DISCOUNT ({selectedSale.billDiscount || 0}%)</span>
										<span style={{ fontSize: '16px' }}>Price {(() => {
											const originalTotal = (selectedSale.originalPrice || selectedSale.item?.price || 0) * (selectedSale.quantity || 0)
											const itemDiscountAmount = (originalTotal * (selectedSale.itemDiscount || 0)) / 100
											const subtotal = originalTotal - itemDiscountAmount
											const billDiscountAmount = (subtotal * (selectedSale.billDiscount || 0)) / 100
											return billDiscountAmount.toFixed(2)
										})()}</span>
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderTop: '2px solid #333', marginTop: '10px' }}>
										<span style={{ fontSize: '18px', fontWeight: 'bold' }}>TOTAL AMOUNT</span>
										<span style={{ fontSize: '18px', fontWeight: 'bold' }}>Price {((selectedSale.actualPrice || selectedSale.item?.price || 0) * (selectedSale.quantity || 0)).toFixed(2)}</span>
									</div>
								</div>
							</div>
							<div style={{ textAlign: 'center', marginTop: '50px', fontSize: '14px', color: '#666' }}>
								<p style={{ margin: '5px 0' }}>Thank you for your business!</p>
								<p style={{ margin: '5px 0' }}>For any queries, please contact us.</p>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
