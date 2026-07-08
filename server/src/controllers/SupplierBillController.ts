import { Request, Response } from 'express';
import { SupplierBillModel } from '../models/SupplierBill';

export class SupplierBillController {
  static index = (req: Request, res: Response): void => {
    try {
      const { supplier_uuid } = req.params;
      const bills = SupplierBillModel.findBySupplier(supplier_uuid);
      res.json({ success: true, data: bills });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  static store = (req: Request, res: Response): void => {
    try {
      const { supplier_uuid } = req.params;
      const { bill_image } = req.body;
      if (!supplier_uuid) {
        res.status(400).json({ success: false, error: 'supplier_uuid is required' });
        return;
      }
      const bill = SupplierBillModel.create({ supplier_uuid, bill_image });
      res.status(201).json({ success: true, data: bill });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  static destroy = (req: Request, res: Response): void => {
    try {
      const { bill_uuid } = req.params;
      const deleted = SupplierBillModel.delete(bill_uuid);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Bill not found' });
        return;
      }
      res.json({ success: true, message: 'Deleted' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}
