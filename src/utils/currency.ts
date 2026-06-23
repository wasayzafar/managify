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

type CurrencyDef = { symbol: string; prefix: boolean }

const CURRENCY_MAP: Record<string, CurrencyDef> = {
  USD: { symbol: '$',   prefix: true  },
  EUR: { symbol: '€',   prefix: true  },
  GBP: { symbol: '£',   prefix: true  },
  PKR: { symbol: 'PKR', prefix: false },
  INR: { symbol: '₹',   prefix: true  },
  AED: { symbol: 'AED', prefix: false },
  SAR: { symbol: 'SAR', prefix: false },
}

export const formatCurrency = (amount: number, currency?: string): string => {
  const curr = currency || cachedCurrency
  const def: CurrencyDef = CURRENCY_MAP[curr] ?? { symbol: curr, prefix: false }
  const formatted = amount.toFixed(2)
  return def.prefix ? `${def.symbol}${formatted}` : `${def.symbol} ${formatted}`
}
