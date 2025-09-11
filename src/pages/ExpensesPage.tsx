import { useState, useEffect } from 'react'
import { db, Expense } from '../storage'

export default function ExpensesPage() {
	const [expenses, setExpenses] = useState<Expense[]>([])
	const [form, setForm] = useState({ type: '', amount: '', description: '' })
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState<typeof form>(form)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const loadExpenses = async () => {
			try {
				const data = await db.listExpenses()
				setExpenses(data)
			} catch (error) {
				console.error('Error loading expenses:', error)
			} finally {
				setLoading(false)
			}
		}
		loadExpenses()
	}, [])

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!form.type || !form.amount) {
			alert('Please fill in expense type and amount')
			return
		}
		
		try {
			console.log('Creating expense:', { type: form.type, amount: Number(form.amount), description: form.description })
			const created = await db.createExpense({
				type: form.type,
				amount: Number(form.amount),
				description: form.description
			})
			console.log('Expense created:', created)
			const updated = await db.listExpenses()
			setExpenses(updated)
			setForm({ type: '', amount: '', description: '' })
			alert('Expense added successfully!')
		} catch (error) {
			console.error('Error creating expense:', error)
			alert('Error adding expense: ' + error)
		}
	}

	const startEdit = (expense: Expense) => {
		setEditingId(expense.id)
		setEditForm({
			type: expense.type,
			amount: String(expense.amount),
			description: expense.description || ''
		})
	}

	const saveEdit = async (id: string) => {
		try {
			await db.updateExpense(id, {
				type: editForm.type,
				amount: Number(editForm.amount),
				description: editForm.description
			})
			const updated = await db.listExpenses()
			setExpenses(updated)
			setEditingId(null)
		} catch (error) {
			console.error('Error updating expense:', error)
		}
	}

	const deleteExpense = async (id: string) => {
		if (window.confirm('Are you sure you want to delete this expense?')) {
			try {
				await db.deleteExpense(id)
				const updated = await db.listExpenses()
				setExpenses(updated)
			} catch (error) {
				console.error('Error deleting expense:', error)
			}
		}
	}

	const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading expenses...
			</div>
		)
	}

	return (
		<div className="card">
			<h2>Expenses</h2>
			
			<div className="card" style={{ background: '#fff3cd', border: '1px solid #ffeaa7', marginBottom: 16 }}>
				<h3 style={{ color: '#856404', margin: '0 0 8px 0' }}>💰 Total Expenses</h3>
				<p style={{ color: '#856404', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
					price {totalExpenses.toFixed(2)}
				</p>
			</div>
			
			<form onSubmit={onSubmit} className="form-grid">
				<input placeholder="Expense Type (e.g., Rent, Utilities)" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
				<input placeholder="Amount" type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
				<input placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
				<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
					<button type="submit">Add Expense</button>
				</div>
			</form>

			<table className="table">
				<thead>
					<tr>
						<th>Type</th>
						<th>Amount</th>
						<th>Description</th>
						<th>Date</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{expenses.map(exp => (
						<tr key={exp.id}>
							<td>
								{editingId === exp.id ? (
									<input value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} />
								) : exp.type}
							</td>
							<td>
								{editingId === exp.id ? (
									<input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
								) : `price ${exp.amount.toFixed(2)}`}
							</td>
							<td>
								{editingId === exp.id ? (
									<input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
								) : exp.description || 'N/A'}
							</td>
							<td>{new Date(exp.date).toLocaleDateString()}</td>
							<td style={{ display: 'flex', gap: 8 }}>
								{editingId === exp.id ? (
									<>
										<button onClick={() => saveEdit(exp.id)}>Save</button>
										<button className="secondary" onClick={() => setEditingId(null)}>Cancel</button>
									</>
								) : (
									<>
										<button onClick={() => startEdit(exp)}>Edit</button>
										<button className="secondary" onClick={() => deleteExpense(exp.id)}>Delete</button>
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