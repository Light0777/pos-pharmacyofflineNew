// models/Category.ts

import db from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

export interface Category {
  category_uuid: string;
  name: string;
  parent_uuid?: string;
  description?: string;
  created_at: string;
}

export interface CategoryCreateInput {
  name: string;
  parent_uuid?: string;
  description?: string;
}

export interface CategoryUpdateInput {
  name?: string;
  parent_uuid?: string;
  description?: string;
}

export class CategoryModel {

  // CREATE
  static create(
    input: CategoryCreateInput
  ): Category {

    const uuid = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO categories (
        category_uuid,
        name,
        parent_uuid,
        description
      ) VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      uuid,
      input.name,
      input.parent_uuid || null,
      input.description || null
    );

    return this.findById(uuid)!;
  }

  // FIND BY ID
  static findById(
    uuid: string
  ): Category | undefined {

    const stmt = db.prepare(`
      SELECT *
      FROM categories
      WHERE category_uuid = ?
    `);

    return stmt.get(uuid) as Category | undefined;
  }

  // FIND ALL
  static findAll(): Category[] {

    const stmt = db.prepare(`
      SELECT *
      FROM categories
      ORDER BY name ASC
    `);

    return stmt.all() as Category[];
  }

  // DELETE
  static delete(uuid: string): boolean {

    const children = db.prepare(`
      SELECT COUNT(*) as count FROM categories WHERE parent_uuid = ?
    `).get(uuid) as { count: number };

    if (children.count > 0) {
      throw new Error('Cannot delete category: it has sub-categories. Remove or re-parent them first.');
    }

    db.prepare(`
      DELETE FROM category_attributes WHERE category_uuid = ?
    `).run(uuid);

    db.prepare(`
      UPDATE product_templates SET category_uuid = NULL WHERE category_uuid = ?
    `).run(uuid);

    const stmt = db.prepare(`
      DELETE FROM categories
      WHERE category_uuid = ?
    `);

    const result = stmt.run(uuid);

    return result.changes > 0;
  }

  // UPDATE
  static update(
    uuid: string,
    input: CategoryUpdateInput
  ): Category | undefined {

    const existing = this.findById(uuid);
    if (!existing) return undefined;

    const name = input.name ?? existing.name;
    const parent_uuid = input.parent_uuid !== undefined ? input.parent_uuid : existing.parent_uuid;
    const description = input.description !== undefined ? input.description : existing.description;

    const stmt = db.prepare(`
      UPDATE categories
      SET name = ?,
          parent_uuid = ?,
          description = ?
      WHERE category_uuid = ?
    `);

    stmt.run(name, parent_uuid || null, description || null, uuid);

    return this.findById(uuid);
  }

  static findByName(
    name: string
  ): Category | undefined {

    const stmt = db.prepare(`
    SELECT *
    FROM categories
    WHERE name = ?
    LIMIT 1
  `);

    return stmt.get(name) as Category | undefined;
  }
}