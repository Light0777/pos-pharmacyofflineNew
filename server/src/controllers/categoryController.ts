// controllers/CategoryController.ts

import type {
  Request,
  Response
} from 'express';

import {
  CategoryModel
} from '../models/Category';

import type {
  AuthRequest
} from '../middleware/auth';

export class CategoryController {

  // CREATE
  static create = (
    req: AuthRequest,
    res: Response
  ): void => {

    try {

      const {
        name,
        parent_uuid,
        description
      } = req.body;

      if (!name) {

        res.status(400).json({
          success: false,
          error: 'Name required'
        });

        return;
      }

      const category =
        CategoryModel.create({
          name,
          parent_uuid,
          description
        });

      res.status(201).json({
        success: true,
        data: category
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // LIST
  static index = (
    req: Request,
    res: Response
  ): void => {

    try {

      const categories =
        CategoryModel.findAll();

      res.json({
        success: true,
        data: categories
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
    req: AuthRequest,
    res: Response
  ): void => {

    try {

      const uuid =
        String(req.params.uuid);

      const deleted =
        CategoryModel.delete(uuid);

      if (!deleted) {

        res.status(404).json({
          success: false,
          error: 'Category not found'
        });

        return;
      }

      res.json({
        success: true,
        message: 'Category deleted'
      });

    } catch (error: any) {

      console.error(error);

      const message = error?.message || 'Internal server error';

      res.status(500).json({
        success: false,
        error: message
      });
    }
  };

  // UPDATE
  static update = (
    req: AuthRequest,
    res: Response
  ): void => {

    try {

      const uuid =
        String(req.params.uuid);

      const {
        name,
        parent_uuid,
        description
      } = req.body;

      const category =
        CategoryModel.update(uuid, {
          name,
          parent_uuid,
          description
        });

      if (!category) {

        res.status(404).json({
          success: false,
          error: 'Category not found'
        });

        return;
      }

      res.json({
        success: true,
        data: category
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