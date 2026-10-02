import type { ReactNode, ButtonHTMLAttributes } from "react";

// ─── Shared POS presentation primitives (theme spec) ─────────────────────────
// Page bg #F6F8FB · cards white/12px radius/#E5E9F0 border · primary #16A34A.
// These carry zero business logic — pure styling + labels.

// ─── Shared invoice-grid column definition (single source of truth) ─────────
// Used for BOTH the header row and every body row so labels sit exactly
// above their cells. Order:
// # | Product Name | UOM | Qty | Free | Batch | Expiry | Price | Rate |
// GST% | GST Amt | Value | Action.
export const INVOICE_GRID_COLUMNS =
  "48px minmax(240px,2.4fr) 80px 80px 80px 1.1fr 1.1fr 100px 100px 90px 110px 120px 64px";

export const POS_GREEN = "#16A34A";
export const POS_GREEN_HOVER = "#15803D";
export const POS_GREEN_DISABLED = "#86D6A4";
export const POS_INK = "#1E293B";
export const POS_MUTED = "#64748B";
export const POS_CARD_BORDER = "#E5E9F0";
export const POS_INPUT_BORDER = "#D5DBE5";

export const posCardClass =
  "bg-white rounded-xl border border-[#E5E9F0] shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

export const posInputClass =
  "bg-white border border-[#D5DBE5] rounded-lg h-10 px-3 text-sm text-[#1E293B] " +
  "placeholder:text-[#64748B] outline-none " +
  "focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/30 " +
  "disabled:bg-[#EEF1F5] disabled:text-[#64748B] disabled:cursor-not-allowed";

export const posLabelClass =
  "block text-[13px] font-medium text-[#64748B] mb-1";

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`${posCardClass} ${className}`}>{children}</div>;
}

// Small pill badge shown inside/next to shortcut buttons:
// 11px monospace, 1px border, 4px radius. The onGreen tone keeps the pill
// readable on solid-green buttons (semi-transparent white).
export function ShortcutBadge({
  label,
  tone = "gray",
}: {
  label: string;
  tone?: "gray" | "onGreen";
}) {
  if (tone === "onGreen") {
    return (
      <kbd className="px-1 py-px text-[11px] font-mono whitespace-nowrap leading-none rounded text-white bg-[rgba(255,255,255,0.2)] border border-[rgba(255,255,255,0.4)]">
        {label}
      </kbd>
    );
  }
  return (
    <kbd className="px-1 py-px text-[11px] font-mono text-gray-500 border border-gray-300 rounded whitespace-nowrap leading-none">
      {label}
    </kbd>
  );
}

interface PaymentButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  shortcut: string;
  active: boolean;
}

// 2×2 payment grid button: 44px tall, 8px radius, icon + label + pill.
// Active = solid green gradient w/ white text; inactive = #F1F5F9 w/ dark text.
export function PaymentButton({
  icon,
  label,
  shortcut,
  active,
  className = "",
  ...rest
}: PaymentButtonProps) {
  return (
    <button
      type="button"
      title={`Shortcut: ${shortcut}`}
      className={`h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-gradient-to-b from-[#16A34A] to-[#15803D] text-white shadow-sm"
          : "bg-[#F1F5F9] text-[#1E293B] hover:bg-[#E5E9F0]"
      } ${className}`}
      {...rest}
    >
      <span className="flex items-center [&>svg]:w-[18px] [&>svg]:h-[18px]">
        {icon}
      </span>
      <span>{label}</span>
      <ShortcutBadge label={shortcut} tone={active ? "onGreen" : "gray"} />
    </button>
  );
}
