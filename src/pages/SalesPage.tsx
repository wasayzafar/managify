import { FormEvent, useState, useEffect } from 'react'
import { db, Item, Sale, StoreInfo } from '../storage'
import { Link } from 'react-router-dom'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { getThermalPrintStyles, isThermalPrinting } from '../utils/thermalPrintStyles'

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
					placeholder="Search by Invoice No" 
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
							<th>Invoice No</th>
							<th>Total Amount</th>
							<th>Date</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{sales.filter(s => {
							const matchesSearch = !searchTerm || (s.invoiceNo && s.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase())) || s.id.toLowerCase().includes(searchTerm.toLowerCase())
							const matchesDate = !dateFilter || (s.date && new Date(s.date).toISOString().slice(0, 10) === dateFilter)
							return matchesSearch && matchesDate
						}).map(s => {
							const saleItem = items.find(i => i.id === s.itemId)
							return (
								<tr key={s.id}>
									<td>{s.invoiceNo || s.id.slice(-6)}</td>
									<td>Price {((s.actualPrice || saleItem?.price || 0) * (s.quantity || 0)).toFixed(2)}</td>
									<td>{s.date ? new Date(s.date).toLocaleString() : 'N/A'}</td>
									<td style={{ display: 'flex', gap: '4px' }}>
										<button 
											style={{ padding: '4px 8px', fontSize: '12px' }}
											onClick={() => setSelectedSale({ ...s, item: saleItem })}
										>
											View Bill
										</button>
										<button 
											style={{ padding: '4px 8px', fontSize: '12px', background: '#f44336', color: 'white' }}
											onClick={async () => {
												if (window.confirm('Are you sure you want to return this sale? This will add the quantity back to inventory.')) {
													try {
														// Add quantity back to inventory via purchase
														await db.createPurchase({
															itemId: s.itemId || '',
															qty: s.quantity || 1,
															costPrice: 0,
															supplier: 'RETURN',
															supplierPhone: '',
															paymentType: 'debit',
															creditDeadline: '',
															date: new Date().toISOString(),
															note: `Return for sale ${s.invoiceNo || s.id.slice(-6)}`
														})
														// Delete the sale from cloud storage
														await db.deleteSale(s.id)
														// Remove the sale from the list
														setSales(prev => prev.filter(sale => sale.id !== s.id))
														alert('Sale returned successfully. Quantity added back to inventory.')
													} catch (error) {
														console.error('Error returning sale:', error)
														alert('Error returning sale')
													}
												}
											}}
										>
											Return
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
								<button onClick={async () => {
									const el = document.getElementById('sale-bill-print')
									if (!el) return
									
									// Convert images to base64
									const images = el.querySelectorAll('img')
									for (const img of images) {
										try {
											const canvas = document.createElement('canvas')
											const ctx = canvas.getContext('2d')
											canvas.width = img.naturalWidth || img.width
											canvas.height = img.naturalHeight || img.height
											ctx?.drawImage(img, 0, 0)
											img.src = canvas.toDataURL('image/png')
										} catch (e) {
											console.warn('Could not convert image to base64:', e)
										}
									}
									
									const w = window.open('', 'PRINT', 'height=650,width=900,top=100,left=150')
									if (!w) return
									w.document.write('<html><head><title>Sale Receipt</title>')
									w.document.write('<style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;} table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style>')
									w.document.write('</head><body>')
									w.document.write(el.innerHTML)
									w.document.write('</body></html>')
									w.document.close()
									w.focus()
									w.print()
									w.close()
								}} style={{ marginRight: 8 }}>Print</button>
								<button onClick={downloadSalePdf} style={{ marginRight: 8 }}>Download PDF</button>
								<button onClick={() => setSelectedSale(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
							</div>
						</div>
						<div id="sale-bill-print" style={getThermalPrintStyles().container}>
							{isThermalPrinting() ? (
								<div style={{ fontFamily: 'Arial, sans-serif', fontSize: '8px', lineHeight: '1.1', padding: '5px' }}>
									<div style={{ textAlign: 'center', marginBottom: '8px' }}>
										{(selectedSale.storeInfo?.logo || storeInfo.logo) && (
											<img src={selectedSale.storeInfo?.logo || storeInfo.logo} alt="Logo" style={{ maxHeight: '20px', marginBottom: '3px' }} />
										)}
										<div style={{ fontWeight: 'bold', fontSize: '10px' }}>{((selectedSale.storeInfo?.storeName || storeInfo.storeName) || 'MANAGIFY').toUpperCase()}</div>
										{(selectedSale.storeInfo?.phone || storeInfo.phone) && <div>Phone: {selectedSale.storeInfo?.phone || storeInfo.phone}</div>}
										{(selectedSale.storeInfo?.email || storeInfo.email) && <div>Email: {selectedSale.storeInfo?.email || storeInfo.email}</div>}
										{(selectedSale.storeInfo?.address || storeInfo.address) && <div>{selectedSale.storeInfo?.address || storeInfo.address}</div>}
										{(selectedSale.storeInfo?.taxNumber || storeInfo.taxNumber) && <div>Tax#: {selectedSale.storeInfo?.taxNumber || storeInfo.taxNumber}</div>}
									</div>
									<hr style={{ border: 'none', borderTop: '1px solid #000', margin: '5px 0' }} />
									<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
										<div><strong>INVOICE</strong></div>
										<div><strong>BILL TO</strong></div>
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '7px' }}>
										<div>
											<div>Invoice #: {selectedSale.invoiceNo || selectedSale.id.slice(-8)}</div>
											<div>Date: {selectedSale.date ? new Date(selectedSale.date).toLocaleDateString() : 'N/A'}</div>
										</div>
										<div style={{ textAlign: 'right' }}>
											<div>Customer: {selectedSale.customerName || 'Walk-in'}</div>
											<div>Phone: {selectedSale.customerPhone || '-'}</div>
										</div>
									</div>
									<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7px', marginBottom: '5px' }}>
										<thead>
											<tr style={{ borderBottom: '1px solid #000' }}>
												<th style={{ textAlign: 'left', padding: '1px' }}>Article</th>
												<th style={{ textAlign: 'left', padding: '1px' }}>Item Description</th>
												<th style={{ textAlign: 'center', padding: '1px' }}>Qty</th>
												<th style={{ textAlign: 'right', padding: '1px' }}>Unit Price</th>
												<th style={{ textAlign: 'center', padding: '1px' }}>Discount</th>
												<th style={{ textAlign: 'right', padding: '1px' }}>Amount</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td style={{ padding: '1px' }}>{selectedSale.item?.id?.slice(-6) || selectedSale.itemId?.slice(-6) || 'N/A'}</td>
												<td style={{ padding: '1px' }}>{selectedSale.item?.name || 'Unknown Item'}</td>
												<td style={{ textAlign: 'center', padding: '1px' }}>{selectedSale.quantity || 0}</td>
												<td style={{ textAlign: 'right', padding: '1px' }}>Price {(selectedSale.originalPrice || selectedSale.item?.price || 0).toFixed(2)}</td>
												<td style={{ textAlign: 'center', padding: '1px' }}>{selectedSale.itemDiscount || 0}%</td>
												<td style={{ textAlign: 'right', padding: '1px' }}>Price {((selectedSale.actualPrice || selectedSale.item?.price || 0) * (selectedSale.quantity || 0)).toFixed(2)}</td>
											</tr>
										</tbody>
									</table>
									<div style={{ borderTop: '1px solid #000', paddingTop: '3px' }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px' }}>
											<span>SUBTOTAL</span>
											<span>Price {(() => {
												const originalTotal = (selectedSale.originalPrice || selectedSale.item?.price || 0) * (selectedSale.quantity || 0)
												const itemDiscountAmount = (originalTotal * (selectedSale.itemDiscount || 0)) / 100
												return (originalTotal - itemDiscountAmount).toFixed(2)
											})()}</span>
										</div>
										{(selectedSale.billDiscount || 0) > 0 && (
											<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px' }}>
												<span>BILL DISCOUNT ({selectedSale.billDiscount || 0}%)</span>
												<span>Price {(() => {
													const originalTotal = (selectedSale.originalPrice || selectedSale.item?.price || 0) * (selectedSale.quantity || 0)
													const itemDiscountAmount = (originalTotal * (selectedSale.itemDiscount || 0)) / 100
													const subtotal = originalTotal - itemDiscountAmount
													const billDiscountAmount = (subtotal * (selectedSale.billDiscount || 0)) / 100
													return billDiscountAmount.toFixed(2)
												})()}</span>
											</div>
										)}
										<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '2px', marginTop: '2px' }}>
											<span>TOTAL AMOUNT</span>
											<span>Price {((selectedSale.actualPrice || selectedSale.item?.price || 0) * (selectedSale.quantity || 0)).toFixed(2)}</span>
										</div>
									</div>
									<div style={{ textAlign: 'center', marginTop: '8px', fontSize: '6px' }}>
										<div>Thank you for your business!</div>
										<div>For any queries, please contact us.</div>
									</div>
								</div>
							) : (
								<>
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
							</>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
