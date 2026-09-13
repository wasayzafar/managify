import { supabase } from './supabase'
import { matchesBranch } from './utils/branchFilter'

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
  supplier_address?: string
  note?: string
  payment_type?: string
  credit_deadline?: string
  is_paid?: boolean
  branch_id?: string | null
  tax_rate_id?: string | null
  tax_name?: string | null
  tax_percent?: number | null
  tax_amount?: number | null
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
  payment_type?: string
  credit_deadline?: string
  is_paid?: boolean
  credit_amount?: number
  paid_amount?: number
  branch_id?: string | null
  tax_rate_id?: string | null
  tax_name?: string | null
  tax_percent?: number | null
  tax_amount?: number | null
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
  currency?: string
  header_layout?: string
  user_id: string
}

export interface Expense {
  id: string
  type: string
  amount: number
  description?: string
  date: string
  expires_this_month?: boolean
  expense_month?: string
  user_id: string
  branch_id?: string | null
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
  customer_address?: string | null
  lines: any[]
  total: number
  bill_discount: number
  created_at: string
  date: string
  user_id: string
  branch_id?: string | null
  tax_rate_id?: string | null
  tax_name?: string | null
  tax_percent?: number | null
  tax_amount?: number | null
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

export interface Asset {
  id: string
  name: string
  category: string
  purchase_date: string
  purchase_price: number
  description?: string
  user_id: string
  created_at?: string
  branch_id?: string | null
}

// Items
export const listItems = async (userId: string): Promise<Item[]> => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  console.log('listItems returned:', data?.length, 'items')
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

export const deleteItem = async (userId: string, id: string): Promise<void> => {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
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

export const deletePurchase = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('purchases')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// IMEIs
export interface ImeiRecord {
  id?: string
  user_id?: string
  purchase_id: string
  item_id: string
  imei1: string
  imei2?: string
  is_sold?: boolean
  warranty_till?: string
  created_at?: string
}

export const addImeis = async (userId: string, imeis: Omit<ImeiRecord, 'id' | 'user_id' | 'created_at'>[]): Promise<void> => {
  if (!imeis.length) return
  const { error } = await supabase
    .from('imeis')
    .insert(imeis.map(i => ({ ...i, user_id: userId })))
  if (error) throw error
}

export const listImeisByPurchase = async (userId: string, purchaseId: string): Promise<ImeiRecord[]> => {
  const { data, error } = await supabase
    .from('imeis')
    .select('*')
    .eq('user_id', userId)
    .eq('purchase_id', purchaseId)
  if (error) throw error
  return data || []
}

export const listImeisByItem = async (userId: string, itemId: string): Promise<ImeiRecord[]> => {
  const { data, error } = await supabase
    .from('imeis')
    .select('*')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export const markImeiSold = async (userId: string, imei: string, warrantyTill?: string): Promise<void> => {
  const updateData: any = { is_sold: true }
  if (warrantyTill) updateData.warranty_till = warrantyTill
  await supabase
    .from('imeis')
    .update(updateData)
    .eq('user_id', userId)
    .or(`imei1.eq.${imei},imei2.eq.${imei}`)
  // silently ignore if IMEI not found in DB (manual entry on invoice)
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

export const updateSale = async (id: string, sale: Partial<Omit<Sale, 'id' | 'user_id'>>): Promise<void> => {
  const { error } = await supabase
    .from('sales')
    .update(sale)
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

export const updateHeaderLayout = async (userId: string, layout: string): Promise<void> => {
  const { error } = await supabase.from('store_info').update({ header_layout: layout }).eq('user_id', userId)
  if (error) throw error
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
export const getInventory = async (
  userId: string,
  targetBranchId?: string | null,
  mainBranchId?: string | null
): Promise<Array<{ itemId: string; itemName: string; itemSku: string; stock: number }>> => {
  const [items, purchases, sales] = await Promise.all([
    listItems(userId),
    listPurchases(userId),
    listSales(userId),
  ])

  // Stock transfers are an optional, additive refinement on top of the core
  // purchased-minus-sold math — if the stock_transfers table doesn't exist
  // yet (store hasn't run that migration) or the query fails for any other
  // reason, treat it as "no transfers" rather than letting Promise.all's
  // rejection take down the entire inventory list. This bundled into the
  // same Promise.all as items/purchases/sales previously meant one missing
  // table silently zeroed out inventory for every item, for every store
  // that hadn't run the migration yet.
  let transfers: StockTransferRow[] = []
  try {
    transfers = await listStockTransfers(userId)
  } catch (err) {
    console.error('Error loading stock transfers (continuing without them):', err)
  }

  // Stock is an aggregate (purchased minus sold), so — unlike a raw list —
  // it can't be branch-filtered after the fact by the caller; it has to be
  // filtered before summing.
  const purchasesInScope = targetBranchId
    ? purchases.filter(p => matchesBranch(p.branch_id, targetBranchId, mainBranchId))
    : purchases
  const salesInScope = targetBranchId
    ? sales.filter(s => matchesBranch(s.branch_id, targetBranchId, mainBranchId))
    : sales

  // A transfer leaves the source branch's countable stock once APPROVED
  // (physically gone, even mid-transit) and only lands at the destination
  // once RECEIVED — so there's a deliberate gap where it's counted nowhere,
  // matching goods actually in a truck. Viewing "all branches" nets to zero
  // for any transfer still in that gap, which is correct (nothing left the
  // store as a whole).
  const transfersOutInScope = targetBranchId
    ? transfers.filter(t => (t.status === 'approved' || t.status === 'received') && matchesBranch(t.from_branch_id, targetBranchId, mainBranchId))
    : []
  const transfersInInScope = targetBranchId
    ? transfers.filter(t => t.status === 'received' && matchesBranch(t.to_branch_id, targetBranchId, mainBranchId))
    : []

  return items.map(item => {
    const totalPurchased = purchasesInScope
      .filter(p => p.item_id === item.id)
      .reduce((sum, p) => sum + p.quantity, 0)

    const totalSold = salesInScope
      .filter(s => s.item_id === item.id)
      .reduce((sum, s) => sum + s.quantity, 0)

    const totalTransferredOut = transfersOutInScope
      .filter(t => t.item_id === item.id)
      .reduce((sum, t) => sum + t.quantity, 0)

    const totalTransferredIn = transfersInInScope
      .filter(t => t.item_id === item.id)
      .reduce((sum, t) => sum + t.quantity, 0)

    return {
      itemId: item.id,
      itemName: item.name,
      itemSku: item.sku,
      stock: totalPurchased - totalSold - totalTransferredOut + totalTransferredIn
    }
  })
}

// Assets
export const listAssets = async (userId: string): Promise<Asset[]> => {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('user_id', userId)
    .order('purchase_date', { ascending: false })
  if (error) throw error
  return data || []
}

export const addAsset = async (userId: string, asset: Omit<Asset, 'id' | 'user_id'>): Promise<string> => {
  const { data, error } = await supabase
    .from('assets')
    .insert({ ...asset, user_id: userId, created_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data.id
}

export const updateAsset = async (id: string, asset: Partial<Omit<Asset, 'id' | 'user_id'>>): Promise<void> => {
  const { error } = await supabase
    .from('assets')
    .update(asset)
    .eq('id', id)
  if (error) throw error
}

export const deleteAsset = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Branches
export interface BranchRow {
  id: string
  store_id: string
  name: string
  address?: string
  phone?: string
  is_active: boolean
  created_at?: string
}

export const listBranches = async (storeId: string): Promise<BranchRow[]> => {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export const addBranch = async (storeId: string, branch: Omit<BranchRow, 'id' | 'store_id' | 'is_active' | 'created_at'>): Promise<string> => {
  const { data, error } = await supabase
    .from('branches')
    .insert({ ...branch, store_id: storeId })
    .select()
    .single()
  if (error) throw error
  return data.id
}

export const updateBranch = async (id: string, branch: Partial<Omit<BranchRow, 'id' | 'store_id'>>): Promise<void> => {
  const { error } = await supabase
    .from('branches')
    .update(branch)
    .eq('id', id)
  if (error) throw error
}

export const deleteBranch = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('branches')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Stock transfers (branch-to-branch, with manager/owner approval)
export interface StockTransferRow {
  id: string
  store_id: string
  item_id: string
  quantity: number
  from_branch_id: string
  to_branch_id: string
  status: 'pending' | 'approved' | 'rejected' | 'received'
  requested_by: string
  requested_by_name?: string
  approved_by?: string
  approved_at?: string
  received_at?: string
  rejected_reason?: string
  notes?: string
  created_at: string
}

export const listStockTransfers = async (storeId: string): Promise<StockTransferRow[]> => {
  const { data, error } = await supabase
    .from('stock_transfers')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const createStockTransfer = async (
  storeId: string,
  requestedBy: string,
  data: { itemId: string; quantity: number; fromBranchId: string; toBranchId: string; requestedByName?: string; notes?: string }
): Promise<string> => {
  const { data: row, error } = await supabase
    .from('stock_transfers')
    .insert({
      store_id: storeId,
      item_id: data.itemId,
      quantity: data.quantity,
      from_branch_id: data.fromBranchId,
      to_branch_id: data.toBranchId,
      requested_by: requestedBy,
      requested_by_name: data.requestedByName,
      notes: data.notes,
    })
    .select()
    .single()
  if (error) throw error
  return row.id
}

export const setStockTransferStatus = async (id: string, status: 'approved' | 'rejected' | 'received', rejectedReason?: string): Promise<void> => {
  const patch: Record<string, any> = { status }
  if (status === 'rejected' && rejectedReason) patch.rejected_reason = rejectedReason
  const { error } = await supabase.from('stock_transfers').update(patch).eq('id', id)
  if (error) throw error
}

// Tax rates
export interface TaxRateRow {
  id: string
  store_id: string
  name: string
  rate: number
  applies_to: 'purchase' | 'sales' | 'both'
  is_active: boolean
  created_at?: string
}

export const listTaxRates = async (storeId: string): Promise<TaxRateRow[]> => {
  const { data, error } = await supabase
    .from('tax_rates')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export const addTaxRate = async (storeId: string, tax: Omit<TaxRateRow, 'id' | 'store_id' | 'is_active' | 'created_at'>): Promise<string> => {
  const { data, error } = await supabase
    .from('tax_rates')
    .insert({ ...tax, store_id: storeId })
    .select()
    .single()
  if (error) throw error
  return data.id
}

export const updateTaxRate = async (id: string, tax: Partial<Omit<TaxRateRow, 'id' | 'store_id'>>): Promise<void> => {
  const { error } = await supabase
    .from('tax_rates')
    .update(tax)
    .eq('id', id)
  if (error) throw error
}

export const deleteTaxRate = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tax_rates')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Clear all user data
export const clearAllData = async (userId: string): Promise<void> => {
  // Child tables that reference items must be deleted first to avoid FK violations
  const tables = [
    'sales',      // references items
    'purchases',  // references items
    'invoices',
    'items',
    'expenses',
    'employees',
    'suppliers',
    'assets',
    'store_info',
  ]

  const failures: string[] = []
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', userId)
    // 42P01 = table does not exist, 42703 = column does not exist — skip missing tables
    if (error && error.code !== '42P01' && error.code !== '42703') {
      console.error(`Failed to clear table "${table}":`, error)
      failures.push(table)
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to clear: ${failures.join(', ')}`)
  }
}