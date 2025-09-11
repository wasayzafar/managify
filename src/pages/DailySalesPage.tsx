import { useMemo, useState, useEffect } from 'react'
import { db, StoreInfo } from '../storage'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export default function DailySalesPage() {
	const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({
		storeName: 'Managify',
		phone: '',
		address: '',
		email: '',
		website: '',
		taxNumber: '',
		logo: ''
	})

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
	}, [])

	const [dailyData, setDailyData] = useState({
		filteredSales: [],
		itemBreakdown: [],
		totalRevenue: 0,
		totalTransactions: 0,
		totalItems: 0
	})

	useEffect(() => {
		const loadDailyData = async () => {
			try {
				const [sales, items] = await Promise.all([
					db.listSales(),
					db.listItems()
				])
				
				// Filter sales for selected date
				const filteredSales = sales.filter(sale => {
					const saleDate = sale.date ? new Date(sale.date).toISOString().slice(0, 10) : ''
					return saleDate === selectedDate
				})

				// Calculate totals
				const totalTransactions = filteredSales.length
				const totalItems = filteredSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0)
				const totalRevenue = 0 // Will be calculated when price data is available

				// Group by item for detailed breakdown
				const itemBreakdown = filteredSales.reduce((acc, sale) => {
					const item = items.find(i => i.id === sale.itemId)
					const existing = acc.find(i => i.itemId === sale.itemId)
					const salePrice = sale.actualPrice || item?.price || 0
					if (existing) {
						existing.qty += sale.quantity || 0
						existing.total += (sale.quantity || 0) * salePrice
					} else {
						acc.push({
							itemId: sale.itemId,
							item: item,
							qty: sale.quantity || 0,
							unitPrice: salePrice,
							total: (sale.quantity || 0) * salePrice
						})
					}
					return acc
				}, [] as any[])

				setDailyData({
					filteredSales,
					itemBreakdown,
					totalRevenue: itemBreakdown.reduce((sum, item) => sum + item.total, 0),
					totalTransactions,
					totalItems
				})
			} catch (error) {
				console.error('Error loading daily data:', error)
			}
		}
		
		loadDailyData()
	}, [selectedDate])

	async function downloadPdf() {
		const el = document.getElementById('daily-sales-report')
		if (!el) return
		const canvas = await html2canvas(el)
		const imgData = canvas.toDataURL('image/png')
		const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
		const pageWidth = pdf.internal.pageSize.getWidth()
		const imgWidth = pageWidth
		const imgHeight = canvas.height * imgWidth / canvas.width
		pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
		pdf.save(`daily_sales_${selectedDate}.pdf`)
	}

	return (
		<div className="card">
			<h2>Daily Sales Report</h2>
			
			<div className="form-grid" style={{ marginBottom: 16 }}>
				<div>
					<label>Select Date</label>
					<input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
				</div>
				<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
					<button onClick={downloadPdf} disabled={dailyData.totalTransactions === 0}>
						Download Daily Sales PDF
					</button>
				</div>
			</div>

			{dailyData.totalTransactions === 0 ? (
				<div className="card" style={{ textAlign: 'center', padding: '40px' }}>
					<h3>No Sales Found</h3>
					<p>No sales were recorded on {new Date(selectedDate).toLocaleDateString()}</p>
				</div>
			) : (
				<div id="daily-sales-report" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px', background: 'white', color: 'black' }}>
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
						<p style={{ margin: '10px 0 5px 0', fontSize: '14px', color: '#666' }}>Daily Sales Report</p>
					</div>

					<div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
						<div style={{ fontSize: '14px', lineHeight: '1.6' }}>
							<div><strong>Report Date:</strong> {new Date(selectedDate).toLocaleDateString()}</div>
							<div><strong>Generated:</strong> {new Date().toLocaleString()}</div>
						</div>
						<div style={{ fontSize: '14px', textAlign: 'right' }}>
							<div><strong>Total Transactions:</strong> {dailyData.totalTransactions}</div>
							<div><strong>Total Items Sold:</strong> {dailyData.totalItems}</div>
						</div>
					</div>

					{/* Summary Cards */}
					<div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
						<div style={{ flex: 1, padding: '15px', background: '#e8f5e8', border: '1px solid #4caf50', borderRadius: '8px', textAlign: 'center' }}>
							<h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#2e7d32' }}>TOTAL REVENUE</h3>
							<div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>price {dailyData.totalRevenue.toFixed(2)}</div>
						</div>
						<div style={{ flex: 1, padding: '15px', background: '#e3f2fd', border: '1px solid #2196f3', borderRadius: '8px', textAlign: 'center' }}>
							<h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#1976d2' }}>TRANSACTIONS</h3>
							<div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>{dailyData.totalTransactions}</div>
						</div>
						<div style={{ flex: 1, padding: '15px', background: '#fff3e0', border: '1px solid #ff9800', borderRadius: '8px', textAlign: 'center' }}>
							<h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#f57c00' }}>ITEMS SOLD</h3>
							<div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f57c00' }}>{dailyData.totalItems}</div>
						</div>
					</div>

					{/* Sales Transactions */}
					<h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#333' }}>Sales Transactions</h3>
					<table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
						<thead>
							<tr style={{ background: '#f5f5f5' }}>
								<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>Invoice #</th>
								<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>Customer</th>
								<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>Time</th>
								<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Amount</th>
							</tr>
						</thead>
						<tbody>
							{dailyData.filteredSales.map(sale => (
								<tr key={sale.id}>
									<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{sale.id}</td>
									<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>Walk-in</td>
									<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{sale.date ? new Date(sale.date).toLocaleTimeString() : 'N/A'}</td>
									<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>Qty: {sale.quantity || 0}</td>
								</tr>
							))}
						</tbody>
					</table>

					{/* Item Breakdown */}
					<h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#333' }}>Item Sales Breakdown</h3>
					<table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
						<thead>
							<tr style={{ background: '#f5f5f5' }}>
								<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>SKU</th>
								<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>Item Name</th>
								<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>Qty Sold</th>
								<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Unit Price</th>
								<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Total</th>
							</tr>
						</thead>
						<tbody>
							{dailyData.itemBreakdown.map((item, index) => (
								<tr key={index}>
									<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{item.item?.sku || 'N/A'}</td>
									<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px' }}>{item.item?.name || 'Unknown Item'}</td>
									<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{item.qty}</td>
									<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>price {item.unitPrice.toFixed(2)}</td>
									<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>price {item.total.toFixed(2)}</td>
								</tr>
							))}
						</tbody>
						<tfoot>
							<tr style={{ background: '#f9f9f9' }}>
								<td colSpan={4} style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>TOTAL REVENUE</td>
								<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>price {dailyData.totalRevenue.toFixed(2)}</td>
							</tr>
						</tfoot>
					</table>

					<div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
						<p>Daily sales report generated from inventory management system</p>
						<p>Report covers all sales transactions for {new Date(selectedDate).toLocaleDateString()}</p>
					</div>
				</div>
			)}
		</div>
	)
}
