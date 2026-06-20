import db from '../database/connection';
import type { Setting } from '../types/index';

export class SettingsModel {
  // Get settings (always returns one record)
  static get(): Setting {
    let settings = db.prepare('SELECT * FROM settings LIMIT 1').get() as Setting | undefined;

    if (!settings) {
      // Create default settings if none exists
      db.prepare(`
        INSERT INTO settings (shop_name, invoice_prefix)
        VALUES ('My Shop', 'INV')
      `).run();

      settings = db.prepare('SELECT * FROM settings LIMIT 1').get() as Setting;
    }

    return settings;
  }

  // Create or update settings
  static save(data: {
    auto_print?: number;
    shop_name: string;
    mobile?: string;
    address?: string;
    gstin?: string;
    invoice_prefix?: string;
    printer_type?: string;
    printer_host?: string;
    printer_port?: number;
    printer_name?: string;
    terms_conditions?: string;
    privacy_policy?: string;
  }): Setting {
    const existing = db.prepare('SELECT * FROM settings LIMIT 1').get() as Setting | undefined;

    if (existing) {
      // Update existing
      const updateFields: string[] = [];
      const values: any[] = [];

      if (data.shop_name !== undefined) {
        updateFields.push('shop_name = ?');
        values.push(data.shop_name);
      }
      if (data.mobile !== undefined) {
        updateFields.push('mobile = ?');
        values.push(data.mobile);
      }
      if (data.address !== undefined) {
        updateFields.push('address = ?');
        values.push(data.address);
      }
      if (data.gstin !== undefined) {
        updateFields.push('gstin = ?');
        values.push(data.gstin);
      }
      if (data.invoice_prefix !== undefined) {
        updateFields.push('invoice_prefix = ?');
        values.push(data.invoice_prefix);
      }

      if (data.auto_print !== undefined) {
        updateFields.push('auto_print = ?');
        values.push(data.auto_print);
      }
      if (data.printer_type !== undefined) {
        updateFields.push('printer_type = ?');
        values.push(data.printer_type);
      }
      if (data.printer_host !== undefined) {
        updateFields.push('printer_host = ?');
        values.push(data.printer_host);
      }
      if (data.printer_port !== undefined) {
        updateFields.push('printer_port = ?');
        values.push(data.printer_port);
      }
      if (data.printer_name !== undefined) {
        updateFields.push('printer_name = ?');
        values.push(data.printer_name);
      }

      if (data.terms_conditions !== undefined) {
        updateFields.push('terms_conditions = ?');
        values.push(data.terms_conditions);
      }
      if (data.privacy_policy !== undefined) {
        updateFields.push('privacy_policy = ?');
        values.push(data.privacy_policy);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        db.prepare(`UPDATE settings SET ${updateFields.join(', ')}`).run(...values);
      }

    } else {
      // Create new
      db.prepare(`
        INSERT INTO settings (shop_name, mobile, address, gstin, invoice_prefix)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        data.shop_name,
        data.mobile || null,
        data.address || null,
        data.gstin || null,
        data.invoice_prefix || 'INV'
      );
    }

    return this.get();
  }

  // Update specific fields
  static update(
    updates: Partial<Setting>
  ): Setting {

    const fields: string[] = [];

    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {

      if (value !== undefined) {

        fields.push(`${key} = ?`);

        values.push(value);
      }
    }

    if (!fields.length) {

      throw new Error(
        'No fields to update'
      );
    }

    fields.push(
      'updated_at = CURRENT_TIMESTAMP'
    );

    db.prepare(`

    UPDATE settings

    SET ${fields.join(', ')}

    WHERE id = 1
  `).run(...values);

    return this.get()!;
  }
}
