import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

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

  // External workstation shortcuts (central usePosShortcuts dispatcher):
  // F7/F8/F9 select the payment method, F10 focuses the cash input.
  useEffect(() => {
    const onSelectPayment = (e: Event) => {
      const method = (e as CustomEvent).detail;
      if (method === "cash" || method === "upi" || method === "pay_later") {
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
    console.log("🟢 Method selected in PaymentSection:", method);
    console.log("🟢 Current payments before change:", payments);

    setSelectedMethod(method);
    onPaymentChange(0, "method", method);
    console.log("🟢 Called onPaymentChange with method:", method);

    if (method === "pay_later") {
      console.log("🟢 Setting pay_later amount to:", grandTotal);
      setAmountGiven(grandTotal);
      onPaymentChange(0, "amount", grandTotal);
      console.log("🟢 Called onPaymentChange with amount:", grandTotal);
    }
  };

  const handleAmountChange = (value: number) => {
    setHasManualInput(true);
    setAmountGiven(value);
    onPaymentChange(0, "amount", value);
  };

  const methods = [
    { id: "cash", label: t('pos.cash'), activeBorder: "border-green-500", activeBg: "bg-green-500/10", activeText: "text-green-500" },
    { id: "upi", label: t('pos.upi'), activeBorder: "border-purple-500", activeBg: "bg-purple-500/10", activeText: "text-purple-500" },
    { id: "pay_later", label: t('pos.payLater'), activeBorder: "border-orange-500", activeBg: "bg-orange-500/10", activeText: "text-orange-500" },
  ];

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold text-gray-500">{t('pos.paymentMethod')}</div>

      {/* Method Selector - three equal controls */}
      <div className="grid grid-cols-3 gap-1">
        {methods.map(({ id, label, activeBorder, activeBg, activeText }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleMethodSelect(id)}
            className={`border rounded-none py-1 transition-all text-center ${selectedMethod === id
              ? `${activeBorder} ${activeBg}`
              : "border-gray-300 bg-white hover:border-gray-400"
              }`}
          >
            <span className={`text-xs font-medium ${selectedMethod === id ? activeText : "text-gray-700"}`}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Bill Amount - plain prominent row (calculated value, not an input) */}
      <div className="flex justify-between items-baseline py-0.5">
        <span className="text-gray-500 text-xs">{t('pos.billAmount')}</span>
        <span className="text-gray-900 font-bold text-base">₹{grandTotal.toLocaleString()}</span>
      </div>

      {/* Amount Input - Show only for cash and upi */}
      {selectedMethod !== "pay_later" && (
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">
            {selectedMethod === "cash" ? t('pos.cashGiven') : t('pos.amountPaid')}
          </label>
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-none px-2 py-1 focus-within:border-green-500 transition-colors">
            <span className="text-gray-500 font-bold text-sm">₹</span>
            <input
              ref={cashInputRef}
              type="number"
              className="flex-1 bg-transparent text-gray-900 text-sm font-bold outline-none min-w-0"  // min-w-0 prevents overflow
              value={amountGiven || ""}
              placeholder={grandTotal.toString()}
              onChange={(e) => handleAmountChange(Number(e.target.value))}
              onKeyDown={(e) => {
                // Enter in Cash Given continues to checkout via existing logic.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('pos-checkout-request'));
                }
              }}
            />
            <button
              type="button"
              className="text-xs text-green-500 border border-green-500/50 px-2 py-1 rounded-none hover:bg-green-500/10 transition-colors flex-shrink-0 whitespace-normal text-center leading-tight"
              onClick={() => handleAmountChange(grandTotal)}
            >
              {t('pos.exact')}
            </button>
          </div>
        </div>
      )}

      {/* Credit Info - Show when Pay Later is selected */}
      {selectedMethod === "pay_later" && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-none px-2 py-1.5">
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

      {/* Change / Due - Show only for cash and upi */}
      {selectedMethod !== "pay_later" && amountGiven > 0 && (
        <div className={`rounded-none px-2 py-1 flex justify-between items-center ${change >= 0
          ? "bg-green-500/10 border border-green-500/30"
          : "bg-red-500/10 border border-red-500/30"
          }`}>
          <span className={`text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
            {change >= 0 ? t('pos.changeToReturn') : t('pos.amountDue')}
          </span>
          <span className={`text-sm font-bold ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
            ₹{Math.abs(change).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}