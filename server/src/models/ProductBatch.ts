import db from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import type { ProductBatch, ProductBatchCreateInput } from '../types';
import { AuditLogModel } from './AuditLog';

export class ProductBatchModel {

  static readonly MIN_EXPIRY_DAYS = 30;
  static readonly NEAR_EXPIRY_DAYS = 90;

  // =========================
  // CREATE
  // =========================

  static create(input: ProductBatchCreateInput): ProductBatch {
    const batchUuid = uuidv4();

    const today = new Date().toISOString().split('T')[0];
    if (input.expiry_date <= today) {
      throw new Error('Expired batch cannot be added');
    }

    const stmt = db.prepare(`
      INSERT INTO product_batches (
        batch_uuid, product_uuid, batch_number, expiry_date, manufacture_date,
        mrp, ptr, rate, purchase_price, selling_price, gst_percent,
        quantity, sold_quantity, free_quantity, is_quarantined,
        supplier_uuid, purchase_uuid, strips
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    stmt.run(
      batchUuid,
      input.product_uuid,
      input.batch_number,
      input.expiry_date,
      input.manufacture_date || null,
      input.mrp,
      input.ptr || 0,
      input.rate || 0,
      input.purchase_price || 0,
      input.selling_price || 0,
      input.gst_percent || 0,
      input.quantity,
      0,
      input.free_quantity || 0,
      0,
      input.supplier_uuid || null,
      input.purchase_uuid || null,
      input.strips || 0
    );

    this.recalculateProductStock(input.product_uuid);
    return this.findById(batchUuid)!;
  }

  // =========================
  // FIND BY ID
  // =========================

  static findById(uuid: string): ProductBatch | undefined {
    const stmt = db.prepare(`SELECT * FROM product_batches WHERE batch_uuid = ?`);
    return stmt.get(uuid) as ProductBatch | undefined;
  }

  // =========================
  // FIND BY BATCH NUMBER
  // =========================

  static findByBatchNumber(
    product_uuid: string,
    batch_number: string
  ): ProductBatch | undefined {

    const stmt = db.prepare(`
    SELECT *
    FROM product_batches
    WHERE product_uuid = ?
    AND batch_number = ?
    LIMIT 1
  `);

    return stmt.get(
      product_uuid,
      batch_number
    ) as ProductBatch | undefined;
  }

  // =========================
  // UPDATE
  // =========================

  static update(
    batch_uuid: string,
    updates: Partial<ProductBatchCreateInput>
  ): ProductBatch | undefined {

    const batch =
      this.findById(batch_uuid);

    if (!batch) {
      return undefined;
    }

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {

      if (value === undefined) {
        continue;
      }

      fields.push(`${key} = ?`);
      values.push(value);
    }

    if (!fields.length) {
      return batch;
    }

    fields.push(
      'updated_at = CURRENT_TIMESTAMP'
    );

    values.push(batch_uuid);

    db.prepare(`
    UPDATE product_batches
    SET ${fields.join(', ')}
    WHERE batch_uuid = ?
  `).run(...values);

    const updated =
      this.findById(batch_uuid)!;

    this.recalculateProductStock(
      updated.product_uuid
    );

    return updated;
  }

  // =========================
  // GET BY PRODUCT
  // =========================

  static getByProduct(product_uuid: string): ProductBatch[] {
    const stmt = db.prepare(`
      SELECT * FROM product_batches
      WHERE product_uuid = ?
      ORDER BY expiry_date ASC
    `);
    return stmt.all(product_uuid) as ProductBatch[];
  }

  // =========================
  // AVAILABLE FEFO BATCHES
  // =========================

  static getAvailableBatches(product_uuid: string): ProductBatch[] {
    const stmt = db.prepare(`
      SELECT * FROM product_batches
      WHERE
        product_uuid = ?
        AND quantity > 0
        AND is_quarantined = 0
        AND expiry_date > DATE('now')
      ORDER BY expiry_date ASC
    `);
    return stmt.all(product_uuid) as ProductBatch[];
  }

  // =========================
  // RECALCULATE STOCK
  // =========================

  static recalculateProductStock(product_uuid: string): void {
    const result = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM product_batches
      WHERE product_uuid = ? AND quantity > 0
    `).get(product_uuid) as { total: number };

    db.prepare(`
      UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP
      WHERE product_uuid = ?
    `).run(result.total || 0, product_uuid);
  }

  // =========================
  // UPDATE QUANTITY
  // =========================

  static updateQuantity(
    batch_uuid: string,
    quantity: number,
    operation: 'add' | 'subtract'
  ): ProductBatch | undefined {
    const batch = this.findById(batch_uuid);
    if (!batch) return undefined;

    const newQuantity = operation === 'add'
      ? batch.quantity + quantity
      : batch.quantity - quantity;

    if (newQuantity < 0) throw new Error('Insufficient batch stock');

    const soldQuantity = operation === 'subtract'
      ? batch.sold_quantity + quantity
      : Math.max(batch.sold_quantity - quantity, 0);

    db.prepare(`
      UPDATE product_batches
      SET quantity = ?, sold_quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE batch_uuid = ?
    `).run(newQuantity, soldQuantity, batch_uuid);

    this.recalculateProductStock(batch.product_uuid);
    return this.findById(batch_uuid);
  }

  // =========================
  // FEFO CONSUMPTION
  // =========================

  static consumeStockFEFO(product_uuid: string, quantity: number): { batch_uuid: string; quantity: number }[] {
    const batches = this.getAvailableBatches(product_uuid);
    if (!batches.length) throw new Error('No saleable batches available');

    let remaining = quantity;
    const consumed: { batch_uuid: string; quantity: number }[] = [];

    for (const batch of batches) {
      if (remaining <= 0) break;
      const deductQty = Math.min(batch.quantity, remaining);
      this.updateQuantity(batch.batch_uuid, deductQty, 'subtract');
      consumed.push({ batch_uuid: batch.batch_uuid, quantity: deductQty });
      remaining -= deductQty;
    }

    if (remaining > 0) throw new Error('Insufficient valid FEFO stock');
    return consumed;
  }

  static consumeStock(batch_uuid: string, quantity: number): { batch_uuid: string; quantity: number } {
    const batch = db.prepare(`SELECT * FROM product_batches WHERE batch_uuid = ?`).get(batch_uuid) as ProductBatch | undefined;
    if (!batch) throw new Error('Batch not found');
    if (batch.quantity < quantity) throw new Error(`Insufficient stock in batch ${batch.batch_number}. Available: ${batch.quantity}, requested: ${quantity}`);
    this.updateQuantity(batch_uuid, quantity, 'subtract');
    return { batch_uuid, quantity };
  }

  // =========================
  // DELETE BATCH
  // =========================

  static deleteBatch(batch_uuid: string): { success: boolean; reason?: string } {
    const batch = this.findById(batch_uuid);
    if (!batch) return { success: false, reason: 'not_found' };

    try {
      const result = db.prepare(`
        DELETE FROM product_batches WHERE batch_uuid = ?
      `).run(batch_uuid);

      if (result.changes > 0) {
        this.recalculateProductStock(batch.product_uuid);
        return { success: true };
      }
      return { success: false, reason: 'not_found' };
    } catch (err: any) {
      if (err?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return { success: false, reason: 'has_references' };
      }
      throw err;
    }
  }

  // =========================
  // NEAR EXPIRY
  // =========================

  static getNearExpiry(): Array<{
    product_uuid: string; product_name: string; batch_uuid: string;
    batch_number: string; expiry_date: string; remaining_qty: number; days_left: number;
  }> {
    const stmt = db.prepare(`
      SELECT
        pb.batch_uuid, pb.product_uuid, p.name as product_name,
        pb.batch_number, pb.expiry_date, pb.quantity as remaining_qty,
        CAST(julianday(pb.expiry_date) - julianday('now') AS INTEGER) as days_left
      FROM product_batches pb
      INNER JOIN products p ON p.product_uuid = pb.product_uuid
      WHERE
        pb.expiry_date <= DATE('now', '+' || ? || ' day')
        AND pb.quantity > 0
        AND pb.is_quarantined = 0
      ORDER BY pb.expiry_date ASC
    `);
    return stmt.all(this.NEAR_EXPIRY_DAYS) as any[];
  }

  // =========================
  // GET EXPIRED (not quarantined)
  // =========================

  static getExpired(): Array<{
    product_uuid: string; product_name: string; batch_uuid: string;
    batch_number: string; expiry_date: string; quantity: number; mrp: number;
  }> {
    const stmt = db.prepare(`
      SELECT
        pb.batch_uuid, pb.product_uuid, p.name as product_name,
        pb.batch_number, pb.expiry_date, pb.quantity, pb.mrp
      FROM product_batches pb
      INNER JOIN products p ON p.product_uuid = pb.product_uuid
      WHERE
        pb.expiry_date <= DATE('now')
        AND pb.quantity > 0
      ORDER BY pb.expiry_date ASC
    `);
    return stmt.all() as any[];
  }

  // =========================
  // QUARANTINE EXPIRED
  // =========================

  // =========================
  // SEARCH BY BATCH NUMBER (across all products)
  // =========================

  static searchByBatchNumber(query: string): { batch_uuid: string; product_uuid: string; batch_number: string }[] {
    const stmt = db.prepare(`
      SELECT batch_uuid, product_uuid, batch_number
      FROM product_batches
      WHERE batch_number LIKE ?
      GROUP BY product_uuid
      ORDER BY batch_number ASC
    `);
    return stmt.all(`%${query}%`) as { batch_uuid: string; product_uuid: string; batch_number: string }[];
  }

  static quarantineExpired(): number {
    const expiredBatches = db.prepare(`
      SELECT batch_uuid, product_uuid, expiry_date
      FROM product_batches
      WHERE expiry_date <= DATE('now') AND is_quarantined = 0
    `).all() as Array<{ batch_uuid: string; product_uuid: string; expiry_date: string }>;

    const result = db.prepare(`
      UPDATE product_batches
      SET is_quarantined = 1, updated_at = CURRENT_TIMESTAMP
      WHERE expiry_date <= DATE('now') AND is_quarantined = 0
    `).run();

    const affectedProducts = new Set<string>();
    for (const batch of expiredBatches) affectedProducts.add(batch.product_uuid);
    for (const productUuid of affectedProducts) this.recalculateProductStock(productUuid);

    for (const batch of expiredBatches) {
      AuditLogModel.create({
        action_type: 'batch_quarantined',
        entity_type: 'product_batch',
        entity_uuid: batch.batch_uuid,
        details: JSON.stringify({ expiry_date: batch.expiry_date })
      });
    }

    return result.changes;
  }
}