import db from '../database/connection';
import type { Cart, CartItem, CartWithItems, CartSummary, Product } from '../types/index';
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

      p.schedule_type as p_schedule_type,

      p.prescription_required as p_prescription_required,

      p.created_at as p_created_at,

      p.updated_at as p_updated_at

    FROM cart_items ci

    INNER JOIN products p
      ON p.product_uuid =
        ci.product_uuid

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

      p_schedule_type: string;

      p_prescription_required: number;

      p_created_at: string;

      p_updated_at: string;
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
            item.p_name,

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
  static updateItem(
    cartUuid: string,
    productUuid: string,
    unitUuid: string,
    updates: {
      quantity?: number;
      price?: number;
      discount?: number;
      tax_percent?: number;
    }): CartItem | undefined {
    const item = db.prepare(`
      SELECT * FROM cart_items
      WHERE cart_uuid = ?
      AND product_uuid = ?
      AND unit_uuid = ?
    `).get(
      cartUuid,
      productUuid,
      unitUuid
    ) as CartItem | undefined;

    if (!item) return undefined;

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

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(
        cartUuid,
        productUuid,
        unitUuid
      );

      db.prepare(`
        UPDATE cart_items 
        SET ${updateFields.join(', ')} 
        WHERE cart_uuid = ?
        AND product_uuid = ?
        AND unit_uuid = ?
      `).run(...values);
    }

    return db.prepare(`
      SELECT * FROM cart_items 
      WHERE cart_uuid = ?
      AND product_uuid = ?
      AND unit_uuid = ?
    `).get(
      cartUuid,
      productUuid,
      unitUuid
    ) as CartItem;
  }

  // Remove item from cart
  static removeItem(
    cartUuid: string,
    productUuid: string,
    unitUuid: string
  ): boolean {
    const result = db.prepare(`
      DELETE FROM cart_items 
      WHERE cart_uuid = ?
      AND product_uuid = ?
      AND unit_uuid = ?
    `).run(
      cartUuid,
      productUuid,
      unitUuid
    );

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
