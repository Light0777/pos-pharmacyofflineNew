import type { Request, Response } from 'express';
import { CartModel } from '../models/Cart';
import { ProductModel } from '../models/Product';
import type { AuthRequest } from '../middleware/auth';

export class CartController {
  // Create new cart
  static create = (req: AuthRequest, res: Response): void => {
    try {
      const cart = CartModel.create();

      res.status(201).json({
        success: true,
        message: 'Cart created successfully',
        data: cart
      });
    } catch (error) {
      console.error('Create cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Get cart with items and summary
  static show = (req: Request, res: Response): void => {
    try {
      const cartUuid = String(req.params.cart_uuid);
      const cart = CartModel.findWithItems(cartUuid);

      if (!cart) {
        res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
        return;
      }

      res.json({
        success: true,
        data: cart
      });
    } catch (error) {
      console.error('Show cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Add item to cart
  static addItem = (req: Request, res: Response): void => {
    try {
      const cartUuid = String(req.params.cart_uuid);
      const {
        product_uuid,
        unit_uuid,
        quantity,
        batch_uuid
      } = req.body;

      // Validation
      if (
        !product_uuid ||
        !unit_uuid ||
        !quantity
      ) {
        res.status(400).json({
          success: false,
          error: 'product_uuid, unit_uuid and quantity are required'
        });
        return;
      }

      // Check if cart exists and is active
      const cart = CartModel.findById(cartUuid);
      if (!cart) {
        res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
        return;
      }

      if (cart.status !== 'active') {
        res.status(400).json({
          success: false,
          error: 'Cart is not active'
        });
        return;
      }

      // Get product details
      const product = ProductModel.findById(String(product_uuid));
      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Product not found'
        });
        return;
      }

      // Check stock
      const qty = parseInt(String(quantity));
      if (qty < 1) {
        res.status(400).json({
          success: false,
          error: 'Quantity must be at least 1'
        });
        return;
      }

      // Add item to cart
      const item = CartModel.addItem(
        cartUuid,
        product.product_uuid,
        String(unit_uuid),
        qty,
        product.price,
        product.gst_percent || 0,
        batch_uuid
      );

      res.status(201).json({
        success: true,
        message: 'Item added to cart',
        data: item
      });
    } catch (error) {
      console.error('Add item error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Update cart item
  static updateItem = (req: Request, res: Response): void => {
    try {
      const cartUuid = String(req.params.cart_uuid);
      const unitUuid = String(req.params.unit_uuid);
      const productUuid = String(req.params.product_uuid);
      const { quantity, price, discount, tax_percent } = req.body;

      const updates: any = {};
      if (quantity !== undefined) updates.quantity = parseInt(String(quantity));
      if (price !== undefined) updates.price = parseFloat(String(price));
      if (discount !== undefined) updates.discount = parseFloat(String(discount));
      if (tax_percent !== undefined) updates.tax_percent = parseFloat(String(tax_percent));

      const item = CartModel.updateItem(
        cartUuid,
        productUuid,
        unitUuid,
        updates
      );

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Item not found in cart'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Item updated successfully',
        data: item
      });
    } catch (error) {
      console.error('Update item error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Remove item from cart
  static removeItem = (req: Request, res: Response): void => {
    try {
      const cartUuid = String(req.params.cart_uuid);
      const productUuid =
        String(req.params.product_uuid);

      const unitUuid =
        String(req.params.unit_uuid);

      const removed = CartModel.removeItem(
        cartUuid,
        productUuid,
        unitUuid
      );

      if (!removed) {
        res.status(404).json({
          success: false,
          error: 'Item not found in cart'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Item removed from cart'
      });
    } catch (error) {
      console.error('Remove item error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Apply bill discount
  static applyDiscount = (req: Request, res: Response): void => {
    try {
      const cartUuid = String(req.params.cart_uuid);
      const { discount } = req.body;

      if (discount === undefined || isNaN(Number(discount)) || Number(discount) < 0) {
        res.status(400).json({
          success: false,
          error: 'Valid discount amount is required'
        });
        return;
      }

      const cart = CartModel.applyDiscount(cartUuid, Number(discount));

      if (!cart) {
        res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
        return;
      }

      // Return updated cart with summary
      const cartWithItems = CartModel.findWithItems(cartUuid);

      res.json({
        success: true,
        message: 'Discount applied successfully',
        data: cartWithItems
      });
    } catch (error) {
      console.error('Apply discount error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Hold cart
  static hold = (req: AuthRequest, res: Response): void => {
    try {
      const cartUuid = String(req.params.cart_uuid);
      const cart = CartModel.hold(cartUuid);

      if (!cart) {
        res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Cart held successfully',
        data: cart
      });
    } catch (error) {
      console.error('Hold cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Resume cart
  static resume = (req: AuthRequest, res: Response): void => {
    try {
      const cartUuid = String(req.params.cart_uuid);
      const cart = CartModel.resume(cartUuid);

      if (!cart) {
        res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Cart resumed successfully',
        data: cart
      });
    } catch (error) {
      console.error('Resume cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Get held carts
  static heldCarts = (req: AuthRequest, res: Response): void => {
    try {
      const carts = CartModel.getHeldCarts();

      res.json({
        success: true,
        data: carts,
        count: carts.length
      });
    } catch (error) {
      console.error('Get held carts error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Clear cart
  static clear = (req: AuthRequest, res: Response): void => {
    try {
      const cartUuid = String(req.params.cart_uuid);

      const cart = CartModel.findById(cartUuid);
      if (!cart) {
        res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
        return;
      }

      CartModel.clearCart(cartUuid);

      res.json({
        success: true,
        message: 'Cart cleared successfully'
      });
    } catch (error) {
      console.error('Clear cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Get all carts
  static getAll = (req: AuthRequest, res: Response): void => {
    try {
      console.log('GET ALL CARTS CONTROLLER HIT');

      const carts = CartModel.getAll();

      res.json({
        success: true,
        count: carts.length,
        data: carts
      });
    } catch (error) {
      console.error('Get all carts error:', error);

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Delete cart (route: DELETE /carts/:cart_uuid)
  static deleteByUuid = (req: AuthRequest, res: Response): void => {

    
    try {
      const cartUuid = String(req.params.cart_uuid);

      const cart = CartModel.findById(cartUuid);
      if (!cart) {
        res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
        return;
      }

      const deleted = CartModel.deleteByUuid(cartUuid);
      if (!deleted) {
        res.status(500).json({
          success: false,
          error: 'Unable to delete cart'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Cart deleted successfully'
      });
    } catch (error) {
      console.error('Delete cart error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }

    console.log('REQ PARAMS:', req.params);
    
  };

  

}
