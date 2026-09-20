import db from '../connection';

export function runMigration(): void {
  console.log('Running migration 005: POS grid (batch/unit edit, free qty, custom items, remarks, round-off)...');

  const addColumns: Array<{ table: string; column: string; def: string }> = [
    // Per-line free quantity + custom (ad-hoc) rows on the bill
    { table: 'cart_items', column: 'free_quantity', def: 'REAL NOT NULL DEFAULT 0' },
    { table: 'cart_items', column: 'is_custom', def: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'cart_items', column: 'custom_name', def: 'TEXT' },
    // Free quantity carried onto the sale
    { table: 'sale_items', column: 'free_quantity', def: 'REAL NOT NULL DEFAULT 0' },
    { table: 'sale_items', column: 'custom_name', def: 'TEXT' },
    // Invoice remarks + stored round-off
    { table: 'sales', column: 'remarks', def: 'TEXT' },
    { table: 'sales', column: 'round_off', def: 'REAL NOT NULL DEFAULT 0' },
    // Customer credit terms
    { table: 'customers', column: 'credit_days', def: 'INTEGER NOT NULL DEFAULT 0' },
  ];

  for (const col of addColumns) {
    try {
      db.exec(`ALTER TABLE ${col.table} ADD COLUMN ${col.column} ${col.def}`);
      console.log(`  ✓ Added column ${col.table}.${col.column}`);
    } catch {
      // column already exists — ignore
    }
  }

  // Sentinel product backing custom (ad-hoc) bill rows.
  // Custom rows reference this product so FK constraints stay intact;
  // the display name comes from cart_items.custom_name instead.
  try {
    db.prepare(`
      INSERT OR IGNORE INTO products (product_uuid, name, price, stock, unit, gst_percent)
      VALUES ('custom-item', 'Custom Item', 0, 999999999, 'Piece', 0)
    `).run();
    console.log('  ✓ Ensured custom-item sentinel product');
  } catch (err) {
    console.error('  ✗ Failed to ensure custom-item product:', err);
  }

  // Base unit for the sentinel product (required for cart validation)
  try {
    db.prepare(`
      INSERT OR IGNORE INTO product_units (unit_uuid, product_uuid, unit_name, conversion_factor, is_base_unit)
      VALUES ('unit-custom-item', 'custom-item', 'Piece', 1, 1)
    `).run();
    console.log('  ✓ Ensured custom-item base unit');
  } catch (err) {
    console.error('  ✗ Failed to ensure custom-item unit:', err);
  }

  console.log('Migration 005 completed successfully!');
}
