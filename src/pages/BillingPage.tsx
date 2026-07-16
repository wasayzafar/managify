import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader, Result } from '@zxing/library'
import { db, StoreInfo } from '../storage'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { getThermalPrintStyles, isThermalPrinting, getPrintWindowSize, getPrintPageCSS, getPrintOrientation, getPrintSize } from '../utils/thermalPrintStyles'
import { preloadImageAsBase64, getCachedImage } from '../utils/imageCache'
import { loadCurrency, formatCurrency } from '../utils/currency'

 type CartLine = { id: string, sku: string, name: string, itemId?: string, qty: number, price: number, discount?: number, originalPrice?: number }
//test
export default function BillingPage() {
	const [customer, setCustomer] = useState('')
	const [customerPhone, setCustomerPhone] = useState('')
	const [customerAddress, setCustomerAddress] = useState('')
	const [ecommerceMode] = useState(() => localStorage.getItem('ecommerceMode') === 'true')
	const [invoiceNo, setInvoiceNo] = useState(() => `INV-${Date.now().toString().slice(-6)}`)
	const localNow = () => { const n = new Date(); const p = (x: number) => String(x).padStart(2, '0'); return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}` }
	const [billDate, setBillDate] = useState(() => localNow())
	const [useCurrentDate, setUseCurrentDate] = useState(true)
	const [skuInput, setSkuInput] = useState('')
	const [qtyInput, setQtyInput] = useState('1')
	const [priceInput, setPriceInput] = useState('')
	const [cart, setCart] = useState<CartLine[]>([])
	const [billDiscount, setBillDiscount] = useState(0)
	const [lastInvoice, setLastInvoice] = useState<{ invoiceNo: string, customer: string, phone?: string, customerAddress?: string, lines: CartLine[], total: number, billDiscount: number, createdAt: string, storeInfo?: any } | null>(null)
	const [savedInvoices, setSavedInvoices] = useState<any[]>([])
	const [finalizing, setFinalizing] = useState(false)
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({
		storeName: 'Managify',
		phone: '',
		address: '',
		email: '',
		website: '',
		taxNumber: '',
		logo: '',
		currency: 'PKR'
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
				await loadCurrency()
				// Preload logo for instant printing
				if (info.logo) {
					preloadImageAsBase64(info.logo).catch(console.warn)
				}
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
	const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
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
						setSkuInput(text)
						setQtyInput('1')
						addManual()
					}
				})
			} catch {}
		}
		run()
		return () => { stop = true; reader.reset() }
	}, [scanEnabled])

	// Handle external barcode scanner
	useEffect(() => {
		const handleKeyPress = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && skuInput && document.activeElement?.getAttribute('placeholder') === 'Scan or enter SKU') {
				setQtyInput('1')
				addManual()
			}
		}
		document.addEventListener('keypress', handleKeyPress)
		return () => document.removeEventListener('keypress', handleKeyPress)
	}, [skuInput])

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
				return [{ id: `line_${Math.random().toString(36).slice(2, 9)}`, sku: item.sku, name: item.name, itemId: item.id, qty, price: item.price, originalPrice: item.price }, ...prev]
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
		if (!cart.length || finalizing) return
		setFinalizing(true)
		if (useCurrentDate) setBillDate(localNow())
		const finalDate = useCurrentDate ? new Date().toISOString() : new Date(billDate).toISOString()
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
					date: finalDate
				})
			}
			// Save invoice to database
			const savedInvoice = await db.createInvoice({
				invoiceNo,
				customer,
				phone: customerPhone,
				customerAddress: customerAddress || undefined,
				lines: cart,
				total,
				billDiscount,
				date: finalDate
			})

			const snapshot = { invoiceNo, customer, phone: customerPhone, customerAddress, lines: cart, total, billDiscount, createdAt: new Date(finalDate).toLocaleString(), storeInfo }
			setLastInvoice(snapshot)
			setCart([])
			setInvoiceNo(`INV-${Date.now().toString().slice(-6)}`)
			setBillDate(localNow())
			await loadSavedInvoices()
			alert('Bill created and saved successfully')
		} catch (error) {
			console.error('Error finalizing bill:', error)
			alert('Error creating bill')
		} finally {
			setFinalizing(false)
		}
	}

	function printInvoice() {
		const el = document.getElementById('invoice-print')
		if (!el) return

		// Use cached base64 images for instant printing
		const images = Array.from(el.querySelectorAll('img'))
		images.forEach(img => {
			const cached = getCachedImage(img.src)
			if (cached) {
				img.src = cached
			}
		})

		const { width, height } = getPrintWindowSize()
		const w = window.open('', 'PRINT', `height=${height},width=${width},top=100,left=150`)
		if (!w) return
		w.document.write('<html><head><title>Invoice</title>')
		w.document.write(`<style>${getPrintPageCSS()} body{margin:0;padding:0;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;} table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style>`)
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
		const size = getPrintSize()
		const orientation = (size === 'A4' || size === 'A5') && getPrintOrientation() === 'landscape' ? 'l' : 'p'
		const format = size === 'A5' ? 'a5' : 'a4'
		const pdf = new jsPDF({ orientation, unit: 'mm', format })
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
		<div className="card" style={{ position: 'relative', opacity: finalizing ? 0.6 : 1, pointerEvents: finalizing ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
			{finalizing && (
				<div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
					<div style={{ background: '#0b0f14', border: '1px solid #243245', borderRadius: 12, padding: '20px 36px', color: '#e8eef5', fontSize: 15, fontWeight: 600, letterSpacing: 0.3 }}>
						Finalizing bill…
					</div>
				</div>
			)}
			<h2>Billing</h2>
			<div className="form-grid" style={{ marginBottom: 12 }}>
				<input placeholder="Invoice No" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
				<input placeholder="Customer" value={customer} onChange={e => setCustomer(e.target.value)} />
				<input placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
				<div>
					<label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Bill Date</label>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
						<input
							type="datetime-local"
							value={billDate}
							disabled={useCurrentDate}
							onChange={e => setBillDate(e.target.value)}
							style={{ opacity: useCurrentDate ? 0.45 : 1 }}
						/>
						<label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#9ca3af', cursor: 'pointer', userSelect: 'none' }}>
							<input
								type="checkbox"
								checked={useCurrentDate}
								style={{ width: 'auto', cursor: 'pointer' }}
								onChange={e => {
									setUseCurrentDate(e.target.checked)
									if (e.target.checked) setBillDate(localNow())
								}}
							/>
							Use current date &amp; time
						</label>
					</div>
				</div>
				{ecommerceMode && (
					<input
						placeholder="Customer Delivery Address"
						value={customerAddress}
						onChange={e => setCustomerAddress(e.target.value)}
						style={{ gridColumn: '1 / -1' }}
					/>
				)}
			</div>

			<div className="card">
				<h3>Add Items</h3>
				<div className="form-grid">
					<input placeholder="Scan or enter SKU" value={skuInput} onChange={e => setSkuInput(e.target.value)} autoFocus />
					<input placeholder="Qty" type="number" value={qtyInput} onChange={e => setQtyInput(e.target.value)} />
					<input placeholder="Price (manual only)" type="number" step="0.01" value={priceInput} onChange={e => setPriceInput(e.target.value)} />
					<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
						<button onClick={addManual}>Add</button>
						{isMobile && (
							<label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
								<input type="checkbox" checked={scanEnabled} onChange={e => setScanEnabled(e.target.checked)} /> Enable scanner
							</label>
						)}
					</div>
				</div>
				{isMobile && <video ref={videoRef} style={{ width: '100%', maxHeight: 240, background: '#111', borderRadius: 12, marginTop: 8 }} muted playsInline />}
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
							<td><input type="number" step="0.01" value={l.price} onChange={e => {
								const newPrice = Number(e.target.value || '0')
								const orig = l.originalPrice ?? l.price
								const disc = orig > 0 && newPrice < orig ? Math.round(((orig - newPrice) / orig) * 10000) / 100 : 0
								updateLine(l.id, { price: newPrice, discount: disc })
							}} /></td>
							<td><input type="number" min="0" max="100" value={l.discount || 0} onChange={e => updateLine(l.id, { discount: Number(e.target.value || '0') })} style={{ width: '60px' }} /></td>
							<td>{(() => {
								const lineTotal = l.qty * l.price
								const discountAmount = (lineTotal * (l.discount || 0)) / 100
								return formatCurrency(lineTotal - discountAmount, storeInfo.currency)
							})()}</td>
							<td style={{ textAlign: 'right' }}><button className="secondary" onClick={() => removeLine(l.id)}>Remove</button></td>
						</tr>
					))}
				</tbody>
				<tfoot>
					<tr>
						<td colSpan={5} style={{ textAlign: 'right' }}><strong>Subtotal</strong></td>
						<td>{formatCurrency(subtotal, storeInfo.currency)}</td>
					</tr>
					<tr>
						<td colSpan={4} style={{ textAlign: 'right' }}><strong>Bill Discount %</strong></td>
						<td><input type="number" min="0" max="100" value={billDiscount} onChange={e => setBillDiscount(Number(e.target.value || '0'))} style={{ width: '60px' }} /></td>
						<td>{formatCurrency((subtotal * billDiscount) / 100, storeInfo.currency)}</td>
					</tr>
					<tr style={{ background: '#2263ff', color: 'white' }}>
						<td colSpan={5} style={{ textAlign: 'right' }}><strong>Total</strong></td>
						<td><strong>{formatCurrency(total, storeInfo.currency)}</strong></td>
					</tr>
				</tfoot>
			</table>

			<div className="form-actions" style={{ marginTop: 12 }}>
				<button onClick={finalize} disabled={finalizing}>{finalizing ? 'Finalizing…' : 'Finalize Bill'}</button>
				<button className="secondary" onClick={() => setCart([])}>Clear</button>
			</div>

			{lastInvoice && (
				<div className="card" style={{ marginTop: 16 }}>
					<div className="form-actions" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
						<button onClick={printInvoice}>Print</button>
						<button className="secondary" onClick={downloadPdf}>Download PDF</button>
					</div>
					<div id="invoice-print" style={getThermalPrintStyles().container}>
						{isThermalPrinting() ? (
							<div style={{ fontFamily: 'Arial, sans-serif', fontSize: '8px', lineHeight: '1.1', padding: '5px' }}>
								<div style={{ textAlign: 'center', marginBottom: '8px' }}>
									{(lastInvoice.storeInfo?.logo || storeInfo.logo) && (
										<img src={lastInvoice.storeInfo?.logo || storeInfo.logo} alt="Logo" style={{ maxHeight: '20px', marginBottom: '3px' }} />
									)}
									<div style={{ fontWeight: 'bold', fontSize: '10px' }}>{((lastInvoice.storeInfo?.storeName || storeInfo.storeName) || 'MANAGIFY').toUpperCase()}</div>
									{(lastInvoice.storeInfo?.phone || storeInfo.phone) && <div>Phone: {lastInvoice.storeInfo?.phone || storeInfo.phone}</div>}
									{(lastInvoice.storeInfo?.email || storeInfo.email) && <div>Email: {lastInvoice.storeInfo?.email || storeInfo.email}</div>}
									{(lastInvoice.storeInfo?.address || storeInfo.address) && <div>{lastInvoice.storeInfo?.address || storeInfo.address}</div>}
									{(lastInvoice.storeInfo?.taxNumber || storeInfo.taxNumber) && <div>Tax#: {lastInvoice.storeInfo?.taxNumber || storeInfo.taxNumber}</div>}
								</div>
								<hr style={{ border: 'none', borderTop: '1px solid #000', margin: '5px 0' }} />
								<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
									<div><strong>INVOICE</strong></div>
									<div><strong>BILL TO</strong></div>
								</div>
								<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '7px' }}>
									<div>
										<div>Invoice #: {lastInvoice.invoiceNo}</div>
										<div>Date: {new Date(lastInvoice.createdAt).toLocaleDateString()}</div>
									</div>
									<div style={{ textAlign: 'right' }}>
										<div>Customer: {lastInvoice.customer || 'Walk-in'}</div>
										<div>Phone: {lastInvoice.phone || '-'}</div>
										{lastInvoice.customerAddress && (
											<div>Address: {lastInvoice.customerAddress}</div>
										)}
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
										{lastInvoice.lines.map((line: any) => (
											<tr key={line.id}>
												<td style={{ padding: '1px' }}>{line.itemId ? line.itemId.slice(-6) : line.sku.slice(-6)}</td>
												<td style={{ padding: '1px' }}>{line.name}</td>
												<td style={{ textAlign: 'center', padding: '1px' }}>{line.qty}</td>
												<td style={{ textAlign: 'right', padding: '1px' }}>{formatCurrency(line.price, storeInfo.currency)}</td>
												<td style={{ textAlign: 'center', padding: '1px' }}>{line.discount || 0}%</td>
												<td style={{ textAlign: 'right', padding: '1px' }}>{formatCurrency(line.qty * line.price * (1 - (line.discount || 0) / 100), storeInfo.currency)}</td>
											</tr>
										))}
									</tbody>
								</table>
								{(() => {
									const invSubtotal = (lastInvoice.lines || []).reduce((s: number, l: any) => { const t = (l.qty || 0) * (l.price || 0); return s + t - (t * (l.discount || 0) / 100) }, 0)
									const bd = lastInvoice.billDiscount || 0
									const discountAmt = (invSubtotal * bd) / 100
									return (
										<div style={{ borderTop: '1px solid #000', paddingTop: '3px' }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px' }}>
												<span>SUBTOTAL</span>
												<span>{formatCurrency(invSubtotal, storeInfo.currency)}</span>
											</div>
											{bd > 0 && (
												<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px' }}>
													<span>BILL DISCOUNT ({bd}%)</span>
													<span>{formatCurrency(discountAmt, storeInfo.currency)}</span>
												</div>
											)}
											<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '2px', marginTop: '2px' }}>
												<span>TOTAL AMOUNT</span>
												<span>{formatCurrency(invSubtotal - discountAmt, storeInfo.currency)}</span>
											</div>
										</div>
									)
								})()}
								<div style={{ textAlign: 'center', marginTop: '8px', fontSize: '6px' }}>
									<div>Thank you for your business!</div>
									<div>For any queries, please contact us.</div>
								</div>
							</div>
						) : (
						<>
						<div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
							{(lastInvoice.storeInfo?.logo || storeInfo.logo) && (
								<img 
									src={lastInvoice.storeInfo?.logo || storeInfo.logo} 
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
								{((lastInvoice.storeInfo?.storeName || storeInfo.storeName) || 'MANAGIFY').toUpperCase()}
							</h1>
							{(lastInvoice.storeInfo?.address || storeInfo.address) && (
								<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
									{lastInvoice.storeInfo?.address || storeInfo.address}
								</p>
							)}
							{(lastInvoice.storeInfo?.phone || storeInfo.phone) && (
								<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
									Phone: {lastInvoice.storeInfo?.phone || storeInfo.phone}
								</p>
							)}
							{(lastInvoice.storeInfo?.email || storeInfo.email) && (
								<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
									Email: {lastInvoice.storeInfo?.email || storeInfo.email}
								</p>
							)}
							{(lastInvoice.storeInfo?.website || storeInfo.website) && (
								<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
									Website: {lastInvoice.storeInfo?.website || storeInfo.website}
								</p>
							)}
							{(lastInvoice.storeInfo?.taxNumber || storeInfo.taxNumber) && (
								<p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
									Tax #: {lastInvoice.storeInfo?.taxNumber || storeInfo.taxNumber}
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
									{lastInvoice.customerAddress && (
										<div><strong>Address:</strong> {lastInvoice.customerAddress}</div>
									)}
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
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>{formatCurrency(l.price, storeInfo.currency)}</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>{l.discount || 0}%</td>
										<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>{(() => {
											const lineTotal = l.qty * l.price
											const discountAmount = (lineTotal * (l.discount || 0)) / 100
											return formatCurrency(lineTotal - discountAmount, storeInfo.currency)
										})()}</td>
									</tr>
								))}
							</tbody>
							<tfoot>
								{(() => {
									const invSubtotal = (lastInvoice.lines || []).reduce((s: number, l: any) => { const t = (l.qty || 0) * (l.price || 0); return s + t - (t * (l.discount || 0) / 100) }, 0)
									const bd = lastInvoice.billDiscount || 0
									const discountAmt = (invSubtotal * bd) / 100
									return (<>
										<tr style={{ background: '#f9f9f9' }}>
											<td colSpan={5} style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>SUBTOTAL</td>
											<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px' }}>{formatCurrency(invSubtotal, storeInfo.currency)}</td>
										</tr>
										{bd > 0 && (
											<tr>
												<td colSpan={5} style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>BILL DISCOUNT ({bd}%)</td>
												<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px' }}>{formatCurrency(discountAmt, storeInfo.currency)}</td>
											</tr>
										)}
									</>)
								})()}
								<tr style={{ background: '#f9f9f9' }}>
									<td colSpan={5} style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>TOTAL AMOUNT</td>
									<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>{formatCurrency(lastInvoice.total, storeInfo.currency)}</td>
								</tr>
							</tfoot>
						</table>

						<div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
							<p>Thank you for your business!</p>
							<p>For any queries, please contact us.</p>
						</div>
						</>
						)}
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
									<td>{formatCurrency(invoice.total, storeInfo.currency)}</td>
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
