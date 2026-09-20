import { useTranslation } from 'react-i18next';

interface CartSummaryProps {
  total: number;
  tax: number;
  grandTotal: number;
}

export default function CartSummary({ total, tax, grandTotal }: CartSummaryProps) {
  const { t } = useTranslation();

  return (
    <div className="text-[11px] leading-tight">
      <div className="flex justify-between py-0.5">
        <span className="text-gray-400">{t('pos.subtotal')}</span>
        <span className="text-gray-200">₹{total.toLocaleString()}</span>
      </div>
      <div className="flex justify-between py-0.5 border-b border-gray-700">
        <span className="text-gray-400">{t('pos.tax')}</span>
        <span className="text-gray-200">₹{tax.toLocaleString()}</span>
      </div>
      <div className="flex justify-between items-center py-1">
        <span className="font-bold text-gray-200 text-xs">{t('pos.grandTotal')}</span>
        <span className="font-bold text-green-400 text-base">₹{grandTotal.toLocaleString()}</span>
      </div>
    </div>
  );
}