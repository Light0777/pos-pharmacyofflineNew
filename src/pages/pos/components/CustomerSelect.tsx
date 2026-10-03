import { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Search, X } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AddCircleIcon } from "@hugeicons/core-free-icons";
import { useTranslation } from 'react-i18next';

interface CustomerSelectProps {
  customers: any[];
  selectedCustomer: any | null;
  onSelectCustomer: (customer: any | null) => void;
  onAddNew: (phone?: string) => void;
  displayName?: string;
  // dropdown: closed control + upward menu (bottom cards).
  // inline: always-visible search input + downward menu (header card).
  // Selection state is shared via props, so both stay in sync.
  layout?: 'dropdown' | 'inline';
  // Only one mounted instance should answer the global F4 shortcut.
  listenF4?: boolean;
}

export default function CustomerSelect({
  customers,
  selectedCustomer,
  onSelectCustomer,
  onAddNew,
  displayName,
  layout = 'dropdown',
  listenF4 = true,
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
    if (!listenF4) return;
    const onFocusCustomer = () => {
      console.log("🔵 Customer dropdown requested → opening");
      setIsOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    };
    window.addEventListener("pos-focus-customer", onFocusCustomer);
    return () =>
      window.removeEventListener("pos-focus-customer", onFocusCustomer);
  }, [listenF4]);

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

  // Keep the highlighted option visible while arrow-keying (instant —
  // see ProductGrid: global smooth-scroll lags rapid key repeats).
  useEffect(() => {
    dropdownRef.current?.querySelector('[data-cust-active="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'instant' } as ScrollIntoViewOptions);
  }, [highlightIdx, searchQuery, isOpen]);

  // Filter customers by name or phone digits.
  // Capped at the first 5 matches so a huge customer list can never
  // flood the dropdown (speed + focus); keep typing to narrow.
  const q = searchQuery.trim().toLowerCase();
  const qDigits = searchQuery.replace(/\D/g, '');
  const filteredCustomers = q
    ? customers.filter((c) => {
        const nameHit = String(c.name ?? '').toLowerCase().includes(q);
        const phoneHit = qDigits.length > 0 &&
          String(c.mobile ?? '').replace(/\D/g, '').includes(qDigits);
        return nameHit || phoneHit;
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
      setHighlightIdx((i) => (optionCount <= 0 ? 0 : (i + 1) % optionCount));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => (optionCount <= 0 ? 0 : (i - 1 + optionCount) % optionCount));
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (optionCount > 0) pickOption(Math.min(highlightIdx, optionCount - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const selectedLabel = selectedCustomer
    ? `${selectedCustomer.name}${
        selectedCustomer.credit_balance > 0
          ? ` (${t('pos.dueLabel')}: ₹${selectedCustomer.credit_balance})`
          : ''
      }`
    : displayName?.trim()
      ? displayName.trim()
      : t('pos.walkInCustomer');

  const searchBox = (
    <div className="flex items-center gap-2 bg-white border border-[#D5DBE5] rounded-lg h-10 px-3 pos-field transition">
      <Search className="w-[18px] h-[18px] text-[#64748B] shrink-0" />
      <input
        ref={searchInputRef}
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); setHighlightIdx(0); }}
        onKeyDown={onSearchKeyDown}
        onFocus={() => setIsOpen(true)}
        placeholder="Search customer by name, phone or barcode..."
        autoComplete="off"
        className="flex-1 min-w-0 bg-transparent text-[#1E293B] text-sm outline-none placeholder:text-[#64748B]"
      />
      {searchQuery.length > 0 && (
        <button onClick={() => setSearchQuery('')} className="text-[#64748B] hover:text-[#1E293B] shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  const menu = (
    <div className={`absolute left-0 right-0 bg-white border border-[#E5E9F0] rounded-xl overflow-hidden z-50 shadow-lg ${layout === 'inline' ? 'top-full mt-1' : 'bottom-full mb-1'}`}>
      {layout === 'dropdown' && (
        <div className="p-2 border-b border-[#E5E9F0] bg-gray-50/60">
          {searchBox}
        </div>
      )}

      {/* Walk-in Customer Option — hide when actively searching */}
      {!searchQuery.trim() && (
        <div
          className={`px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors border-b border-[#E5E9F0] flex items-center gap-2 ${highlightIdx === 0 ? 'bg-[#16A34A]/10' : ''}`}
          onMouseEnter={() => setHighlightIdx(0)}
          onClick={() => {
            onSelectCustomer(null);
            setIsOpen(false);
          }}
        >
          <User className="w-5 h-5 text-[#64748B]" />
          <div className="text-start">
            <div className="text-[#1E293B] text-sm font-medium">{t('pos.walkInCustomer')}</div>
            <div className="text-[11px] text-[#64748B]">{t('pos.noCreditAccountNeeded')}</div>
          </div>
        </div>
      )}

      {/* Customers List */}
      <div className="max-h-40 overflow-y-auto">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((c, idx) => (
            <div
              key={c.customer_uuid}
              data-cust-active={highlightIdx === (idx + (walkInVisible ? 1 : 0)) || undefined}
              className={`px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors border-b border-[#E5E9F0] last:border-b-0 ${highlightIdx === (idx + (walkInVisible ? 1 : 0)) ? 'bg-[#16A34A]/10' : ''}`}
              onMouseEnter={() => setHighlightIdx(idx + (walkInVisible ? 1 : 0))}
              onClick={() => {
                onSelectCustomer(c);
                setIsOpen(false);
              }}
            >
              <div className="flex justify-between items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[#1E293B] text-sm font-medium truncate">{c.name}</div>
                  {c.mobile && (
                    <div className="text-[11px] text-[#64748B] mt-0.5">{c.mobile}</div>
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
          <div className="p-4 text-center text-[#64748B] text-sm">
            {t('pos.noCustomerFoundFor', { query: searchQuery })}
          </div>
        )}
      </div>

      {/* Add New Customer Button */}
      <div className="border-t border-[#E5E9F0] px-2 py-1.5 bg-gray-50/60">
        <button
          className="w-full text-center text-[#16A34A] text-xs font-semibold hover:text-[#15803D] transition-colors flex items-center justify-center gap-2 py-0.5"
          onClick={() => {
            onAddNew(searchQuery);
            setIsOpen(false);
          }}
        >
          <HugeiconsIcon icon={AddCircleIcon} className="text-lg" />
          <span>{t('pos.addNewCustomer')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {layout === 'inline' ? (
        searchBox
      ) : (
        <div
          className="w-full h-10 bg-white border border-[#D5DBE5] rounded-lg px-3 text-[#1E293B] flex justify-between items-center gap-2 cursor-pointer hover:border-[#16A34A] transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-[18px] h-[18px] text-[#64748B] shrink-0" />
            <span className="text-sm truncate">{selectedLabel}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      )}
      {isOpen && menu}
    </div>
  );
}
