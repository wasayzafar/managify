import React, { useState } from "react";
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useDataPrefetch } from '../hooks/useDataPrefetch'
import { SEO } from '../components/SEO'
import { useAuth } from '../auth/useAuth'
import { useBranch } from '../auth/BranchContext'
import Header from './Header'
import {
	PiSquaresFourDuotone, PiStackDuotone, PiCubeDuotone, PiShoppingBagDuotone, PiShoppingCartDuotone,
	PiReceiptDuotone, PiChartLineUpDuotone, PiCalendarBlankDuotone, PiInvoiceDuotone, PiUsersDuotone,
	PiWalletDuotone, PiStorefrontDuotone, PiArchiveDuotone, PiGearDuotone, PiShieldCheckDuotone,
	PiCrownDuotone, PiRocketDuotone, PiBuildingsDuotone, PiUserGearDuotone,
} from 'react-icons/pi'

const ADMIN_EMAILS = ['nativeedgestudio.space@gmail.com', 'nativeedge.studio@gmail.com']

export default function App() {
	const loc = useLocation()
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	const { prefetchPageData } = useDataPrefetch()
	const { user } = useAuth()
	const isAdmin = ADMIN_EMAILS.includes(user?.email ?? '')
	const { role } = useBranch()

	// Prefetch data based on current route
	React.useEffect(() => {
		const path = loc.pathname
		if (path === '/') {
			prefetchPageData('dashboard')
		} else if (path.startsWith('/inventory')) {
			prefetchPageData('inventory')
		} else if (path.startsWith('/sales')) {
			prefetchPageData('sales')
		} else if (path.startsWith('/purchases')) {
			prefetchPageData('purchases')
		} else if (path.startsWith('/profit-loss')) {
			prefetchPageData('profit-loss')
		}
	}, [loc.pathname, prefetchPageData])

	return (
		<div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
			<SEO />
			<header className="mobile-header">
				<button className="mobile-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
				<div className="mobile-logo">
					<img src="./logo.png" alt="" width="24" />
					<span>Managify</span>
				</div>
			</header>
			{sidebarCollapsed && (
				<button
					onClick={() => setSidebarCollapsed(false)}
					className="sidebar-expand-btn"
					title="Open sidebar"
				>☰</button>
			)}
			<aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
				<div className="sidebar-header">
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<h1 className="logoBase"><img src="./logo.png" alt="" srcSet="" width="32" className="logo" />Managify</h1>
						<button
							onClick={() => setSidebarCollapsed(true)}
							className="sidebar-close-btn"
							title="Close sidebar"
						>×</button>
					</div>
					<p>Store Management System</p>
				</div>
				
				<nav className="sidebar-nav">
					<Link className={loc.pathname === '/' ? 'active' : ''} to="/">
						<PiSquaresFourDuotone />
						<span>Dashboard</span>
					</Link>
					<Link className={loc.pathname.startsWith('/inventory') ? 'active' : ''} to="/inventory">
						<PiStackDuotone />
						<span>Inventory</span>
					</Link>
					<Link className={loc.pathname.startsWith('/items') ? 'active' : ''} to="/items">
						<PiCubeDuotone />
						<span>Items</span>
					</Link>
					<Link className={loc.pathname.startsWith('/purchases') ? 'active' : ''} to="/purchases">
						<PiShoppingBagDuotone />
						<span>Purchases</span>
					</Link>
					<Link className={loc.pathname.startsWith('/sales') ? 'active' : ''} to="/sales">
						<PiShoppingCartDuotone />
						<span>Sales</span>
					</Link>
					<Link className={loc.pathname.startsWith('/billing') ? 'active' : ''} to="/billing">
						<PiReceiptDuotone />
						<span>Billing</span>
					</Link>
					<Link className={loc.pathname.startsWith('/profit-loss') ? 'active' : ''} to="/profit-loss">
						<PiChartLineUpDuotone />
						<span>Profit & Loss</span>
					</Link>
					<Link className={loc.pathname.startsWith('/daily-sales') ? 'active' : ''} to="/daily-sales">
						<PiCalendarBlankDuotone />
						<span>Daily Sales</span>
					</Link>

					<Link className={loc.pathname.startsWith('/credits') ? 'active' : ''} to="/credits">
						<PiInvoiceDuotone />
						<span>Credits</span>
					</Link>
					<Link className={loc.pathname.startsWith('/employees') ? 'active' : ''} to="/employees">
						<PiUsersDuotone />
						<span>Employees</span>
					</Link>
					<Link className={loc.pathname.startsWith('/expenses') ? 'active' : ''} to="/expenses">
						<PiWalletDuotone />
						<span>Expenses</span>
					</Link>
					<Link className={loc.pathname.startsWith('/suppliers') ? 'active' : ''} to="/suppliers">
						<PiStorefrontDuotone />
						<span>Vendors</span>
					</Link>
					<Link className={loc.pathname.startsWith('/assets') ? 'active' : ''} to="/assets">
						<PiArchiveDuotone />
						<span>Assets</span>
					</Link>
					{role === 'owner' && (
						<Link className={loc.pathname.startsWith('/branches') ? 'active' : ''} to="/branches">
							<PiBuildingsDuotone />
							<span>Branches</span>
						</Link>
					)}
					{role === 'owner' && (
						<Link className={loc.pathname.startsWith('/staff') ? 'active' : ''} to="/staff">
							<PiUserGearDuotone />
							<span>Staff</span>
						</Link>
					)}
					<Link className={loc.pathname.startsWith('/settings') ? 'active' : ''} to="/settings">
						<PiGearDuotone />
						<span>Settings</span>
					</Link>
					{isAdmin && (
						<Link className={loc.pathname.startsWith('/admin') ? 'active' : ''} to="/admin"
							style={{ marginTop: 8, background: 'color-mix(in srgb, var(--accent) 8%, transparent)', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}>
							<PiShieldCheckDuotone />
							<span>Admin Portal</span>
						</Link>
					)}
				</nav>

				<div className="sidebar-upgrade-card">
					<div className="sidebar-upgrade-icon"><PiCrownDuotone /></div>
					<div className="sidebar-upgrade-title">Upgrade to Pro</div>
					<p className="sidebar-upgrade-copy">Unlock advanced reports and powerful features.</p>
					<button type="button" className="sidebar-upgrade-btn"><PiRocketDuotone size={14} /> Upgrade Now</button>
				</div>
			</aside>
			{sidebarOpen && (
				<div 
					className="sidebar-overlay"
					onClick={() => setSidebarOpen(false)}
					style={{
						position: 'fixed',
						inset: 0,
						background: 'var(--overlay)',
						zIndex: 999,
						display: 'none'
					}}
				/>
			)}
			<main className="main-content">
				<Header />
				<Outlet />
			</main>
		</div>
	)
}
