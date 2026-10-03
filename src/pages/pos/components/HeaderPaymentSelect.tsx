import { useEffect, useRef, useState } from "react";
import { Banknote, Smartphone, CalendarDays, CreditCard, ChevronDown } from "lucide-react";

// Header payment picker: custom dropdown (native <select> draws OS chrome
// that clashes with the app). Picking dispatches through the existing
// pos-select-payment channel, so the method buttons, totals and checkout
// stay in sync exactly as before.
const OPTIONS = [
  { id: "cash", label: "Cash", icon: <Banknote className="w-[18px] h-[18px]" /> },
  { id: "upi", label: "UPI", icon: <Smartphone className="w-[18px] h-[18px]" /> },
  { id: "pay_later", label: "Pay Later", icon: <CalendarDays className="w-[18px] h-[18px]" /> },
  { id: "card", label: "Card", icon: <CreditCard className="w-[18px] h-[18px]" /> },
];

export default function HeaderPaymentSelect({ method }: { method: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const current = OPTIONS.find((o) => o.id === method) ?? {
    id: method,
    label: method,
    icon: <Banknote className="w-[18px] h-[18px]" />,
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Focus the current option whenever the list opens (mouse or keyboard).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const btns = Array.from(listRef.current?.querySelectorAll("button") ?? []);
      const idx = Math.max(
        0,
        btns.findIndex((b) => b.getAttribute("data-active") === "true")
      );
      (btns[idx] as HTMLElement | undefined)?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open ]);

  const pick = (id: string) => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("pos-select-payment", { detail: id }));
    btnRef.current?.focus();
  };

  const moveInList = (dir: 1 | -1) => {
    const btns = Array.from(listRef.current?.querySelectorAll("button") ?? []) as HTMLElement[];
    if (btns.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const i = active ? btns.indexOf(active) : -1;
    const next = dir === 1 ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length;
    btns[next]?.focus();
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className="w-full h-10 pl-10 pr-8 text-sm font-medium text-[#1E293B] bg-white border border-[#D5DBE5] rounded-lg outline-none cursor-pointer focus:outline-none pos-field flex items-center gap-2"
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none flex">
          {current.icon}
        </span>
        <span className="truncate">{current.label}</span>
        <ChevronDown
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={listRef}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                moveInList(e.key === "ArrowDown" ? 1 : -1);
              } else if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
                btnRef.current?.focus();
              }
            }}
            className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-[#E5E9F0] rounded-xl shadow-lg p-1.5"
          >
            {OPTIONS.map((o) => {
              const selected = o.id === current.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  data-active={selected || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors focus:outline-none focus:bg-[#16A34A]/20 focus:text-[#1E293B] focus:shadow-[inset_3px_0_0_0_#16A34A] ${
                    selected
                      ? "bg-[#16A34A]/15 text-[#1E293B] font-semibold"
                      : "text-[#64748B] hover:bg-gray-50"
                  }`}
                >
                  <span className={selected ? "text-[#16A34A]" : "text-[#64748B]"}>{o.icon}</span>
                  <span className="flex-1">{o.label}</span>
                  {selected && <span className="text-[#16A34A] text-xs font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
