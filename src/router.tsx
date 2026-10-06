import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { BranchProvider } from './auth/BranchContext';
import { supabase } from './supabase';
import App from './ui/App';

const Login = lazy(() => import('./pages/Login'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const FounderPage = lazy(() => import('./pages/FounderPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const ItemsPage = lazy(() => import('./pages/ItemsPage'));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const ProfitLossPage = lazy(() => import('./pages/ProfitLossPage'));
const DailySalesPage = lazy(() => import('./pages/DailySalesPage'));
const ScanPage = lazy(() => import('./pages/ScanPage'));
const CreditsPage = lazy(() => import('./pages/CreditsPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AssetsPage = lazy(() => import('./pages/AssetsPage'));
const BranchesPage = lazy(() => import('./pages/BranchesPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const TaxesPage = lazy(() => import('./pages/TaxesPage'));
const CheckoutTestPage = lazy(() => import('./pages/CheckoutTestPage'));

function RouteFallback() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--text-muted)' }}>Loading…</div>;
}

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

  return <BranchProvider>{children}</BranchProvider>;
}

export function AppRouter() {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/founder" element={<FounderPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          <Route path="/register" element={<RegisterPage />} />
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
            <Route path="branches" element={<BranchesPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="taxes" element={<TaxesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="checkout-test" element={<CheckoutTestPage />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
