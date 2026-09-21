import { useTranslation } from 'react-i18next';

interface DiscountSectionProps {
  discount: number;
  onDiscountChange: (value: number) => void;
  onApplyDiscount: () => void;
}

export default function DiscountSection({
  discount,
  onDiscountChange,
  onApplyDiscount,
}: DiscountSectionProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-500 mb-1">{t('pos.applyDiscount')}</div>
      <div className="flex gap-1.5">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">₹</span>
          <input
            type="number"
            className="w-full border border-gray-300 bg-white py-1 pl-6 pr-2 rounded text-gray-900 text-xs focus:border-blue-500 focus:outline-none"
            placeholder="0"
            value={discount}
            onChange={(e) => onDiscountChange(Number(e.target.value))}
          />
        </div>
        <button
          className="bg-green-600 font-bold text-white text-xs px-3 rounded hover:bg-green-700 transition shrink-0"
          onClick={onApplyDiscount}
        >
          {t('pos.apply')}
        </button>
      </div>
    </div>
  );
}