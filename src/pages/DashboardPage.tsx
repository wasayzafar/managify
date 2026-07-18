import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useItems, usePurchases, useSales, useInventory } from '../hooks/useDataQueries'
import { StatsSkeleton } from '../components/LoadingSkeleton'
import { seedTestData } from '../utils/testDataSeeder'
import { loadCurrency, formatCurrency } from '../utils/currency'

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
		}
	}, [items, purchases, sales, inventory])

	if (loading) {
		return <StatsSkeleton />
	}

	return (
		<div>
			<div className="card" style={{ marginBottom: '24px' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<div>
						<h1 style={{ margin: '0 0 8px 0', fontSize: '28px' }}>Dashboard</h1>
						<p style={{ margin: '0', color: '#8b949e' }}>Welcome to Managify Management System</p>
					</div>
					{items.length === 0 && (
						<button 
							onClick={handleSeedData}
							disabled={seeding}
							style={{
								padding: '10px 20px',
								backgroundColor: seeding ? '#ccc' : '#007bff',
								color: 'white',
								border: 'none',
								borderRadius: '5px',
								cursor: seeding ? 'not-allowed' : 'pointer'
							}}
						>
							{seeding ? '🌱 Seeding...' : '🌱 Add Sample Data'}
						</button>
					)}
				</div>
			</div>

			<div className="dashboard-stats">
				<div className="stat-card">
					<h3>Total Items</h3>
					<p className="value">{stats.totalItems}</p>
					<p className="change">Products in catalog</p>
				</div>
				
				<div className="stat-card">
					<h3>Total Stock</h3>
					<p className="value">{stats.totalStock}</p>
					<p className="change">Units available</p>
				</div>
				
				<div className="stat-card">
					<h3>Total Sales</h3>
					<p className="value">{stats.totalSales}</p>
					<p className="change">Transactions completed</p>
				</div>
				
				<div className="stat-card">
					<h3>Total Revenue</h3>
					<p className="value">{formatCurrency(stats.totalRevenue, currency)}</p>
					<p className="change">All time sales</p>
				</div>
				
				<div className="stat-card">
					<h3>Today's Sales</h3>
					<p className="value">{stats.todaySales}</p>
					<p className="change">Transactions today</p>
				</div>
				
				<div className="stat-card">
					<h3>Today's Revenue</h3>
					<p className="value">{formatCurrency(stats.todayRevenue, currency)}</p>
					<p className="change">Sales today</p>
				</div>
				
				<div className="stat-card">
					<h3>Gross Profit (Excl. Expenses)</h3>
					<p className="value" style={{ color: stats.grossProfit >= 0 ? '#4caf50' : '#f44336' }}>
						{formatCurrency(stats.grossProfit, currency)}
					</p>
					<p className="change">Profit margin: {stats.profitMargin.toFixed(1)}%</p>
				</div>
				
				<div className="stat-card">
					<h3>Low Stock Alert</h3>
					<p className="value" style={{ color: stats.lowStockItems > 0 ? '#f44336' : '#4caf50' }}>
						{stats.lowStockItems}
					</p>
					<p className="change">Items need restocking</p>
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
				<div className="card">
					<h3 style={{ margin: '0 0 16px 0' }}>Quick Actions</h3>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
						<Link to="/billing" style={{ display: 'block', padding: '12px', background: '#2263ff', color: 'white', borderRadius: '8px', textAlign: 'center', textDecoration: 'none' }}>
							Create New Bill
						</Link>
						<Link to="/purchases" style={{ display: 'block', padding: '12px', background: '#233043', color: 'white', borderRadius: '8px', textAlign: 'center', textDecoration: 'none' }}>
							Add Purchase
						</Link>
						<Link to="/items" style={{ display: 'block', padding: '12px', background: '#233043', color: 'white', borderRadius: '8px', textAlign: 'center', textDecoration: 'none' }}>
							Manage Items
						</Link>
						<Link to="/scan" style={{ display: 'block', padding: '12px', background: '#233043', color: 'white', borderRadius: '8px', textAlign: 'center', textDecoration: 'none' }}>
							Scan Barcode
						</Link>
					</div>
				</div>

				<div className="card">
					<h3 style={{ margin: '0 0 16px 0' }}>Reports</h3>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
						<Link to="/profit-loss" style={{ display: 'block', padding: '12px', background: '#233043', color: 'white', borderRadius: '8px', textAlign: 'center', textDecoration: 'none' }}>
							Profit & Loss Statement
						</Link>
						<Link to="/daily-sales" style={{ display: 'block', padding: '12px', background: '#233043', color: 'white', borderRadius: '8px', textAlign: 'center', textDecoration: 'none' }}>
							Daily Sales Report
						</Link>
						<Link to="/sales" style={{ display: 'block', padding: '12px', background: '#233043', color: 'white', borderRadius: '8px', textAlign: 'center', textDecoration: 'none' }}>
							View All Sales
						</Link>
						<Link to="/purchases" style={{ display: 'block', padding: '12px', background: '#233043', color: 'white', borderRadius: '8px', textAlign: 'center', textDecoration: 'none' }}>
							View All Purchases
						</Link>
					</div>
				</div>

				<div className="card">
					<h3 style={{ margin: '0 0 16px 0' }}>System Status</h3>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<span>Database Status</span>
							<span style={{ color: '#4caf50', fontWeight: 'bold' }}>✓ Online</span>
						</div>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<span>Scanner Status</span>
							<span style={{ color: '#4caf50', fontWeight: 'bold' }}>✓ Ready</span>
						</div>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<span>PDF Generation</span>
							<span style={{ color: '#4caf50', fontWeight: 'bold' }}>✓ Available</span>
						</div>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<span>Low Stock Items</span>
							<span style={{ color: stats.lowStockItems > 0 ? '#f44336' : '#4caf50', fontWeight: 'bold' }}>
								{stats.lowStockItems > 0 ? '⚠ Alert' : '✓ Good'}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}