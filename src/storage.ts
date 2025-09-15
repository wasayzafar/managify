export type Item = {
	id: string
	sku: string
	name: string
	price: number
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

export type SaleItem = {
	id: string
	saleId: string
	itemId: string
	qty: number
	unitPrice: number
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

import { auth } from './firebase';
import * as cloudStorage from './cloudStorage';

function uid(prefix: string) {
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

function getUserId(): string {
	if (!auth.currentUser) {
		// Return empty string for now, will be handled by components
		return '';
	}
	return auth.currentUser.uid;
}

export const db = {
	async listItems(): Promise<Item[]> {
		const userId = getUserId();
		if (!userId) return [];
		try {
			return await cloudStorage.listItems(userId);
		} catch (error) {
			console.error('Error listing items:', error);
			return [];
		}
	},
	async getItemBySku(sku: string): Promise<Item | undefined> {
		const items = await this.listItems();
		return items.find(i => i.sku === sku);
	},
	async createItem(data: Omit<Item, 'id'>): Promise<Item> {
		const userId = getUserId();
		const itemWithDate = { ...data, createdAt: new Date().toISOString() };
		const id = await cloudStorage.addItem(userId, itemWithDate);
		return { id, ...itemWithDate };
	},
	async updateItem(id: string, data: Partial<Omit<Item, 'id'>>): Promise<void> {
		await cloudStorage.updateItem(id, data);
	},
	async deleteItem(id: string): Promise<void> {
		await cloudStorage.deleteItem(id);
	},

	async listPurchases(): Promise<Purchase[]> {
		const userId = getUserId();
		if (!userId) return [];
		try {
			return await cloudStorage.listPurchases(userId);
		} catch (error) {
			console.error('Error listing purchases:', error);
			return [];
		}
	},
	async createPurchase(data: { itemId: string, qty: number, costPrice?: number, supplier?: string, supplierPhone?: string, note?: string, purchasedAt?: string, date?: string, paymentType?: 'debit' | 'credit', creditDeadline?: string }): Promise<Purchase> {
		const userId = getUserId();
		const purchase = {
			itemId: data.itemId,
			quantity: data.qty,
			date: data.date || data.purchasedAt || new Date().toISOString(),
			costPrice: data.costPrice,
			supplier: data.supplier,
			supplierPhone: data.supplierPhone,
			note: data.note,
			paymentType: data.paymentType,
			creditDeadline: data.creditDeadline
		};
		const id = await cloudStorage.addPurchase(userId, purchase);
		return { id, ...purchase, qty: data.qty };
	},
	async updatePurchase(id: string, data: Partial<Omit<Purchase, 'id'>>): Promise<void> {
		await cloudStorage.updatePurchase(id, data);
	},

	async listSales(): Promise<Sale[]> {
		const userId = getUserId();
		if (!userId) return [];
		try {
			return await cloudStorage.listSales(userId);
		} catch (error) {
			console.error('Error listing sales:', error);
			return [];
		}
	},
	async createSale(data: { itemId: string, quantity: number, date?: string, actualPrice?: number, originalPrice?: number, itemDiscount?: number, billDiscount?: number, customerName?: string, customerPhone?: string, invoiceNo?: string }): Promise<Sale> {
		const userId = getUserId();
		const storeInfo = await this.getStoreInfo();
		const sale = {
			itemId: data.itemId,
			quantity: data.quantity,
			date: data.date || new Date().toISOString(),
			actualPrice: data.actualPrice,
			originalPrice: data.originalPrice,
			itemDiscount: data.itemDiscount,
			billDiscount: data.billDiscount,
			customerName: data.customerName,
			customerPhone: data.customerPhone,
			invoiceNo: data.invoiceNo,
			storeInfo: {
				storeName: storeInfo.storeName,
				phone: storeInfo.phone,
				address: storeInfo.address,
				email: storeInfo.email,
				website: storeInfo.website,
				taxNumber: storeInfo.taxNumber,
				logo: storeInfo.logo
			}
		};
		const id = await cloudStorage.addSale(userId, sale);
		return { id, ...sale };
	},
	async deleteSale(id: string): Promise<void> {
		await cloudStorage.deleteSale(id);
	},

	async inventory(): Promise<Array<{ itemId: string, itemName: string, itemSku: string, stock: number }>> {
		const userId = getUserId();
		if (!userId) return [];
		try {
			return await cloudStorage.getInventory(userId);
		} catch (error) {
			console.error('Error getting inventory:', error);
			return [];
		}
	},

	async getStoreInfo(): Promise<StoreInfo> {
		const userId = getUserId();
		if (!userId) {
			return {
				storeName: 'Managify',
				phone: '',
				address: '',
				email: '',
				website: '',
				taxNumber: '',
				logo: ''
			};
		}
		try {
			const info = await cloudStorage.getStoreInfo(userId);
			return {
				storeName: info.storeName,
				phone: info.phone,
				address: info.address,
				email: info.email,
				website: info.website,
				taxNumber: info.taxNumber,
				logo: info.logo
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
				logo: ''
			};
		}
	},
	async updateStoreInfo(data: Partial<StoreInfo>): Promise<StoreInfo> {
		const userId = getUserId();
		await cloudStorage.updateStoreInfo(userId, data);
		return await this.getStoreInfo();
	},

	async listExpenses(): Promise<Expense[]> {
		const userId = getUserId();
		if (!userId) return [];
		try {
			return await cloudStorage.listExpenses(userId);
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
		const id = await cloudStorage.addExpense(userId, expense);
		return { id, ...expense };
	},
	async updateExpense(id: string, data: Partial<Omit<Expense, 'id'>>): Promise<void> {
		await cloudStorage.updateExpense(id, data);
	},
	async deleteExpense(id: string): Promise<void> {
		await cloudStorage.deleteExpense(id);
	},

	async listEmployees(): Promise<Employee[]> {
		const userId = getUserId();
		if (!userId) return [];
		try {
			return await cloudStorage.listEmployees(userId);
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
			firstMonthPay: data.firstMonthPay,
			phone: data.phone,
			address: data.address,
			email: data.email,
			position: data.position,
			joinDate: data.joinDate || new Date().toISOString().slice(0, 10)
		};
		const id = await cloudStorage.addEmployee(userId, employee);
		return { id, ...employee };
	},
	async updateEmployee(id: string, data: Partial<Omit<Employee, 'id'>>): Promise<void> {
		await cloudStorage.updateEmployee(id, data);
	},
	async deleteEmployee(id: string): Promise<void> {
		await cloudStorage.deleteEmployee(id);
	},

	async createInvoice(data: { invoiceNo: string, customer: string, phone?: string, lines: any[], total: number, billDiscount: number }): Promise<Invoice> {
		const userId = getUserId();
		const storeInfo = await this.getStoreInfo();
		const invoice = {
			invoiceNo: data.invoiceNo,
			customer: data.customer,
			phone: data.phone,
			lines: data.lines,
			total: data.total,
			billDiscount: data.billDiscount,
			date: new Date().toISOString(),
			createdAt: new Date().toLocaleString(),
			storeInfo: {
				storeName: storeInfo.storeName,
				phone: storeInfo.phone,
				address: storeInfo.address,
				email: storeInfo.email,
				website: storeInfo.website,
				taxNumber: storeInfo.taxNumber,
				logo: storeInfo.logo
			}
		};
		const id = await cloudStorage.addInvoice(userId, invoice);
		return { id, ...invoice };
	},
	async listInvoices(): Promise<Invoice[]> {
		const userId = getUserId();
		if (!userId) return [];
		try {
			return await cloudStorage.listInvoices(userId);
		} catch (error) {
			console.error('Error listing invoices:', error);
			return [];
		}
	},

	async clearAllData(): Promise<void> {
		const userId = getUserId();
		if (!userId) return;
		await cloudStorage.clearAllData(userId);
	},
}
