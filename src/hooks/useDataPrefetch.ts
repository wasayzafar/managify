import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './useDataQueries'
import { db } from '../storage'

export function useDataPrefetch() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Only the small store profile is needed on every page; the full item
    // catalog is fetched by the pages that actually use it.
    const prefetchCriticalData = async () => {
      try {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.storeInfo,
          queryFn: () => db.getStoreInfo(),
          staleTime: 10 * 60 * 1000,
        })
      } catch (error) {
        console.warn('Failed to prefetch critical data:', error)
      }
    }

    prefetchCriticalData()
  }, [queryClient])

  const prefetchPageData = (page: string) => {
    switch (page) {
      case 'dashboard':
        queryClient.prefetchQuery({
          queryKey: queryKeys.inventory,
          queryFn: () => db.inventory(),
          staleTime: 1 * 60 * 1000,
        })
        queryClient.prefetchQuery({
          queryKey: queryKeys.sales,
          queryFn: () => db.listSales(),
          staleTime: 2 * 60 * 1000,
        })
        break
      case 'inventory':
        queryClient.prefetchQuery({
          queryKey: queryKeys.inventory,
          queryFn: () => db.inventory(),
          staleTime: 1 * 60 * 1000,
        })
        queryClient.prefetchQuery({
          queryKey: queryKeys.purchases,
          queryFn: () => db.listPurchases(),
          staleTime: 2 * 60 * 1000,
        })
        break
      case 'sales':
        queryClient.prefetchQuery({
          queryKey: queryKeys.sales,
          queryFn: () => db.listSales(),
          staleTime: 2 * 60 * 1000,
        })
        break
      case 'purchases':
        queryClient.prefetchQuery({
          queryKey: queryKeys.purchases,
          queryFn: () => db.listPurchases(),
          staleTime: 2 * 60 * 1000,
        })
        queryClient.prefetchQuery({
          queryKey: queryKeys.suppliers,
          queryFn: () => db.listSuppliers(),
          staleTime: 10 * 60 * 1000,
        })
        break
      case 'profit-loss':
        queryClient.prefetchQuery({
          queryKey: queryKeys.sales,
          queryFn: () => db.listSales(),
          staleTime: 2 * 60 * 1000,
        })
        queryClient.prefetchQuery({
          queryKey: queryKeys.purchases,
          queryFn: () => db.listPurchases(),
          staleTime: 2 * 60 * 1000,
        })
        queryClient.prefetchQuery({
          queryKey: queryKeys.expenses,
          queryFn: () => db.listExpenses(),
          staleTime: 5 * 60 * 1000,
        })
        queryClient.prefetchQuery({
          queryKey: queryKeys.employees,
          queryFn: () => db.listEmployees(),
          staleTime: 10 * 60 * 1000,
        })
        break
    }
  }

  return { prefetchPageData }
}
