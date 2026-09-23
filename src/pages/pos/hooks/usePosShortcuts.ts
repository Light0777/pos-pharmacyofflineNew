// ─── Central keyboard shortcuts for the POS billing screen ───────────────────
//
// One place owns every workstation shortcut so behavior stays consistent:
//   F2            New-bill request (POSPage confirms via in-app dialog;
//                 native confirm is never used — it wedges Electron input)
//   F3 / Ctrl+K   Focus product search (search input also selects its text)
//   F5            Refresh the product list (with toast confirmation)
//   F4            Open customer selection
//   F6            Focus discount input
//   F7 / F8 / F9  Select Cash / UPI / Pay Later
//   F10           Focus Cash Given input
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
  refreshProducts: () => void;
  getSelectedItem: () => any | null;
  clearSelectedItem: () => void;
  increaseSelected: () => void;
  decreaseSelected: () => void;
  removeSelected: () => void;
  newBill: () => void;
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

      switch (e.key) {
        case "F2":
          e.preventDefault();
          h.newBill();
          break;
        case "F3":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("pos-focus-search"));
          break;
        case "F5":
          // Outside modals only (guarded above); refreshes the product list.
          e.preventDefault();
          h.refreshProducts();
          break;
        case "F4":
          e.preventDefault();
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
