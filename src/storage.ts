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
}

export type Expense = {
	id: string
	type: string
	amount: number
	description?: string
	date: string
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
		await supabaseStorage.deleteItem(id);
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
				paymentType: purchase.payment_type,
				creditDeadline: purchase.credit_deadline
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
			note: data.note,
			payment_type: data.paymentType || 'debit'
		};
		
		// Only add credit_deadline if it has a valid value
		if (data.creditDeadline && data.creditDeadline.trim() !== '') {
			purchase.credit_deadline = data.creditDeadline;
		}
		
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
				store_name: info.store_name,
				phone: info.phone,
				address: info.address,
				email: info.email,
				website: info.website,
				tax_number: info.tax_number,
				logo: info.logo
			};
		} catch (error) {
			console.error('Error getting store info:', error);
			return {
				store_name: 'Managify',
				phone: '',
				address: '',
				email: '',
				website: '',
				tax_number: '',
				logo: ''
			};
		}
	},
	async updateStoreInfo(data: Partial<StoreInfo>): Promise<StoreInfo> {
		const userId = getUserId();
		const mappedData = {
			store_name: data.store_name || 'Managify',
			phone: data.phone || '',
			address: data.address || '',
			email: data.email || '',
			website: data.website || '',
			tax_number: data.tax_number || '',
			logo: data.logo || ''
		};
		await supabaseStorage.updateStoreInfo(userId, mappedData);
		return await this.getStoreInfo();
	},

	async listExpenses(): Promise<Expense[]> {
		try {
			const userId = getUserId();
			return await supabaseStorage.listExpenses(userId);
		} catch (error) {
			console.error('Error listing expenses:', error);
			return [];
		}
	},
	async createExpense(data: { type: string, amount: number, description?: string, date?: string }): Promise<Expense> {
		const userId = getUserId();
		const expense = {
			type: data.type,
			amount: data.amount,
			description: data.description,
			date: data.date || new Date().toISOString()
		};
		const id = await supabaseStorage.addExpense(userId, expense);
		return { id, ...expense };
	},
	async updateExpense(id: string, data: Partial<Omit<Expense, 'id'>>): Promise<void> {
		await supabaseStorage.updateExpense(id, data);
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

	async createInvoice(data: { invoiceNo: string, customer: string, phone?: string, lines: any[], total: number, billDiscount: number }): Promise<Invoice> {
		const userId = getUserId();
		const storeInfo = await this.getStoreInfo();
		const invoice = {
			invoice_no: data.invoiceNo,
			customer: data.customer,
			phone: data.phone,
			lines: data.lines,
			total: data.total,
			bill_discount: data.billDiscount,
			date: new Date().toISOString(),
			created_at: new Date().toISOString(),
		};
		const id = await supabaseStorage.addInvoice(userId, invoice);
		return { id, invoiceNo: data.invoiceNo, customer: data.customer, phone: data.phone, lines: data.lines, total: data.total, billDiscount: data.billDiscount, date: invoice.date, createdAt: new Date().toLocaleString(), storeInfo };
	},
	async listInvoices(): Promise<Invoice[]> {
		try {
			const userId = getUserId();
			return await supabaseStorage.listInvoices(userId);
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

	async clearAllData(): Promise<void> {
		const userId = getUserId();
		await supabaseStorage.clearAllData(userId);
	},
}