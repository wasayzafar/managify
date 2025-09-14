import { useState, useEffect } from 'react'
import { db } from '../storage'

type Employee = {
	id: string
	name: string
	salary: number
	firstMonthPay: number
	phone: string
	address: string
	email?: string
	position?: string
	joinDate: string
	createdAt: string
}

export default function EmployeesPage() {
	const [employees, setEmployees] = useState<Employee[]>([])
	const [form, setForm] = useState({ name: '', salary: '', phone: '', address: '', email: '', position: '' })
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState<typeof form>(form)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const loadEmployees = async () => {
			try {
				const data = await db.listEmployees()
				setEmployees(data)
			} catch (error) {
				console.error('Error loading employees:', error)
			} finally {
				setLoading(false)
			}
		}
		loadEmployees()
	}, [])



	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!form.name || !form.salary) return
		
		try {
			await db.createEmployee({
				name: form.name,
				salary: Number(form.salary),
				firstMonthPay: Number(form.salary),
				phone: form.phone,
				address: form.address,
				email: form.email,
				position: form.position
			})
			const updated = await db.listEmployees()
			setEmployees(updated)
			setForm({ name: '', salary: '', phone: '', address: '', email: '', position: '' })
		} catch (error) {
			console.error('Error creating employee:', error)
		}
	}

	const startEdit = (emp: Employee) => {
		setEditingId(emp.id)
		setEditForm({
			name: emp.name,
			salary: String(emp.salary),
			phone: emp.phone,
			address: emp.address,
			email: emp.email || '',
			position: emp.position || ''
		})
	}

	const saveEdit = async (id: string) => {
		try {
			await db.updateEmployee(id, {
				name: editForm.name,
				salary: Number(editForm.salary),
				phone: editForm.phone,
				address: editForm.address,
				email: editForm.email,
				position: editForm.position
			})
			const updated = await db.listEmployees()
			setEmployees(updated)
			setEditingId(null)
		} catch (error) {
			console.error('Error updating employee:', error)
		}
	}

	const deleteEmployee = async (id: string) => {
		if (window.confirm('Are you sure you want to delete this employee?')) {
			try {
				await db.deleteEmployee(id)
				const updated = await db.listEmployees()
				setEmployees(updated)
			} catch (error) {
				console.error('Error deleting employee:', error)
			}
		}
	}

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading employees...
			</div>
		)
	}

	return (
		<div className="card">
			<h2>Employees</h2>
			
			<form onSubmit={onSubmit} className="form-grid">
				<input placeholder="Employee Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
				<input placeholder="Monthly Salary" type="number" step="0.01" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} />

				<input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
				<input placeholder="Position" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
				<input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
				<input placeholder="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
				<div className="form-actions" style={{ gridColumn: '1 / -1' }}>
					<button type="submit">Add Employee</button>
				</div>
			</form>

			<table className="table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Position</th>
						<th>Monthly Salary</th>

						<th>Phone</th>
						<th>Email</th>
						<th>Address</th>
						<th>Join Date</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{employees.map(emp => (
						<tr key={emp.id}>
							<td>
								{editingId === emp.id ? (
									<input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
								) : emp.name}
							</td>
							<td>
								{editingId === emp.id ? (
									<input value={editForm.position} onChange={e => setEditForm({ ...editForm, position: e.target.value })} />
								) : emp.position || 'N/A'}
							</td>
							<td>
								{editingId === emp.id ? (
									<input type="number" step="0.01" value={editForm.salary} onChange={e => setEditForm({ ...editForm, salary: e.target.value })} />
								) : `price ${emp.salary.toFixed(2)}`}
							</td>

							<td>
								{editingId === emp.id ? (
									<input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
								) : emp.phone}
							</td>
							<td>
								{editingId === emp.id ? (
									<input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
								) : emp.email || 'N/A'}
							</td>
							<td>
								{editingId === emp.id ? (
									<input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
								) : emp.address}
							</td>
							<td>{new Date(emp.joinDate).toLocaleDateString()}</td>
							<td style={{ display: 'flex', gap: 8 }}>
								{editingId === emp.id ? (
									<>
										<button onClick={() => saveEdit(emp.id)}>Save</button>
										<button className="secondary" onClick={() => setEditingId(null)}>Cancel</button>
									</>
								) : (
									<>
										<button onClick={() => startEdit(emp)}>Edit</button>
										<button className="secondary" onClick={() => deleteEmployee(emp.id)}>Delete</button>
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