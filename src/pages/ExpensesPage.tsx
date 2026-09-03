import { useState, useEffect } from 'react'
import { db, Expense, StoreInfo } from '../storage'
import { loadCurrency, formatCurrency } from '../utils/currency'
import { exportExpensesToExcel } from '../utils/exportCSV'
import { StatCard } from '../ui/StatCard'
import jsPDF from 'jspdf'
import {
	PiCalendarBlankDuotone, PiWalletDuotone, PiReceiptDuotone, PiCalculatorDuotone,
	PiPlusDuotone, PiFileXlsDuotone, PiFilePdfDuotone, PiPencilDuotone, PiTrashDuotone,
	PiCaretDownDuotone, PiCaretRightDuotone, PiWarningCircleDuotone, PiWarningDuotone,
	PiCheckDuotone, PiXDuotone,
} from 'react-icons/pi'

// Standard operating-expense categories a small-business chart of accounts
// would recognize. "Salaries" was removed — payroll is tracked per-employee
// on the Employees page and rolled into the P&L as its own Payroll line, so
// letting it live here too invited double-counting the same cost twice.
// "Liabilities" was removed outright — a liability is a balance-sheet
// concept (money owed), not a P&L expense category, so it never belonged in
// this list.
const EXPENSE_TYPES = ['Rent', 'Utilities', 'Transport', 'Maintenance & Repairs', 'Marketing & Advertising', 'Insurance', 'Office Supplies', 'Professional Fees', 'Taxes & Licenses', 'Bank Charges', 'Other']

// Categories no longer offered for new entries, but that may still exist on
// older records — flagged so the owner can reclassify them rather than
// silently miscounting payroll or misreading a liability as an expense.
const RETIRED_TYPES = ['Salaries', 'Liabilities']

const fieldLabelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 } as const

const currentMonth = () => {
	const d = new Date()
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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
	const [formError, setFormError] = useState('')

	// Inline edit
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editForm, setEditForm] = useState(emptySubForm)
	const [editError, setEditError] = useState('')

	// Delete confirmation
	const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
	const [deleting, setDeleting] = useState(false)

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

	function removeMonth(month: string) {
		const updated = createdMonths.filter(m => m !== month)
		setCreatedMonths(updated)
		localStorage.setItem('expense_months', JSON.stringify(updated))
		if (expandedMonth === month) setExpandedMonth(null)
	}

	function parseAmount(raw: string): number | null {
		const n = Number(raw)
		if (!raw.trim() || !Number.isFinite(n) || n <= 0) return null
		return n
	}

	async function addSubExpense(month: string) {
		setFormError('')
		const amount = parseAmount(subForm.amount)
		if (amount == null) { setFormError('Enter an amount greater than zero.'); return }
		try {
			await db.createExpense({
				type: subForm.type,
				amount,
				description: subForm.description,
				expenseMonth: month,
			})
			setExpenses(await db.listExpenses())
			setSubForm(emptySubForm)
			setAddingToMonth(null)
		} catch (err: any) {
			console.error('Error adding expense:', err)
			setFormError('Could not save expense. Please try again.')
		}
	}

	function startEdit(exp: Expense) {
		setEditingId(exp.id)
		setEditError('')
		setEditForm({ type: exp.type, amount: String(exp.amount), description: exp.description || '' })
	}

	async function saveEdit(id: string) {
		setEditError('')
		const amount = parseAmount(editForm.amount)
		if (amount == null) { setEditError('Enter an amount greater than zero.'); return }
		try {
			await db.updateExpense(id, { type: editForm.type, amount, description: editForm.description })
			setExpenses(await db.listExpenses())
			setEditingId(null)
		} catch (err) {
			console.error('Error updating expense:', err)
			setEditError('Could not save changes. Please try again.')
		}
	}

	async function confirmDelete() {
		if (!deleteTarget) return
		setDeleting(true)
		try {
			await db.deleteExpense(deleteTarget.id)
			setExpenses(await db.listExpenses())
			setDeleteTarget(null)
		} catch (err) {
			console.error('Error deleting expense:', err)
			alert('Error deleting expense')
		} finally {
			setDeleting(false)
		}
	}

	// Merge created months with months that have expenses
	const expenseMonthSet = new Set(expenses.map(e => e.expenseMonth || 'other'))
	const allMonths = [...new Set([...createdMonths, ...expenseMonthSet])]
		.sort((a, b) => (a === 'other' ? 1 : b === 'other' ? -1 : a < b ? 1 : a > b ? -1 : 0))

	const grouped = expenses.reduce((acc, exp) => {
		const key = exp.expenseMonth || 'other'
		if (!acc[key]) acc[key] = []
		acc[key].push(exp)
		return acc
	}, {} as Record<string, Expense[]>)

	const thisMonthKey = currentMonth()
	const thisYearPrefix = thisMonthKey.slice(0, 4)
	const monthTotal = (expenses.filter(e => (e.expenseMonth || '') === thisMonthKey)).reduce((s, e) => s + e.amount, 0)
	const monthCount = expenses.filter(e => (e.expenseMonth || '') === thisMonthKey).length
	const yearTotal = expenses.filter(e => (e.expenseMonth || '').startsWith(thisYearPrefix)).reduce((s, e) => s + e.amount, 0)
	const allTimeTotal = expenses.reduce((s, e) => s + e.amount, 0)
	const activeMonths = new Set(expenses.map(e => e.expenseMonth).filter(Boolean)).size
	const monthlyAverage = activeMonths > 0 ? allTimeTotal / activeMonths : 0
	const retiredCount = expenses.filter(e => RETIRED_TYPES.includes(e.type)).length

	function handleExcelExport() {
		exportExpensesToExcel(expenses.map(e => ({
			month: e.expenseMonth ? monthLabel(e.expenseMonth) : '—',
			type: e.type,
			amount: e.amount,
			description: e.description || '',
			date: e.date ? new Date(e.date).toLocaleDateString() : '',
		})), 'expenses.xls')
	}

	function handlePdfExport() {
		// jsPDF's built-in font can't render non-ASCII currency glyphs (₹, etc.)
		// — fall back to the plain ISO code for anything but the safe $ symbol
		// so the report never silently drops the currency on every amount.
		const pdfSafeSymbol: Record<string, string> = { USD: '$', PKR: 'PKR', AED: 'AED', SAR: 'SAR' }
		const pdfCurrency = (amount: number) => {
			const symbol = pdfSafeSymbol[currency] ?? currency
			return symbol === '$' ? `$${amount.toFixed(2)}` : `${symbol} ${amount.toFixed(2)}`
		}

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

		const cols = [{ label: 'Month', w: 34 }, { label: 'Type', w: 34 }, { label: 'Amount', w: 30 }, { label: 'Description', w: 60 }, { label: 'Date', w: 24 }]
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
			pdf.text(pdfCurrency(mTotal), startX + tableW - 1, y + 4, { align: 'right' })
			y += 6
			pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
			monthExps.forEach((exp, idx) => {
				if (y > pageH - 20) { pdf.addPage(); y = margin; drawHeader(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5) }
				total += exp.amount
				if (idx % 2 === 0) { pdf.setFillColor(252, 252, 252); pdf.rect(startX, y, tableW, 6, 'F') }
				const cells = ['', exp.type, pdfCurrency(exp.amount), exp.description || '—', exp.date ? new Date(exp.date).toLocaleDateString() : '—']
				let x = startX
				cols.forEach((col, ci) => { const text = pdf.splitTextToSize(cells[ci], col.w - 2)[0] || ''; pdf.text(text, x + 1, y + 4); x += col.w })
				y += 6
			})
		})

		y += 3; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
		pdf.text(`Total: ${expenses.length} expenses`, margin, y)
		pdf.text(`Total Amount: ${pdfCurrency(total)}`, pageW - margin, y, { align: 'right' })
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
			<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: 'var(--text)' }}>
				Loading expenses...
			</div>
		)
	}

	return (
		<div>
			{/* ── Header ── */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
				<div>
					<h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Expenses</h1>
					<p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>{expenses.length} expense entr{expenses.length === 1 ? 'y' : 'ies'} across {activeMonths} month{activeMonths === 1 ? '' : 's'}</p>
				</div>
				<div style={{ display: 'flex', gap: 8 }}>
					<button className="secondary" onClick={handleExcelExport} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
						<span style={{ display: 'flex', color: 'var(--success)' }}><PiFileXlsDuotone size={15} /></span> Excel
					</button>
					<button className="secondary" onClick={handlePdfExport} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
						<span style={{ display: 'flex', color: 'var(--danger)' }}><PiFilePdfDuotone size={15} /></span> PDF
					</button>
				</div>
			</div>

			{/* ── Summary cards ── */}
			<div className="dashboard-stats">
				<StatCard icon={<PiWalletDuotone />} tint="warning" label="This month" value={formatCurrency(monthTotal, currency)} caption={`${monthCount} entr${monthCount === 1 ? 'y' : 'ies'} · ${monthLabel(thisMonthKey)}`} />
				<StatCard icon={<PiReceiptDuotone />} tint="accent" label="This year" value={formatCurrency(yearTotal, currency)} caption="Year to date" />
				<StatCard icon={<PiCalculatorDuotone />} tint="neutral" label="Monthly average" value={formatCurrency(monthlyAverage, currency)} caption={activeMonths > 0 ? `Across ${activeMonths} active month${activeMonths === 1 ? '' : 's'}` : 'No data yet'} />
				<StatCard icon={<PiWalletDuotone />} tint="neutral" label="All-time total" value={formatCurrency(allTimeTotal, currency)} caption={`${expenses.length} total entries`} />
			</div>

			{retiredCount > 0 && (
				<div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
					<PiWarningCircleDuotone size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
					<div style={{ fontSize: 13, color: 'var(--warning)' }}>
						{retiredCount} expense{retiredCount === 1 ? ' is' : 's are'} tagged "Salaries" or "Liabilities" — Salaries are now tracked per-employee on the Payroll report to avoid double-counting, and Liabilities belong on a balance sheet, not here. Consider re-editing {retiredCount === 1 ? 'it' : 'them'} into one of the current categories.
					</div>
				</div>
			)}

			{/* ── Add month ── */}
			<div className="card">
				<h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>Add Month</h3>
				<div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
					<div>
						<label style={fieldLabelStyle}>Month</label>
						<div style={{ position: 'relative' }}>
							<PiCalendarBlankDuotone style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 15, pointerEvents: 'none' }} />
							<input
								type="month"
								value={selectedMonth}
								onChange={e => setSelectedMonth(e.target.value)}
								style={{ minWidth: 180, paddingLeft: 32 }}
							/>
						</div>
					</div>
					<button onClick={addMonth} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<PiPlusDuotone size={15} /> Add Month
					</button>
				</div>
			</div>

			{/* ── Month groups ── */}
			{allMonths.length === 0 && (
				<div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>
					No months yet. Select a month above and click "Add Month" to begin.
				</div>
			)}

			{allMonths.map(month => {
				const monthExpenses = grouped[month] || []
				const mTotal = monthExpenses.reduce((s, e) => s + e.amount, 0)
				const isExpanded = expandedMonth === month
				const isEmptyCreatedMonth = monthExpenses.length === 0 && createdMonths.includes(month)

				return (
					<div key={month} className="card" style={{ padding: 0, overflow: 'hidden' }}>
						{/* Month row — clickable header */}
						<div
							onClick={() => setExpandedMonth(isExpanded ? null : month)}
							style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-sunken)', cursor: 'pointer', userSelect: 'none' }}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
								<span style={{ display: 'flex', color: 'var(--text-muted)' }}>{isExpanded ? <PiCaretDownDuotone size={14} /> : <PiCaretRightDuotone size={14} />}</span>
								<span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14.5 }}>{monthLabel(month)}</span>
								<span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{monthExpenses.length} item{monthExpenses.length !== 1 ? 's' : ''}</span>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
								<span style={{ color: 'var(--warning)', fontWeight: 700, fontSize: 14.5 }}>{formatCurrency(mTotal, currency)}</span>
								<button
									onClick={e => { e.stopPropagation(); setExpandedMonth(month); setAddingToMonth(month); setSubForm(emptySubForm); setFormError('') }}
									style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
								><PiPlusDuotone size={13} /> Add Expense</button>
								{isEmptyCreatedMonth && (
									<button
										className="secondary"
										onClick={e => { e.stopPropagation(); removeMonth(month) }}
										style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, color: 'var(--danger)' }}
									><PiTrashDuotone size={13} /> Remove</button>
								)}
							</div>
						</div>

						{/* Expanded: expense sub-rows + add form */}
						{isExpanded && (
							<div style={{ background: 'var(--bg)' }}>
								{monthExpenses.length > 0 && (
									<div style={{ overflowX: 'auto' }}>
										<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
											<thead>
												<tr style={{ background: 'var(--bg-sunken)' }}>
													{['Type', 'Amount', 'Description', 'Date'].map(h => (
														<th key={h} style={{ padding: '10px 16px', textAlign: h === 'Amount' ? 'right' : 'left', borderBottom: '2px solid var(--border-strong)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
													))}
													<th style={{ padding: '10px 16px', width: 90 }}></th>
												</tr>
											</thead>
											<tbody>
												{monthExpenses.map(exp => (
													<tr key={exp.id} style={{ borderBottom: '1px solid var(--border)' }}>
														<td style={{ padding: '10px 16px' }}>
															{editingId === exp.id
																? <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
																		{[...EXPENSE_TYPES, ...(RETIRED_TYPES.includes(exp.type) ? [exp.type] : [])].map(t => <option key={t}>{t}</option>)}
																	</select>
																: (RETIRED_TYPES.includes(exp.type)
																	? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--warning)' }}><PiWarningCircleDuotone size={13} /> {exp.type}</span>
																	: exp.type)}
														</td>
														<td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>
															{editingId === exp.id
																? <input type="number" step="0.01" min="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} style={{ textAlign: 'right', width: 110 }} />
																: formatCurrency(exp.amount, currency)}
														</td>
														<td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
															{editingId === exp.id
																? <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
																: (exp.description || '—')}
														</td>
														<td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{exp.date ? new Date(exp.date).toLocaleDateString() : 'N/A'}</td>
														<td style={{ padding: '10px 16px' }}>
															<div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
																{editingId === exp.id ? (
																	<>
																		<button onClick={() => saveEdit(exp.id)} style={{ display: 'flex', padding: 6 }} title="Save"><PiCheckDuotone size={13} /></button>
																		<button className="secondary" onClick={() => { setEditingId(null); setEditError('') }} style={{ display: 'flex', padding: 6 }} title="Cancel"><PiXDuotone size={13} /></button>
																	</>
																) : (
																	<>
																		<button className="secondary" onClick={() => startEdit(exp)} style={{ display: 'flex', padding: 6 }} title="Edit"><PiPencilDuotone size={13} /></button>
																		<button className="secondary" onClick={() => setDeleteTarget(exp)} style={{ display: 'flex', padding: 6, color: 'var(--danger)' }} title="Delete"><PiTrashDuotone size={13} /></button>
																	</>
																)}
															</div>
														</td>
													</tr>
												))}
												{editError && editingId && (
													<tr><td colSpan={5} style={{ padding: '8px 16px', color: 'var(--danger)', fontSize: 12.5 }}>{editError}</td></tr>
												)}
											</tbody>
										</table>
									</div>
								)}

								{/* Inline add form */}
								{addingToMonth === month ? (
									<div style={{ padding: '14px 16px', borderTop: monthExpenses.length > 0 ? '1px solid var(--border)' : 'none' }}>
										<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
											<select value={subForm.type} onChange={e => setSubForm({ ...subForm, type: e.target.value })} style={{ flex: '0 0 auto' }}>
												{EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
											</select>
											<input
												type="number"
												step="0.01"
												min="0.01"
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
											<button onClick={() => addSubExpense(month)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PiPlusDuotone size={14} /> Add</button>
											<button className="secondary" onClick={() => { setAddingToMonth(null); setSubForm(emptySubForm); setFormError('') }}>Cancel</button>
										</div>
										{formError && (
											<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: 'var(--danger)', fontSize: 13 }}>
												<PiWarningCircleDuotone size={15} /> {formError}
											</div>
										)}
									</div>
								) : null}
							</div>
						)}
					</div>
				)
			})}

			{/* ── Delete confirmation ── */}
			{deleteTarget && (
				<div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
					onClick={() => !deleting && setDeleteTarget(null)}
				>
					<div className="card" style={{ maxWidth: 380, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
							<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', flexShrink: 0 }}>
								<PiWarningDuotone size={17} />
							</span>
							<h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Delete this expense?</h3>
						</div>
						<p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
							{deleteTarget.type} — {formatCurrency(deleteTarget.amount, currency)}{deleteTarget.description ? ` (${deleteTarget.description})` : ''}. This can't be undone.
						</p>
						<div className="form-actions">
							<button className="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
							<button onClick={confirmDelete} disabled={deleting} style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
								<PiTrashDuotone size={15} /> {deleting ? 'Deleting…' : 'Delete Expense'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
