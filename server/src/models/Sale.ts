import db from '../database/connection';
import type { Sale, SaleItem, Payment, CartWithItems, InvoiceItem, Customer, Setting, PharmacyInvoice } from '../types/index';
import { v4 as uuidv4 } from 'uuid';
import { ProductBatchModel }
  from './ProductBatch';
import { H1RegisterModel } from './H1Register';
import {
  AuditLogModel
} from './AuditLog';

import {
  canDispenseRestrictedMedicine
} from '../utils/pharmacyAuth';

import {
  ProductUnitModel
} from './ProductUnit';

export class SaleModel {
  // Create sale from cart (checkout) - Fix pattern matching PHP
  static createFromCart(
    cartData: CartWithItems,
    customerUuid: string | null,
    payments: Array<{
      method: string;
      amount: number;
      reference?: string;
    }>,
    prescriptions: any[] = [],
    currentUser?: any
  ): { sale: Sale; paid: number; balance: number } {
    const saleUuid = uuidv4();

    const transaction = db.transaction(() => {
      let total = 0;
      let taxTotal = 0;

      // DEBUG: Show cart_items table
      const cartItemsDebug = db.prepare(`
        SELECT *
        FROM cart_items
      `).all();
      console.log(
        'DEBUG - cart_items table:',
        JSON.stringify(cartItemsDebug, null, 2)
      );

      

      // =========================
      // PREPARE + VALIDATE
      // =========================

      const preparedItems = cartData.items.map((item) => {

        const product = db.prepare(`
        SELECT *
        FROM products
        WHERE product_uuid = ?
      `).get(
          item.product_uuid
        ) as any;

        if (!product) {

          throw new Error(
            `Product not found`
          );
        }

        console.log(
          'ITEM UNIT UUID:',
          item.unit_uuid
        );

        const normalizedUnitUuid =
          String(item.unit_uuid).replace('.0', '');

        const unit =
          ProductUnitModel.findById(
            normalizedUnitUuid
          );

        console.log(
          'RAW UNIT UUID:',
          item.unit_uuid
        );

        console.log(
          'NORMALIZED UNIT UUID:',
          normalizedUnitUuid
        );

        console.log(
          'UNIT FOUND:',
          unit
        );

        if (!unit) {

          throw new Error(
            `Invalid unit for ${product.name}`
          );
        }

        const normalizedQuantity =
          Number(item.quantity) *
          Number(unit.conversion_factor);

        if (
          normalizedQuantity <= 0
        ) {

          throw new Error(
            `Invalid quantity for ${product.name}`
          );
        }

        if (
          Number(product.stock) <
          normalizedQuantity
        ) {

          throw new Error(
            `Insufficient stock for ${product.name}`
          );
        }

        const prescription =
          prescriptions.find(
            p =>
              p.product_uuid ===
              item.product_uuid
          );

        // =========================
        // SCHEDULE H
        // =========================

        if (
          product.schedule_type === 'H'
        ) {

          if (
            !prescription ||
            !prescription.prescription_number
          ) {
            throw new Error(
              `${product.name} requires prescription`
            );
          }
        }

        // =========================
        // SCHEDULE H1
        // =========================

        if (
          product.schedule_type === 'H1'
        ) {

          if (
            !prescription ||
            !prescription.prescription_number
          ) {
            throw new Error(
              `${product.name}: prescription required`
            );
          }

          if (
            !prescription.doctor_name
          ) {

            throw new Error(
              `${product.name}: doctor_name required`
            );
          }

          if (
            !prescription.patient_name
          ) {

            throw new Error(
              `${product.name}: patient_name required`
            );
          }
        }

        // =========================
        // SCHEDULE X
        // =========================

        if (
          product.schedule_type === 'X'
        ) {

          if (
            !canDispenseRestrictedMedicine(
              currentUser
            )
          ) {
            throw new Error(
              `Only pharmacist/admin can sell ${product.name}`
            );
          }

          if (
            !prescription ||
            !prescription.prescription_number
          ) {
            throw new Error(
              `${product.name}: prescription required`
            );
          }

          if (
            !prescription.doctor_license
          ) {

            throw new Error(
              `${product.name}: doctor license required`
            );
          }
        }

        const itemTotal =
          Number(item.price) *
          normalizedQuantity;

        const taxAmount =
          (
            itemTotal *
            Number(item.tax_percent)
          ) / 100;

        total += itemTotal;
        taxTotal += taxAmount;

        return {

          item,
          product,
          unit,
          prescription,
          normalizedQuantity,
          itemTotal,
          taxAmount
        };
      });

      const grandTotal =
        total + taxTotal;

      // =========================
      // GENERATE INVOICE
      // =========================

      const invoiceNumber =
        this.generateInvoiceNumber();

      // =========================
      // CREATE SALE
      // =========================

      db.prepare(`
      INSERT INTO sales (

        sale_uuid,
        invoice_number,
        customer_uuid,

        total,
        tax,
        grand_total,

        status

      ) VALUES (

        ?, ?, ?,
        ?, ?, ?,
        'completed'
      )
    `).run(

        saleUuid,
        invoiceNumber,
        customerUuid,
        Math.round(total * 100) / 100,
        Math.round(taxTotal * 100) / 100,
        Math.round(grandTotal * 100) / 100
      );

      // =========================
      // INSERT SALE ITEMS
      // =========================

      const insertItem = db.prepare(`
      INSERT INTO sale_items (

        sale_uuid,
        product_uuid,
        batch_uuid,

        quantity,
        price,
        total,

        gst_percent,
        gst_amount,

        prescription_required,
        prescription_number,

        doctor_name,
        doctor_license,

        patient_name,
        patient_age,
        patient_gender,

        schedule_type

      ) VALUES (

        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?
      )
    `);

      for (const prepared of preparedItems) {

        const {
          item,
          product,
          prescription,
          normalizedQuantity
        } = prepared;

        const consumedBatches = item.batch_uuid
          ? [ProductBatchModel.consumeStock(item.batch_uuid, normalizedQuantity)]
          : ProductBatchModel.consumeStockFEFO(
              item.product_uuid,
              normalizedQuantity
            );

        for (const consumed of consumedBatches) {

          const batchTotal =
            Number(item.price) *
            Number(consumed.quantity);

          const batchTax =
            (
              batchTotal *
              Number(item.tax_percent)
            ) / 100;

          const result =
            insertItem.run(

              saleUuid,

              item.product_uuid,

              consumed.batch_uuid,

              consumed.quantity,

              item.price,

              Math.round(
                batchTotal * 100
              ) / 100,

              item.tax_percent,

              Math.round(
                batchTax * 100
              ) / 100,

              product.prescription_required || 0,

              prescription
                ?.prescription_number || null,

              prescription
                ?.doctor_name || null,

              prescription
                ?.doctor_license || null,

              prescription
                ?.patient_name || null,

              prescription
                ?.patient_age || null,

              prescription
                ?.patient_gender || null,

              product.schedule_type || 'NONE'
            );

          // =========================
          // SCHEDULED DRUG REGISTER (H, H1, X)
          // =========================

          if (
            prescription &&
            ['H', 'H1', 'X'].includes(product.schedule_type)
          ) {

            const settings = db.prepare(`
            SELECT pharmacist_name
            FROM settings
            LIMIT 1
          `).get() as {
              pharmacist_name?: string;
            };

            H1RegisterModel.create({

              sale_uuid:
                saleUuid,

              sale_item_id:
                Number(
                  result.lastInsertRowid
                ),

              product_uuid:
                item.product_uuid,

              batch_uuid:
                consumed.batch_uuid,

              prescription_number:
                prescription!
                  .prescription_number,

              doctor_name:
                prescription!
                  .doctor_name,

              doctor_license:
                prescription!
                  .doctor_license,

              patient_name:
                prescription!
                  .patient_name,

              patient_age:
                prescription!
                  .patient_age,

              patient_gender:
                prescription!
                  .patient_gender,

              quantity:
                consumed.quantity,

              schedule_type:
                product.schedule_type,

              pharmacist_name:
                settings
                  .pharmacist_name
            });

            AuditLogModel.create({

              action_type:
                'schedule_drug_sale',

              entity_type:
                'sale_item',

              entity_uuid:
                String(
                  result.lastInsertRowid
                ),

              reference_uuid:
                saleUuid,

              user_uuid:
                currentUser?.user_uuid,

              details: JSON.stringify({

                product_uuid:
                  item.product_uuid,

                batch_uuid:
                  consumed.batch_uuid,

                prescription_number:
                  prescription!
                    .prescription_number,

                patient_name:
                  prescription!
                    .patient_name
              })
            });
          }

          // =========================
          // SCHEDULE X AUDIT
          // =========================

          if (
            product.schedule_type === 'X'
          ) {

            AuditLogModel.create({

              action_type:
                'schedule_x_sale',

              entity_type:
                'sale_item',

              entity_uuid:
                String(
                  result.lastInsertRowid
                ),

              reference_uuid:
                saleUuid,

              user_uuid:
                currentUser?.user_uuid,

              details: JSON.stringify({

                product_name:
                  product.name,

                batch_uuid:
                  consumed.batch_uuid,

                prescription_number:
                  prescription
                    ?.prescription_number,

                doctor_license:
                  prescription
                    ?.doctor_license
              })
            });
          }
        }

        // =========================
        // STOCK LEDGER
        // =========================

        db.prepare(`
        INSERT INTO stock_ledgers (

          product_uuid,
          quantity,
          type,
          reference_uuid,
          note

        ) VALUES (

          ?, ?, 'sale', ?, ?
        )
      `).run(

          item.product_uuid,

          -normalizedQuantity,

          saleUuid,

          'Sale via cart checkout'
        );
      }

      // =========================
      // PAYMENTS
      // =========================

      let paidAmount = 0;

      const insertPayment =
        db.prepare(`
        INSERT INTO payments (

          sale_uuid,
          method,
          amount,
          reference

        ) VALUES (

          ?, ?, ?, ?
        )
      `);

      for (const payment of payments) {
        const roundedAmount =
          Math.round(
            Number(payment.amount) * 100
          ) / 100;
        insertPayment.run(
          saleUuid,
          payment.method,

          roundedAmount,

          payment.reference || null
        );

        paidAmount += roundedAmount;
      }

      const balance =
        Math.round(
          (grandTotal - paidAmount) * 100
        ) / 100;

      // =========================
      // CUSTOMER CREDIT
      // =========================

      const payLaterAmount =
        payments
          .filter(
            p => p.method === 'pay_later'
          )
          .reduce(
            (sum, p) =>
              sum + Number(p.amount || 0),
            0
          );

      if (
        customerUuid &&
        payLaterAmount > 0
      ) {

        const customer = db.prepare(`
        SELECT *
        FROM customers
        WHERE customer_uuid = ?
      `).get(
          customerUuid
        ) as any;

        if (!customer) {

          throw new Error(
            'Customer not found'
          );
        }

        const currentBalance =
          Number(
            customer.credit_balance || 0
          );

        const creditLimit =
          Number(
            customer.credit_limit || 0
          );

        const newBalance =
          currentBalance +
          payLaterAmount;

        if (
          creditLimit > 0 &&
          newBalance > creditLimit
        ) {

          throw new Error(
            'Credit limit exceeded'
          );
        }

        db.prepare(`
        UPDATE customers
        SET

          credit_balance = ?,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE customer_uuid = ?
      `).run(

          newBalance,

          customerUuid
        );

        db.prepare(`
        INSERT INTO customer_ledgers (

          customer_uuid,
          type,
          amount,
          reference_uuid,
          note

        ) VALUES (

          ?, 'debit', ?, ?, ?
        )
      `).run(

          customerUuid,
          payLaterAmount,
          saleUuid,
          `Pay Later invoice #${invoiceNumber}`
        );
      }

      // =========================
      // SALE AUDIT
      // =========================

      AuditLogModel.create({

        action_type:
          'sale_created',

        entity_type:
          'sale',

        entity_uuid:
          saleUuid,

        reference_uuid:
          saleUuid,

        user_uuid:
          currentUser?.user_uuid,

        details: JSON.stringify({

          invoice_number:
            invoiceNumber,

          customer_uuid:
            customerUuid,

          grand_total:
            grandTotal
        })
      });

      // =========================
      // COMPLETE CART
      // =========================

      db.prepare(`
      UPDATE carts
      SET

        status = 'completed',

        updated_at =
          CURRENT_TIMESTAMP

      WHERE cart_uuid = ?
    `).run(
        cartData.cart_uuid
      );

      const sale = db.prepare(`
      SELECT *
      FROM sales
      WHERE sale_uuid = ?
    `).get(
        saleUuid
      ) as Sale;

      return {

        sale,

        paid:
          Math.round(
            paidAmount * 100
          ) / 100,

        balance
      };
    });

    return transaction();
  }

  // Get invoice details - Pattern matching PHP invoice method
  static getInvoice(
    saleUuid: string
  ): PharmacyInvoice {

    // =========================
    // SALE
    // =========================

    const sale = db.prepare(`

    SELECT *

    FROM sales

    WHERE sale_uuid = ?
  `).get(
      saleUuid
    ) as Sale | undefined;

    if (!sale) {

      throw new Error(
        'Sale not found'
      );
    }

    // =========================
    // SETTINGS
    // =========================

    const settings = db.prepare(`

    SELECT *

    FROM settings

    LIMIT 1
  `).get() as Setting;

    // =========================
    // CUSTOMER
    // =========================

    let customer:
      Customer | undefined;

    if (sale.customer_uuid) {

      customer = db.prepare(`

      SELECT *

      FROM customers

      WHERE customer_uuid = ?
    `).get(
        sale.customer_uuid
      ) as Customer | undefined;
    }

    // =========================
    // SALE ITEMS
    // =========================

    const items = db.prepare(`

    SELECT

      si.id,

      si.sale_uuid,

      si.product_uuid,

      si.batch_uuid,

      si.quantity,

      si.price,

      si.total,

      si.gst_percent,

      si.gst_amount,

      si.schedule_type,

      si.prescription_required,
      si.prescription_number,
      si.doctor_name,
      si.doctor_license,
      si.patient_name,
      si.patient_age,
      si.patient_gender,

      p.name as product_name,

      p.hsn_code,

      p.manufacturer,

      p.unit,

      pb.batch_number,

      pb.batch_uuid as batch_uuid,

      pb.expiry_date

    FROM sale_items si

    INNER JOIN products p
      ON p.product_uuid =
        si.product_uuid

    LEFT JOIN product_batches pb
      ON pb.batch_uuid =
        si.batch_uuid

    WHERE si.sale_uuid = ?
  `).all(
      saleUuid
    ) as Array<{

      id: number;

      sale_uuid: string;

      product_uuid: string;

      unit_uuid: string;

      batch_uuid: string | null;

      quantity: number;

      price: number;

      total: number;

      gst_percent: number;

      gst_amount: number;

      schedule_type: string;

      prescription_required: number;
      prescription_number: string | null;
      doctor_name: string | null;
      doctor_license: string | null;
      patient_name: string | null;
      patient_age: number | null;
      patient_gender: string | null;

      product_name: string;

      hsn_code: string | null;

      manufacturer: string | null;

      unit: string;

      batch_number: string | null;

      expiry_date: string | null;
    }>;

    // =========================
    // PAYMENTS
    // =========================

    const payments = db.prepare(`

    SELECT *

    FROM payments

    WHERE sale_uuid = ?
  `).all(
      saleUuid
    ) as Payment[];

    // =========================
    // FORMAT ITEMS
    // =========================

    const formattedItems: InvoiceItem[] =
      items.map((item) => {

        const taxableAmount =
          item.total -
          item.gst_amount;

        const cgst =
          item.gst_amount / 2;

        const sgst =
          item.gst_amount / 2;

        return {

          id:
            item.id,

          product_name:
            item.product_name,

          unit_uuid:
            item.unit_uuid,

          manufacturer:
            item.manufacturer,

          hsn_code:
            item.hsn_code,

          batch_number:
            item.batch_number,

          batch_uuid: item.batch_uuid,

          product_uuid: item.product_uuid,

          expiry_date:
            item.expiry_date,

          unit:
            item.unit,

          quantity:
            item.quantity,

          price:
            Number(
              item.price.toFixed(2)
            ),

          taxable_amount:
            Number(
              taxableAmount.toFixed(2)
            ),

          gst_percent:
            item.gst_percent,

          gst_amount:
            Number(
              item.gst_amount.toFixed(2)
            ),

          cgst:
            Number(
              cgst.toFixed(2)
            ),

          sgst:
            Number(
              sgst.toFixed(2)
            ),

          total:
            Number(
              item.total.toFixed(2)
            ),

          schedule_type:
            item.schedule_type,

          prescription_required:
            item.prescription_required,
          prescription_number:
            item.prescription_number,
          doctor_name:
            item.doctor_name,
          doctor_license:
            item.doctor_license,
          patient_name:
            item.patient_name,
          patient_age:
            item.patient_age,
          patient_gender:
            item.patient_gender
        };
      });

    // =========================
    // SUMMARY
    // =========================

    const taxableTotal =
      formattedItems.reduce(
        (sum, item) =>
          sum + item.taxable_amount,
        0
      );

    const gstTotal =
      formattedItems.reduce(
        (sum, item) =>
          sum + item.gst_amount,
        0
      );

    const grandTotal =
      formattedItems.reduce(
        (sum, item) =>
          sum + item.total,
        0
      );

    // =========================
    // COMPLIANCE FLAGS
    // =========================

    const containsScheduleH =
      formattedItems.some(
        (item) =>
          item.schedule_type === 'H'
      );

    const containsScheduleH1 =
      formattedItems.some(
        (item) =>
          item.schedule_type === 'H1'
      );

    const containsScheduleX =
      formattedItems.some(
        (item) =>
          item.schedule_type === 'X'
      );

    const warnings: string[] = [];

    if (containsScheduleH) {

      warnings.push(
        'Schedule H drug: Warning - To be sold by retail on the prescription of a Registered Medical Practitioner only.'
      );
    }

    if (containsScheduleH1) {

      warnings.push(
        'Schedule H1 drug sold under prescription record compliance.'
      );
    }

    if (containsScheduleX) {

      warnings.push(
        'Schedule X drug dispensed under strict prescription control.'
      );
    }

    // =========================
    // RETURN
    // =========================

    return {

      invoice_number:
        sale.invoice_number,

      invoice_date:
        sale.created_at,

      customer:
        customer
          ? {
            name:
              customer.name,

            mobile:
              customer.mobile,

            address:
              customer.address,

            gstin:
              customer.gstin
          }
          : undefined,

      pharmacy: {

        shop_name:
          settings.shop_name,

        address:
          settings.address,

        mobile:
          settings.mobile,

        gstin:
          settings.gstin,

        drug_license_number:
          settings.drug_license_number,

        pharmacist_name:
          settings.pharmacist_name,

        pharmacist_registration_number:
          settings.pharmacist_registration_number
      },

      items:
        formattedItems,

      summary: {

        subtotal:
          Number(
            taxableTotal.toFixed(2)
          ),

        taxable_total:
          Number(
            taxableTotal.toFixed(2)
          ),

        gst_total:
          Number(
            gstTotal.toFixed(2)
          ),

        cgst_total:
          Number(
            (gstTotal / 2).toFixed(2)
          ),

        sgst_total:
          Number(
            (gstTotal / 2).toFixed(2)
          ),

        grand_total:
          Number(
            grandTotal.toFixed(2)
          )
      },

      payments,

      compliance: {

        contains_schedule_h:
          containsScheduleH,

        contains_schedule_h1:
          containsScheduleH1,

        contains_schedule_x:
          containsScheduleX,

        warnings
      }
    };
  }

  // Generate invoice number - Pattern matching PHP
  private static generateInvoiceNumber(): string {
    const setting = db.prepare('SELECT * FROM settings LIMIT 1').get() as any;
    const prefix = setting?.invoice_prefix || 'INV';

    // Get last invoice number
    const lastSale = db.prepare(`
      SELECT invoice_number FROM sales 
      ORDER BY created_at DESC LIMIT 1
    `).get() as any;

    let nextNumber = 1;
    if (lastSale && lastSale.invoice_number) {
      // Extract number from "PREFIX-NUMBER" format
      const parts = lastSale.invoice_number.split('-');
      if (parts.length > 1) {
        const lastNum = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }
    }

    return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
  }

  // Find sale by UUID
  static findById(uuid: string): Sale | undefined {
    return db.prepare('SELECT * FROM sales WHERE sale_uuid = ?').get(uuid) as Sale | undefined;
  }

  // Get sales list with pagination - Pattern matching PHP index
  static findAll(page: number = 1, limit: number = 50, filters: any): { sales: any[], total: number } {
    const offset = (page - 1) * limit;

    // Build WHERE clause from filters
    let whereClause = '';
    const params: any[] = [];

    if (filters.startDate && filters.endDate) {
      whereClause = 'WHERE s.created_at BETWEEN ? AND ?';
      params.push(filters.startDate, filters.endDate);
    } else if (filters.startDate) {
      whereClause = 'WHERE s.created_at >= ?';
      params.push(filters.startDate);
    } else if (filters.endDate) {
      whereClause = 'WHERE s.created_at <= ?';
      params.push(filters.endDate);
    }

    if (filters.customerUuid) {
      whereClause += whereClause ? ' AND s.customer_uuid = ?' : 'WHERE s.customer_uuid = ?';
      params.push(filters.customerUuid);
    }

    if (filters.status) {
      whereClause += whereClause ? ' AND s.status = ?' : 'WHERE s.status = ?';
      params.push(filters.status);
    }

    // Main query with customer join and refund_total subquery
    const sales = db.prepare(`
    SELECT s.*, 
           c.name as customer_name, 
           c.mobile as customer_mobile,
           (SELECT COALESCE(SUM(refund_amount), 0) 
            FROM medicine_returns 
            WHERE sale_uuid = s.sale_uuid AND return_type = 'customer_return'
           ) as refund_total
    FROM sales s
    LEFT JOIN customers c ON s.customer_uuid = c.customer_uuid
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

    // Count total with same filters (without limit/offset)
    const countParams = params.slice(0, -2); // remove limit and offset
    const countResult = db.prepare(`
    SELECT COUNT(*) as count
    FROM sales s
    ${whereClause}
  `).get(...countParams) as any;

    const total = countResult?.count || 0;

    return { sales, total };
  }

  // Get sale with relations
  static findWithRelations(uuid: string): any {
    const sale = this.findById(uuid);
    if (!sale) return null;

    const items = db.prepare(`
      SELECT si.*, p.name as product_name
      FROM sale_items si
      LEFT JOIN products p ON si.product_uuid = p.product_uuid
      WHERE si.sale_uuid = ?
    `).all(uuid);

    const payments = db.prepare('SELECT * FROM payments WHERE sale_uuid = ?').all(uuid);

    const customer = sale.customer_uuid ?
      db.prepare('SELECT * FROM customers WHERE customer_uuid = ?').get(sale.customer_uuid) :
      null;

    return {
      ...sale,
      items,
      payments,
      customer
    };
  }

  static voidSale(

    saleUuid: string,

    userUuid: string,

    reason: string
  ): void {

    const transaction = db.transaction(() => {

      // =========================
      // FETCH SALE
      // =========================

      const sale = db.prepare(`

      SELECT *

      FROM sales

      WHERE sale_uuid = ?
    `).get(
        saleUuid
      ) as Sale | undefined;

      if (!sale) {

        throw new Error(
          'Sale not found'
        );
      }

      // =========================
      // ALREADY VOIDED
      // =========================

      if (
        sale.status === 'refunded'
      ) {

        throw new Error(
          'Sale already voided'
        );
      }

      // =========================
      // FETCH SALE ITEMS
      // =========================

      const items = db.prepare(`

      SELECT

        sale_uuid,
        product_uuid,
        batch_uuid,
        quantity

      FROM sale_items

      WHERE sale_uuid = ?
    `).all(
        saleUuid
      ) as Array<{

        sale_uuid: string;

        product_uuid: string;

        batch_uuid: string | null;

        quantity: number;
      }>;

      // =========================
      // RESTORE STOCK
      // =========================

      for (const item of items) {

        if (item.batch_uuid) {

          ProductBatchModel.updateQuantity(

            item.batch_uuid,

            item.quantity,

            'add'
          );
        }

        db.prepare(`

        INSERT INTO stock_ledgers (

          product_uuid,
          quantity,
          type,
          reference_uuid,
          note

        ) VALUES (

          ?, ?, ?, ?, ?
        )
      `).run(

          item.product_uuid,

          item.quantity,

          'return',

          saleUuid,

          'Sale void stock restored'
        );

        ProductBatchModel.recalculateProductStock(
          item.product_uuid
        );
      }

      // =========================
      // VOID SALE
      // =========================

      db.prepare(`

      UPDATE sales

      SET

        status = 'refunded',

        updated_at =
          CURRENT_TIMESTAMP

      WHERE sale_uuid = ?
    `).run(
        saleUuid
      );

      // =========================
      // REVERSE CUSTOMER CREDIT
      // =========================

      if (sale.customer_uuid) {

        const payLaterAmount = db.prepare(`

        SELECT

          COALESCE(
            SUM(amount),
            0
          ) as total

        FROM payments

        WHERE

          sale_uuid = ?

          AND method = 'pay_later'
      `).get(
          saleUuid
        ) as {
          total: number;
        };

        if (
          Number(payLaterAmount.total) > 0
        ) {

          db.prepare(`

          UPDATE customers

          SET

            credit_balance =
              credit_balance - ?,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE customer_uuid = ?
        `).run(

            payLaterAmount.total,

            sale.customer_uuid
          );

          db.prepare(`

          INSERT INTO customer_ledgers (

            customer_uuid,
            type,
            amount,
            reference_uuid,
            note

          ) VALUES (

            ?, ?, ?, ?, ?
          )
        `).run(

            sale.customer_uuid,

            'credit',

            -Math.abs(
              payLaterAmount.total
            ),

            saleUuid,

            'Sale void reversal'
          );
        }
      }

      // =========================
      // AUDIT LOG
      // =========================

      AuditLogModel.create({

        action_type:
          'sale_updated',

        entity_type:
          'sale',

        entity_uuid:
          saleUuid,

        user_uuid:
          userUuid,

        details: JSON.stringify({

          operation:
            'sale_voided',

          reason
        })
      });
    });

    transaction();
  }
}
