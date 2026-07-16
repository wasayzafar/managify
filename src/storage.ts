import { auth } from './firebase';
import { supabase } from './supabase';
import * as supabaseStorage from './supabaseStorage';

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
	note?: string
	purchasedAt?: string
	createdAt?: string
	date?: string
	paymentType?: 'debit' | 'credit'
	creditDeadline?: string
	isPaid?: boolean
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
}

function getUserId(): string {
	if (!auth.currentUser) {
		console.warn('No authenticated user found. Please log in.');
		throw new Error('User not authenticated');
	}
	return auth.currentUser.uid;
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
				note: purchase.note
			}));
		} catch (error) {
			console.error('Error listing purchases:', error);
			if (error instanceof Error && error.message === 'User not authenticated') {
				throw error;
			}
			return [];
		}
	},
	async createPurchase(data: { itemId: string, qty: number, costPrice?: number, supplier?: string, supplierPhone?: string, note?: string, purchasedAt?: string, date?: string, paymentType?: 'debit' | 'credit', creditDeadline?: string }): Promise<Purchase> {
		const userId = getUserId();
		const purchase: any = {
			item_id: data.itemId,
			quantity: data.qty,
			date: data.date || data.purchasedAt || new Date().toISOString(),
			cost_price: data.costPrice,
			supplier: data.supplier,
			supplier_phone: data.supplierPhone,
			note: data.note
		};
		
		const id = await supabaseStorage.addPurchase(userId, purchase);
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
			paymentType: data.paymentType,
			creditDeadline: data.creditDeadline
		};
	},
	async updatePurchase(id: string, data: Partial<Omit<Purchase, 'id'>>): Promise<void> {
		await supabaseStorage.updatePurchase(id, data);
	},
	async deletePurchase(id: string): Promise<void> {
		await supabaseStorage.deletePurchase(id);
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
				invoiceNo: sale.invoice_no
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
				invoiceNo: sale.invoice_no
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
				invoiceNo: sale.invoice_no
			}));
		} catch (error) {
			console.error('Error listing sales by date:', error);
			if (error instanceof Error && error.message === 'User not authenticated') {
				throw error;
			}
			return [];
		}
	},
	async createSale(data: { itemId: string, quantity: number, date?: string, actualPrice?: number, originalPrice?: number, itemDiscount?: number, billDiscount?: number, customerName?: string, customerPhone?: string, invoiceNo?: string }): Promise<Sale> {
		const userId = getUserId();
		const storeInfo = await this.getStoreInfo();
		const sale = {
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
		};
		const id = await supabaseStorage.addSale(userId, sale);
		return { id, itemId: data.itemId, quantity: data.quantity, date: sale.date, actualPrice: data.actualPrice, originalPrice: data.originalPrice, itemDiscount: data.itemDiscount, billDiscount: data.billDiscount, customerName: data.customerName, customerPhone: data.customerPhone, invoiceNo: data.invoiceNo, storeInfo };
	},
	async deleteSale(id: string): Promise<void> {
		await supabaseStorage.deleteSale(id);
	},

	async inventory(): Promise<Array<{ itemId: string, itemName: string, itemSku: string, stock: number }>> {
		try {
			const userId = getUserId();
			return await supabaseStorage.getInventory(userId);
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
				currency: info.currency || 'PKR'
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
		const mappedData = {
			store_name: data.storeName || 'Managify',
			phone: data.phone || '',
			address: data.address || '',
			email: data.email || '',
			website: data.website || '',
			tax_number: data.taxNumber || '',
			logo: data.logo || '',
			currency: data.currency || 'PKR'
		};
		await supabaseStorage.updateStoreInfo(userId, mappedData);
		return await this.getStoreInfo();
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
			}));
		} catch (error) {
			console.error('Error listing expenses:', error);
			return [];
		}
	},
	async createExpense(data: { type: string, amount: number, description?: string, date?: string, expiresThisMonth?: boolean, expenseMonth?: string }): Promise<Expense> {
		const userId = getUserId();
		const expense = {
			type: data.type,
			amount: data.amount,
			description: data.description,
			date: data.date || new Date().toISOString(),
			expires_this_month: data.expiresThisMonth ?? false,
			expense_month: data.expenseMonth || new Date().toISOString().slice(0, 7),
		};
		const id = await supabaseStorage.addExpense(userId, expense);
		return { id, type: expense.type, amount: expense.amount, description: expense.description, date: expense.date, expiresThisMonth: data.expiresThisMonth, expenseMonth: expense.expense_month };
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

	async createInvoice(data: { invoiceNo: string, customer: string, phone?: string, customerAddress?: string, lines: any[], total: number, billDiscount: number, date?: string }): Promise<Invoice> {
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
			created_at: new Date().toISOString(),
		};
		const id = await supabaseStorage.addInvoice(userId, invoice);
		return { id, invoiceNo: data.invoiceNo, customer: data.customer, phone: data.phone, customerAddress: data.customerAddress, lines: data.lines, total: data.total, billDiscount: data.billDiscount, date: dateStr, createdAt: new Date(dateStr).toLocaleString(), storeInfo };
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
			}))
		} catch (error) {
			console.error('Error listing assets:', error)
			return []
		}
	},
	async createAsset(data: { name: string; category: string; purchaseDate: string; purchasePrice: number; description?: string }): Promise<Asset> {
		const userId = getUserId()
		const id = await supabaseStorage.addAsset(userId, {
			name: data.name,
			category: data.category,
			purchase_date: data.purchaseDate,
			purchase_price: data.purchasePrice,
			description: data.description,
		})
		return { id, ...data }
	},
	async updateAsset(id: string, data: Partial<Omit<Asset, 'id'>>): Promise<void> {
		const mapped: any = {}
		if (data.name !== undefined) mapped.name = data.name
		if (data.category !== undefined) mapped.category = data.category
		if (data.purchaseDate !== undefined) mapped.purchase_date = data.purchaseDate
		if (data.purchasePrice !== undefined) mapped.purchase_price = data.purchasePrice
		if (data.description !== undefined) mapped.description = data.description
		await supabaseStorage.updateAsset(id, mapped)
	},
	async deleteAsset(id: string): Promise<void> {
		await supabaseStorage.deleteAsset(id)
	},

	async clearAllData(): Promise<void> {
		const userId = getUserId();
		await supabaseStorage.clearAllData(userId);
	},
}