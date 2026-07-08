import db from '../connection';

export function runMigration(): void {
  console.log('Running migration 003: Supplier Bills...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_bills (
      bill_uuid TEXT PRIMARY KEY,
      supplier_uuid TEXT NOT NULL,
      bill_image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_uuid) REFERENCES suppliers(supplier_uuid) ON DELETE CASCADE
    );
  `);
  console.log('  ✓ Created supplier_bills table');
  console.log('Migration 003 completed successfully!');
}
