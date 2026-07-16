import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import ContactPage from './pages/ContactPage';
import FounderPage from './pages/FounderPage';
import App from './ui/App';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import ItemsPage from './pages/ItemsPage';
import PurchasesPage from './pages/PurchasesPage';
import SalesPage from './pages/SalesPage';
import BillingPage from './pages/BillingPage';
import ProfitLossPage from './pages/ProfitLossPage';
import DailySalesPage from './pages/DailySalesPage';
import ScanPage from './pages/ScanPage';
import CreditsPage from './pages/CreditsPage';
import EmployeesPage from './pages/EmployeesPage';
import ExpensesPage from './pages/ExpensesPage';
import SuppliersPage from './pages/SuppliersPage';
import SettingsPage from './pages/SettingsPage'
import AssetsPage from './pages/AssetsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/welcome" />;
  
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/founder" element={<FounderPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Navigate to="/contact" />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="items" element={<ItemsPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="profit-loss" element={<ProfitLossPage />} />
          <Route path="daily-sales" element={<DailySalesPage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}