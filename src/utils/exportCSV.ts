function toHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function escapeCell(value: string | number | null | undefined): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(','))
  ]
  return lines.join('\r\n')
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Shopify product import columns (matches Shopify's official template)
const SHOPIFY_HEADERS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Product Category',
  'Type',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Variant SKU',
  'Variant Grams',
  'Variant Inventory Tracker',
  'Variant Inventory Qty',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Variant Barcode',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'Gift Card',
  'SEO Title',
  'SEO Description',
  'Variant Weight Unit',
  'Cost per item',
  'Status',
]

export type ExportItem = {
  sku: string
  name: string
  price: number
  costPrice?: number
  stock?: number
}

export function exportItemsToShopifyCSV(items: ExportItem[], filename = 'products_shopify.csv') {
  const rows = items.map(item => [
    toHandle(item.name),          // Handle
    item.name,                     // Title
    '',                            // Body (HTML)
    '',                            // Vendor
    '',                            // Product Category
    '',                            // Type
    '',                            // Tags
    'TRUE',                        // Published
    'Title',                       // Option1 Name
    'Default Title',               // Option1 Value
    item.sku,                      // Variant SKU
    0,                             // Variant Grams
    'shopify',                     // Variant Inventory Tracker
    item.stock ?? 0,               // Variant Inventory Qty
    'deny',                        // Variant Inventory Policy
    'manual',                      // Variant Fulfillment Service
    item.price.toFixed(2),         // Variant Price
    '',                            // Variant Compare At Price
    'TRUE',                        // Variant Requires Shipping
    'FALSE',                       // Variant Taxable
    item.sku,                      // Variant Barcode
    '',                            // Image Src
    '',                            // Image Position
    '',                            // Image Alt Text
    'FALSE',                       // Gift Card
    item.name,                     // SEO Title
    '',                            // SEO Description
    'kg',                          // Variant Weight Unit
    item.costPrice != null ? item.costPrice.toFixed(2) : '', // Cost per item
    'active',                      // Status
  ])

  const csv = buildCSV(SHOPIFY_HEADERS, rows)
  downloadCSV(csv, filename)
}
