import db from '../connection';

export function runMigration(): void {
  console.log('Running migration 002: Security Questions...');

  const columns = db.prepare("PRAGMA table_info(users)").all() as any[];
  const hasSecurityQuestion = columns.some((col: any) => col.name === 'security_question');
  const hasSecurityAnswer = columns.some((col: any) => col.name === 'security_answer');

  if (!hasSecurityQuestion) {
    db.exec(`ALTER TABLE users ADD COLUMN security_question TEXT`);
    console.log('  ✓ Added column users.security_question');
  }
  if (!hasSecurityAnswer) {
    db.exec(`ALTER TABLE users ADD COLUMN security_answer TEXT`);
    console.log('  ✓ Added column users.security_answer');
  }

  console.log('Migration 002 completed successfully!');
}
