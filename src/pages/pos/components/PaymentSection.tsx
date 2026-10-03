import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, Smartphone, CalendarDays, CreditCard } from "lucide-react";
import { PaymentButton } from "./posUi";

interface PaymentSectionProps {
  payments: Array<{ method: string; amount: number }>;
  onPaymentChange: (index: number, field: string, value: any) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  totalPaid: number;
  balance: number;
  grandTotal?: number;
}

export default function PaymentSection({
  payments,
  onPaymentChange,
  onAddRow,
  onRemoveRow,
  totalPaid,
  balance,
  grandTotal = 0,
}: PaymentSectionProps) {
  const { t } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState<string>("cash");
  const [amountGiven, setAmountGiven] = useState<number>(0);
  const [hasManualInput, setHasManualInput] = useState(false);
  const cashInputRef = useRef<HTMLInputElement>(null);
  // Same staleness guard as ProductGrid: the pos-select-payment listener is
  // registered once, so it must read the latest total + handler via ref.
  const liveRef = useRef({ grandTotal, onPaymentChange });
  liveRef.current = { grandTotal, onPaymentChange };

  // External workstation shortcuts (central usePosShortcuts dispatcher):
  // F7/F8/F9 + Ctrl+C/U/P/D select the payment method, F10 focuses cash input.
  useEffect(() => {
    const onSelectPayment = (e: Event) => {
      const method = (e as CustomEvent).detail;
      if (method === "cash" || method === "upi" || method === "pay_later" || method === "card") {
        handleMethodSelect(method);
      }
    };
    const onFocusCash = () => {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    };
    window.addEventListener("pos-select-payment", onSelectPayment);
    window.addEventListener("pos-focus-cash", onFocusCash);
    return () => {
      window.removeEventListener("pos-select-payment", onSelectPayment);
      window.removeEventListener("pos-focus-cash", onFocusCash);
    };
  }, [grandTotal]);

  // Sync amount when grandTotal changes (auto-fill for cash/upi only)
  useEffect(() => {
    if (grandTotal > 0 && selectedMethod !== "pay_later" && !hasManualInput) {
      setAmountGiven(grandTotal);
      onPaymentChange(0, "amount", grandTotal);
    }
  }, [grandTotal, selectedMethod]);

  useEffect(() => {
    setHasManualInput(false);
    setAmountGiven(grandTotal > 0 ? grandTotal : 0);
  }, [selectedMethod]);

  useEffect(() => {
    if (grandTotal === 0) {
      setHasManualInput(false);
      setAmountGiven(0);
    }
  }, [grandTotal]);

  const change = amountGiven - grandTotal;

  const handleMethodSelect = (method: string) => {
    const { grandTotal: liveTotal, onPaymentChange: liveChange } = liveRef.current;
    console.log("🟢 Method selected in PaymentSection:", method);
    console.log("🟢 Current payments before change:", payments);

    setSelectedMethod(method);
    liveChange(0, "method", method);
    console.log("🟢 Called onPaymentChange with method:", method);

    if (method === "pay_later") {
      console.log("🟢 Setting pay_later amount to:", liveTotal);
      setAmountGiven(liveTotal);
      liveChange(0, "amount", liveTotal);
      console.log("🟢 Called onPaymentChange with amount:", liveTotal);
    }
  };

  const handleAmountChange = (value: number) => {
    setHasManualInput(true);
    setAmountGiven(value);
    onPaymentChange(0, "amount", value);
  };

  const methods = [
    { id: "cash", label: t('pos.cash'), key: "Ctrl+C", icon: <Banknote /> },
    { id: "upi", label: t('pos.upi'), key: "Ctrl+U", icon: <Smartphone /> },
    { id: "pay_later", label: t('pos.payLater'), key: "Ctrl+P", icon: <CalendarDays /> },
    { id: "card", label: "Card", key: "Ctrl+D", icon: <CreditCard /> },
  ];

  // Amount entry shows for every tendered method; Pay Later keeps its
  // credit info box instead (nothing is received on credit).
  const showAmountRow = selectedMethod !== "pay_later";

  return (
    <div className="h-full flex flex-col">
      <div className="text-sm font-bold text-[#1E293B] mb-3">{t('pos.paymentMethod')}</div>

      {/* Method Selector - 2x2 grid that stretches to fill the card height */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2">
        {methods.map(({ id, label, key, icon }) => (
          <PaymentButton
            key={id}
            icon={icon}
            label={label}
            shortcut={key}
            active={selectedMethod === id}
            onClick={() => handleMethodSelect(id)}
            className="!h-auto min-h-[44px]"
          />
        ))}
      </div>

      {/* Amount Received - Show for cash, upi and card */}
      {showAmountRow && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <label className="text-[13px] text-[#64748B] whitespace-nowrap">
              Amount Received (₹)
            </label>
            <input
              ref={cashInputRef}
              type="number"
              className="flex-1 min-w-0 bg-white border border-[#D5DBE5] rounded-lg h-10 px-3 text-sm font-bold text-[#1E293B] text-right outline-none pos-field [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={amountGiven || ""}
              placeholder={grandTotal.toFixed(2)}
              onChange={(e) => handleAmountChange(Number(e.target.value))}
              onKeyDown={(e) => {
                // Ctrl+Enter in Amount Received submits via the existing checkout.
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('pos-checkout-request'));
                }
              }}
            />
            <button
              type="button"
              className="shrink-0 text-xs font-semibold text-[#16A34A] border border-[#16A34A] px-2 h-10 rounded-lg hover:bg-[#16A34A]/10 transition-colors"
              onClick={() => handleAmountChange(grandTotal)}
            >
              {t('pos.exact')}
            </button>
          </div>
          {change >= 0 && amountGiven > 0 ? (
            <div className="text-xs text-[#16A34A] font-medium mt-1 text-right">
              Change: ₹ {change.toFixed(2)}
            </div>
          ) : null}
          {change < 0 ? (
            <div className="text-xs text-red-500 font-medium mt-1 text-right">
              {t('pos.amountDue')}: ₹{Math.abs(change).toFixed(2)}
            </div>
          ) : null}
        </div>
      )}

      {/* Credit Info - Show when Pay Later is selected */}
      {selectedMethod === "pay_later" && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-2 py-1.5 mt-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-orange-600 text-xs font-medium">{t('pos.payLater')}</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">
            {t('pos.payLaterDescription')}
          </p>
        </div>
      )}
    </div>
  );
}