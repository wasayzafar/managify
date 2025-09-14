import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader, Result } from '@zxing/library'
import { db, StoreInfo } from '../storage'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

 type CartLine = { id: string, sku: string, name: string, itemId?: string, qty: number, price: number, discount?: number }

export default function BillingPage() {
	const [customer, setCustomer] = useState('')
	const [customerPhone, setCustomerPhone] = useState('')
	const [invoiceNo, setInvoiceNo] = useState(() => `INV-${Date.now().toString().slice(-6)}`)
	const [skuInput, setSkuInput] = useState('')
	const [qtyInput, setQtyInput] = useState('1')
	const [priceInput, setPriceInput] = useState('')
	const [cart, setCart] = useState<CartLine[]>([])
	const [billDiscount, setBillDiscount] = useState(0)
	const [lastInvoice, setLastInvoice] = useState<{ invoiceNo: string, customer: string, phone?: string, lines: CartLine[], total: number, billDiscount: number, createdAt: string } | null>(null)
	const [savedInvoices, setSavedInvoices] = useState<any[]>([])
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({
		storeName: 'Managify',
		phone: '',
		address: '',
		email: '',
		website: '',
		taxNumber: '',
		logo: ''
	})
	const subtotal = useMemo(() => cart.reduce((a, b) => {
		const lineTotal = b.qty * b.price
		const lineDiscount = (lineTotal * (b.discount || 0)) / 100
		return a + lineTotal - lineDiscount
	}, 0), [cart])
	const total = useMemo(() => {
		const billDiscountAmount = (subtotal * billDiscount) / 100
		return subtotal - billDiscountAmount
	}, [subtotal, billDiscount])

	// Load store info
	useEffect(() => {
		const loadStoreInfo = async () => {
			try {
				const info = await db.getStoreInfo()
				setStoreInfo(info)
			} catch (error) {
				console.error('Error loading store info:', error)
			}
		}
		loadStoreInfo()
		loadSavedInvoices()
	}, [])

	const loadSavedInvoices = async () => {
		try {
			const invoices = await db.listInvoices()
			setSavedInvoices(invoices)
		} catch (error) {
			console.error('Error loading invoices:', error)
		}
	}

	// Embedded scanner
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const [scanEnabled, setScanEnabled] = useState(true)
	useEffect(() => {
		if (!scanEnabled) return
		const reader = new BrowserMultiFormatReader()
		let stop = false
		async function run() {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
				if (!videoRef.current) return
				videoRef.current.srcObject = stream
				await videoRef.current.play()
				reader.decodeFromVideoDevice(undefined, videoRef.current, (res: Result | undefined) => {
					if (stop) return
					if (res) {
						const text = res.getText()
						addSku(text, 1)
					}
				})
			} catch {}
		}
		run()
		return () => { stop = true; reader.reset() }
	}, [scanEnabled])

	async function addSku(sku: string, qty: number) {
		try {
			const item = await db.getItemBySku(sku)
			if (!item) return
			setCart(prev => {
				const idx = prev.findIndex(l => l.itemId === item.id)
				if (idx >= 0) {
					const copy = [...prev]
					copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty }
					return copy
				}
				return [{ id: `line_${Math.random().toString(36).slice(2, 9)}`, sku: item.sku, name: item.name, itemId: item.id, qty, price: item.price }, ...prev]
			})
		} catch (error) {
			console.error('Error adding SKU:', error)
		}
	}

	async function addManual() {
		if (!skuInput) return
		try {
			const q = Number(qtyInput || '1')
			const item = await db.getItemBySku(skuInput)
			if (item) {
				await addSku(item.sku, q)
				setSkuInput(''); setQtyInput('1'); setPriceInput('')
				return
			}
			const p = Number(priceInput || '0')
			if (isNaN(p)) {
				alert('Please enter a valid price')
				return
			}
			const line: CartLine = { id: `line_${Math.random().toString(36).slice(2, 9)}`, sku: skuInput, name: skuInput, qty: q, price: p }
			setCart(prev => [line, ...prev])
			setSkuInput(''); setQtyInput('1'); setPriceInput('')
		} catch (error) {
			console.error('Error adding manual item:', error)
		}
	}

	function updateLine(id: string, data: Partial<CartLine>) {
		setCart(prev => prev.map(l => l.id === id ? { ...l, ...data } : l))
	}

	function removeLine(id: string) { setCart(prev => prev.filter(l => l.id !== id)) }

	async function finalize() {
		if (!cart.length) return
		try {
			// Create sales for each cart item with discounted prices
			for (const l of cart) {
				let itemId = l.itemId
				if (!itemId) {
					const created = await db.createItem({ sku: l.sku, name: l.name, price: l.price })
					itemId = created.id
				}
				// Calculate actual sale price after discounts
				const lineTotal = l.qty * l.price
				const lineDiscount = (lineTotal * (l.discount || 0)) / 100
				const lineSubtotal = lineTotal - lineDiscount
				const billDiscountAmount = (lineSubtotal * billDiscount) / 100
				const finalAmount = lineSubtotal - billDiscountAmount
				const actualUnitPrice = finalAmount / l.qty
				
				await db.createSale({ 
					itemId, 
					quantity: l.qty, 
					actualPrice: actualUnitPrice,
					originalPrice: l.price,
					itemDiscount: l.discount || 0,
					billDiscount: billDiscount,
					customerName: customer,
					customerPhone: customerPhone,
					invoiceNo: invoiceNo,
					date: new Date().toISOString() 
				})
			}
			// Save invoice to database
			const savedInvoice = await db.createInvoice({
				invoiceNo,
				customer,
				phone: customerPhone,
				lines: cart,
				total,
				billDiscount
			})
			
			const snapshot = { invoiceNo, customer, phone: customerPhone, lines: cart, total, billDiscount, createdAt: new Date().toLocaleString() }
			setLastInvoice(snapshot)
			setCart([])
			setInvoiceNo(`INV-${Date.now().toString().slice(-6)}`)
			await loadSavedInvoices()
			alert('Bill created and saved successfully')
		} catch (error) {
			console.error('Error finalizing bill:', error)
			alert('Error creating bill')
		}
	}

	async function printInvoice() {
		const el = document.getElementById('invoice-print')
		if (!el) return
		const w = window.open('', 'PRINT', 'height=650,width=900,top=100,left=150')
		if (!w) return
		w.document.write('<html><head><title>Invoice</title>')
		w.document.write('<style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;} table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style>')
		w.document.write('</head><body>')
		w.document.write(el.innerHTML)
		w.document.write('</body></html>')
		w.document.close()
		w.focus()
		w.print()
		w.close()
	}

	async function downloadPdf() {
		const el = document.getElementById('invoice-print')
		if (!el) return
		const canvas = await html2canvas(el)
		const imgData = canvas.toDataURL('image/png')
		const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
		const pageWidth = pdf.internal.pageSize.getWidth()
		const pageHeight = pdf.internal.pageSize.getHeight()
		const imgWidth = pageWidth
		const imgHeight = canvas.height * imgWidth / canvas.width
		let y = 0
		pdf.addImage(imgData, 'PNG', 0, y, imgWidth, imgHeight)
		if (imgHeight > pageHeight) {
			let remaining = imgHeight - pageHeight
			while (remaining > 0) {
				pdf.addPage()
				y -= pageHeight
				pdf.addImage(imgData, 'PNG', 0, y, imgWidth, imgHeight)
				remaining -= pageHeight
			}
		}
		pdf.save(`${lastInvoice?.invoiceNo || 'invoice'}.pdf`)
	}

	return (
		<div className="card">
			<h2>Billing</h2>
			<div className="form-grid" style={{ marginBottom: 12 }}>
				<input placeholder="Invoice No" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
				<input placeholder="Customer" value={customer} onChange={e => setCustomer(e.target.value)} />
				<input placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
			</div>

			<div className="card">
				<h3>Add Items</h3>
				<div className="form-grid">
					<input placeholder="Scan or enter SKU" value={skuInput} onChange={e => setSkuInput(e.target.value)} autoFocus />
					<input placeholder="Qty" type="number" value={qtyInput} onChange={e => setQtyInput(e.target.value)} />
					<input placeholder="Price (manual only)" type="number" step="0.01" value={priceInput} onChange={e => setPriceInput(e.target.value)} />
					<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
						<button onClick={addManual}>Add</button>
						<label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<input type="checkbox" checked={scanEnabled} onChange={e => setScanEnabled(e.target.checked)} /> Enable scanner
						</label>
					</div>
				</div>
				<video ref={videoRef} style={{ width: '100%', maxHeight: 240, background: '#111', borderRadius: 12, marginTop: 8 }} muted playsInline />
			</div>

			<table className="table">
				<thead>
					<tr>
						<th>SKU</th>
						<th>Name</th>
						<th>Qty</th>
						<th>Price</th>
						<th>Discount %</th>
						<th>Amount</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{cart.map(l => (
						<tr key={l.id}>
							<td>{l.sku}</td>
							<td><input value={l.name} onChange={e => updateLine(l.id, { name: e.target.value })} /></td>
							<td><input type="number" value={l.qty} onChange={e => updateLine(l.id, { qty: Number(e.target.value || '0') })} /></td>
							<td><input type="number" step="0.01" value={l.price} onChange={e => updateLine(l.id, { price: Number(e.target.value || '0') })} /></td>
							<td><input type="number" min="0" max="100" value={l.discount || 0} onChange={e => updateLine(l.id, { discount: Number(e.target.value || '0') })} style={{ width: '60px' }} /></td>
							<td>price {(() => {
								const lineTotal = l.qty * l.price
								const discountAmount = (lineTotal * (l.discount || 0)) / 100
								return (lineTotal - discountAmount).toFixed(2)
							})()}</td>
							<td style={{ textAlign: 'right' }}><button className="secondary" onClick={() => removeLine(l.id)}>Remove</button></td>
						</tr>
					))}
				</tbody>
				<tfoot>
					<tr>
						<td colSpan={5} style={{ textAlign: 'right' }}><strong>Subtotal</strong></td>
						<td>price {subtotal.toFixed(2)}</td>
					</tr>
					<tr>
						<td colSpan={4} style={{ textAlign: 'right' }}><strong>Bill Discount %</strong></td>
						<td><input type="number" min="0" max="100" value={billDiscount} onChange={e => setBillDiscount(Number(e.target.value || '0'))} style={{ width: '60px' }} /></td>
						<td>price {((subtotal * billDiscount) / 100).toFixed(2)}</td>
					</tr>
					<tr style={{ background: '#2263ff', color: 'white' }}>
						<td colSpan={5} style={{ textAlign: 'right' }}><strong>Total</strong></td>
						<td><strong>price {total.toFixed(2)}</strong></td>
					</tr>
				</tfoot>
			</table>

			<div className="form-actions" style={{ marginTop: 12 }}>
				<button onClick={finalize}>Finalize Bill</button>
				<button className="secondary" onClick={() => setCart([])}>Clear</button>
			</div>

			{lastInvoice && (
				<div className="card" style={{ marginTop: 16 }}>
					<div className="form-actions" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
						<button onClick={printInvoice}>Print</button>
						<button className="secondary" onClick={downloadPdf}>Download PDF</button>
					</div>
					<div id="invoice-print" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px', background: 'white', color: 'black' }}>
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
								{(storeInfo.storeName || 'MANAGIFY').toUpperCase()}
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
						</div>
						
						<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
							<div>
								<h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#333' }}>INVOICE</h3>
								<div style={{ fontSize: '14px', lineHeight: '1.6' }}>
									<div><strong>Invoice #:</strong> {lastInvoice.invoiceNo}</div>
									<div><strong>Date:</strong> {lastInvoice.createdAt}</div>
								</div>
							</div>
							<div style={{ textAlign: 'right' }}>
								<h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#333' }}>BILL TO</h3>
								<div style={{ fontSize: '14px', lineHeight: '1.6' }}>
									<div><strong>Customer:</strong> {lastInvoice.customer || 'Walk-in Customer'}</div>
									<div><strong>Phone:</strong> {lastInvoice.phone || '-'}</div>
								</div>
							</div>
						</div>

						<table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
							<thead>
								<tr style={{ background: '#f5f5f5' }}>
									<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>SKU</th>
									<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>Item Description</th>
									<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>Qty</th>
									<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Unit Price</th>
									<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Discount</th>
									<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Amount</th>
								</tr>
							</thead>
							<tbody>
								{lastInvoice.lines.map(l => (
									<tr key={l.id}>
										<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{l.sku}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{l.name}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{l.qty}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>price {l.price.toFixed(2)}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>{l.discount || 0}%</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>price {(() => {
											const lineTotal = l.qty * l.price
											const discountAmount = (lineTotal * (l.discount || 0)) / 100
											return (lineTotal - discountAmount).toFixed(2)
										})()}</td>
									</tr>
								))}
							</tbody>
							<tfoot>
								<tr style={{ background: '#f9f9f9' }}>
									<td colSpan={4} style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>SUBTOTAL</td>
									<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px' }}>price {(lastInvoice.total + ((lastInvoice.total * lastInvoice.billDiscount) / (100 - lastInvoice.billDiscount))).toFixed(2)}</td>
								</tr>
								{lastInvoice.billDiscount > 0 && (
									<tr>
										<td colSpan={4} style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>BILL DISCOUNT ({lastInvoice.billDiscount}%)</td>
										<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px' }}>price {((lastInvoice.total * lastInvoice.billDiscount) / (100 - lastInvoice.billDiscount)).toFixed(2)}</td>
									</tr>
								)}
								<tr style={{ background: '#f9f9f9' }}>
									<td colSpan={4} style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>TOTAL AMOUNT</td>
									<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>price {lastInvoice.total.toFixed(2)}</td>
								</tr>
							</tfoot>
						</table>

						<div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
							<p>Thank you for your business!</p>
							<p>For any queries, please contact us.</p>
						</div>
					</div>
				</div>
			)}

			{savedInvoices.length > 0 && (
				<div className="card" style={{ marginTop: 16 }}>
					<h3>Recent Bills</h3>
					<table className="table">
						<thead>
							<tr>
								<th>Invoice #</th>
								<th>Customer</th>
								<th>Total</th>
								<th>Date</th>
								<th>Action</th>
							</tr>
						</thead>
						<tbody>
							{savedInvoices.slice(0, 10).map(invoice => (
								<tr key={invoice.id}>
									<td>{invoice.invoiceNo}</td>
									<td>{invoice.customer || 'Walk-in'}</td>
									<td>price {invoice.total.toFixed(2)}</td>
									<td>{new Date(invoice.date).toLocaleDateString()}</td>
									<td>
										<button 
											style={{ padding: '4px 8px', fontSize: '12px' }}
											onClick={() => setLastInvoice(invoice)}
										>
											View
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
