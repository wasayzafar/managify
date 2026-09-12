import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useBranch } from '../auth/BranchContext'
import { useItems, usePurchases, useSales, useInventory, useStockTransfers } from '../hooks/useDataQueries'
import ThemeToggle from './ThemeToggle'
import {
	PiMagnifyingGlassDuotone, PiArrowsOutDuotone, PiArrowsInDuotone, PiBellDuotone,
	PiCalendarBlankDuotone, PiWarningCircleDuotone, PiInvoiceDuotone, PiCheckCircleDuotone,
	PiSquaresFourDuotone, PiStackDuotone, PiCubeDuotone, PiShoppingBagDuotone, PiShoppingCartDuotone,
	PiReceiptDuotone, PiChartLineUpDuotone, PiCalendarDotsDuotone, PiBarcodeDuotone, PiUsersDuotone,
	PiWalletDuotone, PiStorefrontDuotone, PiArchiveDuotone, PiGearDuotone,
	PiBuildingsDuotone, PiCaretDownDuotone, PiArrowsLeftRightDuotone, PiTruckDuotone,
} from 'react-icons/pi'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

const PAGES = [
	{ label: 'Dashboard', to: '/', icon: <PiSquaresFourDuotone /> },
	{ label: 'Inventory', to: '/inventory', icon: <PiStackDuotone /> },
	{ label: 'Items', to: '/items', icon: <PiCubeDuotone /> },
	{ label: 'Purchases', to: '/purchases', icon: <PiShoppingBagDuotone /> },
	{ label: 'Sales', to: '/sales', icon: <PiShoppingCartDuotone /> },
	{ label: 'Billing', to: '/billing', icon: <PiReceiptDuotone /> },
	{ label: 'Profit & Loss', to: '/profit-loss', icon: <PiChartLineUpDuotone /> },
	{ label: 'Daily Sales', to: '/daily-sales', icon: <PiCalendarDotsDuotone /> },
	{ label: 'Scan Barcode', to: '/scan', icon: <PiBarcodeDuotone /> },
	{ label: 'Credits', to: '/credits', icon: <PiInvoiceDuotone /> },
	{ label: 'Employees', to: '/employees', icon: <PiUsersDuotone /> },
	{ label: 'Expenses', to: '/expenses', icon: <PiWalletDuotone /> },
	{ label: 'Vendors', to: '/suppliers', icon: <PiStorefrontDuotone /> },
	{ label: 'Assets', to: '/assets', icon: <PiArchiveDuotone /> },
	{ label: 'Settings', to: '/settings', icon: <PiGearDuotone /> },
]

function getDaysUntil(d: string) {
	return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

export default function Header() {
	const { user, logout } = useAuth()
	const { branches, currentBranchId, setCurrentBranchId, myBranchId, role } = useBranch()
	const navigate = useNavigate()
	const [menuOpen, setMenuOpen] = useState(false)
	const [notifOpen, setNotifOpen] = useState(false)
	const [branchMenuOpen, setBranchMenuOpen] = useState(false)
	const [searchOpen, setSearchOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [isFullscreen, setIsFullscreen] = useState(false)
	const searchRef = useRef<HTMLInputElement>(null)

	const { data: items = [] } = useItems()
	const { data: purchases = [] } = usePurchases()
	const { data: sales = [] } = useSales()
	const { data: inventory = [] } = useInventory()
	const { data: stockTransfers = [] } = useStockTransfers()

	const label = user?.displayName || user?.email || 'Account'
	const initial = label.charAt(0).toUpperCase()

	const today = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), [])

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault()
				searchRef.current?.focus()
				setSearchOpen(true)
			}
			if (e.key === 'Escape') {
				searchRef.current?.blur()
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [])

	useEffect(() => {
		const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
		document.addEventListener('fullscreenchange', onFsChange)
		return () => document.removeEventListener('fullscreenchange', onFsChange)
	}, [])

	const toggleFullscreen = () => {
		if (document.fullscreenElement) document.exitFullscreen()
		else document.documentElement.requestFullscreen().catch(() => {})
	}

	const matchedPages = useMemo(() => {
		if (!query.trim()) return PAGES.slice(0, 6)
		const q = query.toLowerCase()
		return PAGES.filter(p => p.label.toLowerCase().includes(q))
	}, [query])

	const matchedItems = useMemo(() => {
		if (!query.trim()) return []
		const q = query.toLowerCase()
		return items.filter((i: any) => i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q)).slice(0, 5)
	}, [items, query])

	const lowStockCount = inventory.filter((i: any) => i.stock < 5).length
	const overduePurchaseCredits = purchases.filter((p: any) => p.paymentType === 'credit' && !p.isPaid && p.creditDeadline && getDaysUntil(p.creditDeadline) < 0).length
	const overdueSaleCredits = sales.filter((s: any) => s.paymentType === 'credit' && !s.isPaid && s.creditDeadline && getDaysUntil(s.creditDeadline) < 0).length

	// Transfers needing this person's attention: pending ones only count for
	// whoever can actually approve them (owner, or a manager of either branch
	// involved) — a plain staff member never sees "needs approval" for a step
	// they have no authority over.
	const transfersPendingApproval = stockTransfers.filter(t => t.status === 'pending' && (
		role === 'owner' || (role === 'manager' && (myBranchId === t.fromBranchId || myBranchId === t.toBranchId))
	)).length
	const transfersReadyToReceive = stockTransfers.filter(t => t.status === 'approved' && (!myBranchId || myBranchId === t.toBranchId)).length

	const alertCount = lowStockCount + overduePurchaseCredits + overdueSaleCredits + transfersPendingApproval + transfersReadyToReceive

	const goTo = (to: string) => {
		setSearchOpen(false)
		setQuery('')
		searchRef.current?.blur()
		navigate(to)
	}

	const currentBranchLabel = currentBranchId === 'all'
		? 'All Branches'
		: (branches.find(b => b.id === currentBranchId)?.name || 'Branch')

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: 12,
				padding: '10px 4px 16px',
				borderBottom: '1px solid var(--border)',
				marginBottom: 20,
			}}
		>
			{/* ── Search ── */}
			<div style={{ position: 'relative', flex: '0 1 340px' }}>
				<PiMagnifyingGlassDuotone style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 16, pointerEvents: 'none' }} />
				<input
					ref={searchRef}
					value={query}
					onChange={e => setQuery(e.target.value)}
					onFocus={() => setSearchOpen(true)}
					onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
					placeholder="Search anything…"
					style={{ padding: '9px 44px 9px 36px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-sunken)', color: 'var(--text)', fontSize: 13.5, width: '100%' }}
				/>
				<span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-faint)', border: '1px solid var(--border-strong)', borderRadius: 5, padding: '2px 5px', pointerEvents: 'none' }}>
					{isMac ? '⌘K' : 'Ctrl K'}
				</span>

				{searchOpen && (
					<div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 8px 24px var(--overlay)', zIndex: 1000, overflow: 'hidden', maxHeight: 360, overflowY: 'auto' }}>
						{matchedItems.length > 0 && (
							<div>
								<div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Items</div>
								{matchedItems.map((i: any) => (
									<button key={i.id} onMouseDown={() => goTo(`/inventory?q=${encodeURIComponent(i.sku || i.name)}`)}
										style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13.5, cursor: 'pointer' }}
										onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
										onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
									>
										<PiCubeDuotone style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
										<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
										<span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{i.sku}</span>
									</button>
								))}
							</div>
						)}
						<div>
							<div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pages</div>
							{matchedPages.length === 0 && matchedItems.length === 0 && (
								<div style={{ padding: '14px 12px', fontSize: 13, color: 'var(--text-muted)' }}>No results for "{query}"</div>
							)}
							{matchedPages.map(p => (
								<button key={p.to} onMouseDown={() => goTo(p.to)}
									style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13.5, cursor: 'pointer' }}
									onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
									onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
								>
									<span style={{ display: 'flex', color: 'var(--text-muted)', fontSize: 15, flexShrink: 0 }}>{p.icon}</span>
									{p.label}
								</button>
							))}
						</div>
					</div>
				)}
			</div>

			{/* ── Right cluster ── */}
			<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
				{/* ── Branch switcher ── */}
				<div tabIndex={-1} onBlur={() => setTimeout(() => setBranchMenuOpen(false), 150)} style={{ position: 'relative' }}>
					<button
						className="secondary"
						onClick={() => { if (!myBranchId) setBranchMenuOpen(o => !o) }}
						title={myBranchId ? 'Your assigned branch' : 'Switch branch'}
						style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '7px 10px', borderRadius: 8, whiteSpace: 'nowrap', cursor: myBranchId ? 'default' : 'pointer' }}
					>
						<PiBuildingsDuotone size={14} />
						{currentBranchLabel}
						{!myBranchId && <PiCaretDownDuotone size={11} />}
					</button>
					{branchMenuOpen && !myBranchId && (
						<div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, minWidth: 200, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 8px 24px var(--overlay)', zIndex: 1000, overflow: 'hidden' }}>
							<button
								onMouseDown={() => { setCurrentBranchId('all'); setBranchMenuOpen(false) }}
								style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: currentBranchId === 'all' ? 'var(--bg-hover)' : 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontWeight: currentBranchId === 'all' ? 700 : 400, cursor: 'pointer' }}
								onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
								onMouseLeave={e => (e.currentTarget.style.background = currentBranchId === 'all' ? 'var(--bg-hover)' : 'transparent')}
							>All Branches</button>
							{branches.map(b => (
								<button
									key={b.id}
									onMouseDown={() => { setCurrentBranchId(b.id); setBranchMenuOpen(false) }}
									style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: currentBranchId === b.id ? 'var(--bg-hover)' : 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontWeight: currentBranchId === b.id ? 700 : 400, cursor: 'pointer' }}
									onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
									onMouseLeave={e => (e.currentTarget.style.background = currentBranchId === b.id ? 'var(--bg-hover)' : 'transparent')}
								>{b.name}</button>
							))}
						</div>
					)}
				</div>

				<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, whiteSpace: 'nowrap' }}>
					<PiCalendarBlankDuotone />
					{today}
				</span>

				<button className="secondary" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
					style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0, borderRadius: 8 }}>
					{isFullscreen ? <PiArrowsInDuotone size={16} /> : <PiArrowsOutDuotone size={16} />}
				</button>

				<ThemeToggle />

				{/* ── Notifications ── */}
				<div tabIndex={-1} onBlur={() => setTimeout(() => setNotifOpen(false), 150)} style={{ position: 'relative' }}>
					<button className="secondary" onClick={() => setNotifOpen(o => !o)} title="Notifications"
						style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0, borderRadius: 8 }}>
						<PiBellDuotone size={16} />
						{alertCount > 0 && (
							<span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--danger)', color: 'var(--accent-contrast)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
								{alertCount > 9 ? '9+' : alertCount}
							</span>
						)}
					</button>
					{notifOpen && (
						<div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, minWidth: 280, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 8px 24px var(--overlay)', zIndex: 1000, overflow: 'hidden' }}>
							<div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13.5 }}>Notifications</div>
							{alertCount === 0 ? (
								<div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 14px', color: 'var(--text-muted)', fontSize: 13 }}>
									<PiCheckCircleDuotone style={{ color: 'var(--success)' }} /> You're all caught up
								</div>
							) : (
								<div>
									{lowStockCount > 0 && (
										<button onMouseDown={() => goTo('/inventory')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
											onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
											onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
										>
											<PiWarningCircleDuotone style={{ color: 'var(--danger)', flexShrink: 0 }} />
											<span>{lowStockCount} item{lowStockCount > 1 ? 's' : ''} low on stock</span>
										</button>
									)}
									{overduePurchaseCredits > 0 && (
										<button onMouseDown={() => goTo('/credits')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
											onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
											onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
										>
											<PiInvoiceDuotone style={{ color: 'var(--warning)', flexShrink: 0 }} />
											<span>{overduePurchaseCredits} purchase credit{overduePurchaseCredits > 1 ? 's' : ''} overdue</span>
										</button>
									)}
									{overdueSaleCredits > 0 && (
										<button onMouseDown={() => goTo('/credits')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
											onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
											onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
										>
											<PiInvoiceDuotone style={{ color: 'var(--warning)', flexShrink: 0 }} />
											<span>{overdueSaleCredits} sales credit{overdueSaleCredits > 1 ? 's' : ''} overdue</span>
										</button>
									)}
									{transfersPendingApproval > 0 && (
										<button onMouseDown={() => goTo('/inventory')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
											onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
											onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
										>
											<PiArrowsLeftRightDuotone style={{ color: 'var(--warning)', flexShrink: 0 }} />
											<span>{transfersPendingApproval} stock transfer{transfersPendingApproval > 1 ? 's' : ''} awaiting your approval</span>
										</button>
									)}
									{transfersReadyToReceive > 0 && (
										<button onMouseDown={() => goTo('/inventory')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
											onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
											onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
										>
											<PiTruckDuotone style={{ color: 'var(--success)', flexShrink: 0 }} />
											<span>{transfersReadyToReceive} stock transfer{transfersReadyToReceive > 1 ? 's' : ''} ready to receive</span>
										</button>
									)}
								</div>
							)}
						</div>
					)}
				</div>

				{/* ── Account ── */}
				<div tabIndex={-1} onBlur={() => setTimeout(() => setMenuOpen(false), 150)} style={{ position: 'relative' }}>
					<button
						onClick={() => setMenuOpen(o => !o)}
						title={label}
						style={{
							display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
							borderRadius: '50%', border: '1px solid var(--border-strong)',
							background: user?.photoURL ? 'transparent' : 'var(--accent)', color: 'var(--accent-contrast)',
							fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0, overflow: 'hidden',
						}}
					>
						{user?.photoURL ? (
							<img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
						) : (
							initial
						)}
					</button>

					{menuOpen && (
						<div
							style={{
								position: 'absolute', top: '100%', right: 0, marginTop: 8, minWidth: 220,
								background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 10,
								boxShadow: '0 8px 24px var(--overlay)', zIndex: 1000, overflow: 'hidden',
							}}
						>
							<div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
								<div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{user?.displayName || 'Account'}
								</div>
								{user?.email && (
									<div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{user.email}
									</div>
								)}
							</div>
							<button
								onClick={() => { setMenuOpen(false); navigate('/settings') }}
								style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', color: 'var(--text)', border: 'none', borderRadius: 0, fontSize: 13, cursor: 'pointer' }}
								onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
								onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
							>
								Settings
							</button>
							<button
								onClick={async () => { try { await logout(); navigate('/login') } catch (err) { console.error('Logout failed:', err) } }}
								style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', color: 'var(--danger)', border: 'none', borderRadius: 0, fontSize: 13, cursor: 'pointer' }}
								onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
								onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
							>
								Log Out
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
