import { FormEvent, useState, useEffect } from 'react'
import { db, Supplier } from '../storage'

export default function SuppliersPage() {
	const [suppliers, setSuppliers] = useState<Supplier[]>([])
	const [purchases, setPurchases] = useState<any[]>([])
	const [form, setForm] = useState({ name: '', phone: '', address: '' })
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState<{ name: string, phone: string, address: string }>({ name: '', phone: '', address: '' })
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const loadSuppliers = async () => {
			try {
				const [suppliersData, purchasesData] = await Promise.all([
					db.listSuppliers(),
					db.listPurchases()
				])
				setSuppliers(suppliersData)
				setPurchases(purchasesData)
			} catch (error) {
				console.error('Error loading suppliers:', error)
			} finally {
				setLoading(false)
			}
		}
		loadSuppliers()
	}, [])

	async function onSubmit(e: FormEvent) {
		e.preventDefault()
		if (!form.name || !form.phone) return
		try {
			await db.createSupplier({ name: form.name, phone: form.phone, address: form.address })
			const updatedSuppliers = await db.listSuppliers()
			setSuppliers(updatedSuppliers)
			setForm({ name: '', phone: '', address: '' })
		} catch (error) {
			console.error('Error creating supplier:', error)
		}
	}

	function startEdit(supplier: Supplier) {
		setEditingId(supplier.id)
		setEditForm({ name: supplier.name, phone: supplier.phone, address: supplier.address })
	}

	async function saveEdit(id: string) {
		try {
			await db.updateSupplier(id, { name: editForm.name, phone: editForm.phone, address: editForm.address })
			const updatedSuppliers = await db.listSuppliers()
			setSuppliers(updatedSuppliers)
			setEditingId(null)
		} catch (error) {
			console.error('Error updating supplier:', error)
		}
	}

	function cancelEdit() {
		setEditingId(null)
	}

	async function deleteSupplier(id: string) {
		try {
			await db.deleteSupplier(id)
			const updatedSuppliers = await db.listSuppliers()
			setSuppliers(updatedSuppliers)
		} catch (error) {
			console.error('Error deleting supplier:', error)
		}
	}

	async function payCredit(supplierName: string, creditAmount: number) {
		try {
			// Mark all credit purchases for this supplier as paid
			const supplierCreditPurchases = purchases.filter(p => p.supplier === supplierName && p.paymentType === 'credit' && !p.isPaid)
			for (const purchase of supplierCreditPurchases) {
				await db.updatePurchase(purchase.id, { isPaid: true })
			}
			// Reload data
			const updatedPurchases = await db.listPurchases()
			setPurchases(updatedPurchases)
			alert(`Credit of ${creditAmount.toFixed(2)} paid for ${supplierName}`)
		} catch (error) {
			console.error('Error paying credit:', error)
			alert('Error paying credit')
		}
	}

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading suppliers...
			</div>
		)
	}

	return (
		<div className="card">
			<h2>Suppliers</h2>
			<form onSubmit={onSubmit} className="form-grid">
				<input placeholder="Supplier Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
				<input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
				<input placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
				<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
					<button type="submit">Add Supplier</button>
				</div>
			</form>
			<div className="table-container">
				<table className="table">
					<thead>
						<tr>
							<th>ID</th>
							<th>Name</th>
							<th>Phone</th>
							<th>Address</th>
							<th>Credit Amount</th>
							<th>Debit Amount</th>
							<th>Created</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{suppliers.map(s => {
							const supplierPurchases = purchases.filter(p => p.supplier === s.name)
							const creditAmount = supplierPurchases.filter(p => p.paymentType === 'credit' && !p.isPaid).reduce((sum, p) => sum + ((p.costPrice || 0) * (p.quantity || p.qty || 0)), 0)
							const debitAmount = supplierPurchases.filter(p => p.paymentType === 'debit').reduce((sum, p) => sum + ((p.costPrice || 0) * (p.quantity || p.qty || 0)), 0)
							return (
							<tr key={s.id}>
								<td>{s.supplierId}</td>
								<td>
									{editingId === s.id ? (
										<input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
									) : s.name}
								</td>
								<td>
									{editingId === s.id ? (
										<input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
									) : s.phone}
								</td>
								<td>
									{editingId === s.id ? (
										<input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
									) : s.address}
								</td>
								<td>
									{creditAmount.toFixed(2)}
									{creditAmount > 0 ? (
										<button 
											style={{ marginLeft: '8px', padding: '4px 8px', fontSize: '12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
											onClick={() => payCredit(s.name, creditAmount)}
										>
											Pay
										</button>
									) : null}
								</td>
								<td>{debitAmount.toFixed(2)}</td>
								<td>{s.createdAt ? new Date(s.createdAt).toLocaleString() : 'N/A'}</td>
								<td style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
									{editingId === s.id ? (
										<>
											<button onClick={() => saveEdit(s.id)}>Save</button>
											<button className="secondary" onClick={() => cancelEdit()}>Cancel</button>
										</>
									) : (
										<>
											<button onClick={() => startEdit(s)}>Edit</button>
											<button className="secondary" onClick={() => deleteSupplier(s.id)}>Delete</button>
										</>
									)}
								</td>
							</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</div>
	)
}