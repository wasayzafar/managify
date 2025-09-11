# Managify Garments (React)

A Store Management System

## Features
- Items CRUD (SKU, name, price)
- Purchases list and add entries
- Sales invoices list and add invoice lines
- Inventory view with stock = purchases - sales
- Barcode scanner using camera (@zxing)
- Data persisted in localStorage (no backend required)

## Getting Started

1. Install Node.js 18+
2. Install dependencies:

```bash
npm install
```

3. Run dev server:

```bash
npm run dev
```

4. Open the app at the printed URL, typically `http://localhost:5173`.

### Building for production
```bash
npm run build
npm run preview
```

## Notes
- Camera permissions are required for the scanner page.
- For a multi-user or reliable setup, replace `localStorage` with a backend API and database.
