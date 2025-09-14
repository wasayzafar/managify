import { useState, useEffect } from 'react'
import { db } from '../storage'

export default function InventoryPage() {
	const [items, setItems] = useState<Array<{ itemId: string, itemName: string, itemSku: string, stock: number, price: number, totalValue: number }>>([])
	const [loading, setLoading] = useState(true)
	const [searchTerm, setSearchTerm] = useState('')

	useEffect(() => {
		const loadInventory = async () => {
			try {
				const [inventoryData, itemsData] = await Promise.all([
					db.inventory(),
					db.listItems()
				])
				const enrichedInventory = inventoryData.map(inv => {
					const item = itemsData.find(i => i.id === inv.itemId)
					const price = item?.price || 0
					return {
						...inv,
						price,
						totalValue: inv.stock * price
					}
				})
				setItems(enrichedInventory)
			} catch (error) {
				console.error('Error loading inventory:', error)
			} finally {
				setLoading(false)
			}
		}
		loadInventory()
	}, [])

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading inventory...
			</div>
		)
	}

	const filteredItems = items.filter(item => 
		item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
		item.itemSku.toLowerCase().includes(searchTerm.toLowerCase())
	)

	const lowStockItems = items.filter(item => item.stock <= 5)

	return (
		<div className="card">
			<h2>Inventory</h2>
			
			{lowStockItems.length > 0 && (
				<div className="card" style={{ background: '#fff3cd', border: '1px solid #ffeaa7', marginBottom: 16 }}>
					<h3 style={{ color: '#856404', margin: '0 0 8px 0' }}>⚠️ Low Stock Alert</h3>
					<p style={{ color: '#856404', margin: 0 }}>
						{lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} with stock ≤ 5: {lowStockItems.map(item => item.itemName).join(', ')}
					</p>
				</div>
			)}

			<div className="form-grid" style={{ marginBottom: 16 }}>
				<input 
					placeholder="Search by name or SKU" 
					value={searchTerm} 
					onChange={e => setSearchTerm(e.target.value)} 
					autoFocus
				/>
				<button onClick={() => {
					const csvContent = 'SKU,Name,Stock,Rate/Unit,Total Value\n' + items.map(i => `${i.itemSku},"${i.itemName}",${i.stock},${i.price.toFixed(2)},${i.totalValue.toFixed(2)}`).join('\n')
					const blob = new Blob([csvContent], { type: 'text/csv' })
					const url = URL.createObjectURL(blob)
					const a = document.createElement('a')
					a.href = url
					a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`
					a.click()
					URL.revokeObjectURL(url)
				}}>Export to Excel</button>
			</div>

			<div className="table-container">
				<table className="table">
					<thead>
						<tr>
							<th>SKU</th>
							<th>Name</th>
							<th>Stock</th>
							<th>Rate/Unit</th>
							<th>Total Value</th>
						</tr>
					</thead>
					<tbody>
						{filteredItems.map(i => (
							<tr key={i.itemId}>
								<td>{i.itemSku}</td>
								<td>{i.itemName}</td>
								<td><span className="badge" style={{ background: i.stock <= 5 ? '#f44336' : '#4caf50' }}>{i.stock}</span></td>
								<td>Price {i.price.toFixed(2)}</td>
								<td>Price {i.totalValue.toFixed(2)}</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr style={{ background: '#2263ff', color: 'white', fontWeight: 'bold' }}>
							<td colSpan={4} style={{ textAlign: 'right' }}>Total Inventory Value:</td>
							<td>Price {filteredItems.reduce((sum, i) => sum + i.totalValue, 0).toFixed(2)}</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	)
}
