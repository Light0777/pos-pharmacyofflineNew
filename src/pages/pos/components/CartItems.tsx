import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Remove01Icon,
  Delete01Icon,
  Medicine01Icon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

interface CartItem {
  id: number;
  product_uuid: string;
  unit_uuid: string;
  quantity: number;
  price: number;
  discount: number;
  tax_percent: number;
  product: {
    name: string;
    barcode?: string;
    manufacturer?: string;
    medicine_type?: string;
    schedule_type?: string;
    prescription_required?: number;
  };
}

interface CartItemsProps {
  items: CartItem[];
  onIncrease: (item: CartItem) => void;
  onDecrease: (item: CartItem) => void;
  onRemove?: (item: CartItem) => void;
}

export default function CartItems({
  items,
  onIncrease,
  onDecrease,
  onRemove,
}: CartItemsProps) {
  const { t } = useTranslation();

  useEffect(() => {
    console.log("🛒 CartItems received items update:", items);
    console.log("🛒 Number of items:", items.length);
  }, [items]);

  if (!items || items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-sm">{t('pos.noItems')}</p>
          <p className="text-xs mt-1">{t('pos.clickToAdd')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {items.map((item, index) => {
        const subtotal = item.price * item.quantity;
        const taxAmount =
          ((item.price * item.quantity - (item.discount || 0)) *
            item.tax_percent) /
          100;

        console.log(`🛒 Rendering item ${index + 1}:`, {
          name: item.product?.name,
          quantity: item.quantity,
          price: item.price,
          unit_uuid: item.unit_uuid
        });

        return (
          <div
            key={`${item.product_uuid}_${item.unit_uuid || index}`}
            className="border-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-800 rounded-2xl flex flex-row overflow-hidden transition-all duration-200 font-inter"
          >
            <div className="flex-shrink-0 self-center overflow-hidden rounded-xl aspect-square mx-[1.3%]" style={{ width: '27%' }}>
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#83df1a' }}>
                <HugeiconsIcon icon={Medicine01Icon} className="text-2xl text-white"  />
              </div>
            </div>

            <div className="flex-1 min-w-0 px-2 py-0.5 flex flex-col justify-start text-left gap-[1px]">
              <div className="font-semibold text-xs truncate leading-tight text-gray-900">
                {(item.product?.name || t('pos.unknownProduct')).replace('[Custom] ', '')}
              </div>

              {item.product?.manufacturer && (
                <div className="text-[10px] truncate leading-tight text-gray-500">
                  {item.product.manufacturer}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <div className="text-xs font-bold text-gray-900">
                  ₹{item.price.toFixed(2)}
                </div>
                {item.product?.prescription_required ? (
                  <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-medium leading-none">
                    Rx
                  </span>
                ) : null}
                {item.product?.schedule_type && item.product.schedule_type !== 'NONE' && (
                  <span className="text-[9px] bg-yellow-600 text-white px-1.5 py-0.5 rounded-full font-medium leading-none">
                    Sch {item.product.schedule_type}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => {
                      console.log("➖ Decrease item:", item.product?.name);
                      onDecrease(item);
                    }}
                    className="w-5 h-5 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-l-lg transition-colors"
                  >
                    <HugeiconsIcon icon={Remove01Icon} className="text-[10px]"  />
                  </button>

                  <span className="text-gray-900 text-xs font-medium min-w-[16px] text-center">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => {
                      console.log("➕ Increase item:", item.product?.name);
                      onIncrease(item);
                    }}
                    className="w-5 h-5 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-r-lg transition-colors"
                  >
                    <HugeiconsIcon icon={Add01Icon} className="text-[10px]"  />
                  </button>
                </div>

                {onRemove && (
                  <button
                    onClick={() => {
                      console.log("🗑 Removing item:", item.product?.name);
                      onRemove(item);
                    }}
                    className="text-red-400 hover:text-red-500 transition-colors p-0.5 shrink-0"
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="text-sm"  />
                  </button>
                )}
              </div>

              <div className="flex justify-between items-center border-t border-gray-100">
                <span className="text-gray-500 text-[9px]">{t('pos.subtotal')}:</span>
                <span className="text-green-600 text-[10px] font-semibold">
                  ₹{subtotal.toFixed(2)}
                </span>
              </div>

              {item.tax_percent > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-[9px]">
                    {t('pos.taxWithPercent', { percent: item.tax_percent })}:
                  </span>
                  <span className="text-gray-500 text-[9px]">
                    ₹{taxAmount.toFixed(2)}
                  </span>
                </div>
              )}

              {item.discount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-[9px]">Discount:</span>
                  <span className="text-blue-500 text-[9px]">
                    -₹{item.discount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
