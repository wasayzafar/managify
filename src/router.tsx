import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { supabase } from './supabase';
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
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [suspended, setSuspended] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user) { setChecking(false); return }
    supabase.from('user_registry').select('is_suspended').eq('uid', user.uid).single()
      .then(({ data }) => { setSuspended(!!data?.is_suspended) })
      .finally(() => setChecking(false))
  }, [user])

  if (loading || checking) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#6b7280',fontFamily:'system-ui',background:'#060a10' }}>Loading…</div>;
  if (!user) return <Navigate to="/welcome" />;
  if (suspended) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#060a10',color:'#e2e8f0',fontFamily:'system-ui',gap:16,textAlign:'center',padding:32 }}>
      <div style={{ fontSize:48 }}>🚫</div>
      <h2 style={{ margin:0,fontSize:24,fontWeight:700 }}>Account Suspended</h2>
      <p style={{ color:'#6b7280',margin:0 }}>Your account has been suspended. Contact support to appeal.</p>
      <a href="mailto:nativeedge.studio@gmail.com" style={{ color:'#4d8fff',fontSize:14 }}>nativeedge.studio@gmail.com</a>
      <button onClick={() => logout()} style={{ marginTop:8,padding:'8px 20px',background:'#1a2940',border:'1px solid #243245',borderRadius:8,color:'#e2e8f0',cursor:'pointer',fontFamily:'inherit' }}>Sign Out</button>
    </div>
  );

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
        <Route path="/admin" element={<AdminPage />} />
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