import { Router, Request, Response } from 'express';
import { ThermalPrinterService } from '../services/printerService';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/print-receipt', async (req: Request, res: Response) => {
  try {
    const { paperWidth, ...invoice } = req.body;

    if (!invoice || !invoice.invoice_number) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid invoice data' 
      });
    }

    const printerService = new ThermalPrinterService(
      req.body.printer_host || 'localhost',
      req.body.printer_port || 9104,
      req.body.printer_name || null,
      paperWidth || 42
    );

    console.log('🖨️ Printing receipt for invoice:', invoice.invoice_number, `(${paperWidth || 42}-char width)`);

    const result = await printerService.print(invoice, paperWidth);

    if (result.success) {
      console.log('✅ Print job sent successfully');
      res.json({ 
        success: true, 
        message: 'Receipt sent to thermal printer',
        printed: true
      });
    } else {
      console.warn('⚠️ Print failed:', result.error);
      res.json({ 
        success: false, 
        message: result.error,
        fallback: true,
        useBrowserPrint: true
      });
    }
  } catch (error) {
    console.error('❌ Print error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      useBrowserPrint: true 
    });
  }
});

router.get('/test-printer', async (req: Request, res: Response) => {
  try {
    const paperWidth = Number(req.query.paperWidth) || 42;
    const printerService = new ThermalPrinterService('localhost', 9104, null, paperWidth);
    const testInvoice = {
      invoice_number: 'TEST-001',
      shop: { name: 'Test Store' },
      items: [{ name: 'Test Item', qty: 1, price: 10, total: 10 }],
      summary: { total: 10, grand_total: 10 }
    };

    const result = await printerService.print(testInvoice, paperWidth);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Printer test failed' });
  }
});

export default router;
