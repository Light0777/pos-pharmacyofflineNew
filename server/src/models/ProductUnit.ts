// models/ProductUnit.ts

import db from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

import type {
  ProductUnit,
  ProductUnitCreateInput
} from '../types';

export class ProductUnitModel {

  // CREATE

  static create(
    input: ProductUnitCreateInput
  ): ProductUnit {

    const uuid = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO product_units (

        unit_uuid,

        product_uuid,

        unit_name,
        conversion_factor,

        barcode,

        price,
        purchase_price,

        is_base_unit

      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(

      uuid,

      input.product_uuid,

      input.unit_name,
      input.conversion_factor,

      input.barcode || null,

      input.price || null,
      input.purchase_price || null,

      input.is_base_unit || 0
    );

    return this.findById(uuid)!;
  }

  // FIND BY ID

  static findById(
    unitUuid: string
  ): ProductUnit | undefined {

    return db.prepare(`

    SELECT *
    FROM product_units

    WHERE unit_uuid = ?

  `).get(
      unitUuid
    ) as ProductUnit | undefined;
  }

  // FIND BY PRODUCT + UNIT NAME

  static findByProductAndUnitName(
    product_uuid: string,
    unit_name: string
  ): ProductUnit | undefined {

    const stmt = db.prepare(`
    SELECT *
    FROM product_units
    WHERE product_uuid = ?
    AND unit_name = ?
    LIMIT 1
  `);

    return stmt.get(
      product_uuid,
      unit_name
    ) as ProductUnit | undefined;
  }

  // UPDATE

  static update(
    unit_uuid: string,
    data: Partial<ProductUnitCreateInput>
  ): ProductUnit | undefined {

    const stmt = db.prepare(`
    UPDATE product_units
    SET
      conversion_factor = ?,
      barcode = ?,
      price = ?,
      purchase_price = ?,
      is_base_unit = ?
    WHERE unit_uuid = ?
  `);

    stmt.run(
      data.conversion_factor,
      data.barcode || null,
      data.price || null,
      data.purchase_price || null,
      data.is_base_unit || 0,
      unit_uuid
    );

    return this.findById(unit_uuid);
  }

  // GET PRODUCT UNITS

  static getByProduct(
    product_uuid: string
  ): ProductUnit[] {

    const stmt = db.prepare(`
      SELECT *
      FROM product_units
      WHERE product_uuid = ?
      ORDER BY conversion_factor ASC
    `);

    return stmt.all(product_uuid) as ProductUnit[];
  }

  // GET ALL UNITS

  static getAll(): ProductUnit[] {

    const stmt = db.prepare(`
      SELECT *
      FROM product_units
      ORDER BY unit_uuid ASC
    `);

    return stmt.all() as ProductUnit[];
  }

  // DELETE

  static delete(
    uuid: string
  ): boolean {

    const stmt = db.prepare(`
      DELETE FROM product_units
      WHERE unit_uuid = ?
    `);

    const result = stmt.run(uuid);

    return result.changes > 0;
  }


}