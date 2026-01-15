import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../storage'
import { Item, Purchase, Sale, StoreInfo, Expense, Employee, Invoice, Supplier } from '../storage'

// Query keys for consistent caching
export const queryKeys = {
  items: ['items'] as const,
  purchases: ['purchases'] as const,
  sales: ['sales'] as const,
  inventory: ['inventory'] as const,
  storeInfo: ['storeInfo'] as const,
  expenses: ['expenses'] as const,
  employees: ['employees'] as const,
  invoices: ['invoices'] as const,
  suppliers: ['suppliers'] as const,
}

// Items queries
export const useItems = () => {
  return useQuery({
    queryKey: queryKeys.items,
    queryFn: () => db.listItems(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message === 'User not authenticated') {
        return false;
      }
      return failureCount < 3;
    },
  })
}

export const useItemBySku = (sku: string) => {
  return useQuery({
    queryKey: [...queryKeys.items, 'sku', sku],
    queryFn: () => db.getItemBySku(sku),
    enabled: !!sku,
    staleTime: 5 * 60 * 1000,
  })
}

// Purchases queries
export const usePurchases = () => {
  return useQuery({
    queryKey: queryKeys.purchases,
    queryFn: () => db.listPurchases(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'User not authenticated') {
        return false;
      }
      return failureCount < 3;
    },
  })
}

// Sales queries
export const useSales = () => {
  return useQuery({
    queryKey: queryKeys.sales,
    queryFn: () => db.listSales(),
    staleTime: 2 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'User not authenticated') {
        return false;
      }
      return failureCount < 3;
    },
  })
}

export const useSalesByDateRange = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: [...queryKeys.sales, 'dateRange', startDate, endDate],
    queryFn: () => startDate === endDate 
      ? db.listSalesByDate(startDate)
      : db.listSalesByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000,
  })
}

// Inventory query
export const useInventory = () => {
  return useQuery({
    queryKey: queryKeys.inventory,
    queryFn: () => db.inventory(),
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000,
  })
}

// Store info query
export const useStoreInfo = () => {
  return useQuery({
    queryKey: queryKeys.storeInfo,
    queryFn: () => db.getStoreInfo(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  })
}

// Expenses queries
export const useExpenses = () => {
  return useQuery({
    queryKey: queryKeys.expenses,
    queryFn: () => db.listExpenses(),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })
}

export const useExpensesByDateRange = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: [...queryKeys.expenses, 'dateRange', startDate, endDate],
    queryFn: async () => {
      const expenses = await db.listExpenses()
      return expenses.filter(e => {
        const expenseDate = e.date ? new Date(e.date) : new Date()
        return expenseDate >= new Date(startDate) && expenseDate <= new Date(endDate + 'T23:59:59')
      })
    },
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
  })
}

// Employees queries
export const useEmployees = () => {
  return useQuery({
    queryKey: queryKeys.employees,
    queryFn: () => db.listEmployees(),
    staleTime: 10 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  })
}

// Invoices queries
export const useInvoices = () => {
  return useQuery({
    queryKey: queryKeys.invoices,
    queryFn: () => db.listInvoices(),
    staleTime: 2 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })
}

// Suppliers queries
export const useSuppliers = () => {
  return useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: () => db.listSuppliers(),
    staleTime: 10 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  })
}

// Mutations for data updates
export const useCreateItem = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: Omit<Item, 'id'>) => db.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
    },
  })
}

export const useUpdateItem = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Omit<Item, 'id'>> }) => 
      db.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
    },
  })
}

export const useDeleteItem = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => db.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.items })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
    },
  })
}

export const useCreatePurchase = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: Parameters<typeof db.createPurchase>[0]) => db.createPurchase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
    },
  })
}

export const useCreateSale = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: Parameters<typeof db.createSale>[0]) => db.createSale(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sales })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
    },
  })
}

export const useDeleteSale = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => db.deleteSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sales })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
    },
  })
}

export const useUpdateStoreInfo = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: Partial<StoreInfo>) => db.updateStoreInfo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storeInfo })
    },
  })
}

export const useCreateExpense = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: Parameters<typeof db.createExpense>[0]) => db.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses })
    },
  })
}

export const useUpdateExpense = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Omit<Expense, 'id'>> }) => 
      db.updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses })
    },
  })
}

export const useDeleteExpense = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => db.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses })
    },
  })
}

export const useCreateEmployee = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: Parameters<typeof db.createEmployee>[0]) => db.createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees })
    },
  })
}

export const useUpdateEmployee = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Omit<Employee, 'id'>> }) => 
      db.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees })
    },
  })
}

export const useDeleteEmployee = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => db.deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees })
    },
  })
}

export const useCreateInvoice = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: Parameters<typeof db.createInvoice>[0]) => db.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices })
    },
  })
}

export const useCreateSupplier = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: Parameters<typeof db.createSupplier>[0]) => db.createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers })
    },
  })
}

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Omit<Supplier, 'id'>> }) => 
      db.updateSupplier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers })
    },
  })
}

export const useDeleteSupplier = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => db.deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers })
    },
  })
}

// Prefetch functions for better UX
export const usePrefetchData = () => {
  const queryClient = useQueryClient()
  
  const prefetchAll = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.items,
      queryFn: () => db.listItems(),
      staleTime: 5 * 60 * 1000,
    })
    queryClient.prefetchQuery({
      queryKey: queryKeys.purchases,
      queryFn: () => db.listPurchases(),
      staleTime: 2 * 60 * 1000,
    })
    queryClient.prefetchQuery({
      queryKey: queryKeys.sales,
      queryFn: () => db.listSales(),
      staleTime: 2 * 60 * 1000,
    })
    queryClient.prefetchQuery({
      queryKey: queryKeys.inventory,
      queryFn: () => db.inventory(),
      staleTime: 1 * 60 * 1000,
    })
  }
  
  return { prefetchAll }
}
