import { useEffect, useRef, useState } from 'react'
import { db, Item, Purchase, StoreInfo } from '../storage'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { auth } from '../firebase'

export default function PurchasesPage() {
	const [rows, setRows] = useState<Purchase[]>([])
	const [items, setItems] = useState<Item[]>([])
	const [suppliers, setSuppliers] = useState<any[]>([])
	const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
	const [sku, setSku] = useState('')
	const [qty, setQty] = useState('1')
	const [costPrice, setCostPrice] = useState('')
	const [supplier, setSupplier] = useState('')
	const [supplierPhone, setSupplierPhone] = useState('')
	const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 16))
	const [note, setNote] = useState('')
	const [paymentType, setPaymentType] = useState<'debit' | 'credit'>('debit')
	const [creditDeadline, setCreditDeadline] = useState('')
	const [newName, setNewName] = useState('')
	const [newPrice, setNewPrice] = useState('')
	const [newCostPrice, setNewCostPrice] = useState('')
	const [showAllPurchases, setShowAllPurchases] = useState(false)
	const [paymentFilter, setPaymentFilter] = useState<'all' | 'debit' | 'credit'>('all')
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({
		storeName: 'Managify',
		phone: '',
		address: '',
		email: '',
		website: '',
		taxNumber: '',
		logo: ''
	})
	const [loading, setLoading] = useState(true)
	const existing = items.find(i => i.sku === sku)

	// Hide dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement
			if (showSupplierDropdown && !target.closest('[data-supplier-dropdown]')) {
				setShowSupplierDropdown(false)
			}
		}
		document.addEventListener('click', handleClickOutside)
		return () => document.removeEventListener('click', handleClickOutside)
	}, [showSupplierDropdown])

	// Load data
	useEffect(() => {
		const loadData = async () => {
			try {
				const [purchasesData, itemsData, storeData, suppliersData] = await Promise.all([
					db.listPurchases(),
					db.listItems(),
					db.getStoreInfo(),
					db.listSuppliers()
				])
				setRows(purchasesData)
				setItems(itemsData)
				setStoreInfo(storeData)
				setSuppliers(suppliersData)
			} catch (error) {
				console.error('Error loading data:', error)
			} finally {
				setLoading(false)
			}
		}
		loadData()
	}, [])

	// Keyboard shortcut for submit
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === 'm') {
				e.preventDefault()
				onSubmit()
			}
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [sku, qty, costPrice, supplier, supplierPhone, purchasedAt, note, paymentType, creditDeadline, newName, newPrice])

	// scanner
	const [scanEnabled, setScanEnabled] = useState(false)
	const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
	const { videoRef, isScanning, error: scanError } = useBarcodeScanner(
		(code) => setSku(code),
		scanEnabled && isMobile
	)

	const onSubmit = async () => {
		console.log('Form submitted with:', { sku, qty, costPrice, supplier })
		console.log('Current user ID:', auth.currentUser?.uid)
		const qtyNum = Number(qty || '0')
		if (!qtyNum) {
			console.log('No quantity provided')
			alert('Please enter a quantity')
			return
		}
		if (!sku) {
			console.log('No SKU provided')
			alert('Please enter a SKU')
			return
		}
		try {
			let found = existing
			if (!found) {
				console.log('Creating new item for SKU:', sku)
				// Auto-create item if SKU not found
				const selling = newPrice ? Number(newPrice) : 0
				const name = newName || sku
				found = await db.createItem({ sku, name, price: selling })
				console.log('Created item:', found)
				console.log('Created item for user:', auth.currentUser?.uid)
				const updatedItems = await db.listItems()
				console.log('Items list after creation:', updatedItems.length, 'Contains new item?', updatedItems.some(i => i.id === found.id))
				setItems(updatedItems)
			} else if (newPrice && Number(newPrice) !== found.price) {
				// Update selling price if provided and different
				await db.updateItem(found.id, { price: Number(newPrice) })
				const updatedItems = await db.listItems()
				setItems(updatedItems)
			}
			// Auto-create supplier if not exists
			if (supplier && !suppliers.find(s => s.name === supplier)) {
				const supplierData: any = { 
					name: supplier, 
					phone: supplierPhone || '', 
					address: '' 
				}
				await db.createSupplier(supplierData)
				const updatedSuppliers = await db.listSuppliers()
				setSuppliers(updatedSuppliers)
			}
			console.log('Creating purchase for item:', found.id)
			const purchaseData = { 
				itemId: found.id, 
				qty: qtyNum, 
				costPrice: Number(costPrice || '0'),
				supplier: supplier || 'Unknown',
				supplierPhone: supplierPhone || '',
				note: note || '',
				purchasedAt,
				paymentType,
				creditDeadline: paymentType === 'credit' ? creditDeadline : ''
			}
			console.log('Purchase data:', purchaseData)
			const result = await db.createPurchase(purchaseData)
			console.log('Purchase created:', result)
			// Small delay to ensure database sync
			await new Promise(resolve => setTimeout(resolve, 500))
			// Refresh both items and purchases lists
			const [updatedPurchases, updatedItems] = await Promise.all([
				db.listPurchases(),
				db.listItems()
			])
			console.log('Updated purchases:', updatedPurchases.length, 'Updated items:', updatedItems.length)
			console.log('Newly created item in list?', updatedItems.find(i => i.id === found.id))
			console.log('Newly created purchase in list?', updatedPurchases.find(p => p.id === result.id))
			setRows(updatedPurchases)
			setItems(updatedItems)
			// Clear form fields
			setSku(''); setQty('1'); setCostPrice(''); setSupplier(''); setSupplierPhone(''); setNote(''); setNewName(''); setNewPrice(''); setShowSupplierDropdown(false)
			// Auto-update time for next purchase
			setPurchasedAt(new Date().toISOString().slice(0, 16))
			alert('Purchase added successfully!')
		} catch (error) {
			console.error('Error creating purchase:', error)
			alert('Error creating purchase: ' + error.message)
		}
	}

	async function downloadPdf(row: Purchase & { item?: Item }) {
		const id = `purch-invoice-${row.id}`
		const el = document.getElementById(id)
		if (!el) return
		const canvas = await html2canvas(el)
		const imgData = canvas.toDataURL('image/png')
		const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
		const pageWidth = pdf.internal.pageSize.getWidth()
		const imgWidth = pageWidth
		const imgHeight = canvas.height * imgWidth / canvas.width
		pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
		pdf.save(`purchase_${row.item?.sku || row.id}.pdf`)
	}

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading purchases...
			</div>
		)
	}

	return (
		<div className="card">
			<h2>Purchases<p>To Add (Ctrl + M)</p></h2>
			<div className="card">
				<h3>Add Purchase</h3>
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
						<input 
							value={supplier} 
							onChange={e => setSupplier(e.target.value)} 
							onFocus={() => setShowSupplierDropdown(true)}
							placeholder="Supplier" 
						/>
						{showSupplierDropdown && suppliers.length > 0 && (
							<div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto', zIndex: 1000, color: 'black' }}>
								{suppliers.filter(s => s.name.toLowerCase().includes(supplier.toLowerCase())).map(s => (
									<div 
										key={s.id} 
										style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
										onClick={() => {
											setSupplier(s.name)
											setSupplierPhone(s.phone)
											setShowSupplierDropdown(false)
										}}
										onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
										onMouseLeave={e => e.currentTarget.style.background = 'white'}
									>
										<div style={{ fontWeight: 'bold' }}>{s.name}</div>
										<div style={{ fontSize: '12px', color: '#666' }}>{s.phone}</div>
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
							<label>Enable Scanner</label>
							<input type="checkbox" checked={scanEnabled} onChange={e => setScanEnabled(e.target.checked)} />
							{scanEnabled && (
								<>
									<video ref={videoRef} style={{ width: '100%', maxHeight: 220, background: '#111', borderRadius: 12, marginTop: 8 }} muted playsInline />
									{scanError && <div className="badge" style={{ background: '#ff4444', marginTop: 8 }}>{scanError}</div>}
									{isScanning && <div className="badge" style={{ marginTop: 8 }}>Scanner active - point camera at barcode</div>}
								</>
							)}
						</div>
					)}
					{sku && !existing && (
						<div>
							<label>Item Name (new product)</label>
							<input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Item Name" />
						</div>
					)}
					<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
						<button onClick={onSubmit}>Add Purchase</button>
					</div>
				</div>
			</div>

			<div className="card">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
					<h3>Recent Purchases</h3>
					<button onClick={() => setShowAllPurchases(!showAllPurchases)}>
						{showAllPurchases ? 'Hide All Purchases' : 'Show All Purchases'}
					</button>
				</div>
				
				{showAllPurchases && (
					<>
						<div className="form-grid" style={{ marginBottom: 16 }}>
							<div>
								<label>Filter by Payment Type</label>
								<select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as 'all' | 'debit' | 'credit')}>
									<option value="all">All Purchases</option>
									<option value="debit">Debit Purchases</option>
									<option value="credit">Credit Purchases</option>
								</select>
							</div>
						</div>

					</>
				)}
				{(() => {
					const filteredRows = showAllPurchases ? 
						rows.filter(r => paymentFilter === 'all' || r.paymentType === paymentFilter) : 
						rows.slice(0, 5)
					
					if (showAllPurchases && filteredRows.length === 0) {
						return (
							<div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
								No {paymentFilter === 'all' ? '' : paymentFilter} purchases found
							</div>
						)
					}
					
					return filteredRows.map(r => {
					const item = items.find(i => i.id === r.itemId)
					return (
					<div key={r.id} className="card" style={{ padding: 12 }}>
						<div id={`purch-invoice-${r.id}`} style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px', background: 'white', color: 'black' }}>
							<div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
								{storeInfo.logo && (
									<img 
										src={storeInfo.logo} 
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
								<h1 style={{ margin: '0', fontSize: '28px', color: '#333' }}>
									{storeInfo.storeName.toUpperCase()}
								</h1>
								{storeInfo.address && (
									<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
										{storeInfo.address}
									</p>
								)}
								{storeInfo.phone && (
									<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
										Phone: {storeInfo.phone}
									</p>
								)}
								{storeInfo.email && (
									<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
										Email: {storeInfo.email}
									</p>
								)}
								{storeInfo.website && (
									<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
										Website: {storeInfo.website}
									</p>
								)}
								{storeInfo.taxNumber && (
									<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
										Tax #: {storeInfo.taxNumber}
									</p>
								)}
								<p style={{ margin: '10px 0 5px 0', fontSize: '14px', color: '#666' }}>Purchase Invoice</p>
							</div>
							
							<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
								<div>
									<h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#333' }}>PURCHASE ORDER</h3>
									<div style={{ fontSize: '14px', lineHeight: '1.6' }}>
										<div><strong>PO #:</strong> {r.id.slice(-6)}</div>
										<div><strong>Date:</strong> {r.date ? new Date(r.date).toLocaleDateString() : 'N/A'}</div>
										<div><strong>Payment:</strong> {r.paymentType === 'credit' ? 'Credit Purchase' : 'Debit Purchase'}</div>
										{r.paymentType === 'credit' && r.creditDeadline && (
											<div><strong>Credit Deadline:</strong> {new Date(r.creditDeadline).toLocaleDateString()}</div>
										)}
									</div>
								</div>
								<div style={{ textAlign: 'right' }}>
									<h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#333' }}>SUPPLIER</h3>
									<div style={{ fontSize: '14px', lineHeight: '1.6' }}>
										<div><strong>Name:</strong> {r.supplier || 'N/A'}</div>
										<div><strong>Phone:</strong> {r.supplierPhone || 'N/A'}</div>
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
										<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{item?.sku || 'N/A'}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{item?.name || 'Unknown'}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{r.quantity || r.qty || 0}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>{r.costPrice ? `Amount ${r.costPrice.toFixed(2)}` : 'N/A'}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>{r.costPrice && (r.quantity || r.qty) ? `Amount ${(r.costPrice * (r.quantity || r.qty || 0)).toFixed(2)}` : 'N/A'}</td>
									</tr>
								</tbody>
								<tfoot>
									<tr style={{ background: '#f9f9f9' }}>
										<td colSpan={4} style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>TOTAL COST</td>
										<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>{r.costPrice && (r.quantity || r.qty) ? `Amount ${(r.costPrice * (r.quantity || r.qty || 0)).toFixed(2)}` : 'N/A'}</td>
									</tr>
								</tfoot>
							</table>



							<div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
								<p>Purchase recorded in inventory management system</p>
							</div>
						</div>
						<div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
							<button onClick={() => downloadPdf(r)}>Download Invoice PDF</button>
						</div>
					</div>
						)
					})
				})()}
			</div>
		</div>
	)
}

