import { useState, useEffect } from 'react'
import { db, Expense, StoreInfo } from '../storage'
import { loadCurrency, formatCurrency } from '../utils/currency'
import jsPDF from 'jspdf'

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
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: 'Managify', phone: '', address: '', email: '', website: '', taxNumber: '', logo: '', currency: 'PKR' })

	useEffect(() => {
		const loadExpenses = async () => {
			try {
				const [data, store] = await Promise.all([db.listExpenses(), db.getStoreInfo()])
				setExpenses(data)
				setStoreInfo(store)
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

	function handleExcelExport() {
		const headers = ['Type', 'Amount', 'Description', 'Date', 'Month', 'Expires']
		const rows = expenses.map(e => [
			e.type,
			e.amount.toFixed(2),
			e.description || '',
			e.date ? new Date(e.date).toLocaleDateString() : '',
			e.expenseMonth ? new Date(e.expenseMonth + '-01').toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : '',
			e.expiresThisMonth ? 'Yes' : 'No',
		])
		const tableRows = [
			`<tr>${headers.map(h => `<th style="background:#f0f0f0;font-weight:bold;border:1px solid #ccc;padding:6px">${h}</th>`).join('')}</tr>`,
			...rows.map(r => `<tr>${r.map(c => `<td style="border:1px solid #ccc;padding:6px">${c}</td>`).join('')}</tr>`)
		].join('\n')
		const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${tableRows}</table></body></html>`
		const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a'); a.href = url; a.download = 'expenses.xls'; a.click()
		URL.revokeObjectURL(url)
	}

	function handlePdfExport() {
		const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
		const pageW = pdf.internal.pageSize.getWidth()
		const pageH = pdf.internal.pageSize.getHeight()
		const margin = 14; let y = margin

		pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
		pdf.text(storeInfo.storeName.toUpperCase(), pageW / 2, y, { align: 'center' }); y += 7
		if (storeInfo.address) { pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.text(storeInfo.address, pageW / 2, y, { align: 'center' }); y += 5 }
		if (storeInfo.phone)   { pdf.setFontSize(9); pdf.text('Phone: ' + storeInfo.phone, pageW / 2, y, { align: 'center' }); y += 5 }
		pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
		pdf.text('Expenses Report', pageW / 2, y + 2, { align: 'center' }); y += 7
		pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
		pdf.text('Generated: ' + new Date().toLocaleString(), pageW / 2, y, { align: 'center' }); y += 5
		pdf.line(margin, y, pageW - margin, y); y += 5

		const cols = [
			{ label: 'Type', w: 28 }, { label: 'Amount', w: 28 }, { label: 'Description', w: 60 },
			{ label: 'Date', w: 24 }, { label: 'Month', w: 30 }, { label: 'Expires', w: 16 },
		]
		const tableW = cols.reduce((s, c) => s + c.w, 0)
		const startX = (pageW - tableW) / 2

		const drawHeader = () => {
			pdf.setFillColor(240, 240, 240); pdf.rect(startX, y, tableW, 7, 'F')
			pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
			let x = startX; cols.forEach(c => { pdf.text(c.label, x + 1, y + 5); x += c.w }); y += 7
		}
		drawHeader()

		let total = 0
		pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
		expenses.forEach((exp, idx) => {
			if (y > pageH - 20) { pdf.addPage(); y = margin; drawHeader(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5) }
			total += exp.amount
			if (idx % 2 === 0) { pdf.setFillColor(252, 252, 252); pdf.rect(startX, y, tableW, 6, 'F') }
			const cells = [
				exp.type,
				formatCurrency(exp.amount, currency),
				exp.description || '—',
				exp.date ? new Date(exp.date).toLocaleDateString() : '—',
				exp.expenseMonth ? new Date(exp.expenseMonth + '-01').toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '—',
				exp.expiresThisMonth ? 'Yes' : 'No',
			]
			let x = startX
			cols.forEach((col, ci) => { const text = pdf.splitTextToSize(cells[ci], col.w - 2)[0] || ''; pdf.text(text, x + 1, y + 4); x += col.w })
			y += 6
		})

		y += 3; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
		pdf.text(`Total: ${expenses.length} expenses`, margin, y)
		pdf.text(`Total Amount: ${formatCurrency(total, currency)}`, pageW - margin, y, { align: 'right' })

		const totalPages = (pdf as any).internal.getNumberOfPages()
		for (let i = 1; i <= totalPages; i++) {
			pdf.setPage(i); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(150)
			pdf.text('Report generated by managify.online', pageW / 2, pageH - 6, { align: 'center' })
			pdf.setTextColor(0)
		}
		pdf.save('expenses_report.pdf')
	}

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
				Loading expenses...
			</div>
		)
	}

	return (
		<div className="card">
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
				<h2 style={{ margin: 0 }}>Expenses</h2>
				<div style={{ display: 'flex', gap: 8 }}>
					<button className="secondary" onClick={handleExcelExport}>Export Excel</button>
					<button className="secondary" onClick={handlePdfExport}>Export PDF</button>
				</div>
			</div>

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
