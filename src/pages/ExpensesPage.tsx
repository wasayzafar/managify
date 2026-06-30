import { useState, useEffect } from 'react'
import { db, Expense } from '../storage'
import { loadCurrency, formatCurrency } from '../utils/currency'

const EXPENSE_TYPES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Maintenance', 'Liabilities', 'Other']

const currentMonth = () => new Date().toISOString().slice(0, 7)

const emptyForm = { type: 'Rent', amount: '', description: '', expiresThisMonth: false, expenseMonth: currentMonth() }

export default function ExpensesPage() {
	const [expenses, setExpenses] = useState<Expense[]>([])
	const [form, setForm] = useState(emptyForm)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState(emptyForm)
	const [loading, setLoading] = useState(true)
	const [currency, setCurrency] = useState('PKR')

	useEffect(() => {
		const loadExpenses = async () => {
			try {
				const data = await db.listExpenses()
				setExpenses(data)
				const curr = await loadCurrency()
				setCurrency(curr)
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
			await db.createExpense({
				type: form.type,
				amount: Number(form.amount),
				description: form.description,
				expiresThisMonth: form.expiresThisMonth,
				expenseMonth: form.expenseMonth,
			})
			setExpenses(await db.listExpenses())
			setForm(emptyForm)
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
			description: expense.description || '',
			expiresThisMonth: expense.expiresThisMonth ?? false,
			expenseMonth: expense.expenseMonth || currentMonth(),
		})
	}

	const saveEdit = async (id: string) => {
		try {
			await db.updateExpense(id, {
				type: editForm.type,
				amount: Number(editForm.amount),
				description: editForm.description,
				expiresThisMonth: editForm.expiresThisMonth,
				expenseMonth: editForm.expenseMonth,
			})
			setExpenses(await db.listExpenses())
			setEditingId(null)
		} catch (error) {
			console.error('Error updating expense:', error)
		}
	}

	const deleteExpense = async (id: string) => {
		if (window.confirm('Are you sure you want to delete this expense?')) {
			try {
				await db.deleteExpense(id)
				setExpenses(await db.listExpenses())
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
				<h3 style={{ color: '#856404', margin: '0 0 8px 0' }}>Total Expenses</h3>
				<p style={{ color: '#856404', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
					{formatCurrency(totalExpenses, currency)}
				</p>
			</div>

			<form onSubmit={onSubmit} className="form-grid">
				<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
					{EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
				</select>
				<input
					placeholder="Amount"
					type="number"
					step="0.01"
					value={form.amount}
					onChange={e => setForm({ ...form, amount: e.target.value })}
				/>
				<input
					placeholder="Description (optional)"
					value={form.description}
					onChange={e => setForm({ ...form, description: e.target.value })}
				/>
				<input
					type="month"
					value={form.expenseMonth}
					onChange={e => setForm({ ...form, expenseMonth: e.target.value })}
					title="Expense Month"
				/>
				<label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e8eef5', cursor: 'pointer' }}>
					<input
						type="checkbox"
						checked={form.expiresThisMonth}
						onChange={e => setForm({ ...form, expiresThisMonth: e.target.checked })}
						style={{ width: 16, height: 16, cursor: 'pointer' }}
					/>
					Expires after this month
				</label>
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
						<th>Month</th>
						<th>Expires</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{expenses.map(exp => (
						<tr key={exp.id}>
							<td>
								{editingId === exp.id ? (
									<select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
										{EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
									</select>
								) : exp.type}
							</td>
							<td>
								{editingId === exp.id ? (
									<input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
								) : formatCurrency(exp.amount, currency)}
							</td>
							<td>
								{editingId === exp.id ? (
									<input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
								) : exp.description || 'N/A'}
							</td>
							<td>{new Date(exp.date).toLocaleDateString()}</td>
							<td>
								{editingId === exp.id ? (
									<input type="month" value={editForm.expenseMonth} onChange={e => setEditForm({ ...editForm, expenseMonth: e.target.value })} />
								) : exp.expenseMonth ? (
									new Date(exp.expenseMonth + '-01').toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
								) : '—'}
							</td>
							<td>
								{editingId === exp.id ? (
									<label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
										<input
											type="checkbox"
											checked={editForm.expiresThisMonth}
											onChange={e => setEditForm({ ...editForm, expiresThisMonth: e.target.checked })}
										/>
										This month
									</label>
								) : exp.expiresThisMonth ? (
									<span style={{
										background: '#fff3cd',
										color: '#856404',
										padding: '2px 8px',
										borderRadius: 12,
										fontSize: 12,
										fontWeight: 600,
										whiteSpace: 'nowrap',
									}}>
										This month
									</span>
								) : '—'}
							</td>
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
