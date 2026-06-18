import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getAttributes, createAttribute, deleteAttribute } from "../../../renderer/services/categoryApi";

interface Attribute {
  attribute_uuid: string;
  name: string;
  display_name: string;
  data_type: string;
  created_at: string;
}

const DATA_TYPES = (t: any) => [
  { value: "text", label: t('productSetup.dataTypeText') },
  { value: "number", label: t('productSetup.dataTypeNumber') },
  { value: "boolean", label: t('productSetup.dataTypeBoolean') },
  { value: "select", label: t('productSetup.dataTypeSelect') },
  { value: "date", label: t('productSetup.dataTypeDate') },
];

const QUICK_FILLS = (t: any) => [
  { name: "Strength", display_name: t('productSetup.displayNamePlaceholder'), data_type: "text", label: "+ Strength" },
  { name: "Dosage Form", display_name: "Physical medicine form (Tablet/Syrup/Capsule)", data_type: "select", label: "Dosage Form" },
  { name: "Storage Condition", display_name: "Medicine storage requirement (e.g., 2-8°C)", data_type: "text", label: "Storage Cond." },
  { name: "Prescription Required", display_name: "Whether doctor prescription is required", data_type: "boolean", label: "Prescription Req." },
];

export default function AttributesTab() {
  const { t } = useTranslation();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dataType, setDataType] = useState("text");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataTypeOpen, setDataTypeOpen] = useState(false);
  const [dataTypeSearch, setDataTypeSearch] = useState("");
  const dtOptions = DATA_TYPES(t);
  const qfOptions = QUICK_FILLS(t);
  const dataTypeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dataTypeRef.current && !dataTypeRef.current.contains(e.target as Node)) setDataTypeOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const load = async () => {
    const data = await getAttributes();
    setAttributes(data);
  };

  useEffect(() => {
    load();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleCreate = async () => {
    setError(null);
    setSuccess(null);
    if (!name.trim()) { setError(t('productSetup.attributeNameRequired')); return; }
    if (!displayName.trim()) { setError(t('productSetup.displayNameRequired')); return; }
    setLoading(true);
    try {
      const result = await createAttribute({ name: name.trim(), display_name: displayName.trim(), data_type: dataType });
      if (!result || result.error || (result.success === false)) {
        setError(result?.error || t('productSetup.failedCreateAttribute'));
        return;
      }
      showSuccess(t('productSetup.attributeCreated', { name }));
      setName("");
      setDisplayName("");
      setDataType("text");
      await load();
    } catch (err) {
      setError(t('productSetup.failedCreateAttribute'));
    } finally {
      setLoading(false);
    }
  };

  const fillQuick = (q: typeof qfOptions[0]) => {
    setName(q.name);
    setDisplayName(q.display_name);
    setDataType(q.data_type);
  };

  return (
    <div className="attributes-grid" style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "1.8rem" }}>
      <div className="list-panel" style={{ background: "white", borderRadius: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        <div className="panel-header" style={{ padding: "1.2rem 1.5rem", background: "#fafcff", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>{t('productSetup.allAttributes')}</h2>
          <button onClick={load} title={t('productSetup.refresh')} style={{ background: "transparent", border: "none", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
        <div className="attributes-table-container" style={{ padding: "0.75rem" }}>
          {attributes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontSize: "0.9rem" }}>{t('productSetup.noAttributesYet')}</div>
          ) : (
            [...attributes].sort((a, b) => a.name.localeCompare(b.name)).map((attr) => (
              <div key={attr.attribute_uuid} className="attribute-card" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", margin: "6px 0", borderRadius: "999px", background: "#f8fafc", border: "1px solid #e2e8f0", transition: "background 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"} onMouseLeave={(e) => e.currentTarget.style.background = "#f8fafc"}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{attr.name}</span>
                <span style={{ fontSize: "0.65rem", fontWeight: 500, color: "#64748b", background: "#e2e8f0", padding: "1px 8px", borderRadius: "999px", whiteSpace: "nowrap" }}>{attr.data_type}</span>
                <button
                  onClick={async () => {
                    if (confirm(t('productSetup.deleteAttribute', { name: attr.name }))) {
                      await deleteAttribute(attr.attribute_uuid);
                      await load();
                      showSuccess(t('productSetup.attributeDeleted'));
                    }
                  }}
                  title={t('productSetup.deleteTitle')}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", borderRadius: "50%", color: "#94a3b8", transition: "color 0.15s,background 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.background = "#fef2f2"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "transparent"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="form-panel" style={{ background: "white", borderRadius: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)", padding: "1.5rem", height: "fit-content", position: "sticky", top: "1rem", alignSelf: "start" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>{t('productSetup.createNewAttribute')}</h3>
        <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0.25rem 0 1.25rem 0", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem" }}>{t('productSetup.createAttributeSubtitle')}</p>

        {error && <div style={{ marginBottom: "1rem", padding: "0.65rem 1rem", borderRadius: "999px", fontSize: "0.8rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>{error}</div>}
        {success && <div style={{ marginBottom: "1rem", padding: "0.65rem 1rem", borderRadius: "999px", fontSize: "0.8rem", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>{success}</div>}

        <div className="input-group" style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.35rem", textAlign: "left" }}>{t('productSetup.attributeName')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('productSetup.attributeNamePlaceholder')} style={{ width: "100%", padding: "0.6rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "999px", fontSize: "0.85rem", outline: "none", background: "#f8fafc", transition: "border-color 0.15s,box-shadow 0.15s" }} onFocus={(e) => { e.target.style.borderColor = "#22c55e"; e.target.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.15)"; }} onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }} />
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px", paddingLeft: "4px" }}>{t('productSetup.attributeNameHint')}</div>
        </div>
        <div className="input-group" style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.35rem", textAlign: "left" }}>{t('productSetup.displayName')}</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('productSetup.displayNamePlaceholder')} style={{ width: "100%", padding: "0.6rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "999px", fontSize: "0.85rem", outline: "none", background: "#f8fafc", transition: "border-color 0.15s,box-shadow 0.15s" }} onFocus={(e) => { e.target.style.borderColor = "#22c55e"; e.target.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.15)"; }} onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }} />
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px", paddingLeft: "4px" }}>{t('productSetup.displayNameHint')}</div>
        </div>
        <div className="input-group" style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.35rem", textAlign: "left" }}>{t('productSetup.dataType')}</label>
          <div ref={dataTypeRef} style={{ position: "relative" }}>
            <div onClick={() => setDataTypeOpen(!dataTypeOpen)} style={{ width: "100%", padding: "0.6rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "999px", fontSize: "0.85rem", outline: "none", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "border-color 0.15s,box-shadow 0.15s" }} tabIndex={0} onFocus={(e) => { e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.15)"; }} onBlur={(e) => { if (!dataTypeOpen) { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}}>
              <span style={{ color: "#1e293b", fontSize: "0.85rem" }}>{dtOptions.find((dt) => dt.value === dataType)?.label || t('productSetup.selectDataType')}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: dataTypeOpen ? "rotate(180deg)" : "none" }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            {dataTypeOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: "1rem", boxShadow: "0 4px 24px rgba(0,0,0,0.1)", zIndex: 50, overflow: "hidden" }}>
                <div style={{ padding: "0.5rem", borderBottom: "1px solid #f1f5f9" }}>
                  <input autoFocus value={dataTypeSearch} onChange={(e) => setDataTypeSearch(e.target.value)} placeholder={t('productSetup.searchDataTypes')} style={{ width: "100%", padding: "0.4rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "999px", fontSize: "0.78rem", outline: "none", background: "#f8fafc" }} />
                </div>
                <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                  {dtOptions.filter((dt) => !dataTypeSearch.trim() || dt.label.toLowerCase().includes(dataTypeSearch.toLowerCase())).length === 0 ? (
                    <div style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.78rem", color: "#94a3b8" }}>{t('productSetup.noMatchingDataTypes')}</div>
                  ) : (
                    dtOptions.filter((dt) => !dataTypeSearch.trim() || dt.label.toLowerCase().includes(dataTypeSearch.toLowerCase())).map((dt) => (
                      <div key={dt.value} onClick={() => { setDataType(dt.value); setDataTypeOpen(false); setDataTypeSearch(""); }} style={{ padding: "0.5rem 0.85rem", fontSize: "0.82rem", color: "#1e293b", cursor: "pointer", background: dataType === dt.value ? "#f0fdf4" : "transparent", transition: "background 0.1s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={(e) => { if (dataType !== dt.value) e.currentTarget.style.background = "transparent"; }}>
                        {dt.label}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px", paddingLeft: "4px" }}>{t('productSetup.dataTypeHint')}</div>
        </div>
        <button onClick={handleCreate} disabled={loading} style={{ background: "#16a34a", color: "white", border: "none", width: "100%", padding: "0.7rem", borderRadius: "999px", fontWeight: 600, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, boxShadow: "0 4px 14px rgba(22,163,74,0.25)", transition: "opacity 0.15s,transform 0.15s" }} onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = "scale(1.02)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
          {loading ? t('productSetup.creatingAttr') : t('productSetup.createAttribute')}
        </button>

        <hr style={{ margin: "1.25rem 0", border: "none", borderTop: "1px solid #f1f5f9" }} />
        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}><strong style={{ color: "#334155" }}>{t('productSetup.quickFill')}</strong> — {t('productSetup.quickFillSubtitle')}</div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {qfOptions.map((q) => (
            <button key={q.name} onClick={() => fillQuick(q)} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "999px", padding: "0.25rem 0.75rem", fontSize: "0.72rem", fontWeight: 500, cursor: "pointer", color: "#475569", transition: "background 0.15s,border-color 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.borderColor = "#cbd5e1"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
              {q.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: "0.5rem", lineHeight: "1.4" }}>
          <strong>{t('productSetup.examples')}</strong> {t('productSetup.examplesText')}
        </div>
      </div>
    </div>
  );
}
