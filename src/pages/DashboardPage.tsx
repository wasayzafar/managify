import { useMemo, useState, useEffect, type ReactNode, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useItems, usePurchases, useSales, useInventory } from '../hooks/useDataQueries'
import { StatsSkeleton } from '../components/LoadingSkeleton'
import { seedTestData } from '../utils/testDataSeeder'
import { loadCurrency, formatCurrency } from '../utils/currency'
import AdPopup from '../components/AdPopup'
import { StatCard } from '../ui/StatCard'
import AreaChart from '../ui/AreaChart'
import {
	PiCurrencyDollarDuotone, PiCalendarDotsDuotone, PiChartLineUpDuotone, PiChartLineDownDuotone,
	PiReceiptDuotone, PiSparkleDuotone, PiPackageDuotone, PiStackDuotone, PiWarningCircleDuotone,
	PiPlantDuotone, PiTagDuotone, PiCubeDuotone, PiBarcodeDuotone, PiCalendarBlankDuotone,
	PiListChecksDuotone, PiStorefrontDuotone, PiDatabaseDuotone, PiScanDuotone, PiFileTextDuotone,
	PiCheckCircleDuotone, PiInvoiceDuotone, PiArrowRightDuotone, PiLightbulbFilamentDuotone,
} from 'react-icons/pi'

const TIPS = [
	'Keep your inventory updated to avoid stockouts and improve sales.',
	'Review your low-stock alerts weekly so restocking never catches you off guard.',
	'Chase overdue credits early — the longer they sit, the harder they are to collect.',
	'Compare this month\'s revenue trend to last month to spot slow periods early.',
	'Export a PDF inventory report before month-end for easy record keeping.',
]

function ActionLink({ to, icon, children, primary = false }: { to: string; icon: ReactNode; children: ReactNode; primary?: boolean }) {
	if (primary) {
		return (
			<Link
				to={to}
				style={{
					display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8,
					textDecoration: 'none', fontSize: 12.5, fontWeight: 600,
					background: 'var(--accent)', color: 'var(--accent-contrast)',
				}}
			>
				<span style={{ display: 'flex', flexShrink: 0, fontSize: 15 }}>{icon}</span>
				<span style={{ flex: 1 }}>{children}</span>
				<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: 'color-mix(in srgb, var(--accent-contrast) 20%, transparent)', flexShrink: 0 }}>
					<PiArrowRightDuotone size={10} />
				</span>
			</Link>
		)
	}
	return (
		<Link
			to={to}
			style={{
				display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px', borderRadius: 7,
				textDecoration: 'none', fontSize: 12.5, fontWeight: 500, color: 'var(--text)',
				background: 'transparent', transition: 'background 0.15s ease',
			}}
			onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
			onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
		>
			<span style={{ display: 'flex', flexShrink: 0, color: 'var(--text-muted)', fontSize: 15 }}>{icon}</span>
			<span style={{ flex: 1 }}>{children}</span>
			<PiArrowRightDuotone style={{ opacity: 0.35, flexShrink: 0, fontSize: 13 }} />
		</Link>
	)
}

function StatusRow({ icon, label, ok, okText, badText, last = false }: { icon: ReactNode; label: string; ok: boolean; okText: string; badText: string; last?: boolean }) {
	return (
		<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<span style={{ display: 'flex', color: 'var(--text-muted)', fontSize: 15 }}>{icon}</span>
				<span style={{ fontSize: 12.5 }}>{label}</span>
			</div>
			<span style={{
				display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
				padding: '2px 8px', borderRadius: 20,
				background: ok ? 'var(--success-bg)' : 'var(--danger-bg)',
				color: ok ? 'var(--success)' : 'var(--danger)',
			}}>
				{ok ? <PiCheckCircleDuotone /> : <PiWarningCircleDuotone />}
				{ok ? okText : badText}
			</span>
		</div>
	)
}

export default function DashboardPage() {
	const { data: items = [], isLoading: itemsLoading } = useItems()
	const { data: purchases = [], isLoading: purchasesLoading } = usePurchases()
	const { data: sales = [], isLoading: salesLoading } = useSales()
	const { data: inventory = [], isLoading: inventoryLoading } = useInventory()
	const [seeding, setSeeding] = useState(false)
	const [currency, setCurrency] = useState('PKR')

	useEffect(() => {
		loadCurrency().then(curr => setCurrency(curr))
	}, [])

	const loading = itemsLoading || purchasesLoading || salesLoading || inventoryLoading

	const handleSeedData = async () => {
		setSeeding(true)
		try {
			await seedTestData()
			window.location.reload()
		} catch (error) {
			console.error('Error seeding data:', error)
		} finally {
			setSeeding(false)
		}
	}

	const stats = useMemo(() => {
		const totalItems = items.length
		const totalPurchases = purchases.length
		const totalSales = sales.length
		const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0)

		const calcRevenue = (salesArr: typeof sales) =>
			salesArr.reduce((sum, sale) => {
				if (sale.actualPrice != null) return sum + (sale.quantity || 0) * sale.actualPrice
				const item = items.find(i => i.id === sale.itemId)
				return sum + (sale.quantity || 0) * (item?.price || 0)
			}, 0)

		const calcCOGS = (salesArr: typeof sales) =>
			salesArr.reduce((sum, sale) => {
				const item = items.find(i => i.id === sale.itemId)
				if (!item) return sum
				const itemPurchases = purchases.filter(p => p.itemId === item.id)
				const latestPurchase = itemPurchases
					.slice()
					.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())[0]
				const costPrice = latestPurchase?.costPrice ?? item.costPrice ?? 0
				return sum + (sale.quantity || 0) * costPrice
			}, 0)

		const totalRevenue = calcRevenue(sales)
		const totalCOGS = calcCOGS(sales)
		const grossProfit = totalRevenue - totalCOGS

		const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
		const lowStockItems = inventory.filter(item => item.stock < 5).length

		// Today
		const today = new Date().toISOString().slice(0, 10)
		const todaySalesData = sales.filter(sale => {
			const saleDate = sale.date ? new Date(sale.date).toISOString().slice(0, 10) : ''
			return saleDate === today
		})
		const todayRevenue = calcRevenue(todaySalesData)
		const todaySalesCount = todaySalesData.length

		// Credit alerts
		const now = new Date()
		const unpaidPurchaseCredits = purchases.filter(p => p.paymentType === 'credit' && !p.isPaid)
		const unpaidSaleCredits = sales.filter(s => s.paymentType === 'credit' && !s.isPaid)

		const purchaseCreditTotal = unpaidPurchaseCredits.reduce((sum, p) => sum + (p.costPrice || 0) * (p.quantity || p.qty || 0), 0)
		const saleCreditTotal = unpaidSaleCredits.reduce((sum, s) => sum + (s.actualPrice || 0) * (s.quantity || 0), 0)

		const getDays = (d: string) => Math.ceil((new Date(d).getTime() - now.getTime()) / 86400000)
		const purchaseCreditOverdue = unpaidPurchaseCredits.filter(p => p.creditDeadline && getDays(p.creditDeadline) < 0).length
		const purchaseCreditDueSoon = unpaidPurchaseCredits.filter(p => p.creditDeadline && getDays(p.creditDeadline) >= 0 && getDays(p.creditDeadline) <= 7).length
		const saleCreditOverdue = unpaidSaleCredits.filter(s => s.creditDeadline && getDays(s.creditDeadline) < 0).length
		const saleCreditDueSoon = unpaidSaleCredits.filter(s => s.creditDeadline && getDays(s.creditDeadline) >= 0 && getDays(s.creditDeadline) <= 7).length

		// ── Trend deltas: rolling 30-day window vs the 30 days before it ──
		const msDay = 86400000
		const nowMs = now.getTime()
		const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)
		const inRange = (arr: typeof sales, fromMs: number, toMs: number) => arr.filter(x => {
			const t = x.date ? new Date(x.date).getTime() : NaN
			return !isNaN(t) && t >= fromMs && t < toMs
		})
		const pct = (curr: number, prev: number) => prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : (curr !== 0 ? 100 : 0)

		const last30Sales = inRange(sales, nowMs - 30 * msDay, nowMs)
		const prev30Sales = inRange(sales, nowMs - 60 * msDay, nowMs - 30 * msDay)
		const last30Revenue = calcRevenue(last30Sales)
		const prev30Revenue = calcRevenue(prev30Sales)
		const last30Profit = last30Revenue - calcCOGS(last30Sales)
		const prev30Profit = prev30Revenue - calcCOGS(prev30Sales)

		const revenueDelta = pct(last30Revenue, prev30Revenue)
		const profitDelta = pct(last30Profit, prev30Profit)
		const salesDelta = pct(last30Sales.length, prev30Sales.length)

		const yesterdaySalesData = sales.filter(s => s.date && dayKey(new Date(s.date).getTime()) === dayKey(nowMs - msDay))
		const yesterdayRevenue = calcRevenue(yesterdaySalesData)
		const todayRevenueDelta = pct(todayRevenue, yesterdayRevenue)
		const todaySalesDelta = pct(todaySalesCount, yesterdaySalesData.length)

		// ── 14-day stock / low-stock sparklines, reconstructed from real purchase & sale history ──
		const SPARK_DAYS = 14
		const dayKeys = Array.from({ length: SPARK_DAYS }, (_, i) => dayKey(nowMs - (SPARK_DAYS - 1 - i) * msDay))
		const dayIndex: Record<string, number> = {}
		dayKeys.forEach((d, i) => { dayIndex[d] = i })

		const deltaByDay: Record<string, number>[] = dayKeys.map(() => ({}))
		purchases.forEach(p => {
			if (!p.date) return
			const idx = dayIndex[dayKey(new Date(p.date).getTime())]
			if (idx === undefined) return
			deltaByDay[idx][p.itemId] = (deltaByDay[idx][p.itemId] || 0) + (p.qty ?? p.quantity ?? 0)
		})
		sales.forEach(s => {
			if (!s.date) return
			const idx = dayIndex[dayKey(new Date(s.date).getTime())]
			if (idx === undefined) return
			deltaByDay[idx][s.itemId] = (deltaByDay[idx][s.itemId] || 0) - (s.quantity ?? 0)
		})

		const itemIds = inventory.map(inv => inv.itemId)
		const stockSeriesByItem: Record<string, number[]> = {}
		itemIds.forEach(id => {
			const series = new Array(SPARK_DAYS).fill(0)
			series[SPARK_DAYS - 1] = inventory.find(inv => inv.itemId === id)?.stock || 0
			for (let i = SPARK_DAYS - 2; i >= 0; i--) {
				series[i] = series[i + 1] - (deltaByDay[i + 1][id] || 0)
			}
			stockSeriesByItem[id] = series
		})
		const stockSparkline = dayKeys.map((_, i) => itemIds.reduce((sum, id) => sum + stockSeriesByItem[id][i], 0))
		const lowStockSparkline = dayKeys.map((_, i) => itemIds.reduce((cnt, id) => cnt + (stockSeriesByItem[id][i] < 5 ? 1 : 0), 0))

		return {
			totalItems,
			totalPurchases,
			totalSales,
			totalStock,
			totalRevenue,
			totalCost: totalCOGS,
			grossProfit,
			profitMargin,
			lowStockItems,
			todayRevenue,
			todaySales: todaySalesCount,
			unpaidPurchaseCredits: unpaidPurchaseCredits.length,
			purchaseCreditTotal,
			purchaseCreditOverdue,
			purchaseCreditDueSoon,
			unpaidSaleCredits: unpaidSaleCredits.length,
			saleCreditTotal,
			saleCreditOverdue,
			saleCreditDueSoon,
			revenueDelta,
			profitDelta,
			salesDelta,
			todayRevenueDelta,
			todaySalesDelta,
			stockSparkline,
			lowStockSparkline,
		}
	}, [items, purchases, sales, inventory])

	const [chartRange, setChartRange] = useState<'7d' | '30d' | 'month' | 'year'>('month')
	const revenueSeries = useMemo(() => {
		const now = new Date()
		const saleValue = (sale: typeof sales[number]) =>
			sale.actualPrice != null ? (sale.quantity || 0) * sale.actualPrice : (sale.quantity || 0) * (items.find(i => i.id === sale.itemId)?.price || 0)

		if (chartRange === 'year') {
			const monthCount = now.getMonth() + 1
			const buckets = Array.from({ length: monthCount }, (_, i) => ({ label: new Date(now.getFullYear(), i, 1).toLocaleDateString(undefined, { month: 'short' }), value: 0 }))
			sales.forEach(s => {
				if (!s.date) return
				const d = new Date(s.date)
				if (d.getFullYear() !== now.getFullYear()) return
				buckets[d.getMonth()].value += saleValue(s)
			})
			return buckets
		}

		const dayCount = chartRange === '7d' ? 7 : chartRange === '30d' ? 30 : now.getDate()
		const start = chartRange === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getTime() - (dayCount - 1) * 86400000)
		const keyIndex: Record<string, number> = {}
		const buckets = Array.from({ length: dayCount }, (_, i) => {
			const d = new Date(start.getTime() + i * 86400000)
			keyIndex[d.toISOString().slice(0, 10)] = i
			return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: 0 }
		})
		sales.forEach(s => {
			if (!s.date) return
			const idx = keyIndex[new Date(s.date).toISOString().slice(0, 10)]
			if (idx === undefined) return
			buckets[idx].value += saleValue(s)
		})
		return buckets
	}, [sales, items, chartRange])

	if (loading) {
		return <StatsSkeleton />
	}

	const profitPositive = stats.grossProfit >= 0
	const stockHealthy = stats.lowStockItems === 0
	const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
	const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
	const tipOfTheDay = TIPS[dayOfYear % TIPS.length]

	return (
		<div>
			<AdPopup />
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: '16px' }}>
				<div>
					<h1 style={{ margin: '0 0 2px 0', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>Dashboard</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>{today} &middot; Welcome to Managify Management System</p>
				</div>
				{items.length === 0 && (
					<button
						onClick={handleSeedData}
						disabled={seeding}
						style={{
							display: 'flex', alignItems: 'center', gap: 8,
							padding: '7px 14px',
							background: seeding ? 'var(--secondary-btn-bg)' : 'var(--accent)',
							color: seeding ? 'var(--secondary-btn-text)' : 'var(--accent-contrast)',
							border: 'none',
							borderRadius: '8px',
							fontSize: 12.5, fontWeight: 600,
							cursor: seeding ? 'not-allowed' : 'pointer'
						}}
					>
						<PiPlantDuotone size={15} />
						{seeding ? 'Seeding…' : 'Add Sample Data'}
					</button>
				)}
			</div>

			<div className="dashboard-stats">
				<StatCard
					icon={<PiCurrencyDollarDuotone />} tint="neutral" label="Total revenue"
					value={formatCurrency(stats.totalRevenue, currency)}
					caption="All-time sales" delta={stats.revenueDelta}
				/>
				<StatCard
					icon={<PiCalendarDotsDuotone />} tint="neutral" label="Today's revenue"
					value={formatCurrency(stats.todayRevenue, currency)}
					caption={`${stats.todaySales} sale${stats.todaySales === 1 ? '' : 's'} today`} delta={stats.todayRevenueDelta}
				/>
				<StatCard
					icon={profitPositive ? <PiChartLineUpDuotone /> : <PiChartLineDownDuotone />}
					tint={profitPositive ? 'success' : 'danger'} label="Gross profit"
					value={formatCurrency(stats.grossProfit, currency)}
					valueColor={profitPositive ? 'var(--success)' : 'var(--danger)'}
					caption={`${stats.profitMargin.toFixed(1)}% margin, excl. expenses`} delta={stats.profitDelta}
				/>
				<StatCard
					icon={<PiReceiptDuotone />} tint="neutral" label="Total sales"
					value={stats.totalSales}
					caption="Transactions completed" delta={stats.salesDelta}
				/>
				<StatCard
					icon={<PiSparkleDuotone />} tint="neutral" label="Today's sales"
					value={stats.todaySales}
					caption="Transactions today" delta={stats.todaySalesDelta}
				/>
				<StatCard
					icon={<PiPackageDuotone />} tint="neutral" label="Total items"
					value={stats.totalItems}
					caption="Products in catalog"
				/>
			</div>

			{/* Stock trend + revenue overview */}
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
				<div style={{ flex: '1 1 200px' }}>
					<StatCard
						icon={<PiStackDuotone />} tint="neutral" label="Total stock"
						value={stats.totalStock}
						caption="Units available" sparkline={stats.stockSparkline}
					/>
				</div>
				<div style={{ flex: '1 1 200px' }}>
					<StatCard
						icon={<PiWarningCircleDuotone />} tint={stockHealthy ? 'success' : 'danger'} label="Low stock alert"
						value={stats.lowStockItems}
						valueColor={stockHealthy ? 'var(--success)' : 'var(--danger)'}
						caption={stockHealthy ? 'All items well stocked' : 'Items need restocking'} sparkline={stats.lowStockSparkline}
					/>
				</div>
				<div className="card" style={{ flex: '2 1 420px', marginBottom: 0, padding: '12px 14px' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
						<h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Revenue Overview</h3>
						<select
							value={chartRange}
							onChange={e => setChartRange(e.target.value as typeof chartRange)}
							style={{ width: 'auto', padding: '3px 8px', fontSize: 11.5, borderRadius: 6 }}
						>
							<option value="7d">Last 7 Days</option>
							<option value="30d">Last 30 Days</option>
							<option value="month">This Month</option>
							<option value="year">This Year</option>
						</select>
					</div>
					<AreaChart data={revenueSeries} formatValue={v => formatCurrency(v, currency)} />
				</div>
			</div>

			{/* Credit Alerts */}
			{(stats.unpaidPurchaseCredits > 0 || stats.unpaidSaleCredits > 0) && (
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginBottom: 16 }}>
					{stats.unpaidPurchaseCredits > 0 && (
						<Link to="/credits" style={{ textDecoration: 'none' }}>
							<div style={{ background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', borderLeft: `3px solid ${stats.purchaseCreditOverdue > 0 ? 'var(--danger)' : 'var(--warning)'}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
								onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
								onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
											<span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--warning)', fontWeight: 700, fontSize: 12.5 }}>
												<PiInvoiceDuotone size={15} /> Purchase Credits
											</span>
											<span style={{ background: 'var(--warning)', color: 'var(--warning-bg)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{stats.unpaidPurchaseCredits} unpaid</span>
										</div>
										<div style={{ color: 'var(--text)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 3 }}>{formatCurrency(stats.purchaseCreditTotal, currency)}</div>
										<div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
											{stats.purchaseCreditOverdue > 0 && <span style={{ color: 'var(--danger)' }}>{stats.purchaseCreditOverdue} overdue</span>}
											{stats.purchaseCreditDueSoon > 0 && <span style={{ color: 'var(--warning)' }}>{stats.purchaseCreditDueSoon} due within 7 days</span>}
											{stats.purchaseCreditOverdue === 0 && stats.purchaseCreditDueSoon === 0 && <span style={{ color: 'var(--text-muted)' }}>No urgent deadlines</span>}
										</div>
									</div>
									<PiArrowRightDuotone style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
								</div>
							</div>
						</Link>
					)}
					{stats.unpaidSaleCredits > 0 && (
						<Link to="/credits" style={{ textDecoration: 'none' }}>
							<div style={{ background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', borderLeft: `3px solid ${stats.saleCreditOverdue > 0 ? 'var(--danger)' : 'var(--success)'}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
								onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
								onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
											<span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 700, fontSize: 12.5 }}>
												<PiInvoiceDuotone size={15} /> Sales Credits
											</span>
											<span style={{ background: 'var(--success)', color: 'var(--success-bg)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{stats.unpaidSaleCredits} unpaid</span>
										</div>
										<div style={{ color: 'var(--text)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 3 }}>{formatCurrency(stats.saleCreditTotal, currency)}</div>
										<div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
											{stats.saleCreditOverdue > 0 && <span style={{ color: 'var(--danger)' }}>{stats.saleCreditOverdue} overdue</span>}
											{stats.saleCreditDueSoon > 0 && <span style={{ color: 'var(--warning)' }}>{stats.saleCreditDueSoon} due within 7 days</span>}
											{stats.saleCreditOverdue === 0 && stats.saleCreditDueSoon === 0 && <span style={{ color: 'var(--text-muted)' }}>No urgent deadlines</span>}
										</div>
									</div>
									<PiArrowRightDuotone style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
								</div>
							</div>
						</Link>
					)}
				</div>
			)}

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
				<div className="card" style={{ padding: 10, marginBottom: 0 }}>
					<h3 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700 }}>Quick Actions</h3>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
						<ActionLink to="/billing" icon={<PiReceiptDuotone />} primary>Create New Bill</ActionLink>
						<ActionLink to="/purchases" icon={<PiTagDuotone />}>Add Purchase</ActionLink>
						<ActionLink to="/items" icon={<PiCubeDuotone />}>Manage Items</ActionLink>
						<ActionLink to="/scan" icon={<PiBarcodeDuotone />}>Scan Barcode</ActionLink>
					</div>
				</div>

				<div className="card" style={{ padding: 10, marginBottom: 0 }}>
					<h3 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700 }}>Reports</h3>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
						<ActionLink to="/profit-loss" icon={<PiChartLineUpDuotone />}>Profit &amp; Loss Statement</ActionLink>
						<ActionLink to="/daily-sales" icon={<PiCalendarBlankDuotone />}>Daily Sales Report</ActionLink>
						<ActionLink to="/sales" icon={<PiListChecksDuotone />}>View All Sales</ActionLink>
						<ActionLink to="/purchases" icon={<PiStorefrontDuotone />}>View All Purchases</ActionLink>
					</div>
				</div>

				<div className="card" style={{ padding: 10, marginBottom: 0 }}>
					<h3 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700 }}>System Status</h3>
					<div>
						<StatusRow icon={<PiDatabaseDuotone />} label="Database Status" ok okText="Online" badText="Offline" />
						<StatusRow icon={<PiScanDuotone />} label="Scanner Status" ok okText="Ready" badText="Unavailable" />
						<StatusRow icon={<PiFileTextDuotone />} label="PDF Generation" ok okText="Available" badText="Unavailable" />
						<StatusRow icon={<PiWarningCircleDuotone />} label="Low Stock Items" ok={stockHealthy} okText="Good" badText="Alert" last />
					</div>
				</div>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}>
				<PiLightbulbFilamentDuotone style={{ color: 'var(--warning)', fontSize: 15, flexShrink: 0 }} />
				<span style={{ color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text)', fontWeight: 600 }}>Tip:</strong> {tipOfTheDay}</span>
			</div>

			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10, padding: '0 4px', fontSize: 11.5, color: 'var(--text-faint)' }}>
				<span>Managify v0.1.0</span>
				<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
					All systems operational
				</span>
			</div>
		</div>
	)
}
