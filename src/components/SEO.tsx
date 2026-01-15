import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
}

const pageData: Record<string, SEOProps> = {
  '/': {
    title: 'Dashboard - Managify Store Management System',
    description: 'Business dashboard with sales analytics, inventory overview, and key performance metrics for your store management system.',
    keywords: 'store dashboard, business analytics, sales overview, inventory dashboard, POS dashboard'
  },
  '/inventory': {
    title: 'Inventory Management - Managify POS System',
    description: 'Complete inventory management with real-time stock tracking, low stock alerts, and automated inventory control for your business.',
    keywords: 'inventory management, stock tracking, inventory control, warehouse management, stock alerts'
  },
  '/items': {
    title: 'Product Management - Store Management System',
    description: 'Manage products, SKUs, pricing, and product information with barcode support for efficient store operations.',
    keywords: 'product management, SKU management, item catalog, product database, barcode products'
  },
  '/sales': {
    title: 'Sales Management - POS System | Managify',
    description: 'Track sales transactions, generate invoices, and manage customer orders with our comprehensive POS solution.',
    keywords: 'sales management, POS transactions, invoice generation, sales tracking, customer orders'
  },
  '/purchases': {
    title: 'Purchase Management - Supplier Orders | Managify',
    description: 'Manage supplier orders, track purchase history, and control procurement processes for your business.',
    keywords: 'purchase management, supplier orders, procurement, purchase tracking, vendor management'
  },
  '/billing': {
    title: 'Billing & Invoicing - POS Billing System',
    description: 'Generate professional invoices, manage billing processes, and handle payment tracking for your store.',
    keywords: 'billing system, invoice generator, POS billing, payment tracking, receipt printing'
  },
  '/profit-loss': {
    title: 'Profit & Loss Reports - Business Analytics',
    description: 'Comprehensive profit and loss analysis with detailed financial reporting for business performance tracking.',
    keywords: 'profit loss report, financial analytics, business reports, revenue analysis, expense tracking'
  },
  '/daily-sales': {
    title: 'Daily Sales Reports - Sales Analytics',
    description: 'Daily sales reporting with detailed transaction analysis and performance metrics for your store.',
    keywords: 'daily sales report, sales analytics, transaction reports, daily revenue, sales performance'
  },
  '/employees': {
    title: 'Employee Management - Staff Administration',
    description: 'Manage staff information, roles, and permissions for your store management system.',
    keywords: 'employee management, staff administration, user roles, team management, staff tracking'
  },
  '/suppliers': {
    title: 'Supplier Management - Vendor Relations',
    description: 'Manage supplier information, contact details, and vendor relationships for efficient procurement.',
    keywords: 'supplier management, vendor management, supplier database, vendor relations, procurement contacts'
  },
  '/expenses': {
    title: 'Expense Management - Business Expenses',
    description: 'Track and manage business expenses, categorize costs, and monitor spending for better financial control.',
    keywords: 'expense management, business expenses, cost tracking, expense categories, financial management'
  }
};

export function SEO({ title, description, keywords }: SEOProps) {
  const location = useLocation();
  
  useEffect(() => {
    const pageInfo = pageData[location.pathname] || {};
    const finalTitle = title || pageInfo.title || 'Managify - Store Management System & POS Solution';
    const finalDescription = description || pageInfo.description || 'Complete store management system with inventory, sales, billing, and analytics.';
    const finalKeywords = keywords || pageInfo.keywords || 'store management, POS system, inventory management';
    
    document.title = finalTitle;
    
    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', finalDescription);
    }
    
    // Update meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', finalKeywords);
    }
    
    // Update Open Graph title
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', finalTitle);
    }
    
    // Update Open Graph description
    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', finalDescription);
    }
  }, [location.pathname, title, description, keywords]);
  
  return null;
}