import { FormEvent, useMemo, useState, useEffect } from 'react'
import { db, Item } from '../storage'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import { useItems, usePurchases } from '../hooks/useDataQueries'

export default function ItemsPage() {
	const [filter, setFilter] = useState('')
	const [form, setForm] = useState({ sku: '', name: '', price: '', costPrice: '' })
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState<{ sku: string, name: string, price: string, costPrice: string }>({ sku: '', name: '', price: '', costPrice: '' })
	const [scannerEnabled, setScannerEnabled] = useState(false)

	const { data: items = [], isLoading: itemsLoading, refetch } = useItems()
	const { data: purchases = [] } = usePurchases()

	const { videoRef, isScanning, error: scanError } = useBarcodeScanner(
		(code) => setForm({ ...form, sku: code }),
		scannerEnabled
	)

	const enrichedItems = useMemo(() => {
		return items.map(item => {
			const itemPurchases = purchases.filter(p => p.itemId === item.id)
			const latestPurchase = itemPurchases.sort((a, b) => 
				new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
			)[0]
			const costPrice = latestPurchase?.costPrice || 0
			
			return {
				...item,
				costPrice
			}
		})
	}, [items, purchases])

	const filtered = useMemo(() => enrichedItems.filter(i => (
		i.sku.toLowerCase().includes(filter.toLowerCase()) ||
		i.name.toLowerCase().includes(filter.toLowerCase())
	)), [enrichedItems, filter])

	async function onSubmit(e: FormEvent) {
		e.preventDefault()
		if (!form.sku || !form.name) return
		try {
			const price = Number(form.price || '0')
			const costPrice = Number(form.costPrice || '0')
			await db.createItem({ sku: form.sku, name: form.name, price, costPrice })
			refetch()
			setForm({ sku: '', name: '', price: '', costPrice: '' })
		} catch (error) {
			console.error('Error creating item:', error)
		}
	}

	function startEdit(item: Item) {
		setEditingId(item.id)
		setEditForm({ sku: item.sku, name: item.name, price: String(item.price), costPrice: String(item.costPrice || 0) })
	}

	async function saveEdit(id: string) {
		try {
			const price = Number(editForm.price || '0')
			const costPrice = Number(editForm.costPrice || '0')
			await db.updateItem(id, { sku: editForm.sku, name: editForm.name, price, costPrice })
			refetch()
			setEditingId(null)
		} catch (error) {
			console.error('Error updating item:', error)
		}
	}

	function cancelEdit() {
		setEditingId(null)
	}

	async function deleteItem(id: string) {
		if (!confirm('Delete this item? This will also delete all related purchases and sales.')) return
		try {
			const userId = (await import('../firebase')).auth.currentUser?.uid
			if (!userId) throw new Error('Not authenticated')
			
			await (await import('../supabase')).supabase.from('purchases').delete().eq('item_id', id).eq('user_id', userId)
			await (await import('../supabase')).supabase.from('sales').delete().eq('item_id', id).eq('user_id', userId)
			await db.deleteItem(id)
			refetch()
		} catch (error) {
			console.error('Error deleting item:', error)
			alert('Cannot delete item: ' + (error?.message || 'Unknown error'))
		}
	}

	if (itemsLoading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading items...
			</div>
		)
	}

	return (
		<div className="card">
			<h2>Items</h2>
			<div className="form-grid" style={{ marginBottom: 12 }}>
				<input placeholder="Search by SKU or Name" value={filter} onChange={e => setFilter(e.target.value)} autoFocus />
			</div>
			<form onSubmit={onSubmit} className="form-grid">
				<input placeholder="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
				<input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
				<input placeholder="Price" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
				<input placeholder="Cost Price" type="number" step="0.01" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} />
				<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
					{/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
						<button type="button" onClick={() => setScannerEnabled(!scannerEnabled)}>
							{scannerEnabled ? 'Hide Scanner' : 'Scan SKU'}
						</button>
					)}
					<button type="submit">Add Item</button>
				</div>
				{scannerEnabled && (
					<div style={{ gridColumn: '1 / -1' }}>
						<video ref={videoRef} style={{ width: '100%', maxHeight: 220, background: '#111', borderRadius: 12, marginTop: 8 }} muted playsInline />
						{scanError && <div className="badge" style={{ background: '#ff4444', marginTop: 8 }}>{scanError}</div>}
						{isScanning && <div className="badge" style={{ marginTop: 8 }}>Scanner active - point camera at barcode</div>}
					</div>
				)}
			</form>
			<div className="table-container">
				<table className="table">
					<thead>
						<tr>
							<th>Article</th>
							<th>SKU</th>
							<th>Name</th>
							<th>Price</th>
							<th>Cost Price</th>
							<th>Created</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{filtered.map(i => (
							<tr key={i.id}>
								<td>{i.id.slice(-6)}</td>
								<td>
									{editingId === i.id ? (
										<input value={editForm.sku} onChange={e => setEditForm({ ...editForm, sku: e.target.value })} />
									) : i.sku}
								</td>
								<td>
									{editingId === i.id ? (
										<input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
									) : i.name}
								</td>
								<td>
									{editingId === i.id ? (
										<input type="number" step="0.01" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} />
									) : i.price.toFixed(2)}
								</td>
								<td>
									{editingId === i.id ? (
										<input type="number" step="0.01" value={editForm.costPrice} onChange={e => setEditForm({ ...editForm, costPrice: e.target.value })} />
									) : (i.costPrice !== undefined ? i.costPrice.toFixed(2) : '0.00')}
								</td>
								<td>{i.createdAt ? new Date(i.createdAt).toLocaleString() : 'N/A'}</td>
								<td style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
									{editingId === i.id ? (
										<>
											<button onClick={() => saveEdit(i.id)}>Save</button>
											<button className="secondary" onClick={() => cancelEdit()}>Cancel</button>
										</>
									) : (
										<>
											<button onClick={() => startEdit(i)}>Edit</button>
											<button className="secondary" onClick={() => deleteItem(i.id)}>Delete</button>
										</>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
