// ─── Central keyboard shortcuts for the POS billing screen ───────────────────
//
// One place owns every workstation shortcut so behavior stays consistent:
//   F2            Scan mode (focus hidden barcode input in the search row)
//   F3            Quick Keys panel (frequently sold products)
//   F5            View Bill (open sales history)
//   F4            Open customer selection
//   F6            Focus discount input
//   F7 / F8 / F9  Select Cash / UPI / Pay Later (mirrored by
//                 Ctrl+C / Ctrl+U / Ctrl+P from anywhere but inputs)
//   Ctrl+D        Select Card (same not-in-input rule as Ctrl+C/U/P)
//   F10           Focus Cash Given input
//   Ctrl/Cmd+I    Open inventory lookup
//   Ctrl+Enter    Submit sale (handled by POSPage — opens draft review)
//   Ctrl+Shift+Enter  Clear bill with confirm (handled by POSPage)
//   + / -         Increase / decrease the selected bill row
//   Delete        Remove the selected bill row (no new confirmation;
//                 the app has no delete-confirmation pattern to reuse)
//
// Safety rules enforced here:
// - While any modal is open, no shortcut fires (modals own their keys).
// - Delete / + / - never fire while typing in an input, select,
//   textarea, or editable element.
// - F-keys are safe to honor anywhere outside modals (they type no text).
// - Enter / arrows stay local to the focused control:
//   search inputs, grid cells, and the checkout handler keep their
//   existing behavior untouched.

import { useEffect, useRef } from "react";

export interface PosShortcutHandlers {
  hasLines: boolean;
  modalsOpen: boolean;
  openSales: () => void;
  getSelectedItem: () => any | null;
  clearSelectedItem: () => void;
  increaseSelected: () => void;
  decreaseSelected: () => void;
  removeSelected: () => void;
}

function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    !!el.isContentEditable
  );
}

export function usePosShortcuts(handlers: PosShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = ref.current;

      // Modals (customer, sales, invoice, prescription, custom item)
      // manage their own keys, including Escape.
      if (h.modalsOpen) return;

      const editing = isEditableTarget(e.target);

      // Ctrl/Cmd+letter payment shortcuts: Cash (C), UPI (U), Pay Later (P),
      // Card (D). Audible from anywhere on the POS screen — including inside
      // the grid, where plain letters must keep typing into the bill. Skipped
      // in inputs (typing + clipboard survive) and when text is selected
      // (so Ctrl+C still copies there).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !editing) {
        const k = e.key.toLowerCase();
        const method =
          k === "c" ? "cash"
          : k === "u" ? "upi"
          : k === "p" ? "pay_later"
          : k === "d" ? "card"
          : null;
        if (method) {
          if (k === "c" && window.getSelection()?.toString()) return;
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("pos-select-payment", { detail: method })
          );
          return;
        }
      }

      // Ctrl/Cmd+I opens the inventory lookup from anywhere on POS.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("pos-open-inventory"));
        return;
      }

      switch (e.key) {
        case "F2":
          // Scan mode: the search row focuses its hidden barcode input.
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("pos-open-scan"));
          break;
        case "F3":
          // Quick Keys panel: frequently sold products.
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("pos-open-quickkeys"));
          break;
        case "F5":
          // View Bill: open sales history.
          e.preventDefault();
          h.openSales();
          break;
        case "F4":
          e.preventDefault();
          console.log("🔵 F4 pressed → requesting customer dropdown");
          window.dispatchEvent(new CustomEvent("pos-focus-customer"));
          break;
        case "F6":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("pos-focus-discount"));
          break;
        case "F7":
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("pos-select-payment", { detail: "cash" })
          );
          break;
        case "F8":
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("pos-select-payment", { detail: "upi" })
          );
          break;
        case "F9":
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("pos-select-payment", { detail: "pay_later" })
          );
          break;
        case "F10":
          // F10 opens the OS menu in some browsers; keep it inside POS.
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("pos-focus-cash"));
          break;
        case "Delete":
          if (!editing && h.hasLines) {
            e.preventDefault();
            h.removeSelected();
          }
          break;
        case "+":
        case "=":
          if (!editing) {
            e.preventDefault();
            h.increaseSelected();
          }
          break;
        case "-":
        case "_":
          if (!editing) {
            e.preventDefault();
            h.decreaseSelected();
          }
          break;
        default:
          // Type-anywhere-to-bill: a lone printable keystroke landing on
          // non-interactive chrome (body, labels, dead space) jumps into
          // the grid instead of dying, so typing always bills.
          // Excluded: editable elements, buttons/links (native behavior),
          // modifier combos, and anything while a modal is open (guarded
          // above). Barcode bursts still work: the first char lands in the
          // entry input and the rest types natively into it.
          if (
            !editing &&
            e.key.length === 1 &&
            !e.ctrlKey && !e.metaKey && !e.altKey &&
            e.target instanceof HTMLElement &&
            typeof e.target.closest === "function" &&
            !e.target.closest("button") &&
            !e.target.closest("a") &&
            !e.target.closest("input,select,textarea")
          ) {
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent("pos-grid-type", { detail: e.key })
            );
          }
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
