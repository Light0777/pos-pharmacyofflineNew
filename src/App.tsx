import { Routes, Route, Navigate } from "react-router-dom";

import POS from "./pages/pos/POSPage";
import LoginPage from "./pages/LoginPage";

import AdminLayout from "./layout/AdminLayout";

import Dashboard from "./pages/admin/Dashboard";
import Products from "./pages/admin/Products";
import Sales from "./pages/admin/Sales";
import Stock from "./pages/admin/Stock";
import Reports from "./pages/admin/Reports";
import Staff from "./pages/admin/Staff";
import Settings from "./pages/admin/Settings";

import SupplierPage from "./pages/admin/Supplier";
import SupplierDetail from "./pages/admin/SupplierDetail";
import PurchaseHistory from "./pages/admin/PurchaseHistory";
import CustomerPage from "./pages/admin/Customer";
import GSTReport from "./pages/admin/GSTReport";
import H1Register from "./pages/admin/H1Register";
import AuditLogs from "./pages/admin/AuditLogs";
import StockAdjustments from "./pages/admin/StockAdjustments";
import ExpiredMedicines from "./pages/admin/ExpiredMedicines";
import RequireRole from "./components/RequireRole";

import AuthGate from "./context/AuthGate";
import SignupPage from "./pages/SignUpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ProtectedRoute from "./context/ProtectedRoute";
import UpdateBanner from "./components/UpdateBanner";

export default function App() {
  return (
    <>
      <UpdateBanner />
      <Routes>
      {/* LOGIN */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* ROOT */}
      <Route
        path="/"
        element={
          <AuthGate>
            <Navigate to="/pos" />
          </AuthGate>
        }
      />

      {/* POS */}
      <Route
        path="/pos"
        element={
          <AuthGate>
            <POS />
          </AuthGate>
        }
      />

      {/* ADMIN */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin", "manager"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="sales" element={<Sales />} />
        <Route path="customer" element={<CustomerPage />} />
        <Route path="stock" element={<Stock />} />
        <Route path="reports" element={<Reports />} />
        <Route path="supplier" element={<SupplierPage />} />
        <Route path="supplier/:supplier_uuid" element={<SupplierDetail />} />
        <Route path="purchase" element={<Navigate to="/admin/purchases" replace />} />
        <Route path="purchases" element={<PurchaseHistory />} />
        <Route path="staff" element={<Staff />} />
        <Route path="settings" element={<Settings />} />
        <Route path="daily-report" element={<Navigate to="/admin/gst-report" replace />} />
        <Route path="gst-report" element={<GSTReport />} />
        <Route path="h1-register" element={<RequireRole roles={["admin", "manager"]}><H1Register /></RequireRole>} />
        <Route path="audit-logs" element={<RequireRole roles={["admin", "manager"]}><AuditLogs /></RequireRole>} />
        <Route path="stock-adjustments" element={<StockAdjustments />} />
        <Route path="expired-medicines" element={<ExpiredMedicines />} />
      </Route>

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
    </>
  );
}