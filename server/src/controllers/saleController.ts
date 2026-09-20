import type { Request, Response } from 'express';
import { CartModel } from '../models/Cart';
import { SaleModel } from '../models/Sale';
import type { AuthRequest } from '../middleware/auth';

export class SaleController {
  // static getInvoice(arg0: string, getInvoice: any) {
  //   throw new Error('Method not implemented.');
  // }
  // Preview the next invoice number without consuming it
  static nextInvoice = (req: AuthRequest, res: Response): void => {
    try {
      res.json({
        success: true,
        data: { invoice_number: SaleModel.previewInvoiceNumber() }
      });
    } catch (error) {
      console.error('Next invoice error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Checkout - Convert cart to sale
  static checkout = (req: AuthRequest, res: Response): void => {
    try {
      const cartUuid = String(req.params.cart_uuid);
      const { customer_uuid, payments, prescriptions = [], remarks } = req.body;

      // Get cart with items
      const cart = CartModel.findWithItems(cartUuid);
      if (!cart) {
        res.status(404).json({
          success: false,
          error: 'Cart not found'
        });
        return;
      }

      // Check if cart is active
      if (cart.status !== 'active') {
        res.status(400).json({
          success: false,
          error: 'Cart is not active. Current status: ' + cart.status
        });
        return;
      }

      // Check if cart has items
      if (!cart.items || cart.items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Cart is empty'
        });
        return;
      }

      // Validate payments
      if (!payments || !Array.isArray(payments) || payments.length === 0) {
        res.status(400).json({
          success: false,
          error: 'At least one payment method is required'
        });
        return;
      }

      // Calculate total payment amount
      const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const grandTotal = cart.summary.grand_total;

      // Allow overpayment (customer gives more cash = change)
      // Only reject underpayment if no customer selected for credit
      if (totalPaid < grandTotal - 0.01) {
        res.status(400).json({
          success: false,
          error: `Insufficient payment. Total: ${grandTotal}, Paid: ${totalPaid}`
        });
        return;
      }

      // Process checkout
      const sale = SaleModel.createFromCart(
        cart,
        customer_uuid || null,
        payments,
        prescriptions,
        req.user,
        { remarks }
      );

      // Get full invoice data including shop info, items, GST breakdown
      const invoice = SaleModel.getInvoice(sale.sale.sale_uuid);

      res.status(201).json({
        success: true,
        message: 'Checkout successful',
        data: sale,
        invoice: invoice
      });
    } catch (error: any) {
      console.error('❌ Checkout error DETAILS:', error);
      console.error('Stack:', error.stack);
      // Send the actual error message to the frontend
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  };

  // Get sales list
  static index = (req: Request, res: Response): void => {
    try {
      const page = parseInt(String(req.query.page || '1'));
      const limit = parseInt(String(req.query.limit || '20'));
      const filters: any = {};

      if (req.query.startDate) filters.startDate = String(req.query.startDate);
      if (req.query.endDate) filters.endDate = String(req.query.endDate);
      if (req.query.customer_uuid) filters.customerUuid = String(req.query.customer_uuid);
      if (req.query.status) filters.status = String(req.query.status);

      const { sales, total } = SaleModel.findAll(page, limit, filters);

      res.json({
        success: true,
        data: sales,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('List sales error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Get single sale
  static show = (req: Request, res: Response): void => {
    try {
      const saleUuid = String(req.params.sale_uuid);
      const sale = SaleModel.findById(saleUuid);

      if (!sale) {
        res.status(404).json({
          success: false,
          error: 'Sale not found'
        });
        return;
      }

      res.json({
        success: true,
        data: sale
      });
    } catch (error) {
      console.error('Show sale error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  static getInvoice = (req: Request, res: Response): void => {
    try {
      const saleUuid = String(req.params.sale_uuid);
      const invoice = SaleModel.getInvoice(saleUuid);

      if (!invoice) {
        res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
        return;
      }

      res.json({
        success: true,
        data: invoice
      });
    } catch (error) {
      console.error('Get invoice error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

}
