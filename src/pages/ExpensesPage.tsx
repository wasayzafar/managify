import { useState, useEffect } from 'react'
import { db, Expense, StoreInfo } from '../storage'
import { loadCurrency, formatCurrency } from '../utils/currency'
import jsPDF from 'jspdf'

const EXPENSE_TYPES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Maintenance', 'Liabilities', 'Other']

const currentMonth = () => new Date().toISOString().slice(0, 7)

const emptySubForm = { type: 'Rent', amount: '', description: '' }

function monthLabel(month: string) {
	if (!month || month === 'other') return 'Unknown Month'
	return new Date(month + '-01').toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
}

export default function ExpensesPage() {
	const [expenses, setExpenses] = useState<Expense[]>([])
	const [loading, setLoading] = useState(true)
	const [currency, setCurrency] = useState('PKR')
	const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: 'Managify', phone: '', address: '', email: '', website: '', taxNumber: '', logo: '', currency: 'PKR' })

	// Month creation
	const [selectedMonth, setSelectedMonth] = useState(currentMonth())
	const [createdMonths, setCreatedMonths] = useState<string[]>(() => {
		try { return JSON.parse(localStorage.getItem('expense_months') || '[]') } catch { return [] }
	})

	// Which month is expanded
	const [expandedMonth, setExpandedMonth] = useState<string | null>(currentMonth())

	// Inline add form per month
	const [addingToMonth, setAddingToMonth] = useState<string | null>(null)
	const [subForm, setSubForm] = useState(emptySubForm)

	// Inline edit
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState(emptySubForm)

	useEffect(() => { loadAll() }, [])

	async function loadAll() {
		setLoading(true)
		try {
			const [data, store] = await Promise.all([db.listExpenses(), db.getStoreInfo()])
			setExpenses(data)
			setStoreInfo(store)
			setCurrency(await loadCurrency())
		} catch (err) {
			console.error('Error loading expenses:', err)
		} finally {
			setLoading(false)
		}
	}

	function addMonth() {
		if (!selectedMonth) return
		const updated = [...new Set([...createdMonths, selectedMonth])].sort().reverse()
		setCreatedMonths(updated)
		localStorage.setItem('expense_months', JSON.stringify(updated))
		setExpandedMonth(selectedMonth)
	}

	async function addSubExpense(month: string) {
		if (!subForm.amount) return
		try {
			await db.createExpense({
				type: subForm.type,
				amount: Number(subForm.amount),
				description: subForm.description,
				expenseMonth: month,
			})
			setExpenses(await db.listExpenses())
			setSubForm(emptySubForm)
			setAddingToMonth(null)
		} catch (err) {
			alert('Error adding expense: ' + err)
		}
	}

	function startEdit(exp: Expense) {
		setEditingId(exp.id)
		setEditForm({ type: exp.type, amount: String(exp.amount), description: exp.description || '' })
	}

	async function saveEdit(id: string) {
		try {
			await db.updateExpense(id, { type: editForm.type, amount: Number(editForm.amount), description: editForm.description })
			setExpenses(await db.listExpenses())
			setEditingId(null)
		} catch (err) {
			console.error('Error updating expense:', err)
		}
	}

	async function deleteExpense(id: string) {
		if (!window.confirm('Delete this expense?')) return
		try {
			await db.deleteExpense(id)
			setExpenses(await db.listExpenses())
		} catch (err) {
			console.error('Error deleting expense:', err)
		}
	}

	// Merge created months with months that have expenses
	const expenseMonthSet = new Set(expenses.map(e => e.expenseMonth || 'other'))
	const allMonths = [...new Set([...createdMonths, ...expenseMonthSet])].sort().reverse()

	const grouped = expenses.reduce((acc, exp) => {
		const key = exp.expenseMonth || 'other'
		if (!acc[key]) acc[key] = []
		acc[key].push(exp)
		return acc
	}, {} as Record<string, Expense[]>)

	const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

	function handleExcelExport() {
		const headers = ['Month', 'Type', 'Amount', 'Description', 'Date']
		const rows = expenses.map(e => [
			e.expenseMonth ? monthLabel(e.expenseMonth) : '—',
			e.type,
			e.amount.toFixed(2),
			e.description || '',
			e.date ? new Date(e.date).toLocaleDateString() : '',
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
		if (storeInfo.phone) { pdf.setFontSize(9); pdf.text('Phone: ' + storeInfo.phone, pageW / 2, y, { align: 'center' }); y += 5 }
		pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
		pdf.text('Expenses Report', pageW / 2, y + 2, { align: 'center' }); y += 7
		pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
		pdf.text('Generated: ' + new Date().toLocaleString(), pageW / 2, y, { align: 'center' }); y += 5
		pdf.line(margin, y, pageW - margin, y); y += 5

		const cols = [{ label: 'Month', w: 32 }, { label: 'Type', w: 24 }, { label: 'Amount', w: 28 }, { label: 'Description', w: 56 }, { label: 'Date', w: 24 }, { label: 'Expires', w: 16 }]
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
		allMonths.forEach(month => {
			const monthExps = grouped[month] || []
			if (!monthExps.length) return
			if (y > pageH - 20) { pdf.addPage(); y = margin; drawHeader(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5) }
			// Month separator row
			pdf.setFillColor(220, 230, 240); pdf.rect(startX, y, tableW, 6, 'F')
			pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8)
			pdf.text(monthLabel(month), startX + 1, y + 4)
			const mTotal = monthExps.reduce((s, e) => s + e.amount, 0)
			pdf.text(formatCurrency(mTotal, currency), startX + tableW - 1, y + 4, { align: 'right' })
			y += 6
			pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
			monthExps.forEach((exp, idx) => {
				if (y > pageH - 20) { pdf.addPage(); y = margin; drawHeader(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5) }
				total += exp.amount
				if (idx % 2 === 0) { pdf.setFillColor(252, 252, 252); pdf.rect(startX, y, tableW, 6, 'F') }
				const cells = ['', exp.type, formatCurrency(exp.amount, currency), exp.description || '—', exp.date ? new Date(exp.date).toLocaleDateString() : '—', exp.expiresThisMonth ? 'Yes' : 'No']
				let x = startX
				cols.forEach((col, ci) => { const text = pdf.splitTextToSize(cells[ci], col.w - 2)[0] || ''; pdf.text(text, x + 1, y + 4); x += col.w })
				y += 6
			})
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

	if (loading) return (
		<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#e8eef5' }}>
			Loading expenses...
		</div>
	)

	return (
		<div className="card">
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
				<h2 style={{ margin: 0 }}>Expenses</h2>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
					<input
						type="month"
						value={selectedMonth}
						onChange={e => setSelectedMonth(e.target.value)}
						style={{ minWidth: 160 }}
					/>
					<button onClick={addMonth}>+ Add Month</button>
					<button className="secondary" onClick={handleExcelExport}>Export Excel</button>
					<button className="secondary" onClick={handlePdfExport}>Export PDF</button>
				</div>
			</div>

			{/* Summary */}
			<div className="card" style={{ background: '#fff3cd', border: '1px solid #ffeaa7', marginBottom: 16 }}>
				<h3 style={{ color: '#856404', margin: '0 0 4px 0' }}>Total Expenses</h3>
				<p style={{ color: '#856404', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(totalExpenses, currency)}</p>
			</div>

			{/* Month groups */}
			{allMonths.length === 0 && (
				<div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>
					No months yet. Select a month and click "+ Add Month" to begin.
				</div>
			)}

			{allMonths.map(month => {
				const monthExpenses = grouped[month] || []
				const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0)
				const isExpanded = expandedMonth === month

				return (
					<div key={month} style={{ marginBottom: 10, border: '1px solid #243245', borderRadius: 8, overflow: 'hidden' }}>
						{/* Month row — clickable header */}
						<div
							onClick={() => setExpandedMonth(isExpanded ? null : month)}
							style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#0d1521', cursor: 'pointer', userSelect: 'none' }}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
								<span style={{ color: '#6b7280', fontSize: 12, fontFamily: 'monospace', width: 10 }}>{isExpanded ? '▼' : '▶'}</span>
								<span style={{ color: '#e8eef5', fontWeight: 700, fontSize: 15 }}>{monthLabel(month)}</span>
								<span style={{ color: '#6b7280', fontSize: 12 }}>{monthExpenses.length} item{monthExpenses.length !== 1 ? 's' : ''}</span>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
								<span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 15 }}>{formatCurrency(monthTotal, currency)}</span>
								<button
									onClick={e => { e.stopPropagation(); setExpandedMonth(month); setAddingToMonth(month); setSubForm(emptySubForm) }}
									style={{ fontSize: 12, padding: '4px 12px' }}
								>+ Add Expense</button>
							</div>
						</div>

						{/* Expanded: expense sub-rows + add form */}
						{isExpanded && (
							<div style={{ background: '#0b0f14' }}>
								{monthExpenses.length > 0 && (
									<table className="table" style={{ marginBottom: 0 }}>
										<thead>
											<tr>
												<th>Type</th>
												<th>Amount</th>
												<th>Description</th>
												<th>Date</th>
												<th></th>
											</tr>
										</thead>
										<tbody>
											{monthExpenses.map(exp => (
												<tr key={exp.id}>
													<td>
														{editingId === exp.id
															? <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>{EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}</select>
															: exp.type}
													</td>
													<td>
														{editingId === exp.id
															? <input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
															: formatCurrency(exp.amount, currency)}
													</td>
													<td>
														{editingId === exp.id
															? <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
															: exp.description || '—'}
													</td>
													<td>{new Date(exp.date).toLocaleDateString()}</td>
													<td style={{ display: 'flex', gap: 6 }}>
														{editingId === exp.id ? (
															<><button onClick={() => saveEdit(exp.id)}>Save</button><button className="secondary" onClick={() => setEditingId(null)}>Cancel</button></>
														) : (
															<><button onClick={() => startEdit(exp)}>Edit</button><button className="secondary" onClick={() => deleteExpense(exp.id)}>Delete</button></>
														)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								)}

								{/* Inline add form */}
								{addingToMonth === month ? (
									<div style={{ padding: '12px 16px', borderTop: monthExpenses.length > 0 ? '1px solid #1a2030' : 'none' }}>
										<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
											<select value={subForm.type} onChange={e => setSubForm({ ...subForm, type: e.target.value })} style={{ flex: '0 0 auto' }}>
												{EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
											</select>
											<input
												type="number"
												step="0.01"
												placeholder="Amount"
												value={subForm.amount}
												onChange={e => setSubForm({ ...subForm, amount: e.target.value })}
												style={{ flex: '0 0 130px' }}
											/>
											<input
												placeholder="Description (optional)"
												value={subForm.description}
												onChange={e => setSubForm({ ...subForm, description: e.target.value })}
												style={{ flex: 1, minWidth: 160 }}
											/>
											<button onClick={() => addSubExpense(month)}>Add</button>
											<button className="secondary" onClick={() => { setAddingToMonth(null); setSubForm(emptySubForm) }}>Cancel</button>
										</div>
									</div>
								) : null}
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}
