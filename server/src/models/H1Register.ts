import db from '../database/connection';

import { v4 as uuidv4 } from 'uuid';

import type {
  H1Register,
  CreateH1RegisterInput
} from '../types';

export class H1RegisterModel {

  // =========================
  // CREATE ENTRY
  // =========================

  static create(
    input: CreateH1RegisterInput
  ): H1Register {

    const registerUuid =
      uuidv4();

    db.prepare(`

      INSERT INTO h1_register (

        register_uuid,

        sale_uuid,

        sale_item_id,

        product_uuid,

        batch_uuid,

        prescription_number,

        doctor_name,

        doctor_license,

        patient_name,

        patient_age,

        patient_gender,

        quantity,

        schedule_type,

        pharmacist_name

      ) VALUES (

        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(

      registerUuid,

      input.sale_uuid,

      input.sale_item_id,

      input.product_uuid,

      input.batch_uuid || null,

      input.prescription_number,

      input.doctor_name,

      input.doctor_license || null,

      input.patient_name,

      input.patient_age || null,

      input.patient_gender || null,

      input.quantity,

      input.schedule_type,

      input.pharmacist_name || null
    );

    return this.findById(
      registerUuid
    )!;
  }

  // =========================
  // FIND BY UUID
  // =========================

  static findById(
    uuid: string
  ): H1Register | undefined {

    return db.prepare(`

      SELECT *

      FROM h1_register

      WHERE register_uuid = ?
    `).get(
      uuid
    ) as H1Register | undefined;
  }

  // =========================
  // LIST
  // =========================

  static findAll(): H1Register[] {

    const rows = db.prepare(`
    SELECT *
    FROM h1_register
    ORDER BY created_at DESC
  `).all();

    console.log('H1 rows:', rows);

    return rows as H1Register[];
  }

  // =========================
  // SEARCH BY DATE
  // =========================

  static findByDateRange(
    from: string,
    to: string
  ): H1Register[] {

    return db.prepare(`

      SELECT *

      FROM h1_register

      WHERE DATE(created_at)
      BETWEEN DATE(?)
      AND DATE(?)

      ORDER BY created_at DESC
    `).all(
      from,
      to
    ) as H1Register[];
  }
}