import type {
  Request,
  Response
} from 'express';

import {
  ProductBatchModel
} from '../models/ProductBatch';

export class ProductBatchController {

  // =========================
  // CREATE BATCH
  // =========================

  static create = (
    req: Request,
    res: Response
  ): void => {

    try {

      const {

        product_uuid,

        batch_number,

        expiry_date,

        manufacture_date,

        mrp,

        ptr,

        rate,

        purchase_price,

        selling_price,

        gst_percent,

        quantity,

        free_quantity,

        supplier_uuid,

        purchase_uuid

      } = req.body;

      if (
        !product_uuid ||
        !batch_number ||
        !expiry_date ||
        mrp === undefined ||
        quantity === undefined
      ) {

        res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });

        return;
      }

      const batch =
        ProductBatchModel.create({

          product_uuid,

          batch_number,

          expiry_date,

          manufacture_date,

          mrp: Number(mrp),

          ptr:
            ptr !== undefined
              ? Number(ptr)
              : undefined,

          rate:
            rate !== undefined
              ? Number(rate)
              : undefined,

          purchase_price:
            purchase_price !== undefined
              ? Number(purchase_price)
              : undefined,

          selling_price:
            selling_price !== undefined
              ? Number(selling_price)
              : undefined,

          gst_percent:
            gst_percent !== undefined
              ? Number(gst_percent)
              : undefined,

          quantity: Number(quantity),

          free_quantity:
            free_quantity !== undefined
              ? Number(free_quantity)
              : undefined,

          supplier_uuid,

          purchase_uuid
        });

      res.status(201).json({
        success: true,
        data: batch
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // =========================
  // GET PRODUCT BATCHES
  // =========================

  static getByProduct = (
    req: Request,
    res: Response
  ): void => {

    try {

      const product_uuid =
        String(req.params.product_uuid);

      const batches =
        ProductBatchModel.getByProduct(
          product_uuid
        );

      res.json({
        success: true,
        data: batches
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // =========================
  // AVAILABLE BATCHES
  // =========================

  static available = (
    req: Request,
    res: Response
  ): void => {

    try {

      const product_uuid =
        String(req.params.product_uuid);

      const batches =
        ProductBatchModel
          .getAvailableBatches(
            product_uuid
          );

      res.json({
        success: true,
        data: batches
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // =========================
  // TEST FEFO CONSUMPTION
  // =========================

  static consumeFEFO = (
    req: Request,
    res: Response
  ): void => {

    try {

      const {
        product_uuid,
        quantity
      } = req.body;

      if (
        !product_uuid ||
        quantity === undefined
      ) {

        res.status(400).json({
          success: false,
          error: 'Missing fields'
        });

        return;
      }

      const result =
        ProductBatchModel
          .consumeStockFEFO(
            product_uuid,
            Number(quantity)
          );

      res.json({
        success: true,
        data: result
      });

    } catch (error: any) {

      console.error(error);

      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  // =========================
  // NEAR EXPIRY
  // =========================

  static nearExpiry = (
    req: Request,
    res: Response
  ): void => {

    try {

      const data =
        ProductBatchModel.getNearExpiry();

      res.json({
        success: true,
        count: data.length,
        data
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // =========================
  // QUARANTINE EXPIRED
  // =========================

  static quarantineExpired = (
    req: Request,
    res: Response
  ): void => {

    try {

      const affected =
        ProductBatchModel
          .quarantineExpired();

      res.json({
        success: true,
        quarantined_batches: affected
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  static update = (req: Request, res: Response): void => {
    try {
      const batch_uuid = String(req.params.batch_uuid);
      const { batch_number, expiry_date, manufacture_date, quantity,
        supplier_uuid, purchase_uuid, mrp, ptr, rate, purchase_price,
        selling_price, gst_percent, free_quantity } = req.body;

      const updates: Record<string, any> = {};
      if (batch_number !== undefined) updates.batch_number = batch_number;
      if (expiry_date !== undefined) updates.expiry_date = expiry_date;
      if (manufacture_date !== undefined) updates.manufacture_date = manufacture_date;
      if (quantity !== undefined) updates.quantity = Number(quantity);
      if (supplier_uuid !== undefined) updates.supplier_uuid = supplier_uuid;
      if (purchase_uuid !== undefined) updates.purchase_uuid = purchase_uuid;
      if (mrp !== undefined) updates.mrp = Number(mrp);
      if (ptr !== undefined) updates.ptr = Number(ptr);
      if (rate !== undefined) updates.rate = Number(rate);
      if (purchase_price !== undefined) updates.purchase_price = Number(purchase_price);
      if (selling_price !== undefined) updates.selling_price = Number(selling_price);
      if (gst_percent !== undefined) updates.gst_percent = Number(gst_percent);
      if (free_quantity !== undefined) updates.free_quantity = Number(free_quantity);

      const updated = ProductBatchModel.update(batch_uuid, updates);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Batch not found' });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  static search = (req: Request, res: Response): void => {
    try {
      const q = String(req.query.q || '');
      if (!q) { res.json({ success: true, data: [] }); return; }
      const results = ProductBatchModel.searchByBatchNumber(q);
      res.json({ success: true, data: results });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  static deleteBatch = (req: Request, res: Response): void => {
  try {
    const batch_uuid = String(req.params.batch_uuid);
    const deleted = ProductBatchModel.deleteBatch(batch_uuid);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Batch not found' });
      return;
    }
    res.json({ success: true, message: 'Batch deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
}