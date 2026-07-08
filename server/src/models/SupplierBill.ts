import db from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import type { SupplierBill } from '../types';

export class SupplierBillModel {
  static create(data: { supplier_uuid: string; bill_image?: string }): SupplierBill {
    const billUuid = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO supplier_bills (bill_uuid, supplier_uuid, bill_image)
      VALUES (?, ?, ?)
    `);
    stmt.run(billUuid, data.supplier_uuid, data.bill_image || null);
    return this.findById(billUuid)!;
  }

  static findById(uuid: string): SupplierBill | undefined {
    return db.prepare('SELECT * FROM supplier_bills WHERE bill_uuid = ?').get(uuid) as SupplierBill | undefined;
  }

  static findBySupplier(supplier_uuid: string): SupplierBill[] {
    return db.prepare('SELECT * FROM supplier_bills WHERE supplier_uuid = ? ORDER BY created_at DESC').all(supplier_uuid) as SupplierBill[];
  }

  static delete(uuid: string): boolean {
    const result = db.prepare('DELETE FROM supplier_bills WHERE bill_uuid = ?').run(uuid);
    return result.changes > 0;
  }
}
