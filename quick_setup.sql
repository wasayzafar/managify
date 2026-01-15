-- Quick setup for Supabase tables
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Items table
CREATE TABLE items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  user_id VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchases table
CREATE TABLE purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES items(id),
  quantity INTEGER NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id VARCHAR NOT NULL,
  cost_price DECIMAL(10,2),
  supplier VARCHAR,
  supplier_phone VARCHAR,
  note TEXT
);

-- Sales table
CREATE TABLE sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES items(id),
  quantity INTEGER NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id VARCHAR NOT NULL,
  actual_price DECIMAL(10,2),
  original_price DECIMAL(10,2),
  item_discount DECIMAL(5,2),
  bill_discount DECIMAL(5,2),
  customer_name VARCHAR,
  customer_phone VARCHAR,
  invoice_no VARCHAR
);

-- Store info table
CREATE TABLE store_info (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_name VARCHAR NOT NULL,
  phone VARCHAR,
  address TEXT,
  email VARCHAR,
  website VARCHAR,
  tax_number VARCHAR,
  logo TEXT,
  user_id VARCHAR NOT NULL
);

-- Expenses table
CREATE TABLE expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type VARCHAR NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id VARCHAR NOT NULL
);

-- Employees table
CREATE TABLE employees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR NOT NULL,
  salary DECIMAL(10,2) NOT NULL,
  first_month_pay DECIMAL(10,2) NOT NULL,
  phone VARCHAR NOT NULL,
  address TEXT,
  email VARCHAR,
  position VARCHAR,
  join_date DATE NOT NULL,
  user_id VARCHAR NOT NULL
);

-- Invoices table
CREATE TABLE invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_no VARCHAR NOT NULL,
  customer VARCHAR NOT NULL,
  phone VARCHAR,
  lines JSONB NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  bill_discount DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id VARCHAR NOT NULL
);

-- Suppliers table
CREATE TABLE suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  phone VARCHAR,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id VARCHAR NOT NULL
);