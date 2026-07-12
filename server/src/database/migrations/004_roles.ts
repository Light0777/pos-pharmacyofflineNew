import db from '../connection';

export function runMigration(): void {
  console.log('Running migration 004: Update roles...');
  db.exec(`
    UPDATE users SET role = 'admin' WHERE role = 'owner';
  `);
  console.log('  ✓ Updated owner → admin roles');
  console.log('Migration 004 completed successfully!');
}
