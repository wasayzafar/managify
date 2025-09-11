import { useState, useEffect } from 'react'
import { db } from '../storage'

export default function InventoryPage() {
	const [items, setItems] = useState<Array<{ itemId: string, itemName: string, stock: number }>>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const loadInventory = async () => {
			try {
				const inventoryData = await db.inventory()
				setItems(inventoryData)
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

	return (
		<div className="card">
			<h2>Inventory</h2>
			<div className="table-container">
				<table className="table">
					<thead>
						<tr>
							<th>Item ID</th>
							<th>Name</th>
							<th>Stock</th>
						</tr>
					</thead>
					<tbody>
						{items.map(i => (
							<tr key={i.itemId}>
								<td>{i.itemId}</td>
								<td>{i.itemName}</td>
								<td><span className="badge">{i.stock}</span></td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
