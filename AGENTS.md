# Project State & Progress

## Goal
Manage product creation/editing with multi-batch system, unit/category dropdowns, POS batch selection, and read-only purchase details on edit.

## Constraints & Preferences
- Unit dropdown: Tablet, Capsule, Piece, g, ml
- Category dropdown: Drug, Generic, OTC, Nutraceutical, Ayurvedic, Surgical, FMCG, Cosmetic
- Batches section: first batch from form fields, additional rows via "+ Add Batch" with ✕ remove
- Each batch row: Batch No, Qty, Mfg Date, Expiry Date (native date inputs for additional rows)
- MRP/PTR/Discount% kept in main form, not per-batch
- Subtotal sums quantities across all batch rows
- Supplier input is writable combobox with "+ Add as new supplier" option
- On edit: existing batches update via batch_uuid, removed batches deleted via deleteBatch API
- POS add-to-cart shows batch selector for multi-batch products
- Purchase Details section is read-only on edit (one-time process)
- Purchase table shows "N batches" with ℹ️ info modal instead of batch/expiry columns
- Product table has ℹ️ icon next to batch count opening a batch list modal

## Progress

### Done
- **Supplier Bill Format**: added new bill format option in Settings (purple badge), `renderSupplier()` in InvoiceReceipt.tsx rendering A4 GST purchase invoice layout with seller info, invoice meta table, buyer info, line items table, and footer — uses `window.print()` A4 path
- **Role system restructuring (owner→admin, 3 roles)**: types, auth controller, User model, pharmacyAuth, migration 004, staff/admin routes, frontend AuthContext/App/AdminLayout/TopBar/Profile, translation files (en/ta)
- **Manager read-only authorization**: backend authorize('admin') on write routes for products, batches, purchases, customers, suppliers, stockAdjustment; frontend read-only UI gating in Products, Stock, Sales, Customer, Supplier pages
- **Staff page Phase 5**: admin shown in staff list with admin badge (rose styling), edit/delete disabled for admin rows, Add Staff button admin-only, stats include admin count, translation keys added
- Product delete FK fix: moved `PRAGMA foreign_keys = OFF` outside the transaction (SQLite ignores it inside transactions) with `try/finally` to ensure FK checks are always re-enabled
- POS UnitSelectionModal shows "Available: X [unit]" before Quantity input, computed from selected batch's tablet qty ÷ unit's `conversion_factor`
- POS + button disabled when quantity reaches available stock; input also clamps to max on manual entry and on unit/batch change
- Removed `form` field entirely from all files (types, migration, model, controller, Products.tsx)
- Fixed edit page unit default from "Strip" to "Tablet" to match UNIT_OPTIONS
- When editing product unit, the base `product_unit` record is now deleted/recreated to keep it in sync
- Added `batch_uuid` column to `cart_items` table (migration + fixColumns)
- Added `batch_uuid?: string` to CartItem type
- Updated Cart model: `addItem` accepts/stores `batch_uuid`, `findWithItems` selects/returns it, existing-item check includes batch match
- Updated cartController to accept `batch_uuid` from request body
- Added `consumeStock(batch_uuid, quantity)` method to ProductBatch model for single-batch consumption
- Updated Sale `createFromCart` to use `batch_uuid` from cart item if present, otherwise fall back to FEFO
- Updated frontend chain: `cartApi.addItem` → `useCart.addItemToCart` → `POSPage.onAddItem` → `ProductGrid.handleUnitConfirm` all pass `batch_uuid`
- Added batch selector UI to `UnitSelectionModal` in ProductGrid.tsx (radio list with expiry info, days left badge, progress bar)
- Replaced radio button with click-to-select on the whole batch card
- Fixed stock mismatch: removed `quantity - sold_quantity` double-counting everywhere — edit form, loadBatchInfo, product batch modal, cart batch display, backend `getAvailableBatches`, `recalculateProductStock`
- Replaced Batch/Expiry columns on Purchase page with "N batches" count + ℹ️ icon opening batch list modal
- Added ℹ️ icon next to batch count on Product page opening batch list modal with batch_no, qty, sold, expiry, mfg date
- Both info modals use `HugeiconsIcon` with `InformationCircleIcon` from `@hugeicons/core-free-icons`, sized at 17px
- Made Purchase Details section read-only on edit (shows summary card with supplier, invoice, discount, subtotal)
- Moved the `editing` conditional around Purchase Details: read-only display on edit, full editable form on create
- Added "Add New Details" button next to Purchase Details on edit — reveals supplier/invoice/discount/subtotal inputs for restocking
- On save with new details: creates a real `purchase` record (via `createPurchase` API) linking new batches to the purchase
- `handleEdit` now finds the LATEST purchase across all batches' `purchase_uuid`s for read-only display (instead of first batch's purchase only)
- New batches are identified as: first batch with no `editingBatchUuid`, or batch rows with no `batch_uuid`
- Existing batches update in-place; new batches go through purchase flow when supplier is set
- Stock page edit modal: removed "Current Stock & Update" section; made "Packs" (strips) and "Total Pieces" (quantity) editable; "+ Add Batch" creates new batch rows; auto-calc Total Pieces = Packs × tablets_per_strip; Package section shows live batch totals
- Stock page: replaced native `type="date"` with `SimpleDatePicker` button + popup (with click-outside-to-dismiss)
- Products page: package config fields auto-calc `form.strips`/`form.total_tablets`; Package section shows batch sums; `strips_per_box` synced from first batch on edit load
- Batch column on Products: shows "N expired" info button even when no active batches remain; `loadBatchInfo` updates `expiredProductUuids`
- `loadProducts` clears `batchInfo` cache and re-fetches expired product UUIDs on refresh; added `visibilitychange` listener for same
- Fixed batch quantity zeroed on save: changed `tsp` default from `(isSimple ? 1 : 0)` to `1`
- Topbar: "Batches" tab renamed to "Batch Expire"
- Sidebar: "Expired Medicines" → "Expired Meds" in English locale
- All `??`/`||` mixing parse errors fixed (wrapped RHS in parentheses)
- **Supplier Bill Diary feature**: new DB migration `003_supplier_bills.ts`, model `SupplierBill`, controller `SupplierBillController`, routes at `/api/suppliers/:supplier_uuid/bills`, frontend service `supplierBillApi.ts`, new page `SupplierDetail.tsx` with bill photo grid (upload via `compressImage`, full-image modal, delete confirmation)
- **Wiring**: route `/admin/supplier/:supplier_uuid` registered in `App.tsx`; supplier table rows in `Supplier.tsx` are now clickable (navigate to detail page); sidebar highlight uses `startsWith` so supplier nav item stays highlighted on detail page
- **WhatsApp share fix**: added `open-whatsapp` IPC handler in `main.cjs` (720×600 BrowserWindow with isolated session), exposed `openWhatsApp` via preload `contextBridge`, CSP override skips WhatsApp URLs, `renderSupplier()` now uses `window.electron.openWhatsApp(url)`
- **Supplier bill format polish**: bigger container `max-w-[900px]`, table fonts 14px, shop/party names 20px, line items headers 11px/cells 12px, inner horizontal borders removed between paired meta rows — populated with real invoice/customer/items data
- **File-based inventory import**: new backend endpoints `POST /api/import/file` (multipart preview) & `POST /api/auto-update` (process items), Excel reader sums CGST+SGST+IGST (auto-×100 if ≤1), mapper defaults `qty` to `1`, AutoUpdateService sets default unit to `"Piece"`
- **Import modal**: new `ImportSupplierInvoiceModal.tsx` with 3-step flow (Upload → Editable Preview → Done), file drop zone, supplier combobox (writable + create), inline editable columns (name, mfr, batch, expiry, qty, MRP, rate, GST%), fixed-position supplier dropdown
- **Products page**: "Import" button in toolbar wired to modal with `onImported` callback that reloads products

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- `batch_uuid` stored at cart item level so POS batch selection flows through to sale deduction
- Stock model: `quantity` is current on-hand (decremented on sale), `sold_quantity` is cumulative counter — `quantity - sold_quantity` was double-counting sales
- Info modal uses `HugeiconsIcon` SVG component with explicit `size` prop instead of `<i>` CSS classes which weren't visible
- Batch info modals share consistent layout: clean table with essential columns, click-outside-to-close overlay

## Critical Context
- `InformationCircleIcon` exists in `@hugeicons/core-free-icons` at line 5433 of the types
- `HugeiconsIcon` accepts a `size` prop (default 24) that controls SVG width/height directly
- `deleteBatch(batch_uuid)` exists in `productApi.ts` backed by `DELETE /:batch_uuid` route
- `getAvailableBatches(product_uuid)` backend route returns `ProductBatch[]` with raw `quantity` field
- Pre-existing backend type errors (AuditActionType, attributes, printerService) unrelated and untouched

## Relevant Files
- `src/pages/admin/Products.tsx`: Form + batch rows JSX, handleEdit, handleSubmit, loadBatchInfo, batch info modal, "Add New Details" restock flow, auto-calc package config
- `src/pages/admin/Purchase.tsx`: Purchase table with batch count + info modal
- `src/pages/pos/components/ProductGrid.tsx`: UnitSelectionModal with batch selector, handleProductClick fetches available batches
- `src/pages/pos/hooks/useCart.ts`: `addItemToCart` passes `batchUuid` to `addItem`
- `src/pages/pos/POSPage.tsx`: `onAddItem` handler threads `batchUuid` through
- `src/renderer/services/cartApi.ts`: `addItem` accepts optional `batch_uuid`
- `server/src/models/ProductBatch.ts`: `consumeStock`, `consumeStockFEFO`, `getAvailableBatches`, `recalculateProductStock`, `updateQuantity`
- `server/src/models/Cart.ts`: `addItem` accepts `batchUuid`, `findWithItems` returns `batch_uuid`
- `server/src/models/Sale.ts`: `createFromCart` uses `item.batch_uuid` if present
- `server/src/types/index.ts`: `CartItem.batch_uuid?: string`, `SupplierBill` interface
- `server/src/database/migrations/001_initial.ts`: `batch_uuid TEXT` in cart_items CREATE TABLE + fixColumns entry
- `server/src/database/migrations/003_supplier_bills.ts`: supplier_bills table creation
- `server/src/models/SupplierBill.ts`: CRUD model
- `server/src/controllers/SupplierBillController.ts`: Express handlers
- `server/src/routes/supplierBills.ts`: API routes
- `src/renderer/services/supplierBillApi.ts`: frontend API service
- `src/pages/admin/SupplierDetail.tsx`: Dedicated supplier detail page with bill diary, photo upload, full-image modal, delete confirm
- `src/pages/admin/Supplier.tsx`: Supplier list with clickable row navigation to detail page
- `src/pages/admin/Stock.tsx`: Editable batch strips/qty, Add Batch, live Package totals, SimpleDatePicker for new batch dates
- `src/App.tsx`: Route `/admin/supplier/:supplier_uuid` → SupplierDetail
- `src/layout/AdminLayout.tsx`: `NavItem` uses `startsWith` for sidebar highlight on nested routes
- `src/components/Topbar.tsx`: "Batch Expire" tab label
- `src/locales/en/translation.json`: "Expired Meds" sidebar label
- `src/components/ImportSupplierInvoiceModal.tsx`: 3-step import modal with editable preview, supplier combobox, file upload
- `src/renderer/services/importApi.ts`: API service for `POST /api/import/file` and `POST /api/auto-update`
- `electron/main.cjs`: `open-whatsapp` IPC handler, `open-external` IPC handler, CSP WhatsApp exclusion
- `electron/preload.ts`: `openWhatsApp` exposed via contextBridge
- `server/src/modules/importer/readers/excel.reader.ts`: GST percentage fix (decimal → whole number)
- `server/src/modules/importer/mapping/mapper.ts`: qty default 1 when column missing
- `server/src/services/AutoUpdateService.ts`: product unit defaults to "Piece"
- `server/src/controllers/import.controller.ts`: file upload preview endpoint
- `server/src/controllers/AutoUpdateController.ts`: auto-update endpoint
