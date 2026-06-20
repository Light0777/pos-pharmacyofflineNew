import db from '../database/connection';

import type {
  Purchase,
  PurchaseItem,
  PurchaseWithRelations
} from '../types/index';

import { v4 as uuidv4 } from 'uuid';

import {
  ProductUnitModel
} from './ProductUnit';

import {
  ProductBatchModel
} from './ProductBatch';

export class PurchaseModel {

  // =========================
  // CREATE PURCHASE
  // =========================

  static create(data: {
    supplier_uuid?: string;
    invoice_number?: string;
    invoice_date?: string;
    total?: number;
    items: Array<{
      product_uuid: string;
      batch_number: string;
      batch_uuid?: string;
      unit_uuid?: string;
      expiry_date: string;
      manufacture_date?: string;
      quantity: number;
      free_quantity?: number;
      mrp: number;
      ptr?: number;
      rate?: number;
      cost_price: number;
      selling_price?: number;
      gst_percent?: number;
      discount?: number;
      strips?: number;
    }>;
  }): PurchaseWithRelations {

    const purchaseUuid = uuidv4();

    let total = 0;

    const transaction = db.transaction(() => {

      // =========================
      // CREATE PURCHASE
      // =========================

      db.prepare(`

        INSERT INTO purchases (

          purchase_uuid,
          total,
          supplier_uuid,
          invoice_number,
          invoice_date

        ) VALUES (?, 0, ?, ?, ?)

      `).run(

        purchaseUuid,

        data.supplier_uuid || null,

        data.invoice_number || null,

        data.invoice_date || null
      );

      // =========================
      // INSERT PURCHASE ITEM
      // =========================

      const insertItem = db.prepare(`

        INSERT INTO purchase_items (

          purchase_uuid,

          product_uuid,

          batch_number,

          expiry_date,

          manufacture_date,

          quantity,

          unit_uuid,

          normalized_quantity,

          free_quantity,

          mrp,

          ptr,

          rate,

          cost_price,

          selling_price,

          gst_percent,
          discount

        ) VALUES (

          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?

        )

      `);

      // =========================
      // STOCK LEDGER
      // =========================

      const insertStockLedger = db.prepare(`

        INSERT INTO stock_ledgers (

          product_uuid,
          quantity,
          type,
          reference_uuid,
          note

        ) VALUES (

          ?, ?, 'purchase', ?, 'Stock added via purchase'

        )

      `);

      // =========================
      // PROCESS ITEMS
      // =========================

      for (const item of data.items) {

        // =========================
        // VALIDATE PRODUCT
        // =========================

        const product = db.prepare(`

          SELECT *

          FROM products

          WHERE product_uuid = ?

        `).get(

          item.product_uuid

        ) as any;

        if (!product) {

          throw new Error(

            `Product not found: ${item.product_uuid}`

          );
        }

        // =========================
        // RESOLVE UNIT
        // =========================

        let conversionFactor = 1;
        let unitUuid: string | null = null;

        if (item.unit_uuid) {
          const unit = db.prepare(`

            SELECT
              unit_uuid,
              conversion_factor
            FROM product_units
            WHERE unit_uuid = ?
              AND product_uuid = ?

          `).get(
            item.unit_uuid,
            item.product_uuid
          ) as any;

          if (unit) {
            conversionFactor = Number(unit.conversion_factor || 1);
            unitUuid = item.unit_uuid;
          }
        }

        // =========================
        // CALCULATE QUANTITIES
        // =========================

        const normalizedQuantity =

          Number(item.quantity) *
          conversionFactor;

        const normalizedFreeQuantity =

          Number(item.free_quantity || 0) *
          conversionFactor;

        const costPrice =

          Number(item.cost_price);

        const sellingPrice =

          Number(
            item.selling_price || item.mrp
          );

        const gstPercent =

          Number(item.gst_percent || 0);

        const ptr =

          Number(item.ptr || 0);

        const rate =

          Number(item.rate || 0);

        const discount =

          Number(item.discount || 0);

        // =========================
        // INSERT PURCHASE ITEM
        // =========================

        insertItem.run(

          purchaseUuid,

          item.product_uuid,

          item.batch_number,

          item.expiry_date,

          item.manufacture_date || null,

          Number(item.quantity),

          unitUuid,

          normalizedQuantity,

          normalizedFreeQuantity,

          Number(item.mrp),

          ptr,

          rate,

          costPrice,

          sellingPrice,

          gstPercent,

          discount
        );

        // =========================
        // CREATE OR LINK PRODUCT BATCH
        // =========================

        if (item.batch_uuid) {
          ProductBatchModel.update(item.batch_uuid, { purchase_uuid: purchaseUuid, supplier_uuid: data.supplier_uuid });
        } else {
          ProductBatchModel.create({
          product_uuid: item.product_uuid,
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
          manufacture_date: item.manufacture_date,
          mrp: Number(item.mrp),
          ptr: ptr,
          rate: rate,
          purchase_price: costPrice,
          selling_price: sellingPrice,
          gst_percent: gstPercent,
          quantity: normalizedQuantity,
          free_quantity: normalizedFreeQuantity,
          supplier_uuid: data.supplier_uuid,
          purchase_uuid: purchaseUuid,
          strips: item.strips || 0
        });
        }

        // =========================
        // INSERT STOCK LEDGER
        // =========================

        insertStockLedger.run(

          item.product_uuid,

          normalizedQuantity,

          purchaseUuid
        );

        // =========================
        // CALCULATE TOTAL
        // =========================

        total +=

          (normalizedQuantity * costPrice) -
          discount;
      }

      // =========================
      // UPDATE PURCHASE TOTAL
      // =========================

      db.prepare(`

        UPDATE purchases

        SET

          total = ?,
          updated_at = CURRENT_TIMESTAMP

        WHERE purchase_uuid = ?

      `).run(

        data.total !== undefined
          ? Math.round(Number(data.total) * 100) / 100
          : Math.round(total * 100) / 100,

        purchaseUuid
      );

      return purchaseUuid;
    });

    transaction();

    return this.findWithRelations(
      purchaseUuid
    )!;
  }

  // =========================
  // FIND PURCHASE
  // =========================

  static findById(
    uuid: string
  ): Purchase | undefined {

    return db.prepare(`

      SELECT *
      FROM purchases
      WHERE purchase_uuid = ?

    `).get(uuid) as Purchase | undefined;
  }

  // =========================
  // PURCHASE WITH RELATIONS
  // =========================

  static findWithRelations(
    uuid: string
  ): PurchaseWithRelations | undefined {

    const purchase =
      this.findById(uuid);

    if (!purchase) {
      return undefined;
    }

    // PURCHASE ITEMS

    const items = db.prepare(`

      SELECT

        pi.*,

        p.name as product_name,

        p.barcode as product_barcode,

        p.sku as product_sku

      FROM purchase_items pi

      LEFT JOIN products p
      ON pi.product_uuid = p.product_uuid

      WHERE pi.purchase_uuid = ?

    `).all(uuid) as any[];

    // SUPPLIER

    let supplier: any = null;

    if (purchase.supplier_uuid) {

      supplier = db.prepare(`

        SELECT *
        FROM suppliers
        WHERE supplier_uuid = ?

      `).get(
        purchase.supplier_uuid
      ) as any;
    }

    // FORMAT ITEMS

    const formattedItems =
      items.map(item => ({

        id: item.id,

        purchase_uuid:
          item.purchase_uuid,

        product_uuid:
          item.product_uuid,

        batch_number:
          item.batch_number,

        expiry_date:
          item.expiry_date,

        manufacture_date:
          item.manufacture_date,

        quantity: item.quantity,

        free_quantity: item.free_quantity,

        mrp:
          item.mrp,

        ptr:
          item.ptr,

        rate:
          item.rate,

        cost_price:
          item.cost_price,

        selling_price:
          item.selling_price,

        gst_percent:
          item.gst_percent,

        unit_uuid:
          item.unit_uuid,

        discount:
          item.discount ?? 0,

        created_at:
          item.created_at,

        updated_at:
          item.updated_at,

        product: {

          product_uuid:
            item.product_uuid,

          name:
            item.product_name,

          barcode:
            item.product_barcode,

          sku:
            item.product_sku
        }
      }));

    return {

      ...purchase,

      items:
        formattedItems,

      supplier
    };
  }

  // =========================
  // FIND ALL
  // =========================

  static findAll():
    PurchaseWithRelations[] {

    const purchases = db.prepare(`

      SELECT *
      FROM purchases

      ORDER BY created_at DESC

    `).all() as Purchase[];

    return purchases.map(p =>
      this.findWithRelations(
        p.purchase_uuid
      )!
    );
  }

  // =========================
  // FIND BY SUPPLIER
  // =========================

  static findBySupplier(
    supplierUuid: string
  ): PurchaseWithRelations[] {

    const purchases = db.prepare(`

      SELECT *
      FROM purchases

      WHERE supplier_uuid = ?

      ORDER BY created_at DESC

    `).all(
      supplierUuid
    ) as Purchase[];

    return purchases.map(p =>
      this.findWithRelations(
        p.purchase_uuid
      )!
    );
  }

  // =========================
  // GET ITEMS
  // =========================

  static getItems(
    purchaseUuid: string
  ): PurchaseItem[] {

    return db.prepare(`

      SELECT *
      FROM purchase_items

      WHERE purchase_uuid = ?

    `).all(
      purchaseUuid
    ) as PurchaseItem[];
  }

  // =========================
  // UPDATE PURCHASE
  // =========================

  static update(
    uuid: string,
    data: {
      supplier_uuid?: string;
      total?: number;
      invoice_number?: string;
      invoice_date?: string;
      discount?: number;
    }
  ): Purchase | undefined {
    const purchase = this.findById(uuid);
    if (!purchase) return undefined;

    const updateFields: string[] = [];
    const values: any[] = [];

    if (data.supplier_uuid !== undefined) {
      updateFields.push('supplier_uuid = ?');
      values.push(data.supplier_uuid);
    }
    if (data.total !== undefined) {
      updateFields.push('total = ?');
      values.push(data.total);
    }
    if (data.invoice_number !== undefined) {
      updateFields.push('invoice_number = ?');
      values.push(data.invoice_number);
    }
    if (data.invoice_date !== undefined) {
      updateFields.push('invoice_date = ?');
      values.push(data.invoice_date);
    }
    if (data.discount !== undefined) {
      updateFields.push('discount = ?');
      values.push(data.discount);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(uuid);
      db.prepare(`
        UPDATE purchases
        SET ${updateFields.join(', ')}
        WHERE purchase_uuid = ?
      `).run(...values);
    }

    return this.findById(uuid);
  }

  // =========================
  // DELETE PURCHASE
  // =========================

  static delete(
    uuid: string
  ): boolean {

    const purchase =
      this.findById(uuid);

    if (!purchase) {
      return false;
    }

    const transaction =
      db.transaction(() => {

        // GET BATCHES

        const batches = db.prepare(`

          SELECT *
          FROM product_batches

          WHERE purchase_uuid = ?

        `).all(uuid) as any[];

        // DELETE BATCHES

        for (const batch of batches) {

          db.prepare(`

            DELETE FROM product_batches

            WHERE batch_uuid = ?

          `).run(
            batch.batch_uuid
          );

          ProductBatchModel
            .recalculateProductStock(
              batch.product_uuid
            );

          // STOCK LEDGER

          db.prepare(`

            INSERT INTO stock_ledgers (

              product_uuid,
              quantity,
              type,
              reference_uuid,
              note

            ) VALUES (

              ?, ?, 'adjustment', ?, 'Purchase deleted - stock reversed'
            )

          `).run(

            batch.product_uuid,

            -batch.quantity,

            uuid
          );
        }

        // DELETE PURCHASE ITEMS

        db.prepare(`

          DELETE FROM purchase_items

          WHERE purchase_uuid = ?

        `).run(uuid);

        // DELETE PURCHASE

        const result = db.prepare(`

          DELETE FROM purchases

          WHERE purchase_uuid = ?

        `).run(uuid);

        return result.changes > 0;
      });

    return transaction();
  }
}
