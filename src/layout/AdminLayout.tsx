import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import Topbar from "../components/Topbar";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  Analytics01Icon,
  ClipboardCheckIcon,
  AddTeamIcon,
  ReceiptIndianRupeeIcon,
  AccountSetting02Icon,
  StickyNote02Icon,
  PackageIcon,
  AppleStocksIcon,
  RupeeSquareIcon,
  UserGroupIcon,
  Settings01Icon,
  CheckmarkCircle01Icon,
  Logout01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";

// ============================================
// NAVIGATION ITEM COMPONENT
// ============================================
interface NavItemProps {
  label: string;
  path: string;
  currentPath: string;
  icon?: string;
  onClick: () => void;
  collapsed?: boolean;
  iconElement?: React.ReactNode;
  labelClassName?: string;
}

function NavItem({ label, path, currentPath, icon, onClick, collapsed, iconElement, labelClassName }: NavItemProps) {
  const active = currentPath === path;
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex items-center transition-all duration-200 ${
        collapsed
          ? "justify-center w-10 h-10 rounded-full mx-auto"
          : "w-full gap-3 px-3 py-2.5 rounded-xl"
      } ${
        active
          ? "bg-green-600 text-white shadow-lg shadow-green-600/30"
          : "text-gray-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {iconElement}
      {!collapsed && <span className={`text-sm font-medium ${labelClassName || ""}`}>{label}</span>}
      {!collapsed && active && <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-white text-sm ml-auto shrink-0" />}
    </button>
  );
}

// ============================================
// NAVIGATION SECTION COMPONENT
// ============================================
interface NavSectionProps {
  title: string;
  children: React.ReactNode;
  collapsed?: boolean;
}

function NavSection({ title, children, collapsed }: NavSectionProps) {
  return (
    <div className={collapsed ? "space-y-1" : "space-y-1"}>
      {!collapsed && (
        <div className="px-3 pt-2 pb-1 text-xs font-semibold text-green-400/70 uppercase tracking-wider truncate">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ============================================
// SIDEBAR CONTENT COMPONENT
// ============================================
interface SidebarContentProps {
  user: any;
  currentPath: string;
  navigate: (path: string) => void;
  t: (key: string) => string;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

function SidebarContent({ user, currentPath, navigate, t, onMobileClose, collapsed, onToggle }: SidebarContentProps) {
  const handleNavigate = (path: string) => {
    navigate(path);
    onMobileClose?.();
  };

  return (
    <div className="flex flex-col h-full text-start">
      {/* Sidebar Header */}
      {!collapsed ? (
        <div           className="flex items-center justify-between p-4 pb-1 transition-all duration-300">
          <div className="text-start">
            <div className="text-lg font-bold text-white tracking-tight">
              {t('adminLayout.adminPanel')}
            </div>
            <div className="text-xs text-white/60 capitalize mt-0.5">
              {t(`adminLayout.roles.${user.role}`)}
            </div>
          </div>
          <button
            onClick={onToggle}
            className="w-10 h-10 rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-center"
            title="Collapse sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
          </button>
        </div>
      ) : (
        <div className="flex justify-center pt-3 px-3 pb-1">
          <button
            onClick={onToggle}
            className="w-10 h-10 rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-center"
            title="Expand sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto overflow-x-hidden pt-2 px-3 pb-2 space-y-2" style={{ marginRight: '-17px', paddingRight: 'calc(0.75rem + 17px)' }}>
        {user.role === "owner" && (
          <NavItem
            label={t('adminLayout.nav.dashboard')}
            path="/admin/dashboard"
            currentPath={currentPath}
            iconElement={<HugeiconsIcon icon={Home01Icon} className="text-xl shrink-0" />}
            onClick={() => handleNavigate("/admin/dashboard")}
            collapsed={collapsed}
          />
        )}

        {user.role === "owner" && (
          <NavSection title={t('adminLayout.sections.business')} collapsed={collapsed}>
            <NavItem
              label={t('adminLayout.nav.reports')}
              path="/admin/reports"
              currentPath={currentPath}
              iconElement={<HugeiconsIcon icon={Analytics01Icon} className="text-xl shrink-0" />}
              onClick={() => handleNavigate("/admin/reports")}
              collapsed={collapsed}
            />
            <NavItem
              label={t('adminLayout.nav.gstReport')}
              path="/admin/gst-report"
              currentPath={currentPath}
              iconElement={<HugeiconsIcon icon={ClipboardCheckIcon} className="text-xl shrink-0" />}
              onClick={() => handleNavigate("/admin/gst-report")}
              collapsed={collapsed}
            />
            <NavItem
              label={t('adminLayout.nav.supplier')}
              path="/admin/supplier"
              currentPath={currentPath}
              iconElement={<HugeiconsIcon icon={AddTeamIcon} className="text-xl shrink-0" />}
              onClick={() => handleNavigate("/admin/supplier")}
              collapsed={collapsed}
            />
            <NavItem
              label={t('adminLayout.nav.purchases')}
              path="/admin/purchases"
              currentPath={currentPath}
              iconElement={<HugeiconsIcon icon={ReceiptIndianRupeeIcon} className="text-xl shrink-0" />}
              onClick={() => handleNavigate("/admin/purchases")}
              collapsed={collapsed}
            />
            <NavItem
              label={t('adminLayout.nav.staff')}
              path="/admin/staff"
              currentPath={currentPath}
              iconElement={<HugeiconsIcon icon={AccountSetting02Icon} className="text-xl shrink-0" />}
              onClick={() => handleNavigate("/admin/staff")}
              collapsed={collapsed}
            />
            <NavItem
              label={t('adminLayout.nav.h1Register')}
              path="/admin/h1-register"
              currentPath={currentPath}
              iconElement={<HugeiconsIcon icon={StickyNote02Icon} className="text-xl shrink-0" />}
              onClick={() => handleNavigate("/admin/h1-register")}
              collapsed={collapsed}
              labelClassName="text-xs"
            />
          </NavSection>
        )}

        {["owner", "manager", "admin"].includes(user.role) && (
          <NavSection title={t('adminLayout.sections.management')} collapsed={collapsed}>
            <NavItem
              label={t('adminLayout.nav.products')}
              path="/admin/products"
              currentPath={currentPath}
              iconElement={<HugeiconsIcon icon={PackageIcon} className="text-xl shrink-0" />}
              onClick={() => handleNavigate("/admin/products")}
              collapsed={collapsed}
            />
            <NavItem
              label={t('adminLayout.nav.stock')}
              path="/admin/stock"
              currentPath={currentPath}
              iconElement={<HugeiconsIcon icon={AppleStocksIcon} className="text-xl shrink-0" />}
              onClick={() => handleNavigate("/admin/stock")}
              collapsed={collapsed}
            />
            <NavItem
              label={t('adminLayout.nav.sales')}
              path="/admin/sales"
              currentPath={currentPath}
              iconElement={<HugeiconsIcon icon={RupeeSquareIcon} className="text-xl shrink-0" />}
              onClick={() => handleNavigate("/admin/sales")}
              collapsed={collapsed}
            />
            <NavItem
              label={t('adminLayout.nav.customer')}
              path="/admin/customer"
              currentPath={currentPath}
              iconElement={<HugeiconsIcon icon={UserGroupIcon} className="text-xl shrink-0" />}
              onClick={() => handleNavigate("/admin/customer")}
              collapsed={collapsed}
            />
          </NavSection>
        )}

        <NavItem
          label={t('adminLayout.nav.settings')}
          path="/admin/settings"
          currentPath={currentPath}
          iconElement={<HugeiconsIcon icon={Settings01Icon} className="text-xl shrink-0" />}
          onClick={() => handleNavigate("/admin/settings")}
          collapsed={collapsed}
        />
      </div>
      </div>

      {/* Sidebar Footer */}
      <div className={`p-3 border-t border-white/20 mt-auto ${collapsed ? "flex flex-col items-center gap-2" : ""}`}>
        {collapsed ? (
          <button
            onClick={() => navigate("/pos")}
            title={t('adminLayout.goToPos')}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold text-sm hover:from-green-400 hover:to-green-500 transition-all duration-200 cursor-pointer"
          >
            {user.name?.charAt(0).toUpperCase() || "U"}
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-white/60 capitalize">{user.role}</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/pos")}
              className="w-full bg-green-600 hover:bg-green-500 text-white p-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-green-600/30"
            >
              <HugeiconsIcon icon={Logout01Icon} className="text-lg" />
              <span>{t('adminLayout.goToPos')}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN ADMIN LAYOUT COMPONENT
// ============================================
export default function AdminLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("sidebarOpen");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const toggleSidebar = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    localStorage.setItem("sidebarOpen", JSON.stringify(next));
  };

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F8F8F8]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  const currentPath = location.pathname;

  return (
    <div className="h-screen flex bg-[#F8F8F8]">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col bg-black text-white shadow-xl m-2 lg:m-3 transition-all duration-500 overflow-x-hidden" style={{ width: sidebarOpen ? '14rem' : '4rem', borderRadius: sidebarOpen ? '1rem' : '2rem' }}>
          <SidebarContent user={user} currentPath={currentPath} navigate={navigate} t={t} collapsed={!sidebarOpen} onToggle={toggleSidebar} />
        </aside>

        {/* Mobile Sidebar (with slide animation) */}
        <div
          className={`fixed inset-0 z-50 transition-all duration-300 ${
            mobileMenuOpen ? "visible" : "invisible"
          }`}
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
              mobileMenuOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Sidebar panel */}
          <aside
            className={`absolute left-0 top-0 bottom-0 w-64 bg-black text-white shadow-2xl transition-transform duration-300 ease-out ${
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex justify-end p-2 border-b border-white/20">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/20"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl" />
              </button>
            </div>
            <SidebarContent
              user={user}
              currentPath={currentPath}
              navigate={navigate}
              t={t}
              onMobileClose={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>

        {/* Right Column: Topbar + Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />

          {/* Main Content */}
          <main className="flex-1 flex flex-col overflow-hidden bg-[#F8F8F8] shadow-inner">
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-slate-200 scrollbar-thumb-slate-300">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
  );
}