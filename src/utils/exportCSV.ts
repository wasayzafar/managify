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

export type InventoryExportItem = {
  sku: string
  name: string
  stock: number
  price: number
  costPrice: number
  totalRetail: number
  totalCost: number
}

export function exportInventoryToExcel(items: InventoryExportItem[], filename = 'inventory.xls') {
  const headers = ['SKU', 'Name', 'Stock', 'Selling Price', 'Cost Price', 'Total Retail', 'Total Cost']
  const rows = items.map(i => [i.sku, i.name, i.stock, i.price.toFixed(2), i.costPrice.toFixed(2), i.totalRetail.toFixed(2), i.totalCost.toFixed(2)])

  const tableRows = [
    `<tr>${headers.map(h => `<th style="background:#f0f0f0;font-weight:bold;border:1px solid #ccc;padding:6px">${h}</th>`).join('')}</tr>`,
    ...rows.map(r => `<tr>${r.map(c => `<td style="border:1px solid #ccc;padding:6px">${c}</td>`).join('')}</tr>`)
  ].join('\n')

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${tableRows}</table></body></html>`
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
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
