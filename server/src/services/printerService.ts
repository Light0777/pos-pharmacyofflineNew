import * as net from 'net';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface InvoiceItem {
    name: string;
    qty: number;
    price: number;
    total: number;
    hsn_code?: string;
    tax_percent?: number;
    cgst?: number;
    sgst?: number;
}

interface Invoice {
    invoice_number: string;
    date?: string;
    created_at?: string;
    shop?: {
        name?: string;
        address?: string;
        mobile?: string;
        gstin?: string;
    };
    customer?: {
        name?: string;
        mobile?: string;
    };
    items?: InvoiceItem[];
    summary?: {
        total?: number;
        tax?: number;
        cgst?: number;
        sgst?: number;
        grand_total?: number;
    };
    discount?: number;
    payments?: Array<{ method: string; amount: number }>;
}

const PAPER_WIDTHS: Record<string, number> = {
  '80mm': 42,
  '58mm': 32,
};

export class ThermalPrinterService {
    private printerHost: string;
    private printerPort: number;
    private printerName: string | null;
    private paperWidth: number;

    constructor(host: string = 'localhost', port: number = 9104, printerName: string | null = null, paperWidth: number = 42) {
        this.printerHost = host;
        this.printerPort = port;
        this.printerName = printerName;
        this.paperWidth = paperWidth;
    }

    private centerText(text: string): string {
        const textLength = text.length;
        if (textLength >= this.paperWidth) return text;
        const padding = Math.floor((this.paperWidth - textLength) / 2);
        return ' '.repeat(padding) + text;
    }

    private addSeparator(commands: number[], encoder: TextEncoder, char: string = '-'): void {
        const separator = char.repeat(this.paperWidth);
        commands.push(...encoder.encode(separator + '\n'));
    }

    private formatToESC_POS(invoice: Invoice, paperWidth?: number): Buffer {
        const width = paperWidth || this.paperWidth;
        const encoder = new TextEncoder();
        let commands: number[] = [];

        commands.push(0x1B, 0x40); // ESC @
        commands.push(0x1B, 0x61, 0x01); // Center align

        const shopName = invoice.shop?.name || 'MY STORE';
        commands.push(0x1B, 0x45, 0x01);
        commands.push(...encoder.encode(shopName + '\n'));

        if (invoice.shop?.address) {
            commands.push(...encoder.encode(invoice.shop.address + '\n'));
        }
        if (invoice.shop?.mobile) {
            commands.push(...encoder.encode('Ph: ' + invoice.shop.mobile + '\n'));
        }
        if (invoice.shop?.gstin) {
            commands.push(...encoder.encode('GSTIN: ' + invoice.shop.gstin + '\n'));
        }

        commands.push(...encoder.encode('\n'));
        this.addSeparator(commands, encoder, '-');

        commands.push(...encoder.encode(`Invoice #: ${invoice.invoice_number}\n`));
        const dateStr = invoice.date || invoice.created_at || new Date().toISOString();
        commands.push(...encoder.encode(`Date: ${new Date(dateStr).toLocaleString()}\n`));

        if (invoice.customer?.name) {
            commands.push(...encoder.encode(`Customer: ${invoice.customer.name}\n`));
        }
        if (invoice.customer?.mobile) {
            commands.push(...encoder.encode(`Mobile: ${invoice.customer.mobile}\n`));
        }

        this.addSeparator(commands, encoder, '-');
        commands.push(...encoder.encode('TAX INVOICE\n'));
        this.addSeparator(commands, encoder, '-');

        commands.push(0x1B, 0x61, 0x00); // Left align for table

        const nameWidth = Math.max(10, width - 28);
        const headerLine =
            'Item'.padEnd(nameWidth) +
            'Qty'.padStart(6) +
            'Rate'.padStart(10) +
            'Amt'.padStart(10);
        commands.push(...encoder.encode(headerLine + '\n'));
        this.addSeparator(commands, encoder, '-');

        invoice.items?.forEach(item => {
            const nameLine = item.name.substring(0, nameWidth).padEnd(nameWidth);
            const qtyLine = item.qty.toString().padStart(6);
            const rateLine = Number(item.price).toFixed(2).toString().padStart(10);
            const totalLine = Number(item.total).toFixed(2).toString().padStart(10);
            const itemLine = `${nameLine}${qtyLine}${rateLine}${totalLine}`;
            commands.push(...encoder.encode(itemLine + '\n'));

            if (item.hsn_code || item.tax_percent) {
                let taxLine = '  ';
                if (item.hsn_code) taxLine += `HSN:${item.hsn_code} `;
                if (item.tax_percent) taxLine += `${item.tax_percent}% GST`;
                if (item.cgst && item.sgst && item.tax_percent) {
                    taxLine += ` (C:${item.cgst.toFixed(2)} S:${item.sgst.toFixed(2)})`;
                }
                commands.push(...encoder.encode(taxLine + '\n'));
            }
        });

        this.addSeparator(commands, encoder, '-');

        commands.push(0x1B, 0x61, 0x01); // Center align

        const subtotal = (invoice.summary?.total || 0).toFixed(2);
        commands.push(...encoder.encode(`Subtotal: Rs.${subtotal}\n`));

        if ((invoice.summary?.tax || 0) > 0) {
            const cgst = (invoice.summary?.cgst || (invoice.summary?.tax || 0) / 2).toFixed(2);
            const sgst = (invoice.summary?.sgst || (invoice.summary?.tax || 0) / 2).toFixed(2);
            commands.push(...encoder.encode(`CGST: Rs.${cgst}\n`));
            commands.push(...encoder.encode(`SGST: Rs.${sgst}\n`));
        }

        if ((invoice.discount || 0) > 0) {
            const discount = (invoice.discount || 0).toFixed(2);
            commands.push(...encoder.encode(`Discount: -Rs.${discount}\n`));
        }

        this.addSeparator(commands, encoder, '=');

        const grandTotal = (invoice.summary?.grand_total || 0).toFixed(2);
        commands.push(...encoder.encode(`TOTAL: Rs.${grandTotal}\n`));

        this.addSeparator(commands, encoder, '=');

        if (invoice.payments && invoice.payments.length > 0) {
            commands.push(...encoder.encode('Payment Details:\n'));
            invoice.payments.forEach(payment => {
                commands.push(...encoder.encode(`${payment.method}: Rs.${payment.amount.toFixed(2)}\n`));
            });
            this.addSeparator(commands, encoder, '-');
        }

        commands.push(...encoder.encode('\n'));
        commands.push(...encoder.encode('** THANK YOU **\n'));
        commands.push(...encoder.encode('Visit us again!\n'));
        commands.push(...encoder.encode('\n'));
        commands.push(...encoder.encode('Computer generated invoice\n'));
        commands.push(...encoder.encode('\n\n\n'));

        commands.push(0x1D, 0x56, 0x00); // GS V 0 (full cut)

        return Buffer.from(commands);
    }

    private async printViaWindows(data: Buffer): Promise<{ success: boolean; error?: string; printed?: boolean }> {
        return new Promise((resolve) => {
            const tmpFile = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);
            fs.writeFileSync(tmpFile, data);
            const printerArg = this.printerName || '';

            execFile('cmd.exe', ['/c', 'copy', '/b', tmpFile, printerArg], (error: Error | null) => {
                fs.unlinkSync(tmpFile);
                if (error) {
                    resolve({ success: false, error: error.message, printed: false });
                } else {
                    resolve({ success: true, printed: true });
                }
            });
        });
    }

    async print(invoice: Invoice, paperWidth?: number): Promise<{ success: boolean; error?: string; printed?: boolean }> {
    const printData = this.formatToESC_POS(invoice, paperWidth);

    if (this.printerName) {
      return this.printViaWindows(printData);
    }

    return new Promise((resolve) => {
      const client = new net.Socket();

      const timeout = setTimeout(() => {
        client.destroy();
        resolve({
          success: false,
          error: 'Printer not connected - check if printer is on and connected',
          printed: false
        });
      }, 3000);

      client.connect(this.printerPort, this.printerHost, () => {
        clearTimeout(timeout);
        client.write(printData, (err) => {
          if (err) {
            resolve({ success: false, error: err.message, printed: false });
          } else {
            resolve({ success: true, printed: true });
          }
          client.end();
        });
      });

      client.on('error', () => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: `Cannot connect to printer at ${this.printerHost}:${this.printerPort}`,
          printed: false
        });
      });
    });
  }
}
