import { useState, useRef, useEffect } from 'react';
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ChevronDownIcon,
  UserIcon,
  AddCircleIcon,
  Search01Icon,
  CancelCircleIcon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from 'react-i18next';

interface CustomerSelectProps {
  customers: any[];
  selectedCustomer: any | null;
  onSelectCustomer: (customer: any | null) => void;
  onAddNew: (phone?: string) => void;
}

export default function CustomerSelect({
  customers,
  selectedCustomer,
  onSelectCustomer,
  onAddNew,
}: CustomerSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Filter customers — only match against phone number digits
  const filteredCustomers = searchQuery.trim()
    ? customers.filter((c) => {
        const digits = String(c.mobile ?? '').replace(/\D/g, '');
        const query = searchQuery.replace(/\D/g, '');
        return query.length > 0 && digits.includes(query);
      })
    : customers.slice(0, 10);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Value Display */}
      <div
        className="w-full border border-gray-700 bg-[#212121] p-3 rounded-xl text-white flex justify-between items-center cursor-pointer hover:border-gray-600 transition-all duration-200"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={UserIcon} className="text-gray-400 text-lg"  />
          <span>
            {selectedCustomer
              ? `${selectedCustomer.name}${
                  selectedCustomer.credit_balance > 0
                    ? ` (${t('pos.dueLabel')}: ₹${selectedCustomer.credit_balance})`
                    : ''
                }`
              : t('pos.walkInCustomer')}
          </span>
        </div>
        <HugeiconsIcon icon={ChevronDownIcon}
          className={`text-gray-400 text-xl transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
         />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#212121] border border-gray-700 rounded-xl overflow-hidden z-50 shadow-2xl animate-fadeIn">

          {/* Search Input */}
          <div className="p-2 border-b border-gray-700 bg-[#1a1a1a]">
            <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-lg px-3 py-2">
              <HugeiconsIcon icon={Search01Icon} className="text-gray-400 text-lg shrink-0"  />
              <input
                ref={searchInputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('pos.searchByPhone')}
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
              />
              {searchQuery.length > 0 && (
                <HugeiconsIcon
                  icon={CancelCircleIcon}
                  className="text-gray-400 text-lg cursor-pointer hover:text-gray-200 shrink-0"
                  onClick={() => setSearchQuery('')}
                 />
              )}
            </div>
          </div>

          {/* Walk-in Customer Option — hide when actively searching */}
          {!searchQuery.trim() && (
            <div
              className="p-3 hover:bg-[#2a2a2a] cursor-pointer transition-colors border-b border-gray-700 flex justify-center items-center gap-3"
              onClick={() => {
                onSelectCustomer(null);
                setIsOpen(false);
              }}
            >
              <HugeiconsIcon icon={UserIcon} className="text-gray-400 text-2xl"  />
              <div className="text-start">
                <div className="text-white font-medium">{t('pos.walkInCustomer')}</div>
                <div className="text-xs text-gray-400">{t('pos.noCreditAccountNeeded')}</div>
              </div>
            </div>
          )}

          {/* Customers List */}
          <div className="max-h-48 overflow-y-auto scrollbar-hide">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((c) => (
                <div
                  key={c.customer_uuid}
                  className="p-3 hover:bg-[#2a2a2a] cursor-pointer transition-colors border-b border-gray-700 last:border-b-0"
                  onClick={() => {
                    onSelectCustomer(c);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{c.name}</div>
                      {c.mobile && (
                        <div className="text-xs text-gray-400 mt-0.5">{c.mobile}</div>
                      )}
                    </div>
                    {c.credit_balance > 0 && (
                      <div className="text-right shrink-0">
                        <div className="text-xs text-orange-400">{t('pos.dueAmount')}</div>
                        <div className="text-sm font-semibold text-orange-400">₹{c.credit_balance}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                {t('pos.noCustomerFoundFor', { query: searchQuery })}
              </div>
            )}
          </div>

          {/* Add New Customer Button */}
          <div className="border-t border-gray-700 p-3 bg-[#1a1a1a]">
            <button
              className="w-full text-center text-blue-400 text-sm hover:text-blue-300 transition-colors flex items-center justify-center gap-2 py-1"
              onClick={() => {
                onAddNew(searchQuery);
                setIsOpen(false);
              }}
            >
              <HugeiconsIcon icon={AddCircleIcon} className="text-lg"  />
              <span>{t('pos.addNewCustomer')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}