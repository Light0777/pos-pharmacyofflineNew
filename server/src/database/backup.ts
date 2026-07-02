import fs from 'fs';
import path from 'path';
import db from './connection';

const getBackupDir = (): string => {
  // Check if running in Electron production mode
  if (process.env.NODE_ENV === 'production') {
    try {
      // Try to get Electron's userData path
      const { app } = require('electron');
      const backupDir = path.join(app.getPath('userData'), 'backups');
      return backupDir;
    } catch (error) {
      // Fallback if electron not available
      console.warn('Electron not available, using fallback backup directory');
    }
  }

  // Development mode or fallback
  const base = process.env.USER_DATA_PATH || process.cwd();
  return path.join(base, 'backups');
};

const getDbName = (): string => {
  const appType = process.env.APP_TYPE || 'billing';
  return process.env.APP_DB_NAME || (
    appType === 'hardware'
      ? 'pos_hardware.db'
      : appType === 'pharmacy'
      ? 'pos_pharmacy.db'
      : 'pos_billing.db'
  );
};

const getDbPath = (): string => {
  const dbName = getDbName();

  // Check if running in Electron production mode
  if (process.env.NODE_ENV === 'production') {
    try {
      const { app } = require('electron');
      const dbPath = path.join(app.getPath('userData'), 'database', dbName);
      return dbPath;
    } catch (error) {
      console.warn('Electron not available, using fallback database path');
    }
  }

  // Development mode or fallback
  const base = process.env.USER_DATA_PATH || process.cwd();
  return path.join(base, 'server', 'database', dbName);
};

export function ensureBackupDir(): void {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created backup directory: ${dir}`);
  }
}

export function createBackup(label: string = 'auto'): string {
  ensureBackupDir();
  
  const dbPath = getDbPath();
  
  // Skip backup if DB doesn't exist yet (first run or wrong path)
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Source database not found at: ${dbPath}`);
  }
  
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(getBackupDir(), `pos_backup_${label}_${date}.db`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Backup created: ${backupPath}`);
  return backupPath;
}

export function listBackups(): { name: string; path: string; size: number; date: string }[] {
  ensureBackupDir();
  const dir = getBackupDir();

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter(f => f.startsWith('pos_backup_') && f.endsWith('.db'))
    .sort()
    .reverse()
    .map(f => {
      const filePath = path.join(dir, f);
      const stats = fs.statSync(filePath);
      return {
        name: f,
        path: filePath,
        size: stats.size,
        date: stats.mtime.toISOString()
      };
    });
}

export function restoreBackup(backupName: string): void {
  const backupPath = path.join(getBackupDir(), backupName);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupName}`);
  }

  const dbPath = getDbPath();

  // Ensure database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Close all connections by checkpointing WAL
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn('WAL checkpoint failed:', err);
  }

  // Copy backup over current DB
  fs.copyFileSync(backupPath, dbPath);
  console.log(`✅ Restored from backup: ${backupName}`);
}

export function pruneOldBackups(keepCount: number = 7): void {
  const backups = listBackups();
  if (backups.length > keepCount) {
    backups.slice(keepCount).forEach(b => {
      fs.unlinkSync(b.path);
      console.log(`🗑️ Deleted old backup: ${b.name}`);
    });
  }
}

export function checkDbIntegrity(): boolean {
  try {
    const result = db.prepare("PRAGMA integrity_check").get() as any;
    const ok = result.integrity_check === 'ok';
    if (!ok) {
      console.error('⚠️ Database integrity check FAILED:', result.integrity_check);
    }
    return ok;
  } catch (err) {
    console.error('Integrity check error:', err);
    return false;
  }
}

export function scheduleAutoBackup(): void {
  try {
    createBackup('auto');
    pruneOldBackups(12);
  } catch (err: any) {
    // Non-fatal in dev mode - DB might be in different location
    console.warn('Startup backup skipped:', err.message);
  }

  let daysSinceLastBackup = 0;
  setInterval(() => {
    daysSinceLastBackup++;
    if (daysSinceLastBackup >= 30) {
      daysSinceLastBackup = 0;
      try {
        createBackup('auto');
        pruneOldBackups(12);
      } catch (err: any) {
        console.warn('Scheduled backup failed:', err.message);
      }
    }
  }, 24 * 60 * 60 * 1000);
}