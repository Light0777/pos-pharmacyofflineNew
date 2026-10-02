import { useTranslation } from 'react-i18next';

interface CartSummaryProps {
  total: number;
  tax: number;
  grandTotal: number;
}

export default function CartSummary({ total, tax, grandTotal }: CartSummaryProps) {
  const { t } = useTranslation();

  const roundOff = grandTotal - total - tax;

  return (
    <div>
      <div className="flex justify-between items-baseline py-1">
        <span className="text-[13px] text-[#64748B]">{t('pos.subtotal')}</span>
        <span className="font-semibold text-[#1E293B] text-sm">₹ {total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div className="flex justify-between items-baseline py-1">
        <span className="text-[13px] text-[#64748B]">{t('pos.tax')}</span>
        <span className="font-semibold text-[#1E293B] text-sm">₹ {tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      {Math.abs(roundOff) >= 0.005 && (
        <div className="flex justify-between items-baseline py-1">
          <span className="text-[13px] text-[#64748B]">Round Off</span>
          <span className="font-semibold text-[#1E293B] text-sm">
            {roundOff > 0 ? '+' : ''}₹ {roundOff.toFixed(2)}
          </span>
        </div>
      )}
      <div className="flex justify-between items-center py-2 mt-1 border-t border-[#E5E9F0]">
        <span className="font-bold text-[#1E293B] text-lg">{t('pos.grandTotal')}</span>
        <span className={`font-bold text-[28px] leading-none ${grandTotal > 0 ? 'text-[#16A34A]' : 'text-[#1E293B]'}`}>
          ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}