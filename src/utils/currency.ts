import { db } from '../storage'

let cachedCurrency = 'PKR'

export const loadCurrency = async () => {
  try {
    const info = await db.getStoreInfo()
    cachedCurrency = info.currency || 'PKR'
    return cachedCurrency
  } catch {
    return 'PKR'
  }
}

export const getCurrency = () => cachedCurrency

export const formatCurrency = (amount: number, currency?: string) => {
  const curr = currency || cachedCurrency
  return `${curr} ${amount.toFixed(2)}`
}
