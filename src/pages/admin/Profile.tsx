import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getProfile, type UserProfile, type ShopProfile } from "../../renderer/services/profileApi";
import { useAuth } from "../../context/AuthContext";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  Key01Icon,
  Building01Icon,
  CreditCardIcon,
  Calendar01Icon,
  Alert01Icon,
  Time01Icon,
  CallIcon,
  Location01Icon,
  LockIcon,
  Logout01Icon,
  GlobeIcon,
  AlertCircleIcon,
  File01Icon,
  Medicine01Icon,
  CopyIcon,
  CheckIcon,
  Shield01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";

export default function Profile() {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<ShopProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [slogan, setSlogan] = useState(() => localStorage.getItem("shop_slogan") || "Keeping Your Pharmacy Running Smoothly.");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getProfile();
      const userData = response.data.user;
      const tenantData = response.data.tenant;
      setUser(userData);
      setTenant(tenantData);
    } catch (err) {
      console.error("Profile load error:", err);
      if (authUser) {
        setUser(authUser as UserProfile);
        setTenant({
          shop_name: "My Shop",
          invoice_prefix: "INV",
          is_active: true,
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
      } else {
        setError(t('profile.loadError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className=" rounded-3xl shadow-2xl w-full max-w-[480px] p-6 sm:p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <HugeiconsIcon icon={Alert01Icon} className="text-2xl text-red-500"  />
          </div>
          <p className="text-sm text-gray-600">{error}</p>
          <button
            onClick={loadProfile}
            className="mt-5 text-sm font-semibold text-white px-5 py-2.5 rounded-lg bg-black hover:bg-gray-800 transition-colors"
          >
            {t('profile.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isExpiringSoon = tenant?.expiry_date &&
    new Date(tenant.expiry_date) < new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const daysRemaining = tenant?.expiry_date
    ? Math.max(0, Math.ceil((new Date(tenant.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 365;

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: "bg-amber-50 text-amber-700 border-amber-200",
      manager: "bg-sky-50 text-sky-700 border-sky-200",
      cashier: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
    const roleKey = role === "admin" ? "admin" : role === "manager" ? "manager" : "cashier";
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[roleKey]}`}>
        {t(`profile.roles.${roleKey}`)}
      </span>
    );
  };

  return (
    <div className="h-[calc(95dvh-3rem)] p-6">
      <div className="h-full w-full">

        {/* ── BENTO GRID ── */}
        <div className="h-full grid grid-cols-[1.5fr_1fr_1fr] gap-3" style={{ gridTemplateRows: "3fr 2fr" }}>

          {/* ── LEFT BIG CARD: Shop Information ── */}
          <div
            className="bg-gray-100 rounded-2xl p-6 flex flex-col relative overflow-hidden"
            style={{ gridRow: "span 2" }}
          >
            <div className="flex items-start justify-between">
              <p className="text-gray-500 text-xs font-semibold tracking-[0.2em] uppercase">Shop</p>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <textarea
                value={slogan}
                onChange={(e) => { setSlogan(e.target.value); localStorage.setItem("shop_slogan", e.target.value); }}
                rows={3}
                className="w-full bg-transparent border-0 text-gray-700 text-5xl font-semibold italic text-center focus:outline-none focus:text-gray-900 placeholder-gray-300 leading-tight resize-none"
              />
            </div>

            <div className="mt-auto space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 bg-white/70 backdrop-blur-sm rounded-xl px-3.5 py-3 min-h-[140px] flex items-end">
                  <div className="flex flex-col gap-2 w-full">
                    <div className="text-left">
                      <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase">Name</p>
                      <p className="text-gray-900 text-base font-semibold mt-0.5">{tenant?.shop_name || "N/A"}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase">Prefix</p>
                      <p className="text-gray-900 text-base font-semibold mt-0.5">{tenant?.invoice_prefix || "INV"}</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-white/70 backdrop-blur-sm rounded-xl px-3.5 py-3 min-h-[140px] flex items-end">
                  <div className="flex flex-col gap-2 w-full">
                    <div className="text-left">
                      <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase">GST</p>
                      <p className="text-gray-900 text-base font-semibold mt-0.5">29ABCDE1234F1Z5</p>
                    </div>
                    <div className="text-left">
                      <p className="text-gray-400 text-xs font-semibold tracking-widest uppercase">License</p>
                      <p className="text-amber-700 text-base font-bold mt-0.5">DL-1234-5678-2025</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/70 backdrop-blur-sm rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Location01Icon} className="text-gray-400 text-sm shrink-0"  />
                  <p className="text-gray-600 text-sm truncate">123, Green Avenue, Pharma City, Tamil Nadu 600001</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-sm rounded-lg px-2.5 py-1">
                  <HugeiconsIcon icon={CallIcon} className="text-gray-400 text-xs"  />
                  <span className="text-gray-700 text-sm font-medium">+91 98765 43210</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-sm rounded-lg px-2.5 py-1">
                  <HugeiconsIcon icon={Mail01Icon} className="text-gray-400 text-xs"  />
                  <span className="text-gray-700 text-sm font-medium">contact@mypharma.com</span>
                </div>
              </div>
            </div>

            {/* Decorative dots */}
            <div className="absolute -right-6 -top-6 w-28 h-28 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full opacity-60" />
          </div>

          {/* ── RIGHT TOP CARD: Account Information ── */}
          <div
            className="bg-green-700 rounded-2xl p-7 flex flex-col justify-between relative overflow-hidden"
          >
            {/* Refresh button */}
            <div className="flex items-start justify-between z-10">
              <p className="text-green-300/70 text-xs font-semibold tracking-[0.2em] uppercase">Account</p>
              <button
                onClick={loadProfile}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition"
                title="Refresh"
              >
                <HugeiconsIcon icon={RefreshIcon} className="text-base"  />
              </button>
            </div>

            {/* Avatar + Name */}
            <div className="flex flex-col items-center z-10">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center relative shadow-lg ring-2 ring-white/20">
                <span className="text-3xl font-bold text-white select-none">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </span>
                <div className="absolute bottom-1 right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-md border-2 border-green-700 hover:bg-green-50 transition">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              <p className="text-white text-xl font-bold mt-3">{user?.name}</p>
              <p className="mt-1.5">{getRoleBadge(user?.role || "cashier")}</p>
            </div>

            {/* Email + User ID */}
            <div className="space-y-2 z-10">
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
                <HugeiconsIcon icon={Mail01Icon} className="text-green-400 text-sm shrink-0"  />
                <span className="text-white/90 text-sm truncate">{user?.email || "N/A"}</span>
              </div>
              {user?.user_uuid && (
                <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
                  <HugeiconsIcon icon={Key01Icon} className="text-green-400 text-sm shrink-0"  />
                  <span className="text-white/70 text-xs font-mono truncate flex-1">{user.user_uuid}</span>
                  <button
                    onClick={() => copyToClipboard(user.user_uuid!)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition"
                    title="Copy User ID"
                  >
                    <HugeiconsIcon icon={copied ? CheckIcon : CopyIcon} className={`text-xs ${copied ? "text-green-400" : "text-white/60"}`}  />
                  </button>
                </div>
              )}
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-2 z-10">
              <div className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-xl px-3 py-2">
                <p className="text-green-300/60 text-[10px] font-semibold tracking-widest uppercase">Created</p>
                <p className="text-white/80 text-sm font-medium mt-0.5">01 Jan 2025</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-xl px-3 py-2">
                <p className="text-green-300/60 text-[10px] font-semibold tracking-widest uppercase">Last Login</p>
                <p className="text-white/80 text-sm font-medium mt-0.5">07 Jun 2026</p>
              </div>
            </div>
          </div>

          {/* ── BOTTOM LEFT CARD: Preferences ── */}
          <div className="rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden" style={{ background: "#c084fc" }}>
            <div className="flex items-start justify-between">
              <p className="text-purple-900 text-xs font-bold tracking-[0.2em] uppercase leading-tight">Preferences</p>
              <button className="text-purple-900 hover:translate-x-0.5 hover:-translate-y-0.5 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10"/>
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-2 text-left">
              <div>
                <p className="text-purple-900/70 text-xs font-bold tracking-widest uppercase">Currency</p>
                <p className="text-purple-950 text-base font-bold mt-0.5">INR (₹)</p>
              </div>
              <div>
                <p className="text-purple-900/70 text-xs font-bold tracking-widest uppercase">Timezone</p>
                <p className="text-purple-950 text-base font-bold mt-0.5">Asia/Kolkata</p>
              </div>
              <div>
                <p className="text-purple-900/70 text-xs font-bold tracking-widest uppercase">Date Format</p>
                <p className="text-purple-950 text-base font-bold mt-0.5">DD/MM/YYYY</p>
              </div>
              <div>
                <p className="text-purple-900/70 text-xs font-bold tracking-widest uppercase">Low Stock</p>
                <p className="text-purple-950 text-base font-bold mt-0.5">{`< 10 units`}</p>
              </div>
            </div>
          </div>

          {/* ── BOTTOM RIGHT CARD: Security ── */}
          <div className="rounded-2xl p-5 flex flex-col relative overflow-hidden" style={{ background: "#b0f000", gridColumn: "span 2" }}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-lime-900 text-xs font-bold tracking-[0.2em] uppercase leading-tight">Security</p>
              <button className="text-lime-900 hover:translate-x-0.5 hover:-translate-y-0.5 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
                </svg>
              </button>
            </div>
            <div className="mt-auto">
              <div className="flex items-stretch gap-4 w-full h-full">
                <button className="flex-1 flex flex-col items-center h-40 justify-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-2 hover:bg-white transition shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-lime-100 flex items-center justify-center">
                    <HugeiconsIcon icon={LockIcon} className="text-lime-700 text-xl"  />
                  </div>
                  <span className="text-lime-950 text-sm font-semibold">Change Password</span>
                </button>
                <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white/40 backdrop-blur-sm rounded-xl p-2 opacity-60 cursor-not-allowed relative">
                  <div className="w-12 h-12 rounded-full bg-lime-100/50 flex items-center justify-center">
                    <HugeiconsIcon icon={Shield01Icon} className="text-lime-700 text-xl"  />
                  </div>
                  <span className="text-lime-950 text-sm font-semibold">Two-Factor Auth</span>
                  <span className="absolute -top-2 -right-2 text-[10px] font-bold text-white bg-lime-700 px-2 py-0.5 rounded-full shadow-sm">Soon</span>
                </div>
                <button className="flex-1 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-2 hover:bg-white transition shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-lime-100 flex items-center justify-center">
                    <HugeiconsIcon icon={Logout01Icon} className="text-lime-700 text-xl"  />
                  </div>
                  <span className="text-lime-950 text-sm font-semibold">Logout All</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
