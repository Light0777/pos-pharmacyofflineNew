import type { NextFunction, Request, Response } from 'express';
import { SettingsModel } from '../models/Settings';
import type { AuthRequest } from '../middleware/auth';
import { createBackup, listBackups, restoreBackup } from '../database/backup';
import { LicenseService } from '../services/licenseService';

export class SettingsController {
  // static activateLicense(arg0: string, activateLicense: any) {
  //   throw new Error('Method not implemented.');
  // }
  // static licenseStatus(arg0: string, licenseStatus: any) {
  //   throw new Error('Method not implemented.');
  // }
  // GET settings
  static get = (req: AuthRequest, res: Response): void => {
    try {
      const settings = SettingsModel.get();

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // CREATE or UPDATE settings
  static save = (req: AuthRequest, res: Response): void => {
    try {
      const { shop_name, mobile, address, gstin, invoice_prefix, auto_print, printer_type, printer_host, printer_port, printer_name, terms_conditions, privacy_policy } = req.body;

      if (!shop_name) {
        res.status(400).json({
          success: false,
          error: 'Shop name is required'
        });
        return;
      }

      const settings = SettingsModel.save({
        shop_name: String(shop_name),
        mobile: mobile ? String(mobile) : undefined,
        address: address ? String(address) : undefined,
        gstin: gstin ? String(gstin) : undefined,
        invoice_prefix: invoice_prefix ? String(invoice_prefix) : undefined,
        auto_print: auto_print !== undefined ? Number(auto_print) : undefined,
        printer_type: printer_type ? String(printer_type) : undefined,
        printer_host: printer_host ? String(printer_host) : undefined,
        printer_port: printer_port !== undefined ? Number(printer_port) : undefined,
        printer_name: printer_name ? String(printer_name) : undefined,
        terms_conditions: terms_conditions !== undefined ? String(terms_conditions) : undefined,
        privacy_policy: privacy_policy !== undefined ? String(privacy_policy) : undefined,
      });

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Save settings error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // UPDATE settings (explicit update)
  static update(
    req: Request,
    res: Response
  ): void {

    try {

      const setting =
        SettingsModel.update(
          req.body
        );

      res.json({

        success: true,

        data: setting
      });

    } catch (error) {

      res.status(400).json({

        success: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to update settings'
      });
    }
  }

  // In backup method, remove the parameter since your createBackup has a default parameter
  static backup = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const backupPath = createBackup('manual'); // This is fine - 'manual' is a valid label
      const backups = listBackups();
      res.json({
        success: true,
        message: 'Backup created successfully',
        data: { backupPath, backups }
      });
    } catch (error: any) {
      console.error('Backup error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  static listBackups = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const backups = await listBackups();
      res.json({ success: true, data: backups });
    } catch (error: any) {
      console.error('List backups error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  static restore = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { backup_name } = req.body;
      if (!backup_name) {
        res.status(400).json({ success: false, error: 'backup_name is required' });
        return;
      }
      await restoreBackup(backup_name);
      res.json({ success: true, message: 'Database restored successfully. Please restart the app.' });
    } catch (error: any) {
      console.error('Restore error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  static testPrint = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const settings = SettingsModel.get() as any;
      const { ThermalPrinterService } = await import('../services/printerService');

      const printer = new ThermalPrinterService(
        settings.printer_host || 'localhost',
        settings.printer_port || 9104,
        settings.printer_name || null
      );

      const testInvoice = {
        invoice_number: 'TEST-001',
        created_at: new Date().toISOString(),
        shop: {
          name: settings.shop_name || 'My Store',
          address: settings.address,
          mobile: settings.mobile,
          gstin: settings.gstin,
        },
        items: [{ name: 'Test Item', qty: 1, price: 100, total: 100, tax_percent: 18, cgst: 9, sgst: 9 }],
        summary: { total: 100, tax: 18, cgst: 9, sgst: 9, grand_total: 118 },
        payments: [{ method: 'cash', amount: 118 }],
      };

      const result = await printer.print(testInvoice);

      if (result.success) {
        res.json({ success: true, message: 'Test print sent successfully!' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  static licenseStatus = (req: Request, res: Response): void => {
    const licensed = LicenseService.isLicensed();
    res.json({ success: true, licensed });
  };

  static activateLicense = (req: Request, res: Response): void => {
    const { license_key } = req.body;
    const result = LicenseService.activate(license_key);
    res.json(result);
  };
}