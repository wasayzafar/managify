import React, { useState } from "react";
import { Link, Outlet, useLocation } from 'react-router-dom'

// Simple SVG icons
const DashboardIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
	</svg>
)

const InventoryIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
	</svg>
)

const ItemsIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
	</svg>
)

const PurchasesIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z"/>
	</svg>
)

const SalesIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M7 18C5.9 18 5.01 17.1 5.01 16S5.9 14 7 14 8.9 15.9 8.9 16 8.1 18 7 18ZM1 2V4H3L6.6 11.59L5.25 14.04C5.09 14.32 5 14.65 5 15C5 16.1 5.9 17 7 17H19V15H7.42C7.28 15 7.17 14.89 7.17 14.75L7.2 14.63L8.1 13H15.55C16.3 13 16.96 12.59 17.3 11.97L20.88 5H5.21L4.27 3H1V2ZM17 18C15.9 18 15.01 17.1 15.01 16S15.9 14 17 14 18.9 15.9 18.9 16 18.1 18 17 18Z"/>
	</svg>
)

const BillingIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
	</svg>
)

const ProfitLossIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z"/>
	</svg>
)

const DailySalesIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,19H5V5H19V19Z"/>
	</svg>
)

const ScanIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M4,4H10V2H4A2,2 0 0,0 2,4V10H4V4M20,2H14V4H20V10H22V4A2,2 0 0,0 20,2M4,14H2V20A2,2 0 0,0 4,22H10V20H4V14M22,14V20A2,2 0 0,1 20,22H14V20H20V14H22Z"/>
	</svg>
)

const CreditsIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M20,8H4V6H20M20,18H4V12H20M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z"/>
	</svg>
)

const EmployeesIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M16,4C18.21,4 20,5.79 20,8C20,10.21 18.21,12 16,12C13.79,12 12,10.21 12,8C12,5.79 13.79,4 16,4M16,14C20.42,14 24,15.79 24,18V20H8V18C8,15.79 11.58,14 16,14M6,6H2V4H6V6M6,10H2V8H6V10M6,14H2V12H6V14Z"/>
	</svg>
)

const ExpensesIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M7,15H9C9,16.08 10.37,17 12,17C13.63,17 15,16.08 15,15C15,13.9 13.96,13.5 11.76,12.97C9.64,12.44 7,11.78 7,9C7,7.21 8.47,5.69 10.5,5.18V3H13.5V5.18C15.53,5.69 17,7.21 17,9H15C15,7.92 13.63,7 12,7C10.37,7 9,7.92 9,9C9,10.1 10.04,10.5 12.24,11.03C14.36,11.56 17,12.22 17,15C17,16.79 15.53,18.31 13.5,18.82V21H10.5V18.82C8.47,18.31 7,16.79 7,15Z"/>
	</svg>
)

const SuppliersIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M12,2A3,3 0 0,1 15,5V7H20A1,1 0 0,1 21,8V19A1,1 0 0,1 20,20H4A1,1 0 0,1 3,19V8A1,1 0 0,1 4,7H9V5A3,3 0 0,1 12,2M12,4A1,1 0 0,0 11,5V7H13V5A1,1 0 0,0 12,4Z"/>
	</svg>
)

const SettingsIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor">
		<path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
	</svg>
)

export default function App() {
	const loc = useLocation()
	const [sidebarOpen, setSidebarOpen] = useState(false)

	return (
		<div className="app-shell">
			<header className="mobile-header">
				<button className="mobile-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
				<div className="mobile-logo">
					<img src="./logo.png" alt="" width="24" />
					<span>Managify</span>
				</div>
			</header>
			<aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
				<div className="sidebar-header">
					<h1 className="logoBase"><img src="./logo.png" alt="" srcSet="" width="32" className="logo" />Managify</h1>
					<p>Store Management System</p>
				</div>
				
				<nav className="sidebar-nav">
					<Link className={loc.pathname === '/' ? 'active' : ''} to="/">
						<DashboardIcon />
						<span>Dashboard</span>
					</Link>
					<Link className={loc.pathname.startsWith('/inventory') ? 'active' : ''} to="/inventory">
						<InventoryIcon />
						<span>Inventory</span>
					</Link>
					<Link className={loc.pathname.startsWith('/items') ? 'active' : ''} to="/items">
						<ItemsIcon />
						<span>Items</span>
					</Link>
					<Link className={loc.pathname.startsWith('/purchases') ? 'active' : ''} to="/purchases">
						<PurchasesIcon />
						<span>Purchases</span>
					</Link>
					<Link className={loc.pathname.startsWith('/sales') ? 'active' : ''} to="/sales">
						<SalesIcon />
						<span>Sales</span>
					</Link>
					<Link className={loc.pathname.startsWith('/billing') ? 'active' : ''} to="/billing">
						<BillingIcon />
						<span>Billing</span>
					</Link>
					<Link className={loc.pathname.startsWith('/profit-loss') ? 'active' : ''} to="/profit-loss">
						<ProfitLossIcon />
						<span>Profit & Loss</span>
					</Link>
					<Link className={loc.pathname.startsWith('/daily-sales') ? 'active' : ''} to="/daily-sales">
						<DailySalesIcon />
						<span>Daily Sales</span>
					</Link>

					<Link className={loc.pathname.startsWith('/credits') ? 'active' : ''} to="/credits">
						<CreditsIcon />
						<span>Credits</span>
					</Link>
					<Link className={loc.pathname.startsWith('/employees') ? 'active' : ''} to="/employees">
						<EmployeesIcon />
						<span>Employees</span>
					</Link>
					<Link className={loc.pathname.startsWith('/expenses') ? 'active' : ''} to="/expenses">
						<ExpensesIcon />
						<span>Expenses</span>
					</Link>
					<Link className={loc.pathname.startsWith('/suppliers') ? 'active' : ''} to="/suppliers">
						<SuppliersIcon />
						<span>Suppliers</span>
					</Link>
					<Link className={loc.pathname.startsWith('/settings') ? 'active' : ''} to="/settings">
						<SettingsIcon />
						<span>Settings</span>
					</Link>
				</nav>
				
			
					

			</aside>
			{sidebarOpen && (
				<div 
					className="sidebar-overlay"
					onClick={() => setSidebarOpen(false)}
					style={{
						position: 'fixed',
						inset: 0,
						background: 'rgba(0,0,0,0.5)',
						zIndex: 999,
						display: 'none'
					}}
				/>
			)}
			<main className="main-content">
				<Outlet />
			</main>
		</div>
	)
}
