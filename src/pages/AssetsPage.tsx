import { useState, useEffect } from 'react'
import { db, Asset } from '../storage'
import { loadCurrency, formatCurrency } from '../utils/currency'

const CATEGORIES = ['Equipment', 'Vehicle', 'Furniture', 'Electronics', 'Land', 'Building', 'Other']

const emptyForm = { name: '', category: 'Equipment', purchaseDate: '', purchasePrice: '', description: '' }

export default function AssetsPage() {
	const [assets, setAssets] = useState<Asset[]>([])
	const [form, setForm] = useState(emptyForm)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState(emptyForm)
	const [loading, setLoading] = useState(true)
	const [currency, setCurrency] = useState('PKR')

	useEffect(() => {
		const load = async () => {
			try {
				const [data, curr] = await Promise.all([db.listAssets(), loadCurrency()])
				setAssets(data)
				setCurrency(curr)
			} catch (error) {
				console.error('Error loading assets:', error)
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [])

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!form.name || !form.purchaseDate || !form.purchasePrice) {
			alert('Please fill in asset name, purchase date, and price')
			return
		}
		try {
			await db.createAsset({
				name: form.name,
				category: form.category,
				purchaseDate: form.purchaseDate,
				purchasePrice: Number(form.purchasePrice),
				description: form.description,
			})
			setAssets(await db.listAssets())
			setForm(emptyForm)
		} catch (error: any) {
			console.error('Error adding asset:', error)
			const msg = error?.message || error?.details || error?.hint || JSON.stringify(error)
			alert('Error adding asset: ' + msg)
		}
	}

	const startEdit = (asset: Asset) => {
		setEditingId(asset.id)
		setEditForm({
			name: asset.name,
			category: asset.category,
			purchaseDate: asset.purchaseDate,
			purchasePrice: String(asset.purchasePrice),
			description: asset.description || '',
		})
	}

	const saveEdit = async (id: string) => {
		try {
			await db.updateAsset(id, {
				name: editForm.name,
				category: editForm.category,
				purchaseDate: editForm.purchaseDate,
				purchasePrice: Number(editForm.purchasePrice),
				description: editForm.description,
			})
			setAssets(await db.listAssets())
			setEditingId(null)
		} catch (error: any) {
			console.error('Error updating asset:', error)
			const msg = error?.message || error?.details || error?.hint || JSON.stringify(error)
			alert('Error updating asset: ' + msg)
		}
	}

	const deleteAsset = async (id: string) => {
		if (window.confirm('Delete this asset?')) {
			try {
				await db.deleteAsset(id)
				setAssets(await db.listAssets())
			} catch (error) {
				console.error('Error deleting asset:', error)
			}
		}
	}

	const totalValue = assets.reduce((sum, a) => sum + a.purchasePrice, 0)

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading assets...
			</div>
		)
	}

	return (
		<div className="card">
			<h2>Assets</h2>

			<div className="card" style={{ background: '#d4edda', border: '1px solid #c3e6cb', marginBottom: 16 }}>
				<h3 style={{ color: '#155724', margin: '0 0 8px 0' }}>Total Asset Value</h3>
				<p style={{ color: '#155724', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
					{formatCurrency(totalValue, currency)}
				</p>
			</div>

			<form onSubmit={onSubmit} className="form-grid">
				<input
					placeholder="Asset Name (e.g., Delivery Van, Laptop)"
					value={form.name}
					onChange={e => setForm({ ...form, name: e.target.value })}
				/>
				<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
					{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
				</select>
				<input
					type="date"
					placeholder="Purchase Date"
					value={form.purchaseDate}
					onChange={e => setForm({ ...form, purchaseDate: e.target.value })}
				/>
				<input
					type="number"
					step="0.01"
					placeholder="Purchase Price"
					value={form.purchasePrice}
					onChange={e => setForm({ ...form, purchasePrice: e.target.value })}
				/>
				<input
					placeholder="Description (optional)"
					value={form.description}
					onChange={e => setForm({ ...form, description: e.target.value })}
				/>
				<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
					<button type="submit">Add Asset</button>
				</div>
			</form>

			<table className="table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Category</th>
						<th>Purchase Date</th>
						<th>Purchase Price</th>
						<th>Description</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{assets.length === 0 && (
						<tr>
							<td colSpan={6} style={{ textAlign: 'center', color: '#aaa' }}>No assets added yet</td>
						</tr>
					)}
					{assets.map(asset => (
						<tr key={asset.id}>
							<td>
								{editingId === asset.id
									? <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
									: asset.name}
							</td>
							<td>
								{editingId === asset.id
									? <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
										{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
									  </select>
									: asset.category}
							</td>
							<td>
								{editingId === asset.id
									? <input type="date" value={editForm.purchaseDate} onChange={e => setEditForm({ ...editForm, purchaseDate: e.target.value })} />
									: new Date(asset.purchaseDate).toLocaleDateString()}
							</td>
							<td>
								{editingId === asset.id
									? <input type="number" step="0.01" value={editForm.purchasePrice} onChange={e => setEditForm({ ...editForm, purchasePrice: e.target.value })} />
									: formatCurrency(asset.purchasePrice, currency)}
							</td>
							<td>
								{editingId === asset.id
									? <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
									: asset.description || '—'}
							</td>
							<td style={{ display: 'flex', gap: 8 }}>
								{editingId === asset.id ? (
									<>
										<button onClick={() => saveEdit(asset.id)}>Save</button>
										<button className="secondary" onClick={() => setEditingId(null)}>Cancel</button>
									</>
								) : (
									<>
										<button onClick={() => startEdit(asset)}>Edit</button>
										<button className="secondary" onClick={() => deleteAsset(asset.id)}>Delete</button>
									</>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
