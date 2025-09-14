import { FormEvent, useMemo, useState, useEffect } from 'react'
import { db, Item } from '../storage'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'

export default function ItemsPage() {
	const [items, setItems] = useState<Item[]>([])
	const [filter, setFilter] = useState('')
	const [form, setForm] = useState({ sku: '', name: '', price: '' })
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState<{ sku: string, name: string, price: string }>({ sku: '', name: '', price: '' })
	const [loading, setLoading] = useState(true)
	const [scannerEnabled, setScannerEnabled] = useState(false)

	const { videoRef, isScanning, error: scanError } = useBarcodeScanner(
		(code) => setForm({ ...form, sku: code }),
		scannerEnabled
	)

	useEffect(() => {
		const loadItems = async () => {
			try {
				const itemsData = await db.listItems()
				setItems(itemsData)
			} catch (error) {
				console.error('Error loading items:', error)
			} finally {
				setLoading(false)
			}
		}
		loadItems()
	}, [])

	const filtered = useMemo(() => items.filter(i => (
		i.sku.toLowerCase().includes(filter.toLowerCase()) ||
		i.name.toLowerCase().includes(filter.toLowerCase())
	)), [items, filter])

	async function onSubmit(e: FormEvent) {
		e.preventDefault()
		if (!form.sku || !form.name) return
		try {
			const price = Number(form.price || '0')
			await db.createItem({ sku: form.sku, name: form.name, price })
			const updatedItems = await db.listItems()
			setItems(updatedItems)
			setForm({ sku: '', name: '', price: '' })
		} catch (error) {
			console.error('Error creating item:', error)
		}
	}

	function startEdit(item: Item) {
		setEditingId(item.id)
		setEditForm({ sku: item.sku, name: item.name, price: String(item.price) })
	}

	async function saveEdit(id: string) {
		try {
			const price = Number(editForm.price || '0')
			await db.updateItem(id, { sku: editForm.sku, name: editForm.name, price })
			const updatedItems = await db.listItems()
			setItems(updatedItems)
			setEditingId(null)
		} catch (error) {
			console.error('Error updating item:', error)
		}
	}

	function cancelEdit() {
		setEditingId(null)
	}

	async function deleteItem(id: string) {
		try {
			await db.deleteItem(id)
			const updatedItems = await db.listItems()
			setItems(updatedItems)
		} catch (error) {
			console.error('Error deleting item:', error)
		}
	}

	if (loading) {
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
				<input placeholder="Search by SKU or Name" value={filter} onChange={e => setFilter(e.target.value)} />
			</div>
			<form onSubmit={onSubmit} className="form-grid">
				<input placeholder="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
				<input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
				<input placeholder="Price" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
				<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
					<button type="button" onClick={() => setScannerEnabled(!scannerEnabled)}>
						{scannerEnabled ? 'Hide Scanner' : 'Scan SKU'}
					</button>
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
							<th>SKU</th>
							<th>Name</th>
							<th>Price</th>
							<th>Created</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{filtered.map(i => (
							<tr key={i.id}>
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
