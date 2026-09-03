import { useState, useEffect } from 'react'
import { db, StoreInfo } from '../storage'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { loadCurrency, formatCurrency } from '../utils/currency'
import { StatCard } from '../ui/StatCard'
import {
	PiCalendarBlankDuotone, PiFilePdfDuotone, PiHandCoinsDuotone, PiScalesDuotone,
	PiChartLineUpDuotone, PiBuildingsDuotone, PiWarningCircleDuotone,
} from 'react-icons/pi'

const fieldLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 } as const

// Format a Date using its LOCAL year/month/day, not toISOString() (which
// converts to UTC first). In any timezone ahead of UTC, toISOString() on a
// local midnight rolls back to the previous day — e.g. Sept 1 local becomes
// "2026-08-31", silently pulling an extra calendar month into every report.
function toLocalISODate(d: Date): string {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${y}-${m}-${day}`
}

// Every calendar month (YYYY-MM) the [start, end] range touches, inclusive.
// Expenses and payroll in this app are only ever tracked at monthly
// granularity (expenseMonth, join-month), so this is the correct unit to
// charge them by — not individual days.
function monthsInRange(startDate: string, endDate: string): string[] {
	const [sy, sm] = startDate.slice(0, 7).split('-').map(Number)
	const [ey, em] = endDate.slice(0, 7).split('-').map(Number)
	const months: string[] = []
	let y = sy, m = sm
	while (y < ey || (y === ey && m <= em)) {
		months.push(`${y}-${String(m).padStart(2, '0')}`)
		m++
		if (m > 12) { m = 1; y++ }
	}
	return months
}

export default function ProfitLossPage() {
	const [dateRange, setDateRange] = useState('thisMonth')
	const [startDate, setStartDate] = useState(() => {
		const date = new Date()
		date.setDate(1)
		return toLocalISODate(date)
	})
	const [endDate, setEndDate] = useState(() => toLocalISODate(new Date()))
	const [loading, setLoading] = useState(true)
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

	const rangeInvalid = startDate > endDate

	// Load store info
	useEffect(() => {
		const loadStoreInfo = async () => {
			try {
				const info = await db.getStoreInfo()
				setStoreInfo(info)
				await loadCurrency()
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
		grossMargin: 0,
		totalExpenses: 0,
		totalSalaries: 0,
		operatingExpenses: 0,
		totalAssetPurchases: 0,
		netProfit: 0,
		profitMargin: 0,
		purchaseCount: 0,
		saleCount: 0,
		assetCount: 0,
		employeeCount: 0,
		orphanedSaleCount: 0,
		monthsInPeriod: 1,
		expensesByType: [] as { type: string; amount: number; count: number }[]
	})

	useEffect(() => {
		if (dateRange === 'thisMonth') {
			const now = new Date()
			const start = new Date(now.getFullYear(), now.getMonth(), 1)
			const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
			setStartDate(toLocalISODate(start))
			setEndDate(toLocalISODate(end))
		} else if (dateRange === 'lastMonth') {
			const now = new Date()
			const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
			const end = new Date(now.getFullYear(), now.getMonth(), 0)
			setStartDate(toLocalISODate(start))
			setEndDate(toLocalISODate(end))
		} else if (dateRange === 'thisYear') {
			const now = new Date()
			const start = new Date(now.getFullYear(), 0, 1)
			const end = new Date(now.getFullYear(), 11, 31)
			setStartDate(toLocalISODate(start))
			setEndDate(toLocalISODate(end))
		}
	}, [dateRange])

	useEffect(() => {
		if (startDate > endDate) {
			// Clear stale figures rather than leaving the last valid range's
			// numbers on screen — otherwise the stat cards can show totals that
			// don't correspond to what's currently selected.
			setPlData({
				totalRevenue: 0, totalCOGS: 0, grossProfit: 0, grossMargin: 0,
				totalExpenses: 0, totalSalaries: 0, operatingExpenses: 0,
				totalAssetPurchases: 0, netProfit: 0, profitMargin: 0,
				purchaseCount: 0, saleCount: 0, assetCount: 0, employeeCount: 0,
				orphanedSaleCount: 0, monthsInPeriod: 0, expensesByType: []
			})
			setLoading(false)
			return
		}

		const loadPLData = async () => {
			setLoading(true)
			try {
				const [purchases, sales, expenses, assets, employees, items] = await Promise.all([
					db.listPurchases(),
					db.listSales(),
					db.listExpenses(),
					db.listAssets(),
					db.listEmployees(),
					db.listItems(),
				])

				// Both bounds parsed as local time explicitly — a bare "YYYY-MM-DD"
				// parses as UTC midnight while "YYYY-MM-DDT23:59:59" parses as local
				// time, so leaving rangeStart bare would shift it hours later than
				// local midnight in any timezone ahead of UTC and wrongly exclude
				// same-day transactions from the start of the period.
				const rangeStart = new Date(startDate + 'T00:00:00')
				const rangeEnd = new Date(endDate + 'T23:59:59')

				// Filter by date range
				const filteredPurchases = purchases.filter(p => {
					const purchaseDate = p.date ? new Date(p.date) : new Date()
					return purchaseDate >= rangeStart && purchaseDate <= rangeEnd
				})

				const filteredSales = sales.filter(s => {
					const saleDate = s.date ? new Date(s.date) : new Date()
					return saleDate >= rangeStart && saleDate <= rangeEnd
				})

				// Revenue: each sale line's actualPrice already has both the item-level
				// and bill-level discount baked in, so summing it directly reconstructs
				// true recognized revenue (accrual basis — earned at sale, regardless
				// of whether a credit sale has been collected yet).
				const totalRevenue = filteredSales.reduce((sum, sale) => {
					if (sale.actualPrice != null) {
						return sum + ((sale.quantity || 0) * sale.actualPrice)
					}
					// Fallback for older sales without actualPrice
					const item = items.find(i => i.id === sale.itemId)
					return sum + ((sale.quantity || 0) * (item?.price || 0))
				}, 0)

				// Cost of Goods Sold: use the cost that was actually in effect at the
				// time of each sale — the latest purchase dated on or before the sale
				// date — never "today's" latest cost. Using today's cost for a past
				// sale silently rewrites that period's gross profit every time a
				// supplier's price changes, which breaks the matching principle.
				let orphanedSaleCount = 0
				const totalCOGS = filteredSales.reduce((sum, sale) => {
					const item = items.find(i => i.id === sale.itemId)
					if (!item) { orphanedSaleCount++; return sum }

					const saleDate = sale.date ? new Date(sale.date) : new Date()
					const itemPurchases = purchases.filter(p =>
						p.itemId === item.id && p.date && new Date(p.date) <= saleDate
					)
					const latestPurchase = itemPurchases
						.slice()
						.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())[0]

					const costPrice = latestPurchase?.costPrice ?? item.costPrice ?? 0
					return sum + ((sale.quantity || 0) * costPrice)
				}, 0)

				// Expenses are only ever entered at monthly granularity (expenseMonth),
				// so they're filtered by month, not by day.
				const startMonth = startDate.slice(0, 7)
				const endMonth = endDate.slice(0, 7)
				const filteredExpenses = expenses.filter(e => {
					const m = e.expenseMonth || e.date?.slice(0, 7) || ''
					return m >= startMonth && m <= endMonth
				})
				const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

				// Break expenses down by type (e.g. Rent, Utilities, Liabilities)
				const expensesByTypeMap = filteredExpenses.reduce((map, expense) => {
					const key = expense.type || 'Other'
					const existing = map.get(key) || { amount: 0, count: 0 }
					existing.amount += expense.amount
					existing.count += 1
					map.set(key, existing)
					return map
				}, new Map<string, { amount: number; count: number }>())
				const expensesByType = Array.from(expensesByTypeMap.entries())
					.map(([type, v]) => ({ type, amount: v.amount, count: v.count }))
					.sort((a, b) => b.amount - a.amount)

				// Capital expenditure (asset purchases) — tracked and shown, but
				// intentionally NOT deducted from Net Profit below. Buying a
				// long-lived asset isn't an operating expense; it should be
				// capitalized and depreciated over its useful life. Expensing it in
				// full the month it's bought would understate that month's profit
				// and overstate every other month's, since the asset keeps producing
				// value long after the purchase. This app doesn't track depreciation
				// schedules, so the honest thing to do is report it separately as a
				// memo line rather than fold it into an inaccurate Net Profit.
				const filteredAssets = assets.filter(a => {
					const purchaseDate = a.purchaseDate ? new Date(a.purchaseDate) : new Date()
					return purchaseDate >= rangeStart && purchaseDate <= rangeEnd
				})
				const totalAssetPurchases = filteredAssets.reduce((sum, asset) => sum + asset.purchasePrice, 0)

				// Payroll: charge every calendar month the period spans, not a flat
				// one-off amount — a "This Year" report must include 12 months of
				// salary per employee, not 1. The employee's join month is charged
				// at firstMonthPay (prorated first pay); months before joining are
				// excluded entirely.
				const months = monthsInRange(startDate, endDate)
				const totalSalaries = employees.reduce((sum: number, emp: any) => {
					if (!emp.joinDate) return sum + months.length * (emp.salary || 0)
					const joinMonth = String(emp.joinDate).slice(0, 7)
					let empTotal = 0
					for (const month of months) {
						if (month < joinMonth) continue
						empTotal += month === joinMonth ? (emp.firstMonthPay ?? emp.salary ?? 0) : (emp.salary || 0)
					}
					return sum + empTotal
				}, 0)

				const grossProfit = totalRevenue - totalCOGS
				const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
				const operatingExpenses = totalExpenses + totalSalaries
				// Net Profit reflects operating performance only — see the capital
				// expenditure note above for why asset purchases are excluded.
				const netProfit = grossProfit - operatingExpenses
				const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

				setPlData({
					totalRevenue,
					totalCOGS,
					grossProfit,
					grossMargin,
					totalExpenses,
					totalSalaries,
					operatingExpenses,
					totalAssetPurchases,
					netProfit,
					profitMargin,
					purchaseCount: filteredPurchases.length,
					saleCount: filteredSales.length,
					assetCount: filteredAssets.length,
					employeeCount: employees.length,
					orphanedSaleCount,
					monthsInPeriod: months.length,
					expensesByType
				})
			} catch (error) {
				console.error('Error loading P&L data:', error)
			} finally {
				setLoading(false)
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
		<div>
			{/* ── Header ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
				<div>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Profit &amp; Loss</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>Revenue, cost of goods, and operating performance for the selected period</p>
				</div>
			</div>

			{/* ── Summary cards ── */}
			<div className="dashboard-stats">
				<StatCard icon={<PiHandCoinsDuotone />} tint="accent" label="Total revenue" value={formatCurrency(plData.totalRevenue, storeInfo.currency)} caption={`${plData.saleCount} sale transaction${plData.saleCount === 1 ? '' : 's'}`} />
				<StatCard icon={<PiScalesDuotone />} tint={plData.grossProfit >= 0 ? 'success' : 'danger'} label="Gross profit" value={formatCurrency(plData.grossProfit, storeInfo.currency)} valueColor={plData.grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'} caption={`Gross margin ${plData.grossMargin.toFixed(1)}%`} />
				<StatCard icon={<PiChartLineUpDuotone />} tint={plData.netProfit >= 0 ? 'success' : 'danger'} label="Net profit" value={formatCurrency(plData.netProfit, storeInfo.currency)} valueColor={plData.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'} caption={`Net margin ${plData.profitMargin.toFixed(1)}%`} />
				<StatCard icon={<PiBuildingsDuotone />} tint="neutral" label="Capital expenditure" value={formatCurrency(plData.totalAssetPurchases, storeInfo.currency)} caption="Not included in Net Profit" />
			</div>

			{/* ── Report period ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Report Period</h3>
				<div className="form-grid">
					<div>
						<label style={fieldLabelStyle}>Period</label>
						<div style={{ position: 'relative' }}>
							<PiCalendarBlankDuotone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
							<select
								value={dateRange}
								onChange={e => setDateRange(e.target.value)}
								disabled={loading}
								style={{ paddingLeft: 32 }}
							>
								<option value="thisMonth">This Month</option>
								<option value="lastMonth">Last Month</option>
								<option value="thisYear">This Year</option>
								<option value="custom">Custom Range</option>
							</select>
						</div>
					</div>
					{dateRange === 'custom' && (
						<>
							<div>
								<label style={fieldLabelStyle}>Start Date</label>
								<input
									type="date"
									value={startDate}
									onChange={e => setStartDate(e.target.value)}
									disabled={loading}
									style={{ cursor: 'pointer' }}
								/>
							</div>
							<div>
								<label style={fieldLabelStyle}>End Date</label>
								<input
									type="date"
									value={endDate}
									onChange={e => setEndDate(e.target.value)}
									disabled={loading}
									style={{ cursor: 'pointer' }}
								/>
							</div>
						</>
					)}
					{rangeInvalid && (
						<div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontSize: 13 }}>
							<PiWarningCircleDuotone size={15} /> Start date must be before end date.
						</div>
					)}
					{plData.orphanedSaleCount > 0 && (
						<div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warning)', fontSize: 13 }}>
							<PiWarningCircleDuotone size={15} /> {plData.orphanedSaleCount} sale{plData.orphanedSaleCount === 1 ? '' : 's'} in this period reference a deleted item — its cost is excluded from COGS, so Gross Profit may be slightly overstated.
						</div>
					)}
					<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
						<button onClick={downloadPdf} disabled={loading || rangeInvalid} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							<PiFilePdfDuotone size={15} /> {loading ? 'Loading…' : 'Download PDF'}
						</button>
					</div>
				</div>
			</div>

			{/* ── Printable statement (kept as literal black-on-white paper — not themed) ── */}
			{loading ? (
				<div className="card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: 'var(--text-muted)', fontSize: 15 }}>
					<div style={{ textAlign: 'center' }}>
						<div style={{
							width: 40, height: 40,
							border: '4px solid var(--border)',
							borderTop: '4px solid var(--accent)',
							borderRadius: '50%',
							animation: 'spin 1s linear infinite',
							margin: '0 auto 16px'
						}}></div>
						Loading profit &amp; loss data…
					</div>
				</div>
			) : rangeInvalid ? (
				<div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
					Fix the date range above to generate the statement.
				</div>
			) : (
			<div className="card">
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
							<div><strong>Status:</strong> {plData.netProfit >= 0 ? 'PROFITABLE' : 'LOSS'}</div>
							<div><strong>Gross Margin:</strong> {plData.grossMargin.toFixed(2)}%</div>
							<div><strong>Net Margin:</strong> {plData.profitMargin.toFixed(2)}%</div>
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
								<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>{formatCurrency(plData.totalRevenue, storeInfo.currency)}</td>
							</tr>
							<tr>
								<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px', paddingLeft: '20px' }}>Total Sales ({plData.saleCount} transactions)</td>
								<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>{formatCurrency(plData.totalRevenue, storeInfo.currency)}</td>
							</tr>
							<tr style={{ background: '#ffe8e8' }}>
								<td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>COST OF GOODS SOLD</td>
								<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>{formatCurrency(plData.totalCOGS, storeInfo.currency)}</td>
							</tr>
							<tr>
								<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px', paddingLeft: '20px' }}>Cost of Sold Items ({plData.saleCount} transactions)</td>
								<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>{formatCurrency(plData.totalCOGS, storeInfo.currency)}</td>
							</tr>
							<tr style={{ background: '#e8f5e8' }}>
								<td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>GROSS PROFIT</td>
								<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>{formatCurrency(plData.grossProfit, storeInfo.currency)}</td>
							</tr>
							<tr style={{ background: '#ffe8e8' }}>
								<td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>OPERATING EXPENSES</td>
								<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>{formatCurrency(plData.totalExpenses, storeInfo.currency)}</td>
							</tr>
							{plData.expensesByType.map(exp => (
								<tr key={exp.type}>
									<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px', paddingLeft: '20px' }}>{exp.type} ({exp.count} {exp.count === 1 ? 'entry' : 'entries'})</td>
									<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>{formatCurrency(exp.amount, storeInfo.currency)}</td>
								</tr>
							))}
							<tr style={{ background: '#ffe8e8' }}>
								<td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>PAYROLL</td>
								<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>{formatCurrency(plData.totalSalaries, storeInfo.currency)}</td>
							</tr>
							<tr>
								<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '13px', paddingLeft: '20px' }}>{plData.employeeCount} employee{plData.employeeCount === 1 ? '' : 's'} × {plData.monthsInPeriod} month{plData.monthsInPeriod === 1 ? '' : 's'} in period</td>
								<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '13px' }}>{formatCurrency(plData.totalSalaries, storeInfo.currency)}</td>
							</tr>
							<tr style={{ background: plData.netProfit >= 0 ? '#e8f5e8' : '#ffe8e8', borderTop: '3px solid #333' }}>
								<td style={{ border: '1px solid #ddd', padding: '15px', fontSize: '16px', fontWeight: 'bold' }}>NET PROFIT (OPERATING)</td>
								<td style={{ border: '1px solid #ddd', padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>{formatCurrency(plData.netProfit, storeInfo.currency)}</td>
							</tr>
							<tr style={{ background: '#f5f5f5' }}>
								<td style={{ border: '1px solid #ddd', padding: '12px', fontSize: '13px', fontWeight: 'bold', color: '#555' }}>CAPITAL EXPENDITURE (memo — excluded from Net Profit)</td>
								<td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold', color: '#555' }}>{formatCurrency(plData.totalAssetPurchases, storeInfo.currency)}</td>
							</tr>
							<tr>
								<td style={{ border: '1px solid #ddd', padding: '10px', fontSize: '12px', paddingLeft: '20px', color: '#777' }}>Assets Bought ({plData.assetCount} items) — capitalized, not expensed</td>
								<td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontSize: '12px', color: '#777' }}>{formatCurrency(plData.totalAssetPurchases, storeInfo.currency)}</td>
							</tr>
						</tbody>
					</table>

					<p style={{ margin: '-10px 0 20px', fontSize: '11px', color: '#999', lineHeight: 1.5 }}>
						Capital expenditure (asset purchases) is reported separately above and is not deducted from Net Profit — these are long-lived assets that should be depreciated over their useful life rather than expensed in the month purchased.
					</p>

					<div style={{ marginTop: '30px', padding: '20px', background: plData.netProfit >= 0 ? '#e8f5e8' : '#ffe8e8', border: `2px solid ${plData.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}`, borderRadius: '8px' }}>
						<div style={{ textAlign: 'center' }}>
							<h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: plData.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
								{plData.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}
							</h2>
							<div style={{ fontSize: '32px', fontWeight: 'bold', color: plData.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
								{formatCurrency(Math.abs(plData.netProfit), storeInfo.currency)}
							</div>
							<div style={{ marginTop: '10px', fontSize: '16px', color: '#666' }}>
								Net Margin: {plData.profitMargin.toFixed(2)}%
							</div>
						</div>
					</div>

					<div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
						<p>This statement is generated automatically from the inventory management system</p>
						<p>For detailed analysis, please contact the management</p>
					</div>
				</div>
			</div>
			)}
		</div>
	)
}
