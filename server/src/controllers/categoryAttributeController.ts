// controllers/CategoryAttributeController.ts

import type {
  Request,
  Response
} from 'express';

import {
  CategoryAttributeModel
} from '../models/CategoryAttribute';

export class CategoryAttributeController {

  // ASSIGN ATTRIBUTE

  static assign = (
    req: Request,
    res: Response
  ): void => {

    try {

      const {
        category_uuid,
        attribute_uuid,
        is_required,
        sort_order
      } = req.body;

      if (
        !category_uuid ||
        !attribute_uuid
      ) {

        res.status(400).json({
          success: false,
          error: 'category_uuid and attribute_uuid required'
        });

        return;
      }

      CategoryAttributeModel.assign(
        category_uuid,
        attribute_uuid,
        is_required,
        sort_order
      );

      res.json({
        success: true,
        message: 'Attribute assigned'
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // GET ALL CATEGORY ATTRIBUTE MAPPINGS

  static index = (
    req: Request,
    res: Response
  ): void => {

    try {

      const mappings =
        CategoryAttributeModel.findAll();

      res.json({
        success: true,
        data: mappings
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // GET CATEGORY ATTRIBUTES

  static getByCategory = (
    req: Request,
    res: Response
  ): void => {

    try {

      const category_uuid =
        String(req.params.category_uuid);

      const attributes =
        CategoryAttributeModel.getByCategory(
          category_uuid
        );

      res.json({
        success: true,
        data: attributes
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // REMOVE ATTRIBUTE FROM CATEGORY

  static remove = (
    req: Request,
    res: Response
  ): void => {

    try {

      const category_uuid =
        String(req.query.category_uuid);

      const attribute_uuid =
        String(req.query.attribute_uuid);

      if (!category_uuid || !attribute_uuid) {

        res.status(400).json({
          success: false,
          error: 'category_uuid and attribute_uuid query params required'
        });

        return;
      }

      CategoryAttributeModel.remove(
        category_uuid,
        attribute_uuid
      );

      res.json({
        success: true,
        message: 'Attribute removed from category'
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