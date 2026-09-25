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
  displayName?: string;
}

export default function CustomerSelect({
  customers,
  selectedCustomer,
  onSelectCustomer,
  onAddNew,
  displayName,
}: CustomerSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // External workstation shortcut: F4 opens customer selection.
  // The existing auto-focus effect then puts the cursor in its search box.
  // Always refocuses, so repeated F4 presses visibly respond.
  useEffect(() => {
    const onFocusCustomer = () => {
      console.log("🔵 Customer dropdown requested → opening");
      setIsOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    };
    window.addEventListener("pos-focus-customer", onFocusCustomer);
    return () =>
      window.removeEventListener("pos-focus-customer", onFocusCustomer);
  }, []);

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
    setHighlightIdx(0);
  }, [isOpen]);

  // Filter customers — only match against phone number digits.
  // Capped at the first 5 matches so a huge customer list can never
  // flood the dropdown (speed + focus); keep typing to narrow.
  const filteredCustomers = searchQuery.trim()
    ? customers.filter((c) => {
        const digits = String(c.mobile ?? '').replace(/\D/g, '');
        const query = searchQuery.replace(/\D/g, '');
        return query.length > 0 && digits.includes(query);
      }).slice(0, 5)
    : customers.slice(0, 5);

  // Keyboard selection: arrows move, Enter picks, Esc closes.
  // Index 0 is Walk-in whenever it is visible, customers follow it.
  const walkInVisible = !searchQuery.trim();
  const optionCount = filteredCustomers.length + (walkInVisible ? 1 : 0);
  const pickOption = (idx: number) => {
    if (walkInVisible && idx === 0) {
      console.log('[CUSTOMER] keyboard pick: Walk-in');
      onSelectCustomer(null);
    } else {
      const c = filteredCustomers[idx - (walkInVisible ? 1 : 0)];
      console.log('[CUSTOMER] keyboard pick:', (c as any)?.customer_uuid, (c as any)?.name);
      if (c) onSelectCustomer(c);
    }
    setIsOpen(false);
  };
  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, Math.max(optionCount - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (optionCount > 0) pickOption(Math.min(highlightIdx, optionCount - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Value Display - compact single-line control */}
      <div
        className="w-full border border-gray-300 bg-white px-2 py-1 rounded-none text-gray-900 flex justify-between items-center gap-2 cursor-pointer hover:border-gray-400 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <HugeiconsIcon icon={UserIcon} className="text-gray-400 text-base shrink-0"  />
          <span className="text-xs truncate">
            {selectedCustomer
              ? `${selectedCustomer.name}${
                  selectedCustomer.credit_balance > 0
                    ? ` (${t('pos.dueLabel')}: ₹${selectedCustomer.credit_balance})`
                    : ''
                }`
              : displayName?.trim()
                ? displayName.trim()
                : t('pos.walkInCustomer')}
          </span>
        </div>
        <HugeiconsIcon icon={ChevronDownIcon}
          className={`text-gray-400 text-base shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
         />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-300 rounded-none overflow-hidden z-50 shadow">

          {/* Search Input */}
          <div className="p-1.5 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 bg-gray-100 rounded-none px-2 py-1">
              <HugeiconsIcon icon={Search01Icon} className="text-gray-400 text-lg shrink-0"  />
              <input
                ref={searchInputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setHighlightIdx(0); }}
                onKeyDown={onSearchKeyDown}
                placeholder={t('pos.searchByPhone')}
                className="flex-1 bg-transparent text-gray-900 text-xs outline-none placeholder-gray-500"
              />
              {searchQuery.length > 0 && (
                <HugeiconsIcon
                  icon={CancelCircleIcon}
                  className="text-gray-400 text-lg cursor-pointer hover:text-gray-600 shrink-0"
                  onClick={() => setSearchQuery('')}
                 />
              )}
            </div>
          </div>

          {/* Walk-in Customer Option — hide when actively searching */}
          {!searchQuery.trim() && (
            <div
              className={`px-2 py-1.5 hover:bg-gray-100 cursor-pointer transition-colors border-b border-gray-200 flex justify-center items-center gap-2 ${highlightIdx === 0 ? 'bg-blue-50' : ''}`}
              onMouseEnter={() => setHighlightIdx(0)}
              onClick={() => {
                onSelectCustomer(null);
                setIsOpen(false);
              }}
            >
              <HugeiconsIcon icon={UserIcon} className="text-gray-400 text-xl"  />
              <div className="text-start">
                <div className="text-gray-900 text-sm font-medium">{t('pos.walkInCustomer')}</div>
                <div className="text-[11px] text-gray-400">{t('pos.noCreditAccountNeeded')}</div>
              </div>
            </div>
          )}

          {/* Customers List */}
          <div className="max-h-40 overflow-y-auto scrollbar-hide">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((c, idx) => (
                <div
                  key={c.customer_uuid}
                  className={`px-2 py-1.5 hover:bg-gray-100 cursor-pointer transition-colors border-b border-gray-200 last:border-b-0 ${highlightIdx === (idx + (walkInVisible ? 1 : 0)) ? 'bg-blue-50' : ''}`}
                  onMouseEnter={() => setHighlightIdx(idx + (walkInVisible ? 1 : 0))}
                  onClick={() => {
                    onSelectCustomer(c);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-900 text-sm font-medium truncate">{c.name}</div>
                      {c.mobile && (
                        <div className="text-[11px] text-gray-400 mt-0.5">{c.mobile}</div>
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
          <div className="border-t border-gray-200 px-2 py-1 bg-gray-50">
            <button
              className="w-full text-center text-blue-600 text-xs hover:text-blue-700 transition-colors flex items-center justify-center gap-2 py-0.5"
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