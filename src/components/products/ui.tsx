import React, { useState, useRef, useEffect } from "react";

export const Badge = ({ variant = "default", children, className = "" }: any) => {
  const variants: Record<string, string> = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    danger: "bg-red-50 text-red-700 ring-1 ring-red-200",
    info: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    schedule: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    otc: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export const Spinner = ({ size = "sm" }: { size?: "sm" | "lg" }) => (
  <div className={`animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 ${size === "sm" ? "w-4 h-4" : "w-8 h-8"}`} />
);

export const Tooltip = ({ children, label }: { children: React.ReactNode; label: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-[11px] rounded-md whitespace-nowrap z-50 pointer-events-none">
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
};

export const Select = ({ value, onChange, options, placeholder }: any) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o: any) => o.value === value);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
      >
        <span className={selected ? "text-slate-800" : "text-slate-400"}>{selected?.label || placeholder}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {options.map((opt: any) => (
            <li
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${opt.value === value ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const Input = ({ label, required, prefix, ...props }: any) => (
  <div>
    {label && (
      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide text-left">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
    )}
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">{prefix}</span>}
      <input
        {...props}
        onWheel={(e) => { if (props.type === "number") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
        className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all hover:border-slate-300 ${prefix ? "pl-7" : ""} ${props.className || ""} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        style={props.type === "number" ? { MozAppearance: "textfield" } : undefined}
      />
    </div>
  </div>
);

export const Toggle = ({ checked, onChange, label }: any) => (
  <div className="flex items-center gap-3">
    {label && <span className="text-sm text-slate-600">{label}</span>}
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-blue-500" : "bg-slate-200"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4.5" : "translate-x-0.5"}`}
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  </div>
);

export const Dropdown = ({ label, options, value, onChange, placeholder }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; placeholder?: string }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex h-10 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          <span className={selected ? "text-slate-800" : "text-slate-400"}>{selected?.label || placeholder || "Select\u2026"}</span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {options.map((opt) => (
              <li
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${opt.value === value ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
