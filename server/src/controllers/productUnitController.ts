// controllers/ProductUnitController.ts

import type {
  Request,
  Response
} from 'express';

import {
  ProductUnitModel
} from '../models/ProductUnit';

export class ProductUnitController {

  // CREATE

  static create = (
    req: Request,
    res: Response
  ): void => {

    try {

      const {

        product_uuid,

        unit_name,
        conversion_factor,

        barcode,

        price,
        purchase_price,

        is_base_unit

      } = req.body;

      if (
        !product_uuid ||
        !unit_name ||
        !conversion_factor
      ) {

        res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });

        return;
      }

      const unit =
        ProductUnitModel.create({

          product_uuid,

          unit_name,

          conversion_factor:
            Number(conversion_factor),

          barcode,

          price:
            price !== undefined
              ? Number(price)
              : undefined,

          purchase_price:
            purchase_price !== undefined
              ? Number(purchase_price)
              : undefined,

          is_base_unit:
            is_base_unit ? 1 : 0
        });

      res.status(201).json({
        success: true,
        data: unit
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // GET PRODUCT UNITS

  static getByProduct = (
    req: Request,
    res: Response
  ): void => {

    try {

      const product_uuid =
        String(req.params.product_uuid);

      const units =
        ProductUnitModel.getByProduct(
          product_uuid
        );

      res.json({
        success: true,
        data: units
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // GET ALL UNITS

  static getAllUnits = (
    req: Request,
    res: Response
  ): void => {
    try {
      const units = ProductUnitModel.getAll();

      res.json({
        success: true,
        data: units
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  

  // DELETE

  static destroy = (
    req: Request,
    res: Response
  ): void => {

    try {

      const uuid =
        String(req.params.uuid);

      const deleted =
        ProductUnitModel.delete(uuid);

      if (!deleted) {

        res.status(404).json({
          success: false,
          error: 'Unit not found'
        });

        return;
      }

      res.json({
        success: true,
        message: 'Unit deleted'
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}