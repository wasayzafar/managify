import { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useItems, usePurchases, useInventory, queryKeys } from '../hooks/useDataQueries'
import { usePagination } from '../hooks/usePagination'
import { TableSkeleton } from '../components/LoadingSkeleton'
import { loadCurrency, formatCurrency } from '../utils/currency'
import { exportItemsToShopifyCSV, exportInventoryToExcel } from '../utils/exportCSV'
import { db, StoreInfo } from '../storage'
import jsPDF from 'jspdf'

export default function InventoryPage() {
	const [searchTerm, setSearchTerm] = useState('')
	const [currency, setCurrency] = useState('PKR')
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: 'Managify', phone: '', address: '', email: '', website: '', taxNumber: '', logo: '' })
	const [editingQty, setEditingQty] = useState<{ itemId: string, value: string } | null>(null)
	const [savingQty, setSavingQty] = useState(false)
	const queryClient = useQueryClient()

	const { data: items = [], isLoading: itemsLoading } = useItems()
	const { data: purchases = [], isLoading: purchasesLoading } = usePurchases()
	const { data: inventory = [], isLoading: inventoryLoading } = useInventory()

	useEffect(() => {
		loadCurrency().then(setCurrency)
		db.getStoreInfo().then(setStoreInfo).catch(() => {})
	}, [])

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

	const filteredItems = useMemo(() =>
		enrichedInventory.filter(item =>
			item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.itemSku.toLowerCase().includes(searchTerm.toLowerCase())
		), [enrichedInventory, searchTerm])

	const lowStockItems = useMemo(() => filteredItems.filter(i => i.stock <= 5), [filteredItems])

	const totalRetail = useMemo(() => enrichedInventory.reduce((s, i) => s + i.totalValue, 0), [enrichedInventory])
	const totalCost   = useMemo(() => enrichedInventory.reduce((s, i) => s + i.totalCostValue, 0), [enrichedInventory])

	const pagination = usePagination({ data: filteredItems, itemsPerPage: 20 })

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

	function handleExcelExport() {
		exportInventoryToExcel(
			enrichedInventory.map(i => ({
				sku: i.itemSku, name: i.itemName, stock: i.stock,
				price: i.price, costPrice: i.costPrice,
				totalRetail: i.totalValue, totalCost: i.totalCostValue,
			})),
			'inventory.xls'
		)
	}

	function handlePdfExport() {
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

		enrichedInventory.forEach((item, idx) => {
			if (y > pageH - 20) { pdf.addPage(); y = margin; drawHeader(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5) }
			totalRetailSum += item.totalValue; totalCostSum += item.totalCostValue
			if (idx % 2 === 0) { pdf.setFillColor(252, 252, 252); pdf.rect(startX, y, tableW, 6, 'F') }
			const cells = [item.itemSku, item.itemName, String(item.stock), formatCurrency(item.price, currency), formatCurrency(item.costPrice, currency), formatCurrency(item.totalValue, currency), formatCurrency(item.totalCostValue, currency)]
			let x = startX
			cols.forEach((c, ci) => { const text = pdf.splitTextToSize(cells[ci], c.w - 2)[0] || ''; pdf.text(text, x + 1, y + 4); x += c.w })
			y += 6
		})

		y += 3
		pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
		pdf.text(`Total Items: ${enrichedInventory.length}`, margin, y)
		pdf.text(`Total Retail: ${formatCurrency(totalRetailSum, currency)}   Total Cost: ${formatCurrency(totalCostSum, currency)}   Profit: ${formatCurrency(totalRetailSum - totalCostSum, currency)}`, pageW - margin, y, { align: 'right' })

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

	return (
		<div className="card">
			{/* ── Header ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
				<h2 style={{ margin: 0 }}>Inventory</h2>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
					<input
						type="text"
						placeholder="Search SKU or name…"
						value={searchTerm}
						onChange={e => setSearchTerm(e.target.value)}
						style={{ padding: '8px 12px', border: '1px solid #243245', borderRadius: 6, background: '#0b0f14', color: '#e8eef5', minWidth: 200 }}
					/>
					<button className="secondary" onClick={handleExcelExport}>Export Excel</button>
					<button className="secondary" onClick={handlePdfExport}>Export PDF</button>
					<button className="secondary" onClick={() => exportItemsToShopifyCSV(
						filteredItems.map(i => ({ sku: i.itemSku, name: i.itemName, price: i.price, costPrice: i.costPrice, stock: i.stock })),
						'inventory_shopify.csv'
					)}>Shopify CSV</button>
				</div>
			</div>

			{/* ── Summary cards ── */}
			<div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
				<div style={{ flex: 1, minWidth: 160, background: '#1a2a1a', border: '1px solid #2d5a2d', borderRadius: 8, padding: '14px 18px' }}>
					<div style={{ fontSize: 12, color: '#81c784', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Retail Value</div>
					<div style={{ fontSize: 20, fontWeight: 700, color: '#a5d6a7' }}>{formatCurrency(totalRetail, currency)}</div>
					<div style={{ fontSize: 11, color: '#4a5a4a', marginTop: 3 }}>Stock × Selling Price</div>
				</div>
				<div style={{ flex: 1, minWidth: 160, background: '#111827', border: '1px solid #243245', borderRadius: 8, padding: '14px 18px' }}>
					<div style={{ fontSize: 12, color: '#90caf9', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Cost Value</div>
					<div style={{ fontSize: 20, fontWeight: 700, color: '#bbdefb' }}>{formatCurrency(totalCost, currency)}</div>
					<div style={{ fontSize: 11, color: '#3a4a5a', marginTop: 3 }}>Stock × Cost Price</div>
				</div>
				<div style={{ flex: 1, minWidth: 160, background: '#1f1810', border: '1px solid #5a3e1a', borderRadius: 8, padding: '14px 18px' }}>
					<div style={{ fontSize: 12, color: '#ffcc80', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Potential Profit</div>
					<div style={{ fontSize: 20, fontWeight: 700, color: '#ffe0b2' }}>{formatCurrency(totalRetail - totalCost, currency)}</div>
					<div style={{ fontSize: 11, color: '#4a3a20', marginTop: 3 }}>Retail − Cost</div>
				</div>
				<div style={{ flex: 1, minWidth: 160, background: '#111827', border: '1px solid #243245', borderRadius: 8, padding: '14px 18px' }}>
					<div style={{ fontSize: 12, color: '#b0bec5', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Items</div>
					<div style={{ fontSize: 20, fontWeight: 700, color: '#e8eef5' }}>{enrichedInventory.length}</div>
					<div style={{ fontSize: 11, color: '#3a4a5a', marginTop: 3 }}>{lowStockItems.length} low stock</div>
				</div>
			</div>

			{/* ── Low stock alert ── */}
			{lowStockItems.length > 0 && (
				<div style={{ background: '#7f1d1d', color: '#fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
					⚠️ <strong>{lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''}</strong> {lowStockItems.length > 1 ? 'are' : 'is'} low on stock (≤ 5 units)
				</div>
			)}

			{/* ── Pagination info ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 13, color: '#8899aa' }}>
				<span>Showing {pagination.currentData.length} of {pagination.totalItems} items</span>
				{pagination.totalPages > 1 && (
					<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
						<button onClick={pagination.goToFirstPage} disabled={!pagination.hasPrevPage} style={{ padding: '3px 8px', fontSize: 12 }}>«</button>
						<button onClick={pagination.prevPage}      disabled={!pagination.hasPrevPage} style={{ padding: '3px 8px', fontSize: 12 }}>‹</button>
						<span>Page {pagination.currentPage} / {pagination.totalPages}</span>
						<button onClick={pagination.nextPage}      disabled={!pagination.hasNextPage} style={{ padding: '3px 8px', fontSize: 12 }}>›</button>
						<button onClick={pagination.goToLastPage}  disabled={!pagination.hasNextPage} style={{ padding: '3px 8px', fontSize: 12 }}>»</button>
					</div>
				)}
			</div>

			{/* ── Table ── */}
			<div style={{ overflowX: 'auto' }}>
				<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
					<thead>
						<tr style={{ background: '#141920', position: 'sticky', top: 0 }}>
							{['SKU', 'Name', 'Stock', 'Selling Price', 'Cost Price', 'Total Retail', 'Total Cost'].map(h => (
								<th key={h} style={{ padding: '10px 12px', textAlign: h === 'SKU' || h === 'Name' ? 'left' : 'right', borderBottom: '2px solid #243245', color: '#8899aa', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{pagination.currentData.map(item => (
							<tr key={item.itemId} style={{ borderBottom: '1px solid #1a2030', background: item.stock <= 5 ? '#2d1b1b' : 'transparent' }}
								onMouseEnter={e => (e.currentTarget.style.background = item.stock <= 5 ? '#3a1f1f' : '#141920')}
								onMouseLeave={e => (e.currentTarget.style.background = item.stock <= 5 ? '#2d1b1b' : 'transparent')}
							>
								<td style={{ padding: '10px 12px', color: '#94a3b8' }}>{item.itemSku}</td>
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
												style={{ padding: '3px 8px', fontSize: 12 }}>
												{savingQty ? '…' : '✓'}
											</button>
											<button className="secondary" onClick={() => setEditingQty(null)}
												style={{ padding: '3px 8px', fontSize: 12 }}>✕</button>
										</div>
									) : (
										<span
											onClick={() => setEditingQty({ itemId: item.itemId, value: String(item.stock) })}
											title="Click to edit stock"
											style={{ cursor: 'pointer', color: item.stock <= 5 ? '#f87171' : '#e8eef5', fontWeight: item.stock <= 5 ? 700 : 400, borderBottom: '1px dashed #4b5563', paddingBottom: 1 }}>
											{item.stock <= 5 && <span style={{ marginRight: 4 }}>⚠</span>}{item.stock}
										</span>
									)}
								</td>
								<td style={{ padding: '10px 12px', textAlign: 'right', color: '#86efac' }}>{formatCurrency(item.price, currency)}</td>
								<td style={{ padding: '10px 12px', textAlign: 'right', color: '#93c5fd' }}>{formatCurrency(item.costPrice, currency)}</td>
								<td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(item.totalValue, currency)}</td>
								<td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8' }}>{formatCurrency(item.totalCostValue, currency)}</td>
							</tr>
						))}
						{pagination.currentData.length === 0 && (
							<tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#4a5568' }}>No items found</td></tr>
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
								style={{ padding: '6px 12px', background: pageNum === pagination.currentPage ? '#2263ff' : '#1a2030', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: pageNum === pagination.currentPage ? 700 : 400 }}>
								{pageNum}
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}
