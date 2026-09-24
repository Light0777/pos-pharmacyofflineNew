import db from '../connection';

export function runMigration(): void {
  console.log('Running migration 006: bill-level customer overrides...');

  for (const col of ['customer_mobile', 'customer_name']) {
    try {
      db.exec(`ALTER TABLE sales ADD COLUMN ${col} TEXT`);
      console.log(`  ✓ Added column sales.${col}`);
    } catch {
      // column already exists — ignore
    }
  }

  console.log('Migration 006 completed successfully!');
}
