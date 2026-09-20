import db from '../database/connection';
import type { Cart, CartItem, CartWithItems, CartSummary, Product } from '../types/index';
import { ProductUnitModel } from './ProductUnit';
import { v4 as uuidv4 } from 'uuid';

export class CartModel {
  // Create new cart
  static create(): Cart {
    const uuid = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO carts (cart_uuid, status, discount)
      VALUES (?, 'active', 0.00)
    `);

    stmt.run(uuid);
    return this.findById(uuid)!;
  }

  // Find cart by UUID
  static findById(uuid: string): Cart | undefined {
    const stmt = db.prepare('SELECT * FROM carts WHERE cart_uuid = ?');
    return stmt.get(uuid) as Cart | undefined;
  }

  // Get cart with items and product details
  static findWithItems(
    uuid: string
  ): CartWithItems | undefined {

    const cart = this.findById(uuid);

    if (!cart) {
      return undefined;
    }

    // =========================
    // FETCH CART ITEMS
    // =========================

    const items = db.prepare(`

    SELECT

      ci.id,

      ci.cart_uuid,

      ci.product_uuid,

      ci.unit_uuid,

      ci.batch_uuid,

      ci.quantity,

      ci.price,

      ci.discount,

      ci.tax_percent,

      ci.created_at,

      ci.updated_at,

      p.product_uuid as p_product_uuid,

      p.name as p_name,

      p.category_uuid as p_category_uuid,

      p.barcode as p_barcode,

      p.sku as p_sku,

      p.manufacturer as p_manufacturer,

      p.hsn_code as p_hsn_code,

      p.gst_percent as p_gst_percent,

      p.purchase_price as p_purchase_price,

      p.price as p_selling_price,

      p.stock as p_stock,

      p.unit as p_unit,

      p.image as p_image,

      p.schedule_type as p_schedule_type,

      p.prescription_required as p_prescription_required,

      p.created_at as p_created_at,

      p.updated_at as p_updated_at,

      ci.free_quantity,

      ci.is_custom,

      ci.custom_name,

      u.unit_name as unit_name,

      pb.batch_number as batch_number,

      pb.expiry_date as batch_expiry_date

    FROM cart_items ci

    INNER JOIN products p
      ON p.product_uuid =
        ci.product_uuid

    LEFT JOIN product_units u
      ON u.unit_uuid =
        ci.unit_uuid

    LEFT JOIN product_batches pb
      ON pb.batch_uuid =
        ci.batch_uuid

    WHERE ci.cart_uuid = ?
  `).all(uuid) as Array<{

      id: number;

      cart_uuid: string;

      product_uuid: string;

      unit_uuid: string;

      batch_uuid: string | null;

      quantity: number;

      price: number;

      discount: number;

      tax_percent: number;

      created_at: string;

      updated_at: string;

      p_product_uuid: string;

      p_name: string;

      p_category_uuid: string | null;

      p_barcode: string | null;

      p_sku: string | null;

      p_manufacturer: string | null;

      p_hsn_code: string | null;

      p_gst_percent: number;

      p_purchase_price: number;

      p_selling_price: number;

      p_stock: number;

      p_unit: string;

      p_image: string | null;

      p_schedule_type: string;

      p_prescription_required: number;

      p_created_at: string;

      p_updated_at: string;

      free_quantity: number | null;

      is_custom: number | null;

      custom_name: string | null;

      unit_name: string | null;

      batch_number: string | null;

      batch_expiry_date: string | null;
    }>;

    // =========================
    // CALCULATE SUMMARY
    // =========================

    const summary = this.calculateSummary(
      items as CartItem[],
      cart.discount
    );

    // =========================
    // FORMAT ITEMS
    // =========================

    const formattedItems: (
      CartItem & { product?: Product }
    )[] = items.map((item) => {

      const baseAmount =
        item.price * item.quantity;

      const discount =
        Number(item.discount || 0);

      const taxableAmount =
        baseAmount - discount;

      const gstAmount =
        (
          taxableAmount *
          item.tax_percent
        ) / 100;

      const total =
        taxableAmount + gstAmount;

      return {

        id:
          item.id,

        cart_uuid:
          item.cart_uuid,

        product_uuid:
          item.product_uuid,

        unit_uuid:
          item.unit_uuid,

        batch_uuid:
          item.batch_uuid || undefined,

        free_quantity:
          Number((item as any).free_quantity || 0),

        is_custom:
          Number((item as any).is_custom || 0),

        custom_name:
          (item as any).custom_name || undefined,

        unit_name:
          (item as any).unit_name || undefined,

        batch_number:
          (item as any).batch_number || undefined,

        batch_expiry_date:
          (item as any).batch_expiry_date || undefined,

        quantity:
          item.quantity,

        price:
          Number(
            item.price.toFixed(2)
          ),

        discount:
          Number(
            discount.toFixed(2)
          ),

        tax_percent:
          Number(
            item.tax_percent.toFixed(2)
          ),

        created_at:
          item.created_at,

        updated_at:
          item.updated_at,

        product: {

          product_uuid:
            item.p_product_uuid,

          name:
            Number((item as any).is_custom) === 1 && (item as any).custom_name
              ? (item as any).custom_name
              : item.p_name,

          category_uuid:
            item.p_category_uuid || undefined,

          barcode:
            item.p_barcode || undefined,

          sku:
            item.p_sku || undefined,

          manufacturer:
            item.p_manufacturer || undefined,

          hsn_code:
            item.p_hsn_code || undefined,

          gst_percent:
            item.p_gst_percent,

          purchase_price:
            item.p_purchase_price,

          price:
            item.p_selling_price,

          stock:
            item.p_stock,

          unit:
            item.p_unit,

          image:
            item.p_image || undefined,

          schedule_type:
            item.p_schedule_type,

          prescription_required:
            item.p_prescription_required,

          created_at:
            item.p_created_at,

          updated_at:
            item.p_updated_at
        },

        // OPTIONAL EXTRA FIELDS
        // (safe for runtime usage)

        gst_amount:
          Number(
            gstAmount.toFixed(2)
          ),

        total:
          Number(
            total.toFixed(2)
          )
      };
    });

    // =========================
    // RETURN
    // =========================

    return {

      ...cart,

      items:
        formattedItems,

      summary
    };
  }

  // Calculate cart summary
  static calculateSummary(items: CartItem[], billDiscount: number = 0): CartSummary {
    let total = 0;
    let itemDiscountTotal = 0;
    let taxTotal = 0;

    for (const item of items) {
      const itemBase = item.price * item.quantity;
      const itemDiscount = item.discount || 0;
      const itemNet = itemBase - itemDiscount;
      const taxAmount = (itemNet * item.tax_percent) / 100;

      total += itemBase;
      itemDiscountTotal += itemDiscount;
      taxTotal += taxAmount;
    }

    const grandTotal = total - itemDiscountTotal - billDiscount + taxTotal;

    return {
      total: Math.round(total * 100) / 100,
      item_discount: Math.round(itemDiscountTotal * 100) / 100,
      bill_discount: Math.round(billDiscount * 100) / 100,
      tax: Math.round(taxTotal * 100) / 100,
      grand_total: Math.round(grandTotal * 100) / 100
    };
  }

  // Add item to cart
  static addItem(
    cartUuid: string,
    productUuid: string,
    unitUuid: string,
    quantity: number,
    price: number,
    taxPercent: number,
    batchUuid?: string
  ): CartItem {
    // Debug: show cart_items table columns
    console.log('cart_items columns:', db.prepare('PRAGMA table_info(cart_items)').all());

    // Check if item already exists in cart
    const existingItem = db.prepare(`
      SELECT * FROM cart_items 
      WHERE cart_uuid = ?
      AND product_uuid = ?
      AND unit_uuid = ?
      AND (batch_uuid IS NULL AND ? IS NULL OR batch_uuid = ?)
    `).get(
      cartUuid,
      productUuid,
      unitUuid,
      batchUuid || null,
      batchUuid || null
    ) as CartItem | undefined;

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      db.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price = ?, 
            tax_percent = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newQuantity, price, taxPercent, existingItem.id);

      return db.prepare('SELECT * FROM cart_items WHERE id = ?').get(existingItem.id) as CartItem;
    } else {
      // Insert new item
      const stmt = db.prepare(`

        INSERT INTO cart_items (

          cart_uuid,
          product_uuid,
          unit_uuid,
          batch_uuid,
          quantity,
          price,
          discount,
          tax_percent

        ) VALUES (

          ?, ?, ?, ?, ?, ?, ?, ?

        )

      `);

      console.log({

        cartUuid,

        productUuid,

        unitUuid,

        quantity,

        price,

        taxPercent

      });

      const result = stmt.run(

        cartUuid,

        productUuid,

        unitUuid || null,

        batchUuid || null,

        Number(quantity),

        Number(price),

        0,

        Number(taxPercent || 0)
      );

      return db.prepare('SELECT * FROM cart_items WHERE id = ?').get(result.lastInsertRowid) as CartItem;
    }
  }

  // Update cart item
  // Add a custom (ad-hoc) row backed by the sentinel product
  static addCustomItem(
    cartUuid: string,
    input: {
      name: string;
      price: number;
      gst_percent: number;
      quantity: number;
      free_quantity?: number;
    }
  ): CartItem {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Custom item name is required');

    const qty = Math.floor(Number(input.quantity));
    if (!qty || qty < 1) throw new Error('Quantity must be at least 1');

    const price = Number(input.price);
    if (isNaN(price) || price < 0) throw new Error('Invalid custom item price');

    let gst = Number(input.gst_percent || 0);
    if (isNaN(gst) || gst < 0) gst = 0;
    if (gst > 100) gst = 100;

    const units = ProductUnitModel.getByProduct('custom-item') as any[];
    const base = units.find((u) => Number(u.is_base_unit) === 1) || units[0];
    if (!base) throw new Error('Custom item unit is not configured');

    const result = db.prepare(`
      INSERT INTO cart_items (
        cart_uuid, product_uuid, unit_uuid, batch_uuid,
        quantity, price, discount, tax_percent,
        free_quantity, is_custom, custom_name
      ) VALUES (
        ?, 'custom-item', ?, NULL,
        ?, ?, 0, ?,
        ?, 1, ?
      )
    `).run(
      cartUuid,
      base.unit_uuid,
      qty,
      price,
      gst,
      Math.max(0, Math.floor(Number(input.free_quantity) || 0)),
      name
    );

    return db.prepare('SELECT * FROM cart_items WHERE id = ?').get(result.lastInsertRowid) as CartItem;
  }

  // Update cart item
  //
  // Supports scalar edits (quantity / price / discount / tax / free qty)
  // plus in-place batch and unit switches that preserve the row's position.
  // matchBatchUuid pins the exact row when sibling lines share product+unit.
  static updateItem(
    cartUuid: string,
    productUuid: string,
    unitUuid: string,
    updates: {
      quantity?: number;
      price?: number;
      discount?: number;
      tax_percent?: number;
      free_quantity?: number;
      batch_uuid?: string | null;
      new_unit_uuid?: string;
    },
    matchBatchUuid?: string | null
  ): CartItem | undefined {
    const rows = db.prepare(`
      SELECT * FROM cart_items
      WHERE cart_uuid = ?
      AND product_uuid = ?
      AND unit_uuid = ?
    `).all(
      cartUuid,
      productUuid,
      unitUuid
    ) as CartItem[];

    if (rows.length === 0) return undefined;

    let item: CartItem | undefined;
    if (matchBatchUuid !== undefined) {
      item = rows.find((r) => ((r as any).batch_uuid || null) === (matchBatchUuid || null));
      if (!item) return undefined;
    } else {
      item = rows[0];
    }

    // ── In-place unit switch (row keeps its position) ──
    if (updates.new_unit_uuid && updates.new_unit_uuid !== item.unit_uuid) {
      const newUnit = ProductUnitModel.findById(String(updates.new_unit_uuid));
      if (!newUnit || (newUnit as any).product_uuid !== item.product_uuid) {
        throw new Error('Invalid unit for this product');
      }
      const targetBatch =
        updates.batch_uuid !== undefined
          ? updates.batch_uuid
          : (item as any).batch_uuid;
      const conflict = db.prepare(`
        SELECT * FROM cart_items
        WHERE cart_uuid = ?
        AND product_uuid = ?
        AND unit_uuid = ?
        AND ((batch_uuid IS NULL AND ? IS NULL) OR batch_uuid = ?)
        AND id != ?
      `).get(
        cartUuid,
        productUuid,
        String(updates.new_unit_uuid),
        targetBatch || null,
        targetBatch || null,
        (item as any).id
      ) as CartItem | undefined;
      if (conflict) {
        // Merge into the conflicting row and drop this one
        db.prepare(`
          UPDATE cart_items
          SET quantity = quantity + ?,
              free_quantity = COALESCE(free_quantity, 0) + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          item.quantity,
          (item as any).free_quantity || 0,
          (conflict as any).id
        );
        db.prepare(`DELETE FROM cart_items WHERE id = ?`).run((item as any).id);
        return db.prepare(`SELECT * FROM cart_items WHERE id = ?`).get((conflict as any).id) as CartItem;
      }
      // Adopt the new unit's default price only if the row still had the old default
      const oldUnit = ProductUnitModel.findById(String(item.unit_uuid));
      const oldDefault = (oldUnit as any)?.price;
      db.prepare(`
        UPDATE cart_items
        SET unit_uuid = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(String(updates.new_unit_uuid), (item as any).id);
      item = db.prepare(`SELECT * FROM cart_items WHERE id = ?`).get((item as any).id) as CartItem;
      if (
        updates.price === undefined &&
        oldDefault !== undefined &&
        oldDefault !== null &&
        Number(item.price) === Number(oldDefault)
      ) {
        const newDefault = (newUnit as any).price;
        if (newDefault !== undefined && newDefault !== null) {
          updates.price = Number(newDefault);
        }
      }
    }

    // ── Batch switch (validated; stock moves only at checkout) ──
    if (
      updates.batch_uuid !== undefined &&
      ((updates.batch_uuid || null) !== ((item as any).batch_uuid || null))
    ) {
      if (updates.batch_uuid) {
        const batch = db.prepare(
          `SELECT * FROM product_batches WHERE batch_uuid = ?`
        ).get(String(updates.batch_uuid)) as any;
        if (!batch || batch.product_uuid !== item.product_uuid) {
          throw new Error('Invalid batch for this product');
        }
      }
    }

    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.quantity !== undefined) {
      updateFields.push('quantity = ?');
      values.push(updates.quantity);
    }
    if (updates.price !== undefined) {
      updateFields.push('price = ?');
      values.push(updates.price);
    }
    if (updates.discount !== undefined) {
      updateFields.push('discount = ?');
      values.push(updates.discount);
    }
    if (updates.tax_percent !== undefined) {
      updateFields.push('tax_percent = ?');
      values.push(updates.tax_percent);
    }
    if (updates.free_quantity !== undefined) {
      updateFields.push('free_quantity = ?');
      values.push(Math.max(0, Number(updates.free_quantity) || 0));
    }
    if (updates.batch_uuid !== undefined) {
      updateFields.push('batch_uuid = ?');
      values.push(updates.batch_uuid || null);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push((item as any).id);

      db.prepare(`
        UPDATE cart_items
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `).run(...values);
    }

    return db.prepare(`
      SELECT * FROM cart_items
      WHERE id = ?
    `).get(
      (item as any).id
    ) as CartItem;
  }

  // Remove item from cart (optionally pinned to one batch among sibling lines)
  static removeItem(
    cartUuid: string,
    productUuid: string,
    unitUuid: string,
    matchBatchUuid?: string | null
  ): boolean {
    let sql = `
      DELETE FROM cart_items
      WHERE cart_uuid = ?
      AND product_uuid = ?
      AND unit_uuid = ?
    `;
    const params: any[] = [
      cartUuid,
      productUuid,
      unitUuid
    ];
    if (matchBatchUuid !== undefined) {
      sql += ` AND ((batch_uuid IS NULL AND ? IS NULL) OR batch_uuid = ?)`;
      params.push(matchBatchUuid || null, matchBatchUuid || null);
    }
    const result = db.prepare(sql).run(...params);

    return result.changes > 0;
  }

  // Apply bill discount
  static applyDiscount(cartUuid: string, discount: number): Cart | undefined {
    db.prepare(`
      UPDATE carts 
      SET discount = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE cart_uuid = ?
    `).run(discount, cartUuid);

    return this.findById(cartUuid);
  }

  // Update cart status
  static updateStatus(cartUuid: string, status: Cart['status']): Cart | undefined {
    db.prepare(`
      UPDATE carts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE cart_uuid = ?
    `).run(status, cartUuid);

    return this.findById(cartUuid);
  }

  // Hold cart
  static hold(cartUuid: string): Cart | undefined {
    return this.updateStatus(cartUuid, 'held');
  }

  // Resume cart
  static resume(cartUuid: string): Cart | undefined {
    return this.updateStatus(cartUuid, 'active');
  }

  // Get all held carts
  static getHeldCarts(): Cart[] {
    const stmt = db.prepare(`
      SELECT * FROM carts 
      WHERE status = 'held' 
      ORDER BY updated_at DESC
    `);
    return stmt.all() as Cart[];
  }

  // Get all active carts
  static getActiveCarts(): Cart[] {
    const stmt = db.prepare(`
      SELECT * FROM carts 
      WHERE status = 'active' 
      ORDER BY created_at DESC
    `);
    return stmt.all() as Cart[];
  }

  // Clear all items from cart
  static clearCart(cartUuid: string): void {
    db.prepare('DELETE FROM cart_items WHERE cart_uuid = ?').run(cartUuid);
    db.prepare(`
      UPDATE carts 
      SET discount = 0.00, updated_at = CURRENT_TIMESTAMP 
      WHERE cart_uuid = ?
    `).run(cartUuid);
  }

  // Delete cart and all its items
  static delete(cartUuid: string): boolean {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM cart_items WHERE cart_uuid = ?').run(cartUuid);
      const result = db.prepare('DELETE FROM carts WHERE cart_uuid = ?').run(cartUuid);
      return result.changes > 0;
    });

    return transaction();
  }

  // Get all carts
  static getAll(): Cart[] {
    try {
      const stmt = db.prepare(`
      SELECT *
      FROM carts
      ORDER BY created_at DESC
    `);

      return stmt.all() as Cart[];
    } catch (error) {
      console.error('Get all carts model error:', error);
      return [];
    }
  }

  static deleteByUuid(cartUuid: string): boolean {
    try {
      console.log('Deleting cart:', cartUuid);

      db.prepare(`
      DELETE FROM cart_items
      WHERE cart_uuid = ?
    `).run(cartUuid);

      const result = db.prepare(`
      DELETE FROM carts
      WHERE cart_uuid = ?
    `).run(cartUuid);

      console.log('Delete result:', result);

      return result.changes > 0;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

}
