import { supabase } from './supabase'

export interface Item {
  id: string
  sku: string
  name: string
  price: number
  cost_price?: number
  user_id: string
  created_at?: string
}

export interface Purchase {
  id: string
  item_id: string
  quantity: number
  date: string
  user_id: string
  cost_price?: number
  supplier?: string
  supplier_phone?: string
  note?: string
}

export interface Sale {
  id: string
  item_id: string
  quantity: number
  date: string
  user_id: string
  actual_price?: number
  original_price?: number
  item_discount?: number
  bill_discount?: number
  customer_name?: string
  customer_phone?: string
  invoice_no?: string
}

export interface StoreInfo {
  id?: string
  store_name: string
  phone: string
  address: string
  email: string
  website: string
  tax_number: string
  logo: string
  user_id: string
}

export interface Expense {
  id: string
  type: string
  amount: number
  description?: string
  date: string
  user_id: string
}

export interface Employee {
  id: string
  name: string
  salary: number
  first_month_pay: number
  phone: string
  address: string
  email?: string
  position?: string
  join_date: string
  user_id: string
}

export interface Invoice {
  id: string
  invoice_no: string
  customer: string
  phone?: string
  lines: any[]
  total: number
  bill_discount: number
  created_at: string
  date: string
  user_id: string
}

export interface Supplier {
  id: string
  supplier_id: string
  name: string
  phone: string
  address: string
  created_at?: string
  user_id: string
}

// Items
export const listItems = async (userId: string): Promise<Item[]> => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}

export const addItem = async (userId: string, item: Omit<Item, 'id' | 'user_id'>): Promise<string> => {
  const { data, error } = await supabase
    .from('items')
    .insert({ ...item, user_id: userId, created_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data.id
}

export const updateItem = async (id: string, item: Partial<Omit<Item, 'id' | 'user_id'>>): Promise<void> => {
  const { error } = await supabase
    .from('items')
    .update(item)
    .eq('id', id)
  if (error) throw error
}

export const deleteItem = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Purchases
export const listPurchases = async (userId: string): Promise<Purchase[]> => {
  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

export const listPurchasesByDateRange = async (userId: string, startDate: string, endDate: string): Promise<Purchase[]> => {
  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

export const addPurchase = async (userId: string, purchase: Omit<Purchase, 'id' | 'user_id'>): Promise<string> => {
  const { data, error } = await supabase
    .from('purchases')
    .insert({ ...purchase, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data.id
}

export const updatePurchase = async (id: string, purchase: Partial<Omit<Purchase, 'id' | 'user_id'>>): Promise<void> => {
  const { error } = await supabase
    .from('purchases')
    .update(purchase)
    .eq('id', id)
  if (error) throw error
}

// Sales
export const listSales = async (userId: string): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

export const listSalesByDateRange = async (userId: string, startDate: string, endDate: string): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

export const listSalesByDate = async (userId: string, date: string): Promise<Sale[]> => {
  const startOfDay = date + 'T00:00:00.000Z'
  const endOfDay = date + 'T23:59:59.999Z'
  return listSalesByDateRange(userId, startOfDay, endOfDay)
}

export const addSale = async (userId: string, sale: Omit<Sale, 'id' | 'user_id'>): Promise<string> => {
  const { data, error } = await supabase
    .from('sales')
    .insert({ ...sale, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data.id
}

export const deleteSale = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Store Info
export const getStoreInfo = async (userId: string): Promise<StoreInfo> => {
  const { data, error } = await supabase
    .from('store_info')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
  
  if (error) throw error
  
  if (!data || data.length === 0) {
    const defaultInfo: Omit<StoreInfo, 'id'> = {
      store_name: 'Managify',
      phone: '',
      address: '',
      email: '',
      website: '',
      tax_number: '',
      logo: '',
      user_id: userId
    }
    const { data: newData, error: insertError } = await supabase
      .from('store_info')
      .insert(defaultInfo)
      .select()
      .single()
    if (insertError) throw insertError
    return newData
  }
  
  return data[0]
}

export const updateStoreInfo = async (userId: string, info: Omit<StoreInfo, 'user_id' | 'id'>): Promise<void> => {
  // First, try to update existing record
  const { error: updateError } = await supabase
    .from('store_info')
    .update(info)
    .eq('user_id', userId)
    .limit(1)
  
  if (updateError) {
    // If update fails, insert new record
    const { error: insertError } = await supabase
      .from('store_info')
      .insert({ ...info, user_id: userId })
    
    if (insertError) throw insertError
  }
}

// Expenses
export const listExpenses = async (userId: string): Promise<Expense[]> => {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

export const addExpense = async (userId: string, expense: Omit<Expense, 'id' | 'user_id'>): Promise<string> => {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...expense, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data.id
}

export const updateExpense = async (id: string, expense: Partial<Omit<Expense, 'id' | 'user_id'>>): Promise<void> => {
  const { error } = await supabase
    .from('expenses')
    .update(expense)
    .eq('id', id)
  if (error) throw error
}

export const deleteExpense = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Employees
export const listEmployees = async (userId: string): Promise<Employee[]> => {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}

export const addEmployee = async (userId: string, employee: Omit<Employee, 'id' | 'user_id'>): Promise<string> => {
  const { data, error } = await supabase
    .from('employees')
    .insert({ ...employee, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data.id
}

export const updateEmployee = async (id: string, employee: Partial<Omit<Employee, 'id' | 'user_id'>>): Promise<void> => {
  const { error } = await supabase
    .from('employees')
    .update(employee)
    .eq('id', id)
  if (error) throw error
}

export const deleteEmployee = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Invoices
export const listInvoices = async (userId: string): Promise<Invoice[]> => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

export const addInvoice = async (userId: string, invoice: Omit<Invoice, 'id' | 'user_id'>): Promise<string> => {
  const { data, error } = await supabase
    .from('invoices')
    .insert({ ...invoice, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data.id
}

// Suppliers
export const listSuppliers = async (userId: string): Promise<Supplier[]> => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}

export const addSupplier = async (userId: string, supplier: Omit<Supplier, 'id' | 'user_id'>): Promise<string> => {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...supplier, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data.id
}

export const updateSupplier = async (id: string, supplier: Partial<Omit<Supplier, 'id' | 'user_id'>>): Promise<void> => {
  const { error } = await supabase
    .from('suppliers')
    .update(supplier)
    .eq('id', id)
  if (error) throw error
}

export const deleteSupplier = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Inventory calculation
export const getInventory = async (userId: string): Promise<Array<{ itemId: string; itemName: string; itemSku: string; stock: number }>> => {
  const [items, purchases, sales] = await Promise.all([
    listItems(userId),
    listPurchases(userId),
    listSales(userId)
  ])

  return items.map(item => {
    const totalPurchased = purchases
      .filter(p => p.item_id === item.id)
      .reduce((sum, p) => sum + p.quantity, 0)
    
    const totalSold = sales
      .filter(s => s.item_id === item.id)
      .reduce((sum, s) => sum + s.quantity, 0)

    return {
      itemId: item.id,
      itemName: item.name,
      itemSku: item.sku,
      stock: totalPurchased - totalSold
    }
  })
}

// Clear all user data
export const clearAllData = async (userId: string): Promise<void> => {
  const tables = ['items', 'purchases', 'sales', 'store_info', 'expenses', 'employees', 'invoices', 'suppliers']
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', userId)
    if (error) throw error
  }
}