import db from '../database/connection';
import crypto from 'crypto';
import os from 'os';

// Stable machine fingerprint: hostname + the full sorted CPU model set +
// platform + arch. Core enumeration order can vary between boots (and RAM
// size changes with upgrades), so anything order- or size-dependent must
// never feed this hash — otherwise the same PC looks like "another machine".
function getMachineId(): string {
  const cpuModels = [...new Set(os.cpus().map((c) => c.model))].sort().join('|');
  const info = [os.hostname(), cpuModels, os.platform(), os.arch()].join('|');
  return crypto.createHash('md5').update(info).digest('hex');
}

export class LicenseService {

  static generateKey(customerName: string): string {
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    const hash = crypto.createHash('md5')
      .update(customerName + random + 'INSTANTBILL2026')
      .digest('hex')
      .substring(0, 4)
      .toUpperCase();
    return `IB-${random}-${hash}`;
  }

  static activate(licenseKey: string): { success: boolean; error?: string } {
    try {
      if (!licenseKey.match(/^IB-[A-F0-9]{8}-[A-F0-9]{4}$/)) {
        return { success: false, error: 'Invalid license key format' };
      }

      const currentMachineId = getMachineId();

      const existing = db.prepare('SELECT * FROM license LIMIT 1').get() as any;
      if (existing) {
        if (existing.machine_id === currentMachineId) {
          return { success: true };
        }
        // Stale row (reinstall, hardware change, DB moved from another PC):
        // a format-valid key always rebinds to this machine. The old
        // "another machine" error only ever locked out legit owners — machine
        // binding never stopped key reuse on fresh installs anyway.
        db.prepare(`
          UPDATE license
          SET license_key = ?, machine_id = ?, activated_at = CURRENT_TIMESTAMP
        `).run(licenseKey, currentMachineId);

        return { success: true };
      }

      db.prepare(`
        INSERT INTO license (license_key, machine_id, activated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run(licenseKey, currentMachineId);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  static isLicensed(): boolean {
    try {
      const license = db.prepare('SELECT * FROM license LIMIT 1').get() as any;
      if (!license) return false;

      const currentMachineId = getMachineId();
      return license.machine_id === currentMachineId;
    } catch {
      return false;
    }
  }
}