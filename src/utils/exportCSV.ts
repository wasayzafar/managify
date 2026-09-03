function toHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function escapeCell(value: string | number | null | undefined): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(','))
  ]
  return lines.join('\r\n')
}

// Triggers a browser download from a Blob. The anchor is attached to the DOM
// before clicking and the object URL is revoked on a delay — some browsers
// (older Firefox, some embedded webviews) drop the download if the element
// is never attached or the URL is revoked before the click is processed.
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadCSV(csv: string, filename: string) {
  downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), filename)
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

  // Text cells are HTML-escaped (an item named e.g. "Cable <2m>" would otherwise
  // break the table markup). Numeric cells carry the raw number plus an Excel
  // mso-number-format hint, so Stock/Price/Total columns import as real,
  // summable numbers instead of left-aligned text.
  const textCell = (value: string) => `<td style="border:1px solid #ccc;padding:6px">${escapeHtml(value)}</td>`
  const numCell = (value: number, format: string) =>
    `<td style="border:1px solid #ccc;padding:6px;text-align:right;mso-number-format:'${format}'">${value}</td>`

  const tableRows = [
    `<tr>${headers.map(h => `<th style="background:#f0f0f0;font-weight:bold;border:1px solid #ccc;padding:6px">${escapeHtml(h)}</th>`).join('')}</tr>`,
    ...items.map(i => `<tr>${[
      textCell(i.sku),
      textCell(i.name),
      numCell(i.stock, '0'),
      numCell(i.price, '0.00'),
      numCell(i.costPrice, '0.00'),
      numCell(i.totalRetail, '0.00'),
      numCell(i.totalCost, '0.00'),
    ].join('')}</tr>`)
  ].join('\n')

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${tableRows}</table></body></html>`
  downloadBlob(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' }), filename)
}

export type AssetExportRow = {
  name: string
  category: string
  purchaseDate: string
  purchasePrice: number
  bookValue: number
  accumulatedDepreciation: number
  description?: string
}

export function exportAssetsToExcel(rows: AssetExportRow[], filename = 'assets.xls') {
  const headers = ['Name', 'Category', 'Purchase Date', 'Purchase Price', 'Book Value', 'Accumulated Depreciation', 'Description']

  const textCell = (value: string) => `<td style="border:1px solid #ccc;padding:6px">${escapeHtml(value)}</td>`
  const numCell = (value: number, format: string) =>
    `<td style="border:1px solid #ccc;padding:6px;text-align:right;mso-number-format:'${format}'">${value}</td>`

  const tableRows = [
    `<tr>${headers.map(h => `<th style="background:#f0f0f0;font-weight:bold;border:1px solid #ccc;padding:6px">${escapeHtml(h)}</th>`).join('')}</tr>`,
    ...rows.map(r => `<tr>${[
      textCell(r.name),
      textCell(r.category),
      textCell(r.purchaseDate),
      numCell(r.purchasePrice, '0.00'),
      numCell(r.bookValue, '0.00'),
      numCell(r.accumulatedDepreciation, '0.00'),
      textCell(r.description || ''),
    ].join('')}</tr>`)
  ].join('\n')

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${tableRows}</table></body></html>`
  downloadBlob(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' }), filename)
}

export type ExpenseExportRow = {
  month: string
  type: string
  amount: number
  description?: string
  date?: string
}

export function exportExpensesToExcel(rows: ExpenseExportRow[], filename = 'expenses.xls') {
  const headers = ['Month', 'Type', 'Amount', 'Description', 'Date']

  const textCell = (value: string) => `<td style="border:1px solid #ccc;padding:6px">${escapeHtml(value)}</td>`
  const numCell = (value: number, format: string) =>
    `<td style="border:1px solid #ccc;padding:6px;text-align:right;mso-number-format:'${format}'">${value}</td>`

  const tableRows = [
    `<tr>${headers.map(h => `<th style="background:#f0f0f0;font-weight:bold;border:1px solid #ccc;padding:6px">${escapeHtml(h)}</th>`).join('')}</tr>`,
    ...rows.map(r => `<tr>${[
      textCell(r.month),
      textCell(r.type),
      numCell(r.amount, '0.00'),
      textCell(r.description || ''),
      textCell(r.date || ''),
    ].join('')}</tr>`)
  ].join('\n')

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${tableRows}</table></body></html>`
  downloadBlob(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' }), filename)
}

export function exportItemsToShopifyCSV(items: ExportItem[], filename = 'products_shopify.csv') {
  const rows = items.map((item, idx) => [
    // Handle is Shopify's product-grouping key: two rows with the same handle
    // become variants of ONE product. Deriving it from the name alone means
    // any two differently-SKU'd items that merely share (or normalize to) the
    // same name — "T-Shirt" and "t-shirt!", or two blank/symbol-only names —
    // would silently collapse into a single product on import. The SKU is
    // this app's actual unique key, so build the handle from that instead,
    // falling back to the name only if the SKU itself has no safe characters.
    toHandle(item.sku) || toHandle(item.name) || `item-${idx + 1}`, // Handle
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
