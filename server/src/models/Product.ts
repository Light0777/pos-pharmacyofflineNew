// models/Product.ts

import db from '../database/connection';
import {
  Product,
  ProductAttribute,
  ProductCreateInput,
  ProductUpdateInput
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ProductModel {

  // =========================
  // CREATE PRODUCT
  // =========================

  static create(input: ProductCreateInput): Product {
    const productUuid = uuidv4();

    const productStmt = db.prepare(`
      INSERT INTO products (
        product_uuid,
        name,
        category_uuid,
        barcode,
        sku,
        manufacturer,
        composition,
        description,
        schedule_type,
        prescription_required,
        rack_location,
        unit,
        price,
        purchase_price,
        gst_percent,
        stock,
        hsn_code,
        image,
        discount,
        boxes,
        strips_per_box,
        tablets_per_strip,
        extra_tablets,
        price_per_box,
        price_per_strip,
        price_per_tablet
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    productStmt.run(
      productUuid,
      input.name,
      input.category_uuid || null,
      input.barcode || null,
      input.sku || null,
      input.manufacturer || null,
      input.composition || null,
      input.description || null,
      input.schedule_type || 'NONE',
      input.prescription_required ? 1 : 0,
      input.rack_location || null,
      input.unit || 'piece',
      input.price,
      input.purchase_price || 0,
      input.gst_percent || 0,
      input.stock || 0,
      input.hsn_code || null,
      input.image || null,
      input.discount || 0,
      input.boxes || 0,
      input.strips_per_box || 0,
      input.tablets_per_strip || 0,
      input.extra_tablets || 0,
      input.price_per_box || 0,
      input.price_per_strip || 0,
      input.price_per_tablet || 0
    );

    return this.findById(productUuid)!;
  }

  // =========================
  // FIND PRODUCT BY ID
  // =========================

  static findById(uuid: string): Product | undefined {

    const productStmt = db.prepare(`
      SELECT * FROM products
      WHERE product_uuid = ?
    `);

    const product = productStmt.get(uuid) as Product | undefined;

    return product;
  }

  // =========================
  // GET PRODUCT ATTRIBUTES
  // =========================

  static getAttributes(productUuid: string): ProductAttribute[] {

    const stmt = db.prepare(`
      SELECT
        pa.attribute_uuid,
        a.name,
        pa.value
      FROM product_attributes pa
      INNER JOIN attributes a
      ON a.attribute_uuid = pa.attribute_uuid
      WHERE pa.product_uuid = ?
    `);

    return stmt.all(productUuid) as ProductAttribute[];
  }

  // =========================
  // FIND BY BARCODE
  // =========================

  static findByBarcode(barcode: string): Product | undefined {

    const stmt = db.prepare(`
      SELECT * FROM products
      WHERE barcode = ?
    `);

    const product = stmt.get(barcode) as Product | undefined;

    if (!product) return undefined;

    product.attributes = this.getAttributes(product.product_uuid);

    return product;
  }

  // =========================
  // FIND BY SKU
  // =========================

  static findBySku(sku: string): Product | undefined {

    const stmt = db.prepare(`
      SELECT * FROM products
      WHERE sku = ?
    `);

    const product = stmt.get(sku) as Product | undefined;

    if (!product) return undefined;

    product.attributes = this.getAttributes(product.product_uuid);

    return product;
  }

  // =========================
  // FIND BY NAME
  // =========================

  static findByName(
    name: string
  ): Product | undefined {

    const stmt = db.prepare(`
    SELECT *
    FROM products
    WHERE name = ?
    LIMIT 1
  `);

    const product =
      stmt.get(name) as Product | undefined;

    if (!product) {
      return undefined;
    }

    product.attributes =
      this.getAttributes(
        product.product_uuid
      );

    return product;
  }


  /**
   * Bulk find products by names and barcodes
   */
  static bulkFindByNamesAndBarcodes(
    names: string[],
    barcodes: string[]
  ): Product[] {
    if (names.length === 0 && barcodes.length === 0) return [];

    const conditions: string[] = [];
    const params: string[] = [];

    // Add name conditions
    if (names.length > 0) {
      const namePlaceholders = names.map(() => '?').join(',');
      conditions.push(`name IN (${namePlaceholders})`);
      params.push(...names);
    }

    // Add barcode conditions
    if (barcodes.length > 0) {
      const barcodePlaceholders = barcodes.map(() => '?').join(',');
      conditions.push(`barcode IN (${barcodePlaceholders})`);
      params.push(...barcodes);
    }

    const stmt = db.prepare(`
    SELECT * FROM products
    WHERE ${conditions.join(' OR ')}
    ORDER BY name ASC
  `);

    return stmt.all(...params) as Product[];
  }


  // =========================
  // FIND BY NAME AND MANUFACTURER
  // =========================

  static findByNameAndManufacturer(
    name: string,
    manufacturer?: string
  ): Product | undefined {

    if (!manufacturer) {
      return this.findByName(name);
    }

    const stmt = db.prepare(`
    SELECT *
    FROM products
    WHERE name = ?
    AND manufacturer = ?
    LIMIT 1
  `);

    const product = stmt.get(name, manufacturer) as Product | undefined;

    if (!product) {
      return undefined;
    }

    product.attributes = this.getAttributes(product.product_uuid);

    return product;
  }

  // =========================
  // LIST PRODUCTS
  // =========================

  static findAll(
    page: number = 1,
    limit: number = 20
  ): {
    products: Product[];
    total: number;
  } {

    const offset = (page - 1) * limit;

    const stmt = db.prepare(`
      SELECT * FROM products
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const products = stmt.all(limit, offset) as Product[];

    const total = (
      db.prepare(`
        SELECT COUNT(*) as count
        FROM products
      `).get() as any
    ).count;

    return {
      products,
      total
    };
  }

  // =========================
  // SEARCH PRODUCTS
  // =========================

  static search(query: string, limit: number = 20): Product[] {

    const stmt = db.prepare(`
      SELECT * FROM products
      WHERE
        name LIKE ?
        OR sku LIKE ?
        OR barcode LIKE ?
        OR composition LIKE ?
        OR manufacturer LIKE ?
        OR rack_location LIKE ?
      ORDER BY name ASC
      LIMIT ?
    `);

    const products = stmt.all(
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      limit
    ) as Product[];

    return products;
  }

  // =========================
  // UPDATE PRODUCT
  // =========================

  static update(
    uuid: string,
    updates: ProductUpdateInput
  ): Product | undefined {

    const existing = this.findById(uuid);

    if (!existing) return undefined;

    const allowedFields = [
      'name',
      'category_uuid',
      'barcode',
      'sku',
      'manufacturer',
      'composition',
      'description',
      'schedule_type',
      'prescription_required',
      'rack_location',
      'unit',
      'price',
      'purchase_price',
      'gst_percent',
      'stock',
      'hsn_code',
      'image',
      'discount',
      'boxes',
      'strips_per_box',
      'tablets_per_strip',
      'extra_tablets',
      'price_per_box',
      'price_per_strip',
      'price_per_tablet'
    ];

    const updateFields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updateFields.length) {
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(uuid);

      const stmt = db.prepare(`
        UPDATE products
        SET ${updateFields.join(', ')}
        WHERE product_uuid = ?
      `);
      stmt.run(...values);
    }

    return this.findById(uuid);
  }

  // =========================
  // UPDATE STOCK
  // =========================

  static updateStock(
    uuid: string,
    quantity: number,
    operation: 'add' | 'subtract' = 'add'
  ): Product | undefined {

    const product = this.findById(uuid);

    if (!product) return undefined;

    const newStock =
      operation === 'add'
        ? product.stock + quantity
        : product.stock - quantity;

    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    const stmt = db.prepare(`
      UPDATE products
      SET
        stock = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE product_uuid = ?
    `);

    stmt.run(newStock, uuid);

    return this.findById(uuid);
  }

  // =========================
  // DELETE PRODUCT
  // =========================

  static delete(uuid: string): boolean {

    // Must set PRAGMA outside transaction — SQLite ignores foreign_keys toggle
    // inside a multi-statement transaction.
    db.pragma('foreign_keys = OFF');

    try {
      const transaction = db.transaction(() => {

        // 1. Cart items
        db.prepare(`DELETE FROM cart_items WHERE product_uuid = ?`).run(uuid);

        // 2. Stock ledger
        db.prepare(`DELETE FROM stock_ledgers WHERE product_uuid = ?`).run(uuid);

        // 3. Stock adjustments
        db.prepare(`DELETE FROM stock_adjustments WHERE product_uuid = ?`).run(uuid);

        // 4. Medicine returns
        db.prepare(`DELETE FROM medicine_returns WHERE product_uuid = ?`).run(uuid);

        // 5. Sale items
        db.prepare(`DELETE FROM sale_items WHERE product_uuid = ?`).run(uuid);

        // 6. Purchase items — SKIP deletion to preserve purchase history

        // 7. Product batches
        db.prepare(`DELETE FROM product_batches WHERE product_uuid = ?`).run(uuid);

        // 8. Product units
        db.prepare(`DELETE FROM product_units WHERE product_uuid = ?`).run(uuid);

        // 9. Product attributes
        db.prepare(`DELETE FROM product_attributes WHERE product_uuid = ?`).run(uuid);

        // 10. Finally delete the product itself
        const result = db.prepare(`DELETE FROM products WHERE product_uuid = ?`).run(uuid);

        return result.changes > 0;
      });

      return transaction();
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }

  // =========================
  // LOW STOCK
  // =========================

  static getLowStock(
    threshold: number = 10
  ): Product[] {

    const stmt = db.prepare(`
      SELECT * FROM products
      WHERE stock <= ?
      ORDER BY stock ASC
    `);

    const products = stmt.all(threshold) as Product[];

    for (const product of products) {
      product.attributes = this.getAttributes(product.product_uuid);
    }

    return products;
  }

  // =========================
  // COUNT
  // =========================

  static count(): number {

    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM products
    `).get() as any;

    return result.count;
  }
}