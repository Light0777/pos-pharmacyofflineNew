import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageToggle from "../../components/LanguageToggle";
import {
  getSettings,
  saveSettings,
  createBackup,
  listBackups,
  restoreBackup,
  getLicenseStatus,
  activateLicense,
} from "../../renderer/services/settingsApi";
import { apiPut } from "../../renderer/services/api";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAuth } from "../../context/AuthContext";
import { getProfile, type UserProfile, type ShopProfile } from "../../renderer/services/profileApi";

const SECURITY_QUESTIONS = [
  "What is your pet's name?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite book?",
  "What is your favorite movie?",
  "What was the model of your first car?",
  "What is your favorite food?",
];
import {
  SaveIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  Building01Icon,
  CallIcon,
  Location01Icon,
  File01Icon,
  Tag01Icon,
  RefreshIcon,
  CloudUploadIcon,
  CloudDownloadIcon,
  Edit01Icon,
  Key01Icon,
  Shield01Icon,
  CancelCircleIcon,
  Mail01Icon,
  CopyIcon,
  CheckIcon,
  Calendar01Icon,
  Time01Icon,
  UserCircleIcon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";

const DEFAULT_SETTINGS = {
  shop_name: "",
  mobile: "",
  address: "",
  gstin: "",
  invoice_prefix: "INV",
  auto_print: 0,
  terms_conditions: "",
  privacy_policy: "",
};

const DEFAULT_TERMS = `Terms & Conditions

1. Acceptance of Terms
By using this software, you agree to be bound by these terms and conditions.

2. License
The software is licensed, not sold. You are granted a non-exclusive, non-transferable license to use the software.

3. Usage
You agree to use the software only for lawful purposes and in accordance with all applicable laws and regulations.

4. Data Privacy
You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.

5. Limitation of Liability
The software is provided "as is" without warranty of any kind. The developers shall not be liable for any damages arising from the use of this software.

6. Changes
We reserve the right to modify these terms at any time. Continued use of the software after changes constitutes acceptance of the new terms.`;

const DEFAULT_PRIVACY = `Privacy Policy

1. Information We Collect
We collect information you provide directly, including business name, address, contact details, and transaction data.

2. Use of Information
Your information is used to operate the software, process transactions, generate invoices, and comply with legal requirements.

3. Data Storage
Your data is stored locally on your device. We do not transmit your data to external servers unless required for license validation.

4. Data Security
We implement reasonable security measures to protect your data from unauthorized access or disclosure.

5. Your Rights
You have the right to access, update, and delete your data. Contact us for assistance with data requests.

6. Contact
For questions about this policy, please contact your software provider.`;

export default function Settings() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_SETTINGS);
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const { user: authUser, logout } = useAuth();
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showSecurityForm, setShowSecurityForm] = useState(false);
  const [secQuestion, setSecQuestion] = useState("");
  const [secAnswer, setSecAnswer] = useState("");
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const response = await getProfile();
      setProfileUser(response.data.user);
    } catch {
      if (authUser) {
        setProfileUser(authUser as UserProfile);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const extractCleanSettings = (obj: any) => {
    if (!obj) return null;
    let source = obj;
    if (obj.data && typeof obj.data === "object") source = obj.data;
    return {
      shop_name: source.shop_name || "",
      mobile: source.mobile || "",
      address: source.address || "",
      gstin: source.gstin || "",
      invoice_prefix: source.invoice_prefix || "INV",
      auto_print: source.auto_print ?? 0,
      terms_conditions: source.terms_conditions || "",
      privacy_policy: source.privacy_policy || "",
    };
  };

  // Load from localStorage first
  useEffect(() => {
    const cached = localStorage.getItem("shop_settings");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const clean = extractCleanSettings(parsed);
        if (clean) setData({ ...DEFAULT_SETTINGS, ...clean });
        else setData({ ...DEFAULT_SETTINGS });
      } catch (err) {
        setData({ ...DEFAULT_SETTINGS });
      }
    } else {
      setData({ ...DEFAULT_SETTINGS });
    }
    setLoading(false);
  }, []);

  const syncFromBackend = async () => {
    try {
      const res = await getSettings();
      const clean = extractCleanSettings(res);
      if (clean && (clean.shop_name || clean.mobile || clean.address)) {
        setData((prev: any) => ({ ...prev, ...clean }));
        localStorage.setItem("shop_settings", JSON.stringify(clean));
      }
    } catch (err) {
      console.error("Failed to sync from backend:", err);
    }
  };

  const loadLicenseStatus = async () => {
    try {
      const res = await getLicenseStatus();
      setLicenseStatus(res);
    } catch (err) {
      console.error("Failed to load license status:", err);
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError(t('settings.licenseKeyRequired'));
      return;
    }
    setActivating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await activateLicense(licenseKey.trim());
      if (res?.success) {
        setSuccess(t('settings.licenseActivated'));
        await loadLicenseStatus();
        setLicenseKey("");
      } else {
        setError(t('settings.licenseActivationFailed'));
      }
    } catch (err) {
      setError(t('settings.licenseActivationFailed'));
    } finally {
      setActivating(false);
    }
  };

  useEffect(() => {
    syncFromBackend();
    loadBackups();
    loadLicenseStatus();
  }, []);

  const loadBackups = async () => {
    try {
      const res = await listBackups();
      if (res?.data) setBackups(res.data);
    } catch (err) {
      console.error("Failed to load backups:", err);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      await createBackup();
      setSuccess(t("settings.backupSuccess"));
      await loadBackups();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(t("settings.backupError"));
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (backupName: string) => {
    if (!confirm(t("settings.restoreConfirm", { name: backupName }))) return;
    setBackupLoading(true);
    try {
      await restoreBackup(backupName);
      setSuccess(t("settings.restoreSuccess"));
      await syncFromBackend();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(t("settings.restoreError"));
    } finally {
      setBackupLoading(false);
    }
  };

  const openEditModal = () => {
    if (data) {
      setFormData({
        shop_name: data.shop_name || "",
        mobile: data.mobile || "",
        address: data.address || "",
        gstin: data.gstin || "",
        invoice_prefix: data.invoice_prefix || "INV",
        auto_print: data.auto_print ?? 0,
      });
      setDialogOpen(true);
    }
  };

  const handleSave = async () => {
    if (!formData.shop_name) {
      setError(t("settings.shopNameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveSettings(formData);
      const toStore = {
        shop_name: formData.shop_name,
        mobile: formData.mobile,
        address: formData.address,
        gstin: formData.gstin,
        invoice_prefix: formData.invoice_prefix,
        auto_print: formData.auto_print,
      };
      localStorage.setItem("shop_settings", JSON.stringify(toStore));
      setData((prev: any) => ({ ...prev, ...toStore }));
      setSuccess(t("settings.saveSuccess"));
      setTimeout(() => setSuccess(null), 3000);
      setDialogOpen(false);
    } catch (err) {
      console.error("Save error:", err);
      setError(t("settings.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    await syncFromBackend();
    await loadBackups();
  };

  if (loading && !data) {
    return (
      <div style={{ background: "#ffffff" }} className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2563eb]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ background: "#ffffff" }} className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-8 text-center max-w-md w-full">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <HugeiconsIcon icon={Alert01Icon} className="text-2xl text-red-400"  />
          </div>
          <p style={{ color: "#374151" }} className="text-sm">{t("settings.loadFailed")}</p>
          <button onClick={handleRefresh} className="mt-5 btn btn-primary">
            {t("settings.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f5f7fa", minHeight: "100vh" }}>

      <style>{`
        body {
          background-color: #f5f7fa;
          color: #374151;
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>

      {/* Success / Error Messages */}
      {(success || error) && (
        <div style={{ maxWidth: 760, margin: "18px auto 0", padding: "0 32px" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 16px", borderRadius: 10, fontSize: "0.85rem",
            background: success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${success ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
            color: success ? "#16a34a" : "#dc2626"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <HugeiconsIcon icon={success ? CheckmarkCircle01Icon : Alert01Icon} className="text-2xl"  />
              <span>{success || error}</span>
            </div>
            <button onClick={() => { setSuccess(null); setError(null); }} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", opacity: 0.6 }}>
              <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: "28px 32px 48px" }}>

        {/* Profile */}
        <div className="settings-section" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="section-header" style={{ padding: "16px 20px 15px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="section-icon green" style={{ width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
              <HugeiconsIcon icon={UserCircleIcon} className="text-xl"  />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>{t('settings.profile')}</div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 1 }}>{t('settings.yourAccountInfo')}</div>
            </div>
            <button onClick={loadProfile} className="edit-inline" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.8rem", fontWeight: 500, color: "#6b7280", cursor: "pointer", transition: "all 0.15s" }}>
              <HugeiconsIcon icon={RefreshIcon} className="text-base"  />
              {t('settings.refresh')}
            </button>
          </div>
          {profileLoading ? (
            <div className="setting-row" style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
            </div>
          ) : profileUser ? (
            <>
              <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                    {profileUser.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#111827" }}>{profileUser.name}</div>
                    <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{profileUser.email}</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border" style={{
                  background: profileUser.role === "owner" ? "#fffbeb" : profileUser.role === "manager" ? "#f0f9ff" : "#ecfdf5",
                  color: profileUser.role === "owner" ? "#b45309" : profileUser.role === "manager" ? "#0369a1" : "#047857",
                  borderColor: profileUser.role === "owner" ? "#fde68a" : profileUser.role === "manager" ? "#bae6fd" : "#a7f3d0",
                }}>
                  {t('profile.roles.' + (profileUser.role || 'user'))}
                </span>
              </div>
              {profileUser.user_uuid && (
                <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t('profile.userId')}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.85rem", color: "#6b7280", fontFamily: "monospace" }}>{profileUser.user_uuid}</span>
                    <button onClick={() => copyToClipboard(profileUser.user_uuid!)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition" title={t('settings.copyUserId')}>
                      <HugeiconsIcon icon={copied ? CheckIcon : CopyIcon} className={`text-sm ${copied ? "text-green-600" : "text-gray-400"}`}  />
                    </button>
                  </div>
                </div>
              )}
              <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t('settings.accountDates')}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: "0.85rem", color: "#6b7280" }}>
                  <span><HugeiconsIcon icon={Calendar01Icon} className="mr-1"  /> {t('settings.created')} 01 Jan 2025</span>
                  <span><HugeiconsIcon icon={Time01Icon} className="mr-1"  /> {t('settings.lastLogin')} 07 Jun 2026</span>
                </div>
              </div>

              {/* Security Question */}
              <div className="setting-row" style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e5e7eb" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>Security Question</div>
                  {profileUser.security_question ? (
                    <div style={{ fontSize: "0.85rem", color: "#16a34a", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                      {profileUser.security_question}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: 2, fontStyle: "italic" }}>
                      Not set — used to reset your password if you forget it
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!showSecurityForm) {
                      setSecQuestion(profileUser.security_question || "");
                      setSecAnswer("");
                    }
                    setShowSecurityForm(!showSecurityForm);
                  }}
                  className="edit-inline"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.8rem", fontWeight: 500, color: "#6b7280", cursor: "pointer", transition: "all 0.15s" }}
                >
                  <HugeiconsIcon icon={Edit01Icon} className="text-base"  />
                  {showSecurityForm ? "Cancel" : profileUser.security_question ? "Change" : "Set"}
                </button>
              </div>
              {showSecurityForm && (
                <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5" style={{ textAlign: "left" }}>Choose a question</label>
                      <div className="relative">
                        <select
                          value={secQuestion}
                          onChange={(e) => setSecQuestion(e.target.value)}
                          className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 text-sm text-slate-900 shadow-sm transition-all outline-none hover:border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                        >
                          <option value="" disabled>Select a security question</option>
                          {SECURITY_QUESTIONS.map((q) => (
                            <option key={q} value={q}>{q}</option>
                          ))}
                        </select>
                        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1" style={{ textAlign: "left" }}>Your answer</label>
                      <input
                        type="text"
                        value={secAnswer}
                        onChange={(e) => setSecAnswer(e.target.value)}
                        placeholder="Enter the answer"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!secQuestion || !secAnswer) return;
                        setSavingSecurity(true);
                        try {
                          await apiPut("/auth/security-question", { security_question: secQuestion, security_answer: secAnswer });
                          setProfileUser((prev) => prev ? { ...prev, security_question: secQuestion } : prev);
                          setSuccess("Security question saved successfully");
                          setShowSecurityForm(false);
                          setTimeout(() => setSuccess(null), 3000);
                        } catch (err: any) {
                          setError(err?.response?.data?.error || "Failed to save");
                          setTimeout(() => setError(null), 3000);
                        } finally {
                          setSavingSecurity(false);
                        }
                      }}
                      disabled={savingSecurity || !secQuestion || !secAnswer}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingSecurity ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="setting-row" style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "0.85rem" }}>
              {t('settings.couldNotLoadProfile')}
            </div>
          )}
        </div>

        {/* Preferences */}
        <div className="settings-section" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="section-header" style={{ padding: "16px 20px 15px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="section-icon blue" style={{ width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(37,99,235,0.1)", color: "#2563eb" }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>{t('settings.preferences')}</div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 1 }}>{t('settings.behaviourAutomation')}</div>
            </div>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t("settings.autoPrintBill")}</div>
              <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 2 }}>{t("settings.autoPrintDesc")}</div>
            </div>
            <label className="toggle" style={{ position: "relative", width: 40, height: 22, flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={data.auto_print === 1}
                onChange={(e) => {
                  const newAutoPrint = e.target.checked ? 1 : 0;
                  setData({ ...data, auto_print: newAutoPrint });
                  localStorage.setItem("shop_settings", JSON.stringify({ ...data, auto_print: newAutoPrint }));
                  saveSettings({ ...data, auto_print: newAutoPrint }).catch(console.error);
                }}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span className="toggle-slider" style={{ position: "absolute", inset: 0, background: data.auto_print === 1 ? "#16a34a" : "#e5e7eb", borderRadius: 22, cursor: "pointer", transition: "0.2s" }}>
                <span style={{ position: "absolute", width: 16, height: 16, left: 3, top: 3, background: "white", borderRadius: "50%", transition: "0.2s", transform: data.auto_print === 1 ? "translateX(18px)" : "none" }} />
              </span>
            </label>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t('settings.language')}</div>
              <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 2 }}>{t('settings.switchLanguage')}</div>
            </div>
            <LanguageToggle />
          </div>
        </div>

        {/* Business Information */}
        <div className="settings-section" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="section-header" style={{ padding: "16px 20px 15px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="section-icon purple" style={{ width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(139,92,246,0.1)", color: "#7c3aed" }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>{t("settings.businessInformation")}</div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 1 }}>{t('settings.storeContactInvoice')}</div>
            </div>
            <button onClick={openEditModal} className="edit-inline" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.8rem", fontWeight: 500, color: "#6b7280", cursor: "pointer", transition: "all 0.15s" }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              {t('settings.edit')}
            </button>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t("settings.businessName")}</span>
            <span style={{ fontSize: "0.85rem", color: "#6b7280", fontFamily: "inherit" }}>{data.shop_name || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>{t('settings.notSet')}</span>}</span>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t("settings.contactNumber")}</span>
            <span style={{ fontSize: "0.85rem", color: "#6b7280", fontFamily: "inherit" }}>{data.mobile || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>{t('settings.notSet')}</span>}</span>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t("settings.addressLabel")}</span>
            <span style={{ fontSize: "0.85rem", color: "#6b7280", fontFamily: "inherit" }}>{data.address || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>{t('settings.notSet')}</span>}</span>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t("settings.invoicePrefixLabel")}</div>
              <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 2 }}>{t('settings.prependedToAll')}</div>
            </div>
            <input
              className="setting-input"
              type="text"
              value={data.invoice_prefix || "INV"}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setData({ ...data, invoice_prefix: val });
                localStorage.setItem("shop_settings", JSON.stringify({ ...data, invoice_prefix: val }));
                saveSettings({ ...data, invoice_prefix: val }).catch(console.error);
              }}
              maxLength={6}
              style={{ background: "#f9fafb", border: "1px solid #d1d5db", borderRadius: 7, padding: "7px 11px", fontSize: "0.85rem", fontFamily: "inherit", color: "#111827", width: 120, outline: "none" }}
            />
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="settings-section" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="section-header" style={{ padding: "16px 20px 15px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="section-icon orange" style={{ width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(245,158,11,0.1)", color: "#d97706" }}>
              <HugeiconsIcon icon={File01Icon} className="text-xl" />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>Terms & Conditions</div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 1 }}>Legal agreement for using this software</div>
            </div>
            <button onClick={() => setShowTermsModal(true)} className="edit-inline" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600, color: "#d97706", cursor: "pointer", transition: "all 0.15s" }}>
              <HugeiconsIcon icon={File01Icon} className="text-xs" />
              View
            </button>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>Terms & Conditions</span>
            <span style={{ fontSize: "0.85rem", color: "#6b7280", fontFamily: "inherit" }}>{data.terms_conditions ? <span style={{ color: "#16a34a" }}>Customized</span> : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Default</span>}</span>
          </div>
        </div>

        {/* Privacy Policy */}
        <div className="settings-section" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="section-header" style={{ padding: "16px 20px 15px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="section-icon blue" style={{ width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(37,99,235,0.1)", color: "#2563eb" }}>
              <HugeiconsIcon icon={Shield01Icon} className="text-xl" />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>Privacy Policy</div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 1 }}>How your data is handled and protected</div>
            </div>
            <button onClick={() => setShowPrivacyModal(true)} className="edit-inline" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600, color: "#2563eb", cursor: "pointer", transition: "all 0.15s" }}>
              <HugeiconsIcon icon={Shield01Icon} className="text-xs" />
              View
            </button>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>Privacy Policy</span>
            <span style={{ fontSize: "0.85rem", color: "#6b7280", fontFamily: "inherit" }}>{data.privacy_policy ? <span style={{ color: "#16a34a" }}>Customized</span> : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Default</span>}</span>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="settings-section" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="section-header" style={{ padding: "16px 20px 15px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="section-icon yellow" style={{ width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(245,158,11,0.1)", color: "#d97706" }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>{t("settings.backupRestore")}</div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 1 }}>{t('settings.protectData')}</div>
            </div>
            <button onClick={handleBackup} disabled={backupLoading} className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 600, cursor: backupLoading ? "not-allowed" : "pointer", transition: "all 0.15s", border: "none", outline: "none", background: "transparent", color: "#2563eb", border: "1px solid rgba(37,99,235,0.25)", opacity: backupLoading ? 0.5 : 1 }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            {backupLoading ? t("settings.creatingBackup") : t("settings.backupNow")}
          </button>
          </div>
          {backups.length === 0 ? (
            <div className="backup-empty" style={{ padding: "26px 20px", textAlign: "center", color: "#9ca3af", fontSize: "0.85rem" }}>
              <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 9px", opacity: 0.28, display: "block" }}>
                <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
              </svg>
              {t("settings.noBackups")}
            </div>
          ) : (
            <div style={{ maxHeight: 250, overflowY: "auto" }}>
              {backups.map((backup, index) => (
                <div key={index} className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
                  <div>
                    <p style={{ fontSize: "0.9rem", fontFamily: "inherit", color: "#374151" }}>{backup.name}</p>
                    <p style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 2 }}>
                      {new Date(backup.date).toLocaleString("en-IN")} · {(backup.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(backup.name)}
                    disabled={backupLoading}
                    className="edit-inline"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.8rem", fontWeight: 500, color: "#dc2626", cursor: backupLoading ? "not-allowed" : "pointer", transition: "all 0.15s", opacity: backupLoading ? 0.5 : 1 }}
                  >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                    </svg>
                    {t("settings.restore")}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="info-note" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.12)", borderRadius: 8, padding: "10px 13px", fontSize: "0.8rem", color: "#6b7280", margin: "0 20px 18px", textAlign: "center" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 0, color: "#2563eb" }}>
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span style={{ textAlign: "center" }}>{t("settings.autoBackupNote")} <code style={{ fontFamily: "inherit", color: "#2563eb", fontSize: "0.75rem", background: "rgba(37,99,235,0.08)", padding: "1px 5px", borderRadius: 3 }}>%APPDATA%\pos-app\backups\</code> {t("settings.onWindows")}</span>
          </div>
        </div>

        {/* License Management */}
        <div className="settings-section" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="section-header" style={{ padding: "16px 20px 15px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="section-icon green" style={{ width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>{t('settings.licenseManagement')}</div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 1 }}>{t('settings.softwareActivation')}</div>
            </div>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t('settings.status')}</div>
              <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 2 }}>{t('settings.activationState')}</div>
            </div>
            <span className="badge badge-green" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 600, background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: "#16a34a", boxShadow: "0 0 5px #16a34a" }} />
              {licenseStatus?.licensed ? t('settings.licensed') : t('settings.notLicensed')}
            </span>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t('settings.activateLicense')}</div>
              <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 3 }}>
                {licenseStatus?.licensed ? t('settings.alreadyActivated') : t('settings.enterLicenseKey')}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="setting-input"
                type="text"
                placeholder={t('settings.licenseKeyPlaceholder')}
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                disabled={licenseStatus?.licensed}
                style={{ background: "#f9fafb", border: "1px solid #d1d5db", borderRadius: 7, padding: "7px 11px", fontSize: "0.85rem", fontFamily: "inherit", color: "#111827", width: 140, outline: "none", opacity: licenseStatus?.licensed ? 0.38 : 1 }}
              />
              <button
                onClick={handleActivate}
                disabled={activating || licenseStatus?.licensed}
                className="btn btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 600, cursor: (activating || licenseStatus?.licensed) ? "not-allowed" : "pointer", transition: "all 0.15s", border: "none", outline: "none", background: licenseStatus?.licensed ? "#d1d5db" : "#2563eb", color: licenseStatus?.licensed ? "#6b7280" : "#fff", opacity: (activating || licenseStatus?.licensed) ? 0.5 : 1 }}
              >
                {activating ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" style={{ display: "inline-block" }} />
                ) : (
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                  </svg>
                )}
{t('settings.activate')}
              </button>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="settings-section" style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="section-header" style={{ padding: "16px 20px 15px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="section-icon" style={{ width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
              <HugeiconsIcon icon={Logout01Icon} className="text-xl"  />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>{t('settings.logout')}</div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 1 }}>{t('settings.signOut')}</div>
            </div>
          </div>
          <div className="setting-row" style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#374151" }}>{t('settings.logoutConfirm')}</span>
            <button
              onClick={logout}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 600, color: "#fff", background: "#dc2626", border: "none", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#b91c1c"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#dc2626"; }}
            >
              <HugeiconsIcon icon={Logout01Icon} className="text-base"  />
{t('settings.logout')}
            </button>
          </div>
        </div>

      </div>

      {/* Custom Edit Modal */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{t("settings.editSettings")}</h2>
              <button onClick={() => setDialogOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t("settings.shopName")} *
                </label>
                <input
                  placeholder={t("settings.shopNamePlaceholder")}
                  value={formData.shop_name || ""}
                  onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t("settings.mobileNumber")}
                </label>
                <input
                  placeholder={t('settings.mobilePlaceholder')}
                  value={formData.mobile || ""}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t("settings.address")}
                </label>
                <textarea
                  rows={3}
                  placeholder={t("settings.addressPlaceholder")}
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t("settings.gstinNumber")}
                </label>
                <input
                  placeholder={t('settings.gstinPlaceholder')}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none uppercase"
                  value={formData.gstin || ""}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t("settings.invoicePrefix")}
                </label>
                <input
                  placeholder={t('settings.invPrefixPlaceholder')}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none uppercase"
                  value={formData.invoice_prefix || "INV"}
                  onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value.toUpperCase() })}
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  {t("settings.exampleInvoice")} {formData.invoice_prefix || "INV"}-0001
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-white">
              <button onClick={() => setDialogOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">
                {t("common.cancel")}
              </button>
              <button onClick={handleSave} disabled={saving} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all ${saving ? 'bg-green-500/50 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 cursor-pointer'}`}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    {t("settings.saving")}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon icon={SaveIcon} className="text-2xl"  />
                    {t('settings.saveChanges')}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <HugeiconsIcon icon={File01Icon} className="text-xl text-amber-600" />
                Terms & Conditions
              </h2>
              <button onClick={() => setShowTermsModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[55vh]" style={{ textAlign: "left" }}>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.85rem", color: "#374151", lineHeight: 1.7, margin: 0 }}>
                {data.terms_conditions || DEFAULT_TERMS}
              </pre>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-white">
              <button onClick={() => setShowTermsModal(false)} className="px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
                Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <HugeiconsIcon icon={Shield01Icon} className="text-xl text-blue-600" />
                Privacy Policy
              </h2>
              <button onClick={() => setShowPrivacyModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[55vh]" style={{ textAlign: "left" }}>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.85rem", color: "#374151", lineHeight: 1.7, margin: 0 }}>
                {data.privacy_policy || DEFAULT_PRIVACY}
              </pre>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-white">
              <button onClick={() => setShowPrivacyModal(false)} className="px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
                Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
