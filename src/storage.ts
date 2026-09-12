import { auth } from './firebase';
import { supabase } from './supabase';
import * as supabaseStorage from './supabaseStorage';
import { getCachedStoreId } from './auth/BranchContext';

export type Item = {
	id: string
	sku: string
	name: string
	price: number
	costPrice?: number
	createdAt?: string
}

export type Purchase = {
	id: string
	itemId: string
	qty?: number
	quantity?: number
	costPrice?: number
	supplier?: string
	supplierPhone?: string
	supplierAddress?: string
	note?: string
	purchasedAt?: string
	createdAt?: string
	date?: string
	paymentType?: 'debit' | 'credit'
	creditDeadline?: string
	isPaid?: boolean
	branchId?: string | null
}

export type Sale = {
	id: string
	invoiceNo?: string
	customer?: string
	createdAt?: string
	date?: string
	itemId?: string
	quantity?: number
	actualPrice?: number
	originalPrice?: number
	itemDiscount?: number
	billDiscount?: number
	customerName?: string
	customerPhone?: string
	paymentType?: 'debit' | 'credit'
	creditDeadline?: string
	isPaid?: boolean
	creditAmount?: number
	paidAmount?: number
	branchId?: string | null
	storeInfo?: {
		storeName: string
		phone: string
		address: string
		email?: string
		website?: string
		taxNumber?: string
		logo?: string
	}
}

export type StoreInfo = {
	storeName: string
	phone: string
	address: string
	email?: string
	website?: string
	taxNumber?: string
	logo?: string
	currency?: string
	headerLayout?: string
}

export type Expense = {
	id: string
	type: string
	amount: number
	description?: string
	date: string
	expiresThisMonth?: boolean
	expenseMonth?: string
	createdAt?: string
	branchId?: string | null
}

export type Employee = {
	id: string
	name: string
	salary: number
	firstMonthPay: number
	phone: string
	address: string
	email?: string
	position?: string
	joinDate: string
	createdAt?: string
}

export type Invoice = {
	id: string
	invoiceNo: string
	customer: string
	phone?: string
	customerAddress?: string
	lines: any[]
	total: number
	billDiscount: number
	createdAt: string
	date: string
	branchId?: string | null
	storeInfo?: {
		storeName: string
		phone: string
		address: string
		email?: string
		website?: string
		taxNumber?: string
		logo?: string
	}
}

export type Supplier = {
	id: string
	supplierId: string
	name: string
	phone: string
	address: string
	createdAt?: string
}

export type Asset = {
	id: string
	name: string
	category: string
	purchaseDate: string
	purchasePrice: number
	description?: string
	createdAt?: string
	branchId?: string | null
}

export type Branch = {
	id: string
	name: string
	address?: string
	phone?: string
	isActive: boolean
	createdAt?: string
}

export type StockTransferStatus = 'pending' | 'approved' | 'rejected' | 'received'

export type StockTransfer = {
	id: string
	itemId: string
	quantity: number
	fromBranchId: string
	toBranchId: string
	status: StockTransferStatus
	requestedBy: string
	requestedByName?: string
	approvedBy?: string
	approvedAt?: string
	receivedAt?: string
	rejectedReason?: string
	notes?: string
	createdAt: string
}

function getUserId(): string {
	if (!auth.currentUser) {
		console.warn('No authenticated user found. Please log in.');
		throw new Error('User not authenticated');
	}
	// For a store owner this is just their own uid. For a staff account it's
	// the owner's uid instead, resolved by BranchProvider from staff_members
	// — every table's user_id column already means "which store", so this is
	// the one place that needed to change for the rest of the app (all
	// ~15 pages funnel through here) to become branch/staff-aware.
	return getCachedStoreId() || auth.currentUser.uid;
}

export const db = {
	async listItems(): Promise<Item[]> {
		try {
			const userId = getUserId();
			const itemsData = await supabaseStorage.listItems(userId);
			return itemsData.map(item => ({
				id: item.id,
				sku: item.sku,
				name: item.name,
				price: item.price,
				costPrice: item.cost_price || 0,
				createdAt: item.created_at
			}));
		} catch (error) {
			console.error('Error listing items:', error);
			if (error instanceof Error && error.message === 'User not authenticated') {
				throw error;
			}
			return [];
		}
	},
	async getItemBySku(sku: string): Promise<Item | undefined> {
		const items = await this.listItems();
		return items.find(i => i.sku === sku);
	},
	async createItem(data: Omit<Item, 'id'>): Promise<Item> {
		const userId = getUserId();
		const mappedData: any = { ...data, created_at: new Date().toISOString() };
		if (data.costPrice !== undefined) {
			mappedData.cost_price = data.costPrice;
			delete mappedData.costPrice;
		}
		const id = await supabaseStorage.addItem(userId, mappedData);
		return { id, ...data, createdAt: mappedData.created_at };
	},
	async updateItem(id: string, data: Partial<Omit<Item, 'id'>>): Promise<void> {
		const mappedData: any = { ...data };
		if (data.costPrice !== undefined) {
			mappedData.cost_price = data.costPrice;
			delete mappedData.costPrice;
		}
		await supabaseStorage.updateItem(id, mappedData);
	},
	async deleteItem(id: string): Promise<void> {
		const userId = getUserId();
		await supabaseStorage.deleteItem(userId, id);
	},

	async listPurchases(): Promise<Purchase[]> {
		try {
			const userId = getUserId();
			const purchasesData = await supabaseStorage.listPurchases(userId);
			return purchasesData.map(purchase => ({
				id: purchase.id,
				itemId: purchase.item_id,
				quantity: purchase.quantity,
				qty: purchase.quantity,
				date: purchase.date,
				costPrice: purchase.cost_price,
				supplier: purchase.supplier,
				supplierPhone: purchase.supplier_phone,
				note: purchase.note,
				paymentType: (purchase.payment_type || 'debit') as 'debit' | 'credit',
				creditDeadline: purchase.credit_deadline,
				isPaid: purchase.is_paid || false,
				supplierAddress: (purchase as any).supplier_address,
				branchId: (purchase as any).branch_id ?? null,
			}));
		} catch (error) {
			console.error('Error listing purchases:', error);
			if (error instanceof Error && error.message === 'User not authenticated') {
				throw error;
			}
			return [];
		}
	},
	async createPurchase(data: { itemId: string, qty: number, costPrice?: number, supplier?: string, supplierPhone?: string, note?: string, purchasedAt?: string, date?: string, paymentType?: 'debit' | 'credit', creditDeadline?: string, branchId?: string | null }): Promise<Purchase> {
		const userId = getUserId();
		const purchase: any = {
			item_id: data.itemId,
			quantity: data.qty,
			date: data.date || data.purchasedAt || new Date().toISOString(),
			cost_price: data.costPrice,
			supplier: data.supplier,
			supplier_phone: data.supplierPhone,
			note: data.note,
			payment_type: data.paymentType || 'debit',
			credit_deadline: data.paymentType === 'credit' ? (data.creditDeadline || null) : null,
			branch_id: data.branchId ?? null,
		};

		const id = await supabaseStorage.addPurchase(userId, purchase);

		// Keep item's cost_price in sync with the latest purchase cost
		if (data.costPrice != null && data.costPrice > 0) {
			await supabaseStorage.updateItem(data.itemId, { cost_price: data.costPrice });
		}

		return {
			id,
			itemId: data.itemId,
			qty: data.qty,
			quantity: data.qty,
			costPrice: data.costPrice,
			supplier: data.supplier,
			supplierPhone: data.supplierPhone,
			note: data.note,
			date: purchase.date,
			paymentType: data.paymentType || 'debit',
			creditDeadline: data.creditDeadline,
			branchId: data.branchId ?? null,
		};
	},
	async updatePurchase(id: string, data: Partial<Omit<Purchase, 'id'>>): Promise<void> {
		const mapped: any = { ...data }
		if ('isPaid' in mapped) { mapped.is_paid = mapped.isPaid; delete mapped.isPaid }
		if ('branchId' in mapped) { mapped.branch_id = mapped.branchId; delete mapped.branchId }
		if ('itemId' in mapped) { mapped.item_id = mapped.itemId; delete mapped.itemId }
		if ('costPrice' in mapped) { mapped.cost_price = mapped.costPrice; delete mapped.costPrice }
		if ('supplierPhone' in mapped) { mapped.supplier_phone = mapped.supplierPhone; delete mapped.supplierPhone }
		if ('paymentType' in mapped) { mapped.payment_type = mapped.paymentType; delete mapped.paymentType }
		if ('creditDeadline' in mapped) { mapped.credit_deadline = mapped.creditDeadline; delete mapped.creditDeadline }
		await supabaseStorage.updatePurchase(id, mapped);
	},
	async deletePurchase(id: string): Promise<void> {
		await supabaseStorage.deletePurchase(id);
	},
	async addImeis(imeis: { purchaseId: string; itemId: string; imei1: string; imei2?: string; warrantyTill?: string }[]): Promise<void> {
		const userId = getUserId()
		await supabaseStorage.addImeis(userId, imeis.map(i => {
			const rec: any = { purchase_id: i.purchaseId, item_id: i.itemId, imei1: i.imei1, imei2: i.imei2 || '' }
			if (i.warrantyTill) rec.warranty_till = i.warrantyTill
			return rec
		}))
	},
	async listImeisByPurchase(purchaseId: string): Promise<any[]> {
		const userId = getUserId()
		return supabaseStorage.listImeisByPurchase(userId, purchaseId)
	},
	async listImeisByItem(itemId: string): Promise<any[]> {
		const userId = getUserId()
		return supabaseStorage.listImeisByItem(userId, itemId)
	},
	async markImeiSold(imei: string, warrantyTill?: string): Promise<void> {
		const userId = getUserId()
		await supabaseStorage.markImeiSold(userId, imei, warrantyTill)
	},

	async listSales(): Promise<Sale[]> {
		try {
			const userId = getUserId();
			const salesData = await supabaseStorage.listSales(userId);
			return salesData.map(sale => ({
				id: sale.id,
				itemId: sale.item_id,
				quantity: sale.quantity,
				date: sale.date,
				actualPrice: sale.actual_price,
				originalPrice: sale.original_price,
				itemDiscount: sale.item_discount,
				billDiscount: sale.bill_discount,
				customerName: sale.customer_name,
				customerPhone: sale.customer_phone,
				invoiceNo: sale.invoice_no,
				paymentType: (sale.payment_type || 'debit') as 'debit' | 'credit',
				creditDeadline: sale.credit_deadline,
				isPaid: sale.is_paid || false,
				creditAmount: sale.credit_amount ?? undefined,
			paidAmount: (sale as any).paid_amount ?? 0,
			branchId: (sale as any).branch_id ?? null,
			}));
		} catch (error) {
			console.error('Error listing sales:', error);
			if (error instanceof Error && error.message === 'User not authenticated') {
				throw error;
			}
			return [];
		}
	},
	async listSalesByDateRange(startDate: string, endDate: string): Promise<Sale[]> {
		try {
			const userId = getUserId();
			const salesData = await supabaseStorage.listSalesByDateRange(userId, startDate, endDate);
			return salesData.map(sale => ({
				id: sale.id,
				itemId: sale.item_id,
				quantity: sale.quantity,
				date: sale.date,
				actualPrice: sale.actual_price,
				originalPrice: sale.original_price,
				itemDiscount: sale.item_discount,
				billDiscount: sale.bill_discount,
				customerName: sale.customer_name,
				customerPhone: sale.customer_phone,
				invoiceNo: sale.invoice_no,
				paymentType: (sale.payment_type || 'debit') as 'debit' | 'credit',
				creditDeadline: sale.credit_deadline,
				isPaid: sale.is_paid || false,
			}));
		} catch (error) {
			console.error('Error listing sales by date range:', error);
			if (error instanceof Error && error.message === 'User not authenticated') {
				throw error;
			}
			return [];
		}
	},
	async listSalesByDate(date: string): Promise<Sale[]> {
		try {
			const userId = getUserId();
			const salesData = await supabaseStorage.listSalesByDate(userId, date);
			return salesData.map(sale => ({
				id: sale.id,
				itemId: sale.item_id,
				quantity: sale.quantity,
				date: sale.date,
				actualPrice: sale.actual_price,
				originalPrice: sale.original_price,
				itemDiscount: sale.item_discount,
				billDiscount: sale.bill_discount,
				customerName: sale.customer_name,
				customerPhone: sale.customer_phone,
				invoiceNo: sale.invoice_no,
				paymentType: (sale.payment_type || 'debit') as 'debit' | 'credit',
				creditDeadline: sale.credit_deadline,
				isPaid: sale.is_paid || false,
			}));
		} catch (error) {
			console.error('Error listing sales by date:', error);
			if (error instanceof Error && error.message === 'User not authenticated') {
				throw error;
			}
			return [];
		}
	},
	async createSale(data: { itemId: string, quantity: number, date?: string, actualPrice?: number, originalPrice?: number, itemDiscount?: number, billDiscount?: number, customerName?: string, customerPhone?: string, invoiceNo?: string, paymentType?: 'debit' | 'credit', creditDeadline?: string, paidAmount?: number, branchId?: string | null }): Promise<Sale> {
		const userId = getUserId();
		const storeInfo = await this.getStoreInfo();
		const sale: any = {
			item_id: data.itemId,
			quantity: data.quantity,
			date: data.date || new Date().toISOString(),
			actual_price: data.actualPrice,
			original_price: data.originalPrice,
			item_discount: data.itemDiscount,
			bill_discount: data.billDiscount,
			customer_name: data.customerName,
			customer_phone: data.customerPhone,
			invoice_no: data.invoiceNo,
			payment_type: data.paymentType || 'debit',
			credit_deadline: data.paymentType === 'credit' ? (data.creditDeadline || null) : null,
			paid_amount: data.paidAmount || 0,
			is_paid: false,
			branch_id: data.branchId ?? null,
		};
		const id = await supabaseStorage.addSale(userId, sale);
		return { id, itemId: data.itemId, quantity: data.quantity, date: sale.date, actualPrice: data.actualPrice, originalPrice: data.originalPrice, itemDiscount: data.itemDiscount, billDiscount: data.billDiscount, customerName: data.customerName, customerPhone: data.customerPhone, invoiceNo: data.invoiceNo, paymentType: data.paymentType || 'debit', creditDeadline: data.creditDeadline, paidAmount: data.paidAmount || 0, isPaid: false, branchId: data.branchId ?? null, storeInfo };
	},
	async updateSale(id: string, data: Partial<Omit<Sale, 'id'>>): Promise<void> {
		const mapped: any = {}
		if ('isPaid' in data) mapped.is_paid = data.isPaid
		if ('paymentType' in data) mapped.payment_type = data.paymentType
		if ('creditDeadline' in data) mapped.credit_deadline = data.creditDeadline
		if ('creditAmount' in data) mapped.credit_amount = data.creditAmount
		if ('paidAmount' in data) mapped.paid_amount = data.paidAmount
		if ('branchId' in data) mapped.branch_id = (data as any).branchId
		await supabaseStorage.updateSale(id, mapped)
	},
	async deleteSale(id: string): Promise<void> {
		await supabaseStorage.deleteSale(id);
	},

	async inventory(branchId?: string | null, mainBranchId?: string | null): Promise<Array<{ itemId: string, itemName: string, itemSku: string, stock: number }>> {
		try {
			const userId = getUserId();
			return await supabaseStorage.getInventory(userId, branchId, mainBranchId);
		} catch (error) {
			console.error('Error getting inventory:', error);
			return [];
		}
	},

	async getStoreInfo(): Promise<StoreInfo> {
		try {
			const userId = getUserId();
			const info = await supabaseStorage.getStoreInfo(userId);
			return {
				storeName: info.store_name,
				phone: info.phone,
				address: info.address,
				email: info.email,
				website: info.website,
				taxNumber: info.tax_number,
				logo: info.logo,
				currency: info.currency || 'PKR',
				headerLayout: info.header_layout || undefined,
			};
		} catch (error) {
			console.error('Error getting store info:', error);
			return {
				storeName: 'Managify',
				phone: '',
				address: '',
				email: '',
				website: '',
				taxNumber: '',
				logo: '',
				currency: 'PKR'
			};
		}
	},
	async updateStoreInfo(data: Partial<StoreInfo>): Promise<StoreInfo> {
		const userId = getUserId();
		const mappedData: any = {
			store_name: data.storeName || 'Managify',
			phone: data.phone || '',
			address: data.address || '',
			email: data.email || '',
			website: data.website || '',
			tax_number: data.taxNumber || '',
			logo: data.logo || '',
			currency: data.currency || 'PKR'
		};
		if (data.headerLayout !== undefined) mappedData.header_layout = data.headerLayout
		await supabaseStorage.updateStoreInfo(userId, mappedData);
		return await this.getStoreInfo();
	},

	async updateHeaderLayout(layoutJson: string): Promise<void> {
		const userId = getUserId();
		await supabaseStorage.updateHeaderLayout(userId, layoutJson);
		localStorage.setItem('invoiceHeaderLayout', layoutJson);
	},

	async listExpenses(): Promise<Expense[]> {
		try {
			const userId = getUserId();
			const data = await supabaseStorage.listExpenses(userId);
			return data.map(e => ({
				id: e.id,
				type: e.type,
				amount: e.amount,
				description: e.description,
				date: e.date,
				expiresThisMonth: e.expires_this_month ?? false,
				expenseMonth: e.expense_month,
				branchId: (e as any).branch_id ?? null,
			}));
		} catch (error) {
			console.error('Error listing expenses:', error);
			return [];
		}
	},
	async createExpense(data: { type: string, amount: number, description?: string, date?: string, expiresThisMonth?: boolean, expenseMonth?: string, branchId?: string | null }): Promise<Expense> {
		const userId = getUserId();
		const expense = {
			type: data.type,
			amount: data.amount,
			description: data.description,
			date: data.date || new Date().toISOString(),
			expires_this_month: data.expiresThisMonth ?? false,
			expense_month: data.expenseMonth || new Date().toISOString().slice(0, 7),
			branch_id: data.branchId ?? null,
		};
		const id = await supabaseStorage.addExpense(userId, expense);
		return { id, type: expense.type, amount: expense.amount, description: expense.description, date: expense.date, expiresThisMonth: data.expiresThisMonth, expenseMonth: expense.expense_month, branchId: data.branchId ?? null };
	},
	async updateExpense(id: string, data: Partial<Omit<Expense, 'id'>>): Promise<void> {
		const mapped: any = { ...data }
		if ('expiresThisMonth' in data) {
			mapped.expires_this_month = data.expiresThisMonth
			delete mapped.expiresThisMonth
		}
		if ('expenseMonth' in data) {
			mapped.expense_month = data.expenseMonth
			delete mapped.expenseMonth
		}
		if ('branchId' in data) {
			mapped.branch_id = (data as any).branchId
			delete mapped.branchId
		}
		await supabaseStorage.updateExpense(id, mapped);
	},
	async deleteExpense(id: string): Promise<void> {
		await supabaseStorage.deleteExpense(id);
	},

	async listEmployees(): Promise<Employee[]> {
		try {
			const userId = getUserId();
			return await supabaseStorage.listEmployees(userId);
		} catch (error) {
			console.error('Error listing employees:', error);
			return [];
		}
	},
	async createEmployee(data: { name: string, salary: number, firstMonthPay: number, phone: string, address: string, email?: string, position?: string, joinDate?: string }): Promise<Employee> {
		const userId = getUserId();
		const employee = {
			name: data.name,
			salary: data.salary,
			first_month_pay: data.firstMonthPay,
			phone: data.phone,
			address: data.address,
			email: data.email,
			position: data.position,
			join_date: data.joinDate || new Date().toISOString().slice(0, 10)
		};
		const id = await supabaseStorage.addEmployee(userId, employee);
		return { id, name: data.name, salary: data.salary, firstMonthPay: data.firstMonthPay, phone: data.phone, address: data.address, email: data.email, position: data.position, joinDate: employee.join_date };
	},
	async updateEmployee(id: string, data: Partial<Omit<Employee, 'id'>>): Promise<void> {
		await supabaseStorage.updateEmployee(id, data);
	},
	async deleteEmployee(id: string): Promise<void> {
		await supabaseStorage.deleteEmployee(id);
	},

	async createInvoice(data: { invoiceNo: string, customer: string, phone?: string, customerAddress?: string, lines: any[], total: number, billDiscount: number, date?: string, branchId?: string | null }): Promise<Invoice> {
		const userId = getUserId();
		const storeInfo = await this.getStoreInfo();
		const dateStr = data.date || new Date().toISOString();
		const invoice = {
			invoice_no: data.invoiceNo,
			customer: data.customer,
			phone: data.phone,
			customer_address: data.customerAddress || null,
			lines: data.lines,
			total: data.total,
			bill_discount: data.billDiscount,
			date: dateStr,
			created_at: dateStr,
			branch_id: data.branchId ?? null,
		};
		const id = await supabaseStorage.addInvoice(userId, invoice);
		return { id, invoiceNo: data.invoiceNo, customer: data.customer, phone: data.phone, customerAddress: data.customerAddress, lines: data.lines, total: data.total, billDiscount: data.billDiscount, date: dateStr, createdAt: new Date(dateStr).toLocaleString(), branchId: data.branchId ?? null, storeInfo };
	},
	async listInvoices(): Promise<Invoice[]> {
		try {
			const userId = getUserId();
			const raw = await supabaseStorage.listInvoices(userId);
			return raw.map((r: any) => ({
				id: r.id,
				invoiceNo: r.invoice_no ?? r.invoiceNo ?? '',
				customer: r.customer ?? '',
				phone: r.phone,
				customerAddress: r.customer_address ?? r.customerAddress,
				lines: r.lines ?? [],
				total: r.total ?? 0,
				billDiscount: r.bill_discount ?? r.billDiscount ?? 0,
				date: r.date ?? r.created_at ?? '',
				createdAt: r.created_at ? new Date(r.created_at).toLocaleString() : '',
				branchId: r.branch_id ?? null,
				storeInfo: r.storeInfo,
			}));
		} catch (error) {
			console.error('Error listing invoices:', error);
			return [];
		}
	},

	async listSuppliers(): Promise<Supplier[]> {
		try {
			const userId = getUserId();
			return await supabaseStorage.listSuppliers(userId);
		} catch (error) {
			console.error('Error listing suppliers:', error);
			return [];
		}
	},
	async createSupplier(data: { name: string, phone: string, address: string }): Promise<Supplier> {
		const userId = getUserId();
		const supplier = {
			supplier_id: Math.floor(1000 + Math.random() * 9000).toString(),
			name: data.name,
			phone: data.phone,
			address: data.address,
			created_at: new Date().toISOString()
		};
		const id = await supabaseStorage.addSupplier(userId, supplier);
		return { id, supplierId: supplier.supplier_id, name: data.name, phone: data.phone, address: data.address, createdAt: supplier.created_at };
	},
	async updateSupplier(id: string, data: Partial<Omit<Supplier, 'id'>>): Promise<void> {
		await supabaseStorage.updateSupplier(id, data);
	},
	async deleteSupplier(id: string): Promise<void> {
		await supabaseStorage.deleteSupplier(id);
	},

	async listAssets(): Promise<Asset[]> {
		try {
			const userId = getUserId()
			const data = await supabaseStorage.listAssets(userId)
			return data.map(a => ({
				id: a.id,
				name: a.name,
				category: a.category,
				purchaseDate: a.purchase_date,
				purchasePrice: a.purchase_price,
				description: a.description,
				createdAt: a.created_at,
				branchId: (a as any).branch_id ?? null,
			}))
		} catch (error) {
			console.error('Error listing assets:', error)
			return []
		}
	},
	async createAsset(data: { name: string; category: string; purchaseDate: string; purchasePrice: number; description?: string; branchId?: string | null }): Promise<Asset> {
		const userId = getUserId()
		const id = await supabaseStorage.addAsset(userId, {
			name: data.name,
			category: data.category,
			purchase_date: data.purchaseDate,
			purchase_price: data.purchasePrice,
			description: data.description,
			branch_id: data.branchId ?? null,
		})
		return { id, ...data }
	},
	async updateAsset(id: string, data: Partial<Omit<Asset, 'id'>>): Promise<void> {
		const mapped: any = {}
		if (data.name !== undefined) mapped.name = data.name
		if (data.category !== undefined) mapped.category = data.category
		if (data.branchId !== undefined) mapped.branch_id = data.branchId
		if (data.purchaseDate !== undefined) mapped.purchase_date = data.purchaseDate
		if (data.purchasePrice !== undefined) mapped.purchase_price = data.purchasePrice
		if (data.description !== undefined) mapped.description = data.description
		await supabaseStorage.updateAsset(id, mapped)
	},
	async deleteAsset(id: string): Promise<void> {
		await supabaseStorage.deleteAsset(id)
	},

	async listBranches(): Promise<Branch[]> {
		try {
			const userId = getUserId();
			const rows = await supabaseStorage.listBranches(userId);
			return rows.map(b => ({ id: b.id, name: b.name, address: b.address, phone: b.phone, isActive: b.is_active, createdAt: b.created_at }));
		} catch (error) {
			console.error('Error listing branches:', error);
			return [];
		}
	},
	async createBranch(data: { name: string; address?: string; phone?: string }): Promise<Branch> {
		const userId = getUserId();
		const id = await supabaseStorage.addBranch(userId, { name: data.name, address: data.address, phone: data.phone });
		return { id, name: data.name, address: data.address, phone: data.phone, isActive: true };
	},
	async updateBranch(id: string, data: Partial<Omit<Branch, 'id'>>): Promise<void> {
		const mapped: any = {};
		if (data.name !== undefined) mapped.name = data.name;
		if (data.address !== undefined) mapped.address = data.address;
		if (data.phone !== undefined) mapped.phone = data.phone;
		if (data.isActive !== undefined) mapped.is_active = data.isActive;
		await supabaseStorage.updateBranch(id, mapped);
	},
	async deleteBranch(id: string): Promise<void> {
		await supabaseStorage.deleteBranch(id);
	},

	async listStockTransfers(): Promise<StockTransfer[]> {
		try {
			const userId = getUserId();
			const rows = await supabaseStorage.listStockTransfers(userId);
			return rows.map(r => ({
				id: r.id, itemId: r.item_id, quantity: r.quantity,
				fromBranchId: r.from_branch_id, toBranchId: r.to_branch_id, status: r.status,
				requestedBy: r.requested_by, requestedByName: r.requested_by_name,
				approvedBy: r.approved_by, approvedAt: r.approved_at, receivedAt: r.received_at,
				rejectedReason: r.rejected_reason, notes: r.notes, createdAt: r.created_at,
			}));
		} catch (error) {
			console.error('Error listing stock transfers:', error);
			return [];
		}
	},
	async createStockTransfer(data: { itemId: string; quantity: number; fromBranchId: string; toBranchId: string; notes?: string }): Promise<void> {
		if (!auth.currentUser) throw new Error('User not authenticated');
		const userId = getUserId();
		await supabaseStorage.createStockTransfer(userId, auth.currentUser.uid, {
			itemId: data.itemId, quantity: data.quantity,
			fromBranchId: data.fromBranchId, toBranchId: data.toBranchId,
			requestedByName: auth.currentUser.displayName || auth.currentUser.email || undefined,
			notes: data.notes,
		});
	},
	async approveStockTransfer(id: string): Promise<void> {
		await supabaseStorage.setStockTransferStatus(id, 'approved');
	},
	async rejectStockTransfer(id: string, reason?: string): Promise<void> {
		await supabaseStorage.setStockTransferStatus(id, 'rejected', reason);
	},
	async receiveStockTransfer(id: string): Promise<void> {
		await supabaseStorage.setStockTransferStatus(id, 'received');
	},

	async clearAllData(): Promise<void> {
		const userId = getUserId();
		await supabaseStorage.clearAllData(userId);
	},
}