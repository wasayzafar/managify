import { useMemo, useState, useEffect } from 'react'
import { db, StoreInfo } from '../storage'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export default function ProfitLossPage() {
	const [dateRange, setDateRange] = useState('thisMonth')
	const [startDate, setStartDate] = useState(() => {
		const date = new Date()
		date.setDate(1)
		return date.toISOString().slice(0, 10)
	})
	const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
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

	const [plData, setPlData] = useState({
		totalRevenue: 0,
		totalCOGS: 0,
		grossProfit: 0,
		totalExpenses: 0,
		totalSalaries: 0,
		netProfit: 0,
		profitMargin: 0,
		purchaseCount: 0,
		saleCount: 0
	})

	useEffect(() => {
		if (dateRange === 'thisMonth') {
			const now = new Date()
			const start = new Date(now.getFullYear(), now.getMonth(), 1)
			const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
			setStartDate(start.toISOString().slice(0, 10))
			setEndDate(end.toISOString().slice(0, 10))
		}
	}, [dateRange])

	useEffect(() => {
		const loadPLData = async () => {
			try {
				const [purchases, sales, expenses] = await Promise.all([
					db.listPurchases(),
					db.listSales(),
					db.listExpenses()
				])

				// Get employees for salary calculation
				const employees = await db.listEmployees()

				// Filter by date range
				const filteredPurchases = purchases.filter(p => {
					const purchaseDate = p.date ? new Date(p.date) : new Date()
					return purchaseDate >= new Date(startDate) && purchaseDate <= new Date(endDate + 'T23:59:59')
				})

				const filteredSales = sales.filter(s => {
					const saleDate = s.date ? new Date(s.date) : new Date()
					return saleDate >= new Date(startDate) && saleDate <= new Date(endDate + 'T23:59:59')
				})

				// Get items for price lookup
				const items = await db.listItems()

				// Calculate Revenue from sales using actual prices (includes discounts)
				const totalRevenue = filteredSales.reduce((sum, sale) => {
					// Use actualPrice if available (includes discounts), otherwise fallback to item price
					if (sale.actualPrice) {
						return sum + ((sale.quantity || 0) * sale.actualPrice)
					}
					// Fallback for older sales without actualPrice
					const item = items.find(i => i.id === sale.itemId)
					return sum + ((sale.quantity || 0) * (item?.price || 0))
				}, 0)

				// Calculate Cost of Goods Sold from sold items only
				const totalCOGS = filteredSales.reduce((sum, sale) => {
					const item = items.find(i => i.id === sale.itemId)
					if (!item) return sum
					
					// Find the most recent purchase for this item to get cost price
					const itemPurchases = purchases.filter(p => p.itemId === item.id)
					const latestPurchase = itemPurchases.sort((a, b) => 
						new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
					)[0]
					
					const costPrice = latestPurchase?.costPrice || 0
					return sum + ((sale.quantity || 0) * costPrice)
				}, 0)

				// Filter expenses by date range
				const filteredExpenses = expenses.filter(e => {
					const expenseDate = e.date ? new Date(e.date) : new Date()
					return expenseDate >= new Date(startDate) && expenseDate <= new Date(endDate + 'T23:59:59')
				})

				// Calculate total expenses
				const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

				// Calculate total salaries (exclude joining month, start from next month)
				const totalSalaries = employees.reduce((sum: number, emp: any) => {
					if (!emp.joinDate) return sum + (emp.salary || 0)
					const joinDate = new Date(emp.joinDate)
					const periodStart = new Date(startDate)
					const nextMonthAfterJoin = new Date(joinDate.getFullYear(), joinDate.getMonth() + 1, 1)
					return nextMonthAfterJoin <= periodStart ? sum + (emp.salary || 0) : sum
				}, 0)

				// Calculate Gross Profit
				const grossProfit = totalRevenue - totalCOGS

				// Calculate Net Profit (after expenses and salaries)
				const netProfit = grossProfit - totalExpenses - totalSalaries

				// Calculate profit margin
				const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

				setPlData({
					totalRevenue,
					totalCOGS,
					grossProfit,
					totalExpenses,
					totalSalaries,
					netProfit,
					profitMargin,
					purchaseCount: filteredPurchases.length,
					saleCount: filteredSales.length
				})
			} catch (error) {
				console.error('Error loading P&L data:', error)
			}
		}
		
		loadPLData()
	}, [startDate, endDate])

	async function downloadPdf() {
		const el = document.getElementById('pl-statement')
		if (!el) return
		const canvas = await html2canvas(el)
		const imgData = canvas.toDataURL('image/png')
		const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
		const pageWidth = pdf.internal.pageSize.getWidth()
		const imgWidth = pageWidth
		const imgHeight = canvas.height * imgWidth / canvas.width
		pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
		pdf.save(`profit_loss_${startDate}_to_${endDate}.pdf`)
	}

	return (
		<div className="card">
			<h2>Profit & Loss Statement</h2>
			
			<div className="form-grid" style={{ marginBottom: 16 }}>
				<div>
					<label>Period</label>
					<select value={dateRange} onChange={e => setDateRange(e.target.value)}>
						<option value="thisMonth">This Month</option>
						<option value="custom">Custom Range</option>
					</select>
				</div>
				{dateRange === 'custom' && (
					<>
						<div>
							<label>Start Date</label>
							<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
						</div>
						<div>
							<label>End Date</label>
							<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
						</div>
					</>
				)}
				<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
					<button onClick={downloadPdf}>Download PDF</button>
				</div>
			</div>

			<div id="pl-statement" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px', background: 'white', color: 'black' }}>
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
					<p style={{ margin: '10px 0 5px 0', fontSize: '14px', color: '#666' }}>Profit & Loss Statement</p>
				</div>

				<div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
					<div style={{ fontSize: '14px', lineHeight: '1.6' }}>
						<div><strong>Period:</strong> {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</div>
						<div><strong>Generated:</strong> {new Date().toLocaleString()}</div>
					</div>
					<div style={{ fontSize: '14px', textAlign: 'right' }}>
						<div><strong>Status:</strong> {plData.grossProfit >= 0 ? 'PROFITABLE' : 'LOSS'}</div>
						<div><strong>Margin:</strong> {plData.profitMargin.toFixed(2)}%</div>
					</div>
				</div>

				<table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
					<thead>
						<tr style={{ background: '#f5f5f5' }}>
							<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' }}>Description</th>
							<th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>Amount</th>
						</tr>
					</thead>
					<tbody>
						<tr style={{ background: '#e8f5e8' }}>
							<td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>REVENUE</td>
							<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>price {plData.totalRevenue.toFixed(2)}</td>
						</tr>
						<tr>
							<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px', paddingLeft: '20px' }}>Total Sales ({plData.saleCount} transactions)</td>
							<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>price {plData.totalRevenue.toFixed(2)}</td>
						</tr>
						<tr style={{ background: '#ffe8e8' }}>
							<td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>COST OF GOODS SOLD</td>
							<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>price {plData.totalCOGS.toFixed(2)}</td>
						</tr>
						<tr>
							<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px', paddingLeft: '20px' }}>Cost of Sold Items ({plData.saleCount} transactions)</td>
							<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>price {plData.totalCOGS.toFixed(2)}</td>
						</tr>
						<tr style={{ background: '#e8f5e8' }}>
							<td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>GROSS PROFIT</td>
							<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>price {plData.grossProfit.toFixed(2)}</td>
						</tr>
						<tr style={{ background: '#ffe8e8' }}>
							<td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>OPERATING EXPENSES</td>
							<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>price {plData.totalExpenses.toFixed(2)}</td>
						</tr>
						<tr style={{ background: '#ffe8e8' }}>
							<td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>SALARIES</td>
							<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>price {plData.totalSalaries.toFixed(2)}</td>
						</tr>
						<tr style={{ background: plData.netProfit >= 0 ? '#e8f5e8' : '#ffe8e8', borderTop: '3px solid #333' }}>
							<td style={{ border: '1px solid #ddd', padding: '15px', fontSize: '16px', fontWeight: 'bold' }}>NET PROFIT</td>
							<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>price {plData.netProfit.toFixed(2)}</td>
						</tr>
					</tbody>
				</table>

				<div style={{ marginTop: '30px', padding: '20px', background: plData.netProfit >= 0 ? '#e8f5e8' : '#ffe8e8', border: `2px solid ${plData.netProfit >= 0 ? '#4caf50' : '#f44336'}`, borderRadius: '8px' }}>
					<div style={{ textAlign: 'center' }}>
						<h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: plData.netProfit >= 0 ? '#2e7d32' : '#c62828' }}>
							{plData.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}
						</h2>
						<div style={{ fontSize: '32px', fontWeight: 'bold', color: plData.netProfit >= 0 ? '#2e7d32' : '#c62828' }}>
							price {Math.abs(plData.netProfit).toFixed(2)}
						</div>
						<div style={{ marginTop: '10px', fontSize: '16px', color: '#666' }}>
							Profit Margin: {plData.profitMargin.toFixed(2)}%
						</div>
					</div>
				</div>

				<div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
					<p>This statement is generated automatically from the inventory management system</p>
					<p>For detailed analysis, please contact the management</p>
				</div>
			</div>
		</div>
	)
}
