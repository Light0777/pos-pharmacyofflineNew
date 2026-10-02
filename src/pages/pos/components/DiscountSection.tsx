import { useEffect, useRef, useState } from 'react';

interface DiscountSectionProps {
  discount: number;
  subtotal: number;
  onApplyDiscount: (amount: number) => void;
}

// Discount accepts a flat ₹ amount ("50") or a percent ("10%").
// Either way a flat rupee amount flows into the existing applyDiscount API —
// GST/totals math downstream is untouched.
export function parseDiscountInput(raw: string, subtotal: number): number | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.endsWith('%')) {
    const pct = parseFloat(v.slice(0, -1));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
    return Math.round(((subtotal * pct) / 100) * 100) / 100;
  }
  const flat = parseFloat(v);
  if (!Number.isFinite(flat) || flat < 0) return null;
  return Math.round(flat * 100) / 100;
}

export default function DiscountSection({
  discount,
  subtotal,
  onApplyDiscount,
}: DiscountSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(discount ? String(discount) : '');

  // External workstation shortcut: F6 focuses this input.
  useEffect(() => {
    const onFocusDiscount = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("pos-focus-discount", onFocusDiscount);
    return () =>
      window.removeEventListener("pos-focus-discount", onFocusDiscount);
  }, []);

  // Stay in step when the bill discount is reset elsewhere (new bill, close).
  useEffect(() => {
    setText(discount ? String(discount) : '');
  }, [discount]);

  const apply = () => {
    const amount = parseDiscountInput(text, subtotal);
    if (amount === null) return;
    onApplyDiscount(amount);
  };

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter applies the discount via the existing handler.
          if (e.key === 'Enter') {
            e.preventDefault();
            apply();
          }
        }}
        placeholder="Apply Discount (₹ or %)"
        autoComplete="off"
        className="flex-1 min-w-0 bg-white border border-[#D5DBE5] rounded-lg h-10 px-3 text-sm text-[#1E293B] placeholder:text-[#64748B] outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/30"
      />
      <button
        className="w-[100px] h-10 shrink-0 bg-[#16A34A] hover:bg-[#15803D] transition-colors rounded-lg text-white text-sm font-bold"
        onClick={apply}
      >
        Apply
      </button>
    </div>
  );
}
