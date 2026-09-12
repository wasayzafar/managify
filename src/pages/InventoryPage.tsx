import { useState, useMemo, useEffect, Fragment, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useItems, usePurchases, useInventory, useStockTransfers, queryKeys } from '../hooks/useDataQueries'
import { usePagination } from '../hooks/usePagination'
import { TableSkeleton } from '../components/LoadingSkeleton'
import { loadCurrency, formatCurrency } from '../utils/currency'
import { exportItemsToShopifyCSV, exportInventoryToExcel } from '../utils/exportCSV'
import { db, StoreInfo } from '../storage'
import { useBranch } from '../auth/BranchContext'
import { matchesBranch } from '../utils/branchFilter'
import { StatCard } from '../ui/StatCard'
import jsPDF from 'jspdf'
import {
	PiMagnifyingGlassDuotone, PiFileXlsDuotone, PiFilePdfDuotone, PiStorefrontDuotone,
	PiCurrencyDollarDuotone, PiWalletDuotone, PiChartLineUpDuotone, PiChartLineDownDuotone,
	PiPackageDuotone, PiWarningCircleDuotone, PiCheckDuotone, PiXDuotone,
	PiCaretDoubleLeftDuotone, PiCaretLeftDuotone, PiCaretRightDuotone, PiCaretDoubleRightDuotone,
	PiCaretUpDuotone, PiCaretDownDuotone, PiFunnelDuotone, PiCaretUpDownDuotone,
	PiDotsThreeVerticalDuotone, PiPencilDuotone, PiArrowsLeftRightDuotone, PiTruckDuotone,
	PiHourglassDuotone, PiBuildingsDuotone, PiWarningDuotone,
} from 'react-icons/pi'

type StockFilter = 'all' | 'in' | 'low' | 'out' | 'attention'

function stockStatusOf(stock: number): { label: string; tint: 'success' | 'warning' | 'danger' } {
	if (stock === 0) return { label: 'Out of Stock', tint: 'danger' }
	if (stock <= 5) return { label: 'Low Stock', tint: 'warning' }
	return { label: 'In Stock', tint: 'success' }
}

const exportBtnStyle: CSSProperties = {
	display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
	background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border-strong)',
}

function StatusPill({ stock }: { stock: number }) {
	const { label, tint } = stockStatusOf(stock)
	return (
		<span style={{
			display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 20,
			fontSize: 11.5, fontWeight: 700, background: `var(--${tint}-bg)`, color: `var(--${tint})`,
		}}>{label}</span>
	)
}

export default function InventoryPage() {
	const [searchParams] = useSearchParams()
	const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '')
	const [currency, setCurrency] = useState('PKR')
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: 'Managify', phone: '', address: '', email: '', website: '', taxNumber: '', logo: '' })
	const [editingQty, setEditingQty] = useState<{ itemId: string, value: string } | null>(null)
	const [savingQty, setSavingQty] = useState(false)
	const queryClient = useQueryClient()
	const [mobilePOS] = useState(() => localStorage.getItem('mobilePOS') === 'true')
	const [openImeiItemId, setOpenImeiItemId] = useState<string | null>(null)
	const [imeiCache, setImeiCache] = useState<Record<string, any[]>>({})
	const [loadingImeiId, setLoadingImeiId] = useState<string | null>(null)
	const [itemsPerPage, setItemsPerPage] = useState(20)
	const [stockFilter, setStockFilter] = useState<StockFilter>('all')
	const [showFilters, setShowFilters] = useState(false)
	const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)
	const [openRowMenu, setOpenRowMenu] = useState<string | null>(null)
	const [transferModalOpen, setTransferModalOpen] = useState(false)
	const [transferForm, setTransferForm] = useState({ itemId: '', quantity: '', fromBranchId: '', toBranchId: '' })
	const [transferError, setTransferError] = useState('')
	const [transferSubmitting, setTransferSubmitting] = useState(false)
	const [fromBranchStock, setFromBranchStock] = useState<Record<string, number> | null>(null)
	const [fromStockLoading, setFromStockLoading] = useState(false)
	const [rejectTarget, setRejectTarget] = useState<string | null>(null)
	const [rejectReason, setRejectReason] = useState('')
	const [transferActionBusyId, setTransferActionBusyId] = useState<string | null>(null)
	const [transferToast, setTransferToast] = useState('')

	const { currentBranchId, mainBranchId, role, myBranchId, branches } = useBranch()
	const { data: items = [], isLoading: itemsLoading } = useItems()
	const { data: allPurchases = [], isLoading: purchasesLoading } = usePurchases()
	const { data: inventory = [], isLoading: inventoryLoading } = useInventory(currentBranchId === 'all' ? undefined : currentBranchId, mainBranchId)
	const { data: stockTransfers = [] } = useStockTransfers()

	const purchases = useMemo(() => {
		if (currentBranchId === 'all') return allPurchases
		return allPurchases.filter(p => matchesBranch(p.branchId, currentBranchId, mainBranchId))
	}, [allPurchases, currentBranchId, mainBranchId])

	useEffect(() => {
		loadCurrency().then(setCurrency)
		db.getStoreInfo().then(setStoreInfo).catch(() => {})
	}, [])

	useEffect(() => {
		const q = searchParams.get('q')
		if (q) setSearchTerm(q)
	}, [searchParams])

	const loading = itemsLoading || purchasesLoading || inventoryLoading

	const enrichedInventory = useMemo(() => {
		return inventory.map(inv => {
			const item = items.find(i => i.id === inv.itemId)
			const price = item?.price || 0
			// Weighted average cost: sum(qty × cost) / sum(qty) across all purchases
			const itemPurchases = purchases.filter(p => p.itemId === inv.itemId && (p.costPrice || 0) > 0)
			const totalCostPaid = itemPurchases.reduce((s, p) => s + (p.qty || p.quantity || 0) * (p.costPrice || 0), 0)
			const totalQtyPurchased = itemPurchases.reduce((s, p) => s + (p.qty || p.quantity || 0), 0)
			const costPrice = totalQtyPurchased > 0 ? totalCostPaid / totalQtyPurchased : 0
			return {
				...inv,
				price,
				costPrice,
				totalValue: inv.stock * price,
				totalCostValue: inv.stock * costPrice,
			}
		})
	}, [inventory, items, purchases])

	const filteredItems = useMemo(() => {
		let list = enrichedInventory.filter(item =>
			item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.itemSku.toLowerCase().includes(searchTerm.toLowerCase())
		)
		if (stockFilter === 'in') list = list.filter(i => i.stock > 5)
		else if (stockFilter === 'low') list = list.filter(i => i.stock > 0 && i.stock <= 5)
		else if (stockFilter === 'out') list = list.filter(i => i.stock === 0)
		else if (stockFilter === 'attention') list = list.filter(i => i.stock <= 5)
		if (sortDir) {
			list = [...list].sort((a, b) => sortDir === 'asc' ? a.stock - b.stock : b.stock - a.stock)
		}
		return list
	}, [enrichedInventory, searchTerm, stockFilter, sortDir])

	const lowStockItems = useMemo(() => enrichedInventory.filter(i => i.stock <= 5), [enrichedInventory])

	const totalRetail = useMemo(() => enrichedInventory.reduce((s, i) => s + i.totalValue, 0), [enrichedInventory])
	const totalCost   = useMemo(() => enrichedInventory.reduce((s, i) => s + i.totalCostValue, 0), [enrichedInventory])

	const pagination = usePagination({ data: filteredItems, itemsPerPage })

	useEffect(() => { pagination.goToPage(1) }, [searchTerm, stockFilter, itemsPerPage])

	async function handleQtySave(itemId: string, currentStock: number) {
		if (!editingQty || editingQty.itemId !== itemId) return
		const newQty = parseInt(editingQty.value, 10)
		if (isNaN(newQty) || newQty < 0) { setEditingQty(null); return }
		if (newQty === currentStock) { setEditingQty(null); return }
		setSavingQty(true)
		try {
			const diff = newQty - currentStock
			if (diff > 0) {
				await db.createPurchase({
					itemId, qty: diff, costPrice: 0,
					supplier: 'ADJUSTMENT', supplierPhone: '',
					paymentType: 'debit', creditDeadline: '',
					note: 'Stock adjustment'
				})
			} else {
				await db.createSale({
					itemId, quantity: Math.abs(diff),
					actualPrice: 0, originalPrice: 0, itemDiscount: 0, billDiscount: 0,
					date: new Date().toISOString(), invoiceNo: 'ADJ'
				})
			}
			await queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
			await queryClient.invalidateQueries({ queryKey: queryKeys.purchases })
			await queryClient.invalidateQueries({ queryKey: queryKeys.sales })
		} catch (err: any) {
			alert('Error adjusting stock: ' + (err?.message || err))
		} finally {
			setSavingQty(false)
			setEditingQty(null)
		}
	}

	async function handleToggleImeis(itemId: string) {
		if (openImeiItemId === itemId) { setOpenImeiItemId(null); return }
		setOpenImeiItemId(itemId)
		setLoadingImeiId(itemId)
		try {
			const imeis = await db.listImeisByItem(itemId)
			setImeiCache(prev => ({ ...prev, [itemId]: imeis }))
		} catch (err) {
			console.error('Error loading IMEIs:', err)
			setImeiCache(prev => ({ ...prev, [itemId]: [] }))
		} finally {
			setLoadingImeiId(null)
		}
	}

	function branchName(id: string) {
		return branches.find(b => b.id === id)?.name || 'Unknown branch'
	}
	function itemName(id: string) {
		return items.find((i: any) => i.id === id)?.name || 'Unknown item'
	}
	function canApprove(t: { fromBranchId: string; toBranchId: string }) {
		return role === 'owner' || (role === 'manager' && (myBranchId === t.fromBranchId || myBranchId === t.toBranchId))
	}
	function canReceive(t: { toBranchId: string }) {
		return !myBranchId || myBranchId === t.toBranchId
	}
	function notifyTransfer(text: string) {
		setTransferToast(text)
		setTimeout(() => setTransferToast(''), 4000)
	}
	async function invalidateAfterTransfer() {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers }),
			queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
		])
	}

	function openTransferModal() {
		const defaultFrom = myBranchId || (currentBranchId !== 'all' ? currentBranchId : (branches[0]?.id || ''))
		setTransferForm({ itemId: '', quantity: '', fromBranchId: defaultFrom, toBranchId: '' })
		setTransferError('')
		setFromBranchStock(null)
		setTransferModalOpen(true)
	}

	useEffect(() => {
		if (!transferModalOpen || !transferForm.fromBranchId) { setFromBranchStock(null); return }
		let cancelled = false
		setFromStockLoading(true)
		db.inventory(transferForm.fromBranchId, mainBranchId).then(rows => {
			if (cancelled) return
			const map: Record<string, number> = {}
			rows.forEach(r => { map[r.itemId] = r.stock })
			setFromBranchStock(map)
		}).finally(() => { if (!cancelled) setFromStockLoading(false) })
		return () => { cancelled = true }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [transferModalOpen, transferForm.fromBranchId])

	const availableAtFrom = transferForm.itemId && fromBranchStock ? (fromBranchStock[transferForm.itemId] ?? 0) : null

	async function submitTransfer(e: React.FormEvent) {
		e.preventDefault()
		setTransferError('')
		const { itemId, fromBranchId, toBranchId } = transferForm
		const quantity = parseInt(transferForm.quantity, 10)
		if (!itemId) { setTransferError('Choose an item.'); return }
		if (!fromBranchId || !toBranchId) { setTransferError('Choose both branches.'); return }
		if (fromBranchId === toBranchId) { setTransferError('Source and destination branches must be different.'); return }
		if (!quantity || quantity <= 0) { setTransferError('Enter a quantity greater than 0.'); return }
		if (availableAtFrom !== null && quantity > availableAtFrom) { setTransferError(`Only ${availableAtFrom} in stock at ${branchName(fromBranchId)}.`); return }
		setTransferSubmitting(true)
		try {
			await db.createStockTransfer({ itemId, quantity, fromBranchId, toBranchId })
			await invalidateAfterTransfer()
			setTransferModalOpen(false)
			notifyTransfer(`Transfer requested — awaiting manager approval.`)
		} catch (err: any) {
			console.error('Error requesting transfer:', err)
			setTransferError(err?.message || 'Could not request transfer.')
		} finally {
			setTransferSubmitting(false)
		}
	}

	async function approveTransfer(id: string) {
		setTransferActionBusyId(id)
		try {
			await db.approveStockTransfer(id)
			await invalidateAfterTransfer()
			notifyTransfer('Transfer approved.')
		} catch (err: any) {
			notifyTransfer('Could not approve: ' + (err?.message || ''))
		} finally {
			setTransferActionBusyId(null)
		}
	}

	function openRejectModal(id: string) {
		setRejectTarget(id)
		setRejectReason('')
	}

	async function confirmReject() {
		if (!rejectTarget) return
		setTransferActionBusyId(rejectTarget)
		try {
			await db.rejectStockTransfer(rejectTarget, rejectReason.trim() || undefined)
			await invalidateAfterTransfer()
			notifyTransfer('Transfer rejected.')
			setRejectTarget(null)
		} catch (err: any) {
			notifyTransfer('Could not reject: ' + (err?.message || ''))
		} finally {
			setTransferActionBusyId(null)
		}
	}

	async function receiveTransfer(t: { id: string; itemId: string; quantity: number; toBranchId: string }) {
		setTransferActionBusyId(t.id)
		try {
			await db.receiveStockTransfer(t.id)
			await invalidateAfterTransfer()
			notifyTransfer(`Stock received: ${t.quantity} × ${itemName(t.itemId)} at ${branchName(t.toBranchId)}.`)
		} catch (err: any) {
			notifyTransfer('Could not confirm receipt: ' + (err?.message || ''))
		} finally {
			setTransferActionBusyId(null)
		}
	}

	function handleExcelExport() {
		exportInventoryToExcel(
			filteredItems.map(i => ({
				sku: i.itemSku, name: i.itemName, stock: i.stock,
				price: i.price, costPrice: i.costPrice,
				totalRetail: i.totalValue, totalCost: i.totalCostValue,
			})),
			'inventory.xls'
		)
	}

	function handlePdfExport() {
		// jsPDF's built-in fonts only cover WinAnsi/Latin-1, not currency glyphs
		// like ₹ (INR) — those render as blank boxes. Fall back to the plain
		// ISO code for anything outside the safe ASCII symbols ($) so the
		// report never silently loses the currency on every price cell.
		const pdfSafeSymbol: Record<string, string> = { USD: '$', PKR: 'PKR', AED: 'AED', SAR: 'SAR' }
		const pdfCurrency = (amount: number) => {
			const symbol = pdfSafeSymbol[currency] ?? currency
			return symbol === '$' ? `$${amount.toFixed(2)}` : `${symbol} ${amount.toFixed(2)}`
		}

		const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' })
		const pageW = pdf.internal.pageSize.getWidth()
		const pageH = pdf.internal.pageSize.getHeight()
		const margin = 14
		let y = margin

		pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
		pdf.text((storeInfo.storeName || 'Managify').toUpperCase(), pageW / 2, y, { align: 'center' }); y += 7
		if (storeInfo.address) { pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.text(storeInfo.address, pageW / 2, y, { align: 'center' }); y += 5 }
		if (storeInfo.phone)   { pdf.setFontSize(9); pdf.text('Phone: ' + storeInfo.phone, pageW / 2, y, { align: 'center' }); y += 5 }
		pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
		pdf.text('Inventory Report', pageW / 2, y + 2, { align: 'center' }); y += 7
		pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
		pdf.text('Generated: ' + new Date().toLocaleString(), pageW / 2, y, { align: 'center' }); y += 5
		pdf.line(margin, y, pageW - margin, y); y += 5

		const cols = [
			{ label: 'SKU', w: 30 }, { label: 'Name', w: 65 }, { label: 'Stock', w: 20 },
			{ label: 'Selling Price', w: 35 }, { label: 'Cost Price', w: 35 },
			{ label: 'Total Retail', w: 35 }, { label: 'Total Cost', w: 35 },
		]
		const tableW = cols.reduce((s, c) => s + c.w, 0)
		const startX = (pageW - tableW) / 2

		const drawHeader = () => {
			pdf.setFillColor(240, 240, 240)
			pdf.rect(startX, y, tableW, 7, 'F')
			pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
			let x = startX
			cols.forEach(c => { pdf.text(c.label, x + 1, y + 5); x += c.w })
			y += 7
		}
		drawHeader()

		let totalRetailSum = 0; let totalCostSum = 0
		pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)

		filteredItems.forEach((item, idx) => {
			if (y > pageH - 20) { pdf.addPage(); y = margin; drawHeader(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5) }
			totalRetailSum += item.totalValue; totalCostSum += item.totalCostValue
			if (idx % 2 === 0) { pdf.setFillColor(252, 252, 252); pdf.rect(startX, y, tableW, 6, 'F') }
			const cells = [item.itemSku, item.itemName, String(item.stock), pdfCurrency(item.price), pdfCurrency(item.costPrice), pdfCurrency(item.totalValue), pdfCurrency(item.totalCostValue)]
			let x = startX
			cols.forEach((c, ci) => { const text = pdf.splitTextToSize(cells[ci], c.w - 2)[0] || ''; pdf.text(text, x + 1, y + 4); x += c.w })
			y += 6
		})

		y += 3
		pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
		pdf.text(`Total Items: ${filteredItems.length}`, margin, y)
		pdf.text(`Total Retail: ${pdfCurrency(totalRetailSum)}   Total Cost: ${pdfCurrency(totalCostSum)}   Profit: ${pdfCurrency(totalRetailSum - totalCostSum)}`, pageW - margin, y, { align: 'right' })

		const totalPages = (pdf as any).internal.getNumberOfPages()
		for (let i = 1; i <= totalPages; i++) {
			pdf.setPage(i); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(150)
			pdf.text('Report generated by managify.online', pageW / 2, pageH - 6, { align: 'center' })
			pdf.setTextColor(0)
		}
		pdf.save('inventory_report.pdf')
	}

	if (loading) {
		return (
			<div className="card">
				<h2>Inventory</h2>
				<TableSkeleton rows={10} columns={7} />
			</div>
		)
	}

	const potentialProfit = totalRetail - totalCost
	const profitPositive = potentialProfit >= 0

	return (
		<div>
			{/* ── Header ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
				<div>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Inventory</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>{enrichedInventory.length} products &middot; {formatCurrency(totalRetail, currency)} in stock value</p>
				</div>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
					{branches.length > 1 && (
						<button onClick={openTransferModal} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
							<PiArrowsLeftRightDuotone size={15} /> Transfer Stock
						</button>
					)}
					<button onClick={handleExcelExport} style={exportBtnStyle}><span style={{ display: 'flex', color: 'var(--success)' }}><PiFileXlsDuotone size={15} /></span> Excel</button>
					<button onClick={handlePdfExport} style={exportBtnStyle}><span style={{ display: 'flex', color: 'var(--danger)' }}><PiFilePdfDuotone size={15} /></span> PDF</button>
					<button onClick={() => exportItemsToShopifyCSV(
						filteredItems.map(i => ({ sku: i.itemSku, name: i.itemName, price: i.price, costPrice: i.costPrice, stock: i.stock })),
						'inventory_shopify.csv'
					)} style={exportBtnStyle}><span style={{ display: 'flex', color: 'var(--success)' }}><PiStorefrontDuotone size={15} /></span> Shopify CSV</button>
				</div>
			</div>

			{/* ── Summary cards ── */}
			<div className="dashboard-stats">
				<StatCard
					icon={<PiCurrencyDollarDuotone />} tint="accent" label="Total retail value"
					value={formatCurrency(totalRetail, currency)}
					caption="Stock × selling price"
				/>
				<StatCard
					icon={<PiWalletDuotone />} tint="accent"
					iconStyle={{ background: 'color-mix(in srgb, #8b5cf6 16%, var(--bg-elevated))', color: '#8b5cf6' }}
					label="Total cost value"
					value={formatCurrency(totalCost, currency)}
					caption="Stock × cost price"
				/>
				<StatCard
					icon={profitPositive ? <PiChartLineUpDuotone /> : <PiChartLineDownDuotone />}
					tint={profitPositive ? 'success' : 'danger'} label="Potential profit"
					value={formatCurrency(potentialProfit, currency)}
					valueColor={profitPositive ? 'var(--success)' : 'var(--danger)'}
					caption="Retail − cost"
				/>
				<StatCard
					icon={<PiPackageDuotone />} tint={lowStockItems.length > 0 ? 'danger' : 'neutral'} label="Total items"
					value={enrichedInventory.length}
					caption={lowStockItems.length > 0 ? `${lowStockItems.length} low on stock` : 'All well stocked'}
					captionColor={lowStockItems.length > 0 ? 'var(--danger)' : undefined}
				/>
			</div>

			{/* ── Low stock alert ── */}
			{lowStockItems.length > 0 && (
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderLeft: '3px solid var(--danger)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13.5 }}>
					<PiWarningCircleDuotone style={{ color: 'var(--danger)', fontSize: 18, flexShrink: 0 }} />
					<span style={{ flex: 1 }}><strong>{lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''}</strong> {lowStockItems.length > 1 ? 'are' : 'is'} low on stock (≤ 5 units)</span>
					<button className="secondary" onClick={() => setStockFilter('attention')} style={{ fontSize: 12.5, color: 'var(--danger)', borderColor: 'var(--danger)', background: 'transparent', flexShrink: 0 }}>View low stock</button>
				</div>
			)}

			{/* ── Stock transfers ── */}
			{stockTransfers.length > 0 && (
				<div className="card">
					<h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
						<PiArrowsLeftRightDuotone size={16} style={{ color: 'var(--text-muted)' }} /> Stock Transfers
					</h3>
					<div style={{ overflowX: 'auto' }}>
						<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
							<thead>
								<tr style={{ background: 'var(--bg-sunken)' }}>
									{['Item', 'Qty', 'From', 'To', 'Status', 'Requested by'].map(h => (
										<th key={h} style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '2px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
									))}
									<th style={{ padding: '9px 12px', width: 160 }}></th>
								</tr>
							</thead>
							<tbody>
								{stockTransfers.slice(0, 25).map(t => {
									const busy = transferActionBusyId === t.id
									return (
										<tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
											<td style={{ padding: '9px 12px', fontWeight: 500 }}>{itemName(t.itemId)}</td>
											<td style={{ padding: '9px 12px' }}>{t.quantity}</td>
											<td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{branchName(t.fromBranchId)}</td>
											<td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{branchName(t.toBranchId)}</td>
											<td style={{ padding: '9px 12px' }}>
												{t.status === 'pending' && (
													<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: 'var(--warning-bg)', color: 'var(--warning)' }}>
														<PiHourglassDuotone size={12} /> Pending approval
													</span>
												)}
												{t.status === 'approved' && (
													<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: 'var(--success-bg)', color: 'var(--success)' }}>
														<PiTruckDuotone size={12} /> In transit
													</span>
												)}
												{t.status === 'received' && (
													<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: 'var(--success-bg)', color: 'var(--success)' }}>
														<PiCheckDuotone size={12} /> Received
													</span>
												)}
												{t.status === 'rejected' && (
													<span title={t.rejectedReason || undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: 'var(--danger-bg)', color: 'var(--danger)' }}>
														<PiXDuotone size={12} /> Rejected
													</span>
												)}
											</td>
											<td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{t.requestedByName || '—'}</td>
											<td style={{ padding: '9px 12px' }}>
												<div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
													{t.status === 'pending' && canApprove(t) && (
														<>
															<button onClick={() => approveTransfer(t.id)} disabled={busy} style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
																<PiCheckDuotone size={12} /> Approve
															</button>
															<button onClick={() => openRejectModal(t.id)} disabled={busy} className="secondary" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--danger)' }}>
																Reject
															</button>
														</>
													)}
													{t.status === 'approved' && canReceive(t) && (
														<button onClick={() => receiveTransfer(t)} disabled={busy} style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
															<PiTruckDuotone size={12} /> {busy ? 'Receiving…' : 'Receive'}
														</button>
													)}
												</div>
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			<div className="card">
			{/* ── Toolbar ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
					<div style={{ position: 'relative' }}>
						<PiMagnifyingGlassDuotone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
						<input
							type="text"
							placeholder="Search SKU or name…"
							value={searchTerm}
							onChange={e => setSearchTerm(e.target.value)}
							style={{ padding: '7px 10px 7px 32px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-sunken)', color: 'var(--text)', minWidth: 200, fontSize: 13 }}
						/>
					</div>
					<span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Showing {pagination.currentData.length} of {pagination.totalItems} items</span>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
					<div style={{ position: 'relative' }} tabIndex={-1} onBlur={() => setTimeout(() => setShowFilters(false), 150)}>
						<button className="secondary" onClick={() => setShowFilters(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, position: 'relative' }}>
							<PiFunnelDuotone size={14} /> Filters
							{stockFilter !== 'all' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />}
						</button>
						{showFilters && (
							<div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, minWidth: 170, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px var(--overlay)', zIndex: 100, overflow: 'hidden' }}>
								{([['all', 'All Items'], ['in', 'In Stock'], ['low', 'Low Stock'], ['out', 'Out of Stock']] as [StockFilter, string][]).map(([val, label]) => (
									<button
										key={val}
										type="button"
										onMouseDown={() => { setStockFilter(val); setShowFilters(false) }}
										style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '8px 12px', background: stockFilter === val ? 'var(--bg-hover)' : 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
										onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
										onMouseLeave={e => (e.currentTarget.style.background = stockFilter === val ? 'var(--bg-hover)' : 'transparent')}
									>
										{label}
										{stockFilter === val && <PiCheckDuotone size={13} style={{ color: 'var(--accent)' }} />}
									</button>
								))}
							</div>
						)}
					</div>

					<label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
						Show
						<select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} style={{ width: 'auto', padding: '5px 8px', fontSize: 13, borderRadius: 7 }}>
							<option value={10}>10</option>
							<option value={20}>20</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
						</select>
						per page
					</label>

					{pagination.totalPages > 1 && (
						<div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
							<button className="secondary" onClick={pagination.goToFirstPage} disabled={!pagination.hasPrevPage} style={{ display: 'flex', padding: 6 }}><PiCaretDoubleLeftDuotone size={13} /></button>
							<button className="secondary" onClick={pagination.prevPage}      disabled={!pagination.hasPrevPage} style={{ display: 'flex', padding: 6 }}><PiCaretLeftDuotone size={13} /></button>
							<span style={{ padding: '0 6px', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Page {pagination.currentPage} of {pagination.totalPages}</span>
							<button className="secondary" onClick={pagination.nextPage}      disabled={!pagination.hasNextPage} style={{ display: 'flex', padding: 6 }}><PiCaretRightDuotone size={13} /></button>
							<button className="secondary" onClick={pagination.goToLastPage}  disabled={!pagination.hasNextPage} style={{ display: 'flex', padding: 6 }}><PiCaretDoubleRightDuotone size={13} /></button>
						</div>
					)}
				</div>
			</div>

			{/* ── Table ── */}
			<div style={{ overflowX: 'auto' }}>
				<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
					<thead>
						<tr style={{ background: 'var(--bg-sunken)', position: 'sticky', top: 0 }}>
							{['SKU', 'Name', 'Stock', 'Selling Price', 'Cost Price', 'Total Retail', 'Total Cost'].map(h => (
								<th key={h} style={{ padding: '10px 12px', textAlign: h === 'SKU' || h === 'Name' ? 'left' : 'right', borderBottom: '2px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
									{h === 'Stock' ? (
										<button
											onClick={() => setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc')}
											style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', padding: 0, color: 'var(--text-muted)', fontWeight: 600, fontSize: 'inherit', cursor: 'pointer' }}
										>
											Stock <PiCaretUpDownDuotone size={13} style={{ color: sortDir ? 'var(--accent)' : 'var(--text-faint)' }} />
										</button>
									) : h}
								</th>
							))}
							<th style={{ padding: '10px 12px', width: 40 }}></th>
						</tr>
					</thead>
					<tbody>
						{pagination.currentData.map(item => (
							<Fragment key={item.itemId}>
							<tr key={item.itemId} style={{ borderBottom: '1px solid var(--border)', background: item.stock <= 5 ? 'color-mix(in srgb, var(--danger) 8%, transparent)' : 'transparent' }}
								onMouseEnter={e => (e.currentTarget.style.background = item.stock <= 5 ? 'color-mix(in srgb, var(--danger) 14%, transparent)' : 'var(--bg-hover)')}
								onMouseLeave={e => (e.currentTarget.style.background = item.stock <= 5 ? 'color-mix(in srgb, var(--danger) 8%, transparent)' : 'transparent')}
							>
								<td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item.itemSku}</td>
								<td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.itemName}</td>
								<td style={{ padding: '10px 12px', textAlign: 'right' }}>
									{editingQty?.itemId === item.itemId ? (
										<div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
											<input
												type="number" min="0"
												value={editingQty.value}
												onChange={e => setEditingQty({ itemId: item.itemId, value: e.target.value })}
												onKeyDown={e => { if (e.key === 'Enter') handleQtySave(item.itemId, item.stock); if (e.key === 'Escape') setEditingQty(null) }}
												autoFocus
												style={{ width: 70, padding: '3px 6px', fontSize: 13, textAlign: 'right' }}
											/>
											<button onClick={() => handleQtySave(item.itemId, item.stock)} disabled={savingQty}
												style={{ display: 'flex', padding: 6 }}>
												{savingQty ? '…' : <PiCheckDuotone size={13} />}
											</button>
											<button className="secondary" onClick={() => setEditingQty(null)}
												style={{ display: 'flex', padding: 6 }}><PiXDuotone size={13} /></button>
										</div>
									) : (
										<div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
											<span
												onClick={() => setEditingQty({ itemId: item.itemId, value: String(item.stock) })}
												title="Click to edit stock"
												style={{ cursor: 'pointer', color: 'var(--text)', borderBottom: '1px dashed var(--text-muted)', paddingBottom: 1 }}>
												{item.stock}
											</span>
											<StatusPill stock={item.stock} />
										</div>
									)}
								</td>
								<td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(item.price, currency)}</td>
								<td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(item.costPrice, currency)}</td>
								<td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(item.totalValue, currency)}</td>
								<td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(item.totalCostValue, currency)}</td>
								<td style={{ padding: '10px 12px', textAlign: 'center', position: 'relative' }} tabIndex={-1} onBlur={() => setTimeout(() => setOpenRowMenu(m => m === item.itemId ? null : m), 150)}>
									<button className="secondary" onClick={() => setOpenRowMenu(m => m === item.itemId ? null : item.itemId)} style={{ display: 'inline-flex', padding: 6, background: 'transparent', color: 'var(--text-muted)' }}>
										<PiDotsThreeVerticalDuotone size={16} />
									</button>
									{openRowMenu === item.itemId && (
										<div style={{ position: 'absolute', top: '100%', right: 8, marginTop: 2, minWidth: 160, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px var(--overlay)', zIndex: 100, overflow: 'hidden', textAlign: 'left' }}>
											<button
												onMouseDown={() => { setEditingQty({ itemId: item.itemId, value: String(item.stock) }); setOpenRowMenu(null) }}
												style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
												onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
												onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
											><PiPencilDuotone size={14} /> Edit Stock</button>
											{mobilePOS && (
												<button
													onMouseDown={() => { handleToggleImeis(item.itemId); setOpenRowMenu(null) }}
													style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
													onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
													onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
												>{openImeiItemId === item.itemId ? <PiCaretUpDuotone size={14} /> : <PiCaretDownDuotone size={14} />} {openImeiItemId === item.itemId ? 'Hide IMEIs' : 'View IMEIs'}</button>
											)}
										</div>
									)}
								</td>
							</tr>
							{mobilePOS && openImeiItemId === item.itemId && (
								<tr key={`imei-${item.itemId}`} style={{ background: 'var(--bg-sunken)' }}>
									<td colSpan={8} style={{ padding: '0 12px 12px 12px' }}>
										{(() => {
											const imeis = imeiCache[item.itemId]
											if (!imeis) return <div style={{ padding: '10px 0', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
											const availableImeis = imeis.filter((i: any) => !i.is_sold)
											if (availableImeis.length === 0) return <div style={{ padding: '10px 0', color: 'var(--text-muted)', fontSize: 13 }}>{imeis.length > 0 ? 'All units sold.' : 'No IMEIs recorded for this item.'}</div>
											return (
												<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 4 }}>
													<thead>
														<tr style={{ background: 'var(--bg-sunken)' }}>
															<th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, width: 40 }}>#</th>
															<th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>IMEI 1</th>
															<th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>IMEI 2</th>
															<th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Warranty Till</th>
														</tr>
													</thead>
													<tbody>
														{availableImeis.map((imei: any, idx: number) => {
															const warrantyDate = imei.warranty_till ? new Date(imei.warranty_till) : null
															const warrantyExpired = warrantyDate && warrantyDate < new Date()
															return (
															<tr key={imei.id} style={{ borderBottom: '1px solid var(--border)' }}>
																<td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
																<td style={{ padding: '6px 10px', fontFamily: 'monospace', color: 'var(--text)' }}>{imei.imei1}</td>
																<td style={{ padding: '6px 10px', fontFamily: 'monospace', color: imei.imei2 ? 'var(--text)' : 'var(--text-muted)' }}>{imei.imei2 || '—'}</td>
																<td style={{ padding: '6px 10px', fontSize: 12 }}>
																	{warrantyDate ? (
																		<span style={{ color: warrantyExpired ? 'var(--danger)' : 'var(--success)' }}>
																			{warrantyDate.toLocaleDateString()}{warrantyExpired ? ' (expired)' : ''}
																		</span>
																	) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
																</td>
															</tr>
															)
														})}
													</tbody>
												</table>
											)
										})()}
									</td>
								</tr>
							)}
							</Fragment>
						))}
						{pagination.currentData.length === 0 && (
							<tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No items found</td></tr>
						)}
					</tbody>
				</table>
			</div>

			{/* ── Bottom pagination ── */}
			{pagination.totalPages > 1 && (
				<div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
					{Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
						const pageNum = Math.max(1, pagination.currentPage - 2) + i
						if (pageNum > pagination.totalPages) return null
						return (
							<button key={pageNum} onClick={() => pagination.goToPage(pageNum)}
								style={{ padding: '6px 12px', background: pageNum === pagination.currentPage ? 'var(--accent)' : 'var(--secondary-btn-bg)', color: pageNum === pagination.currentPage ? 'var(--accent-contrast)' : 'var(--secondary-btn-text)', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: pageNum === pagination.currentPage ? 700 : 400 }}>
								{pageNum}
							</button>
						)
					})}
				</div>
			)}
			</div>

			{/* ── Transfer stock modal ── */}
			{transferModalOpen && (
				<div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
					onClick={() => !transferSubmitting && setTransferModalOpen(false)}
				>
					<div className="card" style={{ maxWidth: 460, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
						<h3 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
							<PiArrowsLeftRightDuotone size={16} /> Transfer Stock
						</h3>
						<p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>
							Requires manager or owner approval before it moves, and the destination branch must confirm receipt.
						</p>
						<form onSubmit={submitTransfer}>
							<div className="form-grid">
								<div style={{ gridColumn: '1 / -1' }}>
									<label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}><PiPackageDuotone size={14} /> Item</label>
									<select value={transferForm.itemId} onChange={e => setTransferForm(f => ({ ...f, itemId: e.target.value }))}>
										<option value="">Select item…</option>
										{items.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
									</select>
									{transferForm.itemId && (
										<p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-faint)' }}>
											{fromStockLoading ? 'Checking stock…' : availableAtFrom !== null ? `${availableAtFrom} available at ${branchName(transferForm.fromBranchId)}` : ''}
										</p>
									)}
								</div>
								<div>
									<label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Quantity</label>
									<input type="number" min="1" value={transferForm.quantity} onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
								</div>
								<div>
									<label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}><PiBuildingsDuotone size={14} /> From</label>
									{myBranchId ? (
										<input value={branchName(myBranchId)} disabled />
									) : (
										<select value={transferForm.fromBranchId} onChange={e => setTransferForm(f => ({ ...f, fromBranchId: e.target.value }))}>
											<option value="">Select…</option>
											{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
										</select>
									)}
								</div>
								<div style={{ gridColumn: '1 / -1' }}>
									<label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}><PiBuildingsDuotone size={14} /> To</label>
									<select value={transferForm.toBranchId} onChange={e => setTransferForm(f => ({ ...f, toBranchId: e.target.value }))}>
										<option value="">Select destination branch…</option>
										{branches.filter(b => b.id !== transferForm.fromBranchId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
									</select>
								</div>
							</div>
							{transferError && (
								<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: 'var(--danger)', fontSize: 13 }}>
									<PiWarningCircleDuotone size={15} /> {transferError}
								</div>
							)}
							<div className="form-actions" style={{ marginTop: 14 }}>
								<button type="button" className="secondary" onClick={() => setTransferModalOpen(false)} disabled={transferSubmitting}>Cancel</button>
								<button type="submit" disabled={transferSubmitting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
									<PiArrowsLeftRightDuotone size={14} /> {transferSubmitting ? 'Requesting…' : 'Request Transfer'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ── Reject transfer modal ── */}
			{rejectTarget && (
				<div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
					onClick={() => transferActionBusyId !== rejectTarget && setRejectTarget(null)}
				>
					<div className="card" style={{ maxWidth: 400, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
							<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', flexShrink: 0 }}>
								<PiWarningDuotone size={17} />
							</span>
							<h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Reject this transfer?</h3>
						</div>
						<label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Reason (optional)</label>
						<textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Not enough stock to spare right now" rows={3} style={{ width: '100%', resize: 'vertical' }} />
						<div className="form-actions" style={{ marginTop: 14 }}>
							<button className="secondary" onClick={() => setRejectTarget(null)} disabled={transferActionBusyId === rejectTarget}>Cancel</button>
							<button onClick={confirmReject} disabled={transferActionBusyId === rejectTarget} style={{ background: 'var(--danger)' }}>
								{transferActionBusyId === rejectTarget ? 'Rejecting…' : 'Reject Transfer'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Transfer toast ── */}
			{transferToast && (
				<div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, maxWidth: 380, boxShadow: '0 8px 24px var(--overlay)', background: transferToast.toLowerCase().includes('could not') ? 'var(--danger-bg)' : 'var(--success-bg)', color: transferToast.toLowerCase().includes('could not') ? 'var(--danger)' : 'var(--success)', border: `1px solid ${transferToast.toLowerCase().includes('could not') ? 'var(--danger)' : 'var(--success)'}` }}>
					{transferToast.toLowerCase().includes('could not') ? <PiWarningCircleDuotone size={17} style={{ flexShrink: 0 }} /> : <PiCheckDuotone size={17} style={{ flexShrink: 0 }} />}
					{transferToast}
				</div>
			)}
		</div>
	)
}
