import { useState, useMemo } from 'react'
import { useItems, usePurchases, useInventory } from '../hooks/useDataQueries'
import { usePagination } from '../hooks/usePagination'
import { VirtualList } from '../components/VirtualList'
import { TableSkeleton } from '../components/LoadingSkeleton'

export default function InventoryPage() {
	const [searchTerm, setSearchTerm] = useState('')
	const { data: items = [], isLoading: itemsLoading } = useItems()
	const { data: purchases = [], isLoading: purchasesLoading } = usePurchases()
	const { data: inventory = [], isLoading: inventoryLoading } = useInventory()

	const loading = itemsLoading || purchasesLoading || inventoryLoading

	const enrichedInventory = useMemo(() => {
		return inventory.map(inv => {
			const item = items.find(i => i.id === inv.itemId)
			const price = item?.price || 0
			
			// Find most recent purchase for cost price
			const itemPurchases = purchases.filter(p => p.itemId === inv.itemId)
			const latestPurchase = itemPurchases.sort((a, b) => 
				new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
			)[0]
			const costPrice = latestPurchase?.costPrice || 0
			
			return {
				...inv,
				price,
				costPrice,
				totalValue: inv.stock * price,
				totalCostValue: inv.stock * costPrice
			}
		})
	}, [inventory, items, purchases])

	const filteredItems = useMemo(() => {
		return enrichedInventory.filter(item => 
			item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.itemSku.toLowerCase().includes(searchTerm.toLowerCase())
		)
	}, [enrichedInventory, searchTerm])

	const lowStockItems = useMemo(() => {
		return filteredItems.filter(item => item.stock <= 5)
	}, [filteredItems])

	const pagination = usePagination({
		data: filteredItems,
		itemsPerPage: 20
	})

	if (loading) {
		return (
			<div className="card">
				<h2>Inventory</h2>
				<TableSkeleton rows={10} columns={6} />
			</div>
		)
	}

	return (
		<div className="card">
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
				<h2 style={{ margin: '0' }}>Inventory</h2>
				<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
					<input
						type="text"
						placeholder="Search items..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						style={{
							padding: '8px 12px',
							border: '1px solid #243245',
							borderRadius: '6px',
							background: '#0b0f14',
							color: '#e8eef5',
							minWidth: '200px'
						}}
					/>
				</div>
			</div>

			{lowStockItems.length > 0 && (
				<div style={{ 
					background: '#f44336', 
					color: 'white', 
					padding: '12px', 
					borderRadius: '8px', 
					marginBottom: '20px' 
				}}>
					<strong>⚠️ Low Stock Alert:</strong> {lowStockItems.length} items need restocking
				</div>
			)}

			<div style={{ marginBottom: '20px' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
					<span>Showing {pagination.currentData.length} of {pagination.totalItems} items</span>
					<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
						<button 
							onClick={pagination.goToFirstPage}
							disabled={!pagination.hasPrevPage}
							style={{ padding: '4px 8px', fontSize: '12px' }}
						>
							First
						</button>
						<button 
							onClick={pagination.prevPage}
							disabled={!pagination.hasPrevPage}
							style={{ padding: '4px 8px', fontSize: '12px' }}
						>
							Previous
						</button>
						<span style={{ fontSize: '14px' }}>
							Page {pagination.currentPage} of {pagination.totalPages}
						</span>
						<button 
							onClick={pagination.nextPage}
							disabled={!pagination.hasNextPage}
							style={{ padding: '4px 8px', fontSize: '12px' }}
						>
							Next
						</button>
						<button 
							onClick={pagination.goToLastPage}
							disabled={!pagination.hasNextPage}
							style={{ padding: '4px 8px', fontSize: '12px' }}
						>
							Last
						</button>
					</div>
				</div>
			</div>

			<div style={{ overflow: 'auto', maxHeight: '600px' }}>
				<table style={{ width: '100%', borderCollapse: 'collapse' }}>
					<thead>
						<tr style={{ background: '#1a1f2e' }}>
							<th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #243245' }}>SKU</th>
							<th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #243245' }}>Name</th>
							<th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #243245' }}>Stock</th>
							<th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #243245' }}>Price</th>
							<th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #243245' }}>Cost Price</th>
							<th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #243245' }}>Total Value</th>
						</tr>
					</thead>
					<tbody>
						{pagination.currentData.map((item, index) => (
							<tr 
								key={item.itemId} 
								style={{ 
									borderBottom: '1px solid #243245',
									background: item.stock <= 5 ? '#2d1b1b' : 'transparent'
								}}
							>
								<td style={{ padding: '12px' }}>{item.itemSku}</td>
								<td style={{ padding: '12px' }}>{item.itemName}</td>
								<td style={{ 
									padding: '12px', 
									textAlign: 'right',
									color: item.stock <= 5 ? '#f44336' : '#e8eef5',
									fontWeight: item.stock <= 5 ? 'bold' : 'normal'
								}}>
									{item.stock}
								</td>
								<td style={{ padding: '12px', textAlign: 'right' }}>${item.price.toFixed(2)}</td>
								<td style={{ padding: '12px', textAlign: 'right' }}>${item.costPrice.toFixed(2)}</td>
								<td style={{ padding: '12px', textAlign: 'right' }}>${item.totalValue.toFixed(2)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{pagination.totalPages > 1 && (
				<div style={{ 
					display: 'flex', 
					justifyContent: 'center', 
					alignItems: 'center', 
					gap: '8px', 
					marginTop: '20px' 
				}}>
					{Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
						const pageNum = Math.max(1, pagination.currentPage - 2) + i
						if (pageNum > pagination.totalPages) return null
						
						return (
							<button
								key={pageNum}
								onClick={() => pagination.goToPage(pageNum)}
								style={{
									padding: '8px 12px',
									background: pageNum === pagination.currentPage ? '#2263ff' : '#243245',
									color: 'white',
									border: 'none',
									borderRadius: '4px',
									cursor: 'pointer'
								}}
							>
								{pageNum}
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}