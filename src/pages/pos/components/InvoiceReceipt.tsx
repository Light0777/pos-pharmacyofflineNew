import { HugeiconsIcon } from "@hugeicons/react";
import {
  PrinterIcon,
  Cancel01Icon,
  WhatsappIcon,
  Delete01Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getSettings } from "../../../renderer/services/settingsApi";

interface InvoiceReceiptProps {
  invoice: any;
  onClose: () => void;
  autoPrint?: boolean;
  onDelete?: () => void;
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convertBelow1000 = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelow1000(n % 100) : '');
  };
  const convert = (n: number): string => {
    if (n === 0) return '';
    if (n < 1000) return convertBelow1000(n);
    const thous = Math.floor(n / 1000);
    const rem = n % 1000;
    return convertBelow1000(thous) + ' Thousand' + (rem ? ' ' + convert(rem) : '');
  };
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let result = convert(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
  return result + ' Only';
}

const BILL_FORMATS: Record<string, { paperWidth?: number }> = {
  a4: {},
  a5: {},
  supplier: {},
  '80mm': { paperWidth: 42 },
  '58mm': { paperWidth: 32 },
};

export default function InvoiceReceipt({ invoice, onClose, autoPrint, onDelete }: InvoiceReceiptProps) {
  const { t } = useTranslation();
  const [formattedInvoice, setFormattedInvoice] = useState<any>(null);
  const [billFormat, setBillFormat] = useState<string>('a4');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem("shop_settings");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.bill_format) setBillFormat(parsed.bill_format);
      } catch {}
    }
    getSettings().then((res: any) => {
      const bf = res?.data?.bill_format || res?.bill_format;
      if (bf) {
        setBillFormat(bf);
        const cached2 = localStorage.getItem("shop_settings");
        if (cached2) {
          try {
            const parsed = JSON.parse(cached2);
            parsed.bill_format = bf;
            localStorage.setItem("shop_settings", JSON.stringify(parsed));
          } catch {}
        }
      }
      setSettingsLoaded(true);
    }).catch(() => {
      setSettingsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (invoice) {
      formatInvoiceData();
    }
  }, [invoice]);

  useEffect(() => {
    if (autoPrint && settingsLoaded && formattedInvoice) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, settingsLoaded, formattedInvoice]);

  useEffect(() => {
    const handleEnterKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleEnterKey);
    return () => window.removeEventListener('keydown', handleEnterKey);
  }, [billFormat, formattedInvoice]);

  const formatDate = (dateString: string) => {
    if (!dateString) return new Date().toLocaleString('en-IN');
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatNumber = (num: number) => {
    const parsed = typeof num === 'string' ? parseFloat(num) : num;
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parsed || 0);
  };

  const formatInvoiceData = () => {
    const shopData = invoice.shop || invoice.pharmacy || {};
    const customerData = invoice.customer || {};
    const summaryData = invoice.summary || {};
    const itemsList = invoice.items || [];
    const paymentsList = invoice.payments || [];
    const complianceData = invoice.compliance || {};

    const calculatedSubtotal = itemsList.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
    const calculatedTax = itemsList.reduce((sum: number, item: any) => sum + (Number(item.gst_amount) || Number(item.tax_amount) || 0), 0);
    const calculatedGrandTotal = calculatedSubtotal + calculatedTax - (Number(invoice.discount) || 0);

    setFormattedInvoice({
      shop: {
        name: shopData.shop_name || shopData.name || 'PHARMACY',
        address: shopData.address || '',
        mobile: shopData.mobile || shopData.phone || '',
        gstin: shopData.gstin || '',
        drug_license_number: shopData.drug_license_number || '',
        pharmacist_name: shopData.pharmacist_name || '',
        state: shopData.state || '',
        state_code: shopData.state_code || '',
      },
      invoice_number: invoice.invoice_number || invoice.invoice_no || 'N/A',
      created_at: invoice.created_at || invoice.date || new Date().toISOString(),
      customer: {
        name: customerData.name || 'Walk-in Customer',
        mobile: customerData.mobile || '',
        address: customerData.address || '',
        gstin: customerData.gstin || '',
      },
      items: itemsList.map((item: any) => ({
        name: item.product_name || item.name || 'Unknown',
        qty: item.quantity || item.qty || 1,
        price: item.price || item.unit_price || 0,
        total: item.total || (item.price * (item.quantity || 1)) || 0,
        hsn_code: item.hsn_code || item.hsn || '',
        tax_percent: item.gst_percent || item.tax_percent || 0,
        batch_number: item.batch_number || '',
        manufacturer: item.manufacturer || '',
        expiry: item.expiry || '',
        unit: item.unit || item.udm || '',
        prescription_number: item.prescription_number || null,
        doctor_name: item.doctor_name || null,
        doctor_license: item.doctor_license || null,
        patient_name: item.patient_name || null,
        patient_age: item.patient_age || null,
        patient_gender: item.patient_gender || null,
      })),
      summary: {
        subtotal: summaryData.subtotal || summaryData.total || calculatedSubtotal,
        tax: summaryData.tax || summaryData.gst_total || calculatedTax,
        grand_total: summaryData.grand_total || invoice.grand_total || calculatedGrandTotal,
      },
      discount: invoice.discount || 0,
      payments: paymentsList.map((payment: any) => ({
        method: payment.method || 'cash',
        amount: payment.amount || 0,
      })),
      compliance: {
        contains_schedule_h: complianceData.contains_schedule_h || false,
        contains_schedule_h1: complianceData.contains_schedule_h1 || false,
      },
      prescription: itemsList.reduce((acc: any, item: any) => {
        if (item.prescription_number && !acc.find((p: any) => p.prescription_number === item.prescription_number)) {
          acc.push({
            prescription_number: item.prescription_number,
            doctor_name: item.doctor_name,
            doctor_license: item.doctor_license,
            patient_name: item.patient_name,
            patient_age: item.patient_age,
            patient_gender: item.patient_gender,
          });
        }
        return acc;
      }, []),
    });
  };

  const handlePrint = async () => {
    if (billFormat === '80mm' || billFormat === '58mm') {
      try {
        const response = await fetch('http://localhost:3000/api/printing/print-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formattedInvoice,
            paperWidth: BILL_FORMATS[billFormat]?.paperWidth || 42,
          }),
        });
        const result = await response.json();
        if (result.success && result.printed) {
          onClose();
        } else {
          alert(result.message || 'Print failed');
        }
      } catch (error) {
        alert('Print failed. Please check your printer connection.');
      }
    } else {
      window.print();
    }
  };

  const handleWhatsApp = () => {
    if (!formattedInvoice) return;

    const phone = formattedInvoice.customer?.mobile ? `91${formattedInvoice.customer.mobile.replace(/\D/g, '')}` : '';
    const shopName = formattedInvoice.shop?.name || 'Our Store';
    const invoiceNo = formattedInvoice.invoice_number;
    const date = formatDate(formattedInvoice.created_at);

    const itemLines = formattedInvoice.items.map((item: any) => `  • ${item.name} x${item.qty} = ₹${formatNumber(item.total)}`).join('\n');
    const paymentLines = formattedInvoice.payments.map((p: any) => `  ${p.method.toUpperCase()}: ₹${formatNumber(p.amount)}`).join('\n');

    const message = [
      `${shopName}`,
      `Invoice: ${invoiceNo}`,
      `Date: ${date}`,
      formattedInvoice.customer?.name !== 'Walk-in Customer' ? `Customer: ${formattedInvoice.customer.name}` : null,
      ``,
      `Items:`,
      itemLines,
      ``,
      `Subtotal: ₹${formatNumber(formattedInvoice.summary.subtotal)}`,
      formattedInvoice.summary.tax > 0 ? `GST: ₹${formatNumber(formattedInvoice.summary.tax)}` : null,
      formattedInvoice.discount > 0 ? `Discount: -₹${formatNumber(formattedInvoice.discount)}` : null,
      `Total: ₹${formatNumber(formattedInvoice.summary.grand_total)}`,
      ``,
      `Payment:`,
      paymentLines,
      ``,
      `Thank you! 🙏`,
    ].filter(line => line !== null).join('\n');

    const url = phone ? `https://web.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(message)}` : `https://web.whatsapp.com/`;
    window.electron?.openWhatsApp(url);
  };

  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        handleWhatsApp();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [formattedInvoice]);

  const renderSupplier = () => {
    const cellStyle: React.CSSProperties = { border: '1px solid #000', padding: '3px 5px', fontSize: 11 };
    const cellCenter: React.CSSProperties = { ...cellStyle, textAlign: 'center' as const };
    const cellRight: React.CSSProperties = { ...cellStyle, textAlign: 'right' as const };
    const cellBold: React.CSSProperties = { ...cellStyle, fontWeight: 'bold' as const };

    const tc = (item: any) => Math.round((Number(item.total || 0) / (1 + (item.tax_percent || 0) / 100)) * 100) / 100;
    const hg = (item: any) => Math.round((tc(item) * ((item.tax_percent || 0) / 2) / 100) * 100) / 100;
    const fmt = (n: number) => n.toFixed(2);
    const invDate = formattedInvoice.created_at ? new Date(formattedInvoice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    const totalQty = items.reduce((s: number, i: any) => s + Number(i.qty || 0), 0);
    const totalTaxable = items.reduce((s: number, i: any) => s + tc(i), 0);
    const totalCgstVal = items.reduce((s: number, i: any) => s + hg(i), 0);
    const totalSgstVal = items.reduce((s: number, i: any) => s + hg(i), 0);
    const grandTotal = Number(summary.grand_total) || totalTaxable + totalCgstVal + totalSgstVal;
    const totalAmount = items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);

    return (
    <div id="receipt" className="supplier-invoice" style={{ width: '100%', margin: '0 auto', background: '#fff', border: '2px solid #000', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 14, color: '#111' }}>
      {/* Title */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, borderBottom: '1px solid #000', padding: '8px 10px' }}>Bill of Supply</div>

      {/* Header grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ borderRight: '1px solid #000' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={cellBold}>Invoice No:</div>
            <div style={cellStyle}>{formattedInvoice.invoice_number}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ ...cellBold, borderTop: '1px solid #000', padding: '6px 10px' }}>Date of Issue:</div>
            <div style={{ ...cellStyle, borderTop: '1px solid #000' }}>{invDate}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ ...cellBold, borderTop: '1px solid #000', padding: '6px 10px' }}>Bill to Party:</div>
            <div style={{ ...cellStyle, borderTop: '1px solid #000' }}></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ ...cellBold, borderTop: '1px solid #000', padding: '6px 10px' }}>Name:</div>
            <div style={{ ...cellStyle, borderTop: '1px solid #000' }}>{customer?.name || '—'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ ...cellBold, borderTop: '1px solid #000', padding: '6px 10px' }}>Address:</div>
            <div style={{ ...cellStyle, borderTop: '1px solid #000' }}>{customer?.address || '—'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ ...cellBold, borderTop: '1px solid #000', padding: '6px 10px' }}>GSTIN/UIN:</div>
            <div style={{ ...cellStyle, borderTop: '1px solid #000' }}>{customer?.gstin || '—'}</div>
          </div>
          <div style={{ /* State / Code sub-row */ }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #000' }}>
              <div style={{ ...cellBold, padding: '6px 10px', borderRight: '1px solid #000' }}>State:</div>
              <div style={{ padding: '6px 10px' }}>Code:</div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={cellBold}>State:</div>
            <div style={cellStyle}>{shop.state || '—'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ ...cellBold, borderTop: '1px solid #000', padding: '6px 10px' }}>State Code:</div>
            <div style={{ ...cellStyle, borderTop: '1px solid #000' }}>{shop.state_code || '—'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ ...cellBold, borderTop: '1px solid #000', padding: '6px 10px' }}>Ship to Party:</div>
            <div style={{ ...cellStyle, borderTop: '1px solid #000' }}></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ ...cellBold, borderTop: '1px solid #000', padding: '6px 10px' }}>Name:</div>
            <div style={{ ...cellStyle, borderTop: '1px solid #000' }}>{customer?.name || '—'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ ...cellBold, borderTop: '1px solid #000', padding: '6px 10px' }}>Address:</div>
            <div style={{ ...cellStyle, borderTop: '1px solid #000' }}>{customer?.address || '—'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ ...cellBold, borderTop: '1px solid #000', padding: '6px 10px' }}>GSTIN:</div>
            <div style={{ ...cellStyle, borderTop: '1px solid #000' }}>{customer?.gstin || '—'}</div>
          </div>
          <div style={{ /* State / Code sub-row */ }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #000' }}>
              <div style={{ ...cellBold, padding: '6px 10px', borderRight: '1px solid #000' }}>State:</div>
              <div style={{ padding: '6px 10px' }}>Code:</div>
            </div>
          </div>
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #000' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>S.No</th>
            <th rowSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>Product Description</th>
            <th rowSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>HSN Code</th>
            <th rowSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>UDM</th>
            <th rowSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>Qty</th>
            <th rowSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>Rate</th>
            <th rowSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>Amount</th>
            <th rowSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>Discount</th>
            <th rowSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>Taxable Value</th>
            <th colSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>CGST</th>
            <th colSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>SGST</th>
            <th colSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>IGST</th>
            <th rowSpan={2} style={{ ...cellCenter, fontWeight: 'bold', fontSize: 9 }}>Total</th>
          </tr>
          <tr>
            <th style={{ ...cellCenter, fontWeight: 'bold', fontSize: 8 }}>Rate</th>
            <th style={{ ...cellCenter, fontWeight: 'bold', fontSize: 8 }}>Amount</th>
            <th style={{ ...cellCenter, fontWeight: 'bold', fontSize: 8 }}>Rate</th>
            <th style={{ ...cellCenter, fontWeight: 'bold', fontSize: 8 }}>Amount</th>
            <th style={{ ...cellCenter, fontWeight: 'bold', fontSize: 8 }}>Rate</th>
            <th style={{ ...cellCenter, fontWeight: 'bold', fontSize: 8 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => {
            const taxable = tc(item);
            const halfGst = hg(item);
            return (
            <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
              <td style={cellCenter}>{idx + 1}</td>
              <td style={{ ...cellStyle, textAlign: 'left' as const, fontSize: 10 }}>{item.name}</td>
              <td style={cellCenter}>{item.hsn_code || '—'}</td>
              <td style={cellCenter}>{item.unit || 'Nos'}</td>
              <td style={cellCenter}>{item.qty || 0}</td>
              <td style={cellRight}>{Number(item.price || 0).toFixed(2)}</td>
              <td style={cellRight}>{Number(item.total || 0).toFixed(2)}</td>
              <td style={cellRight}>{discount > 0 ? Number(discount).toFixed(2) : '—'}</td>
              <td style={cellRight}>{fmt(taxable)}</td>
              <td style={cellCenter}>{item.tax_percent > 0 ? `${(item.tax_percent / 2)}%` : '—'}</td>
              <td style={cellRight}>{item.tax_percent > 0 ? fmt(halfGst) : '—'}</td>
              <td style={cellCenter}>{item.tax_percent > 0 ? `${(item.tax_percent / 2)}%` : '—'}</td>
              <td style={cellRight}>{item.tax_percent > 0 ? fmt(halfGst) : '—'}</td>
              <td style={cellCenter}>0%</td>
              <td style={cellRight}>0.00</td>
              <td style={cellRight}>{Number(item.total || 0).toFixed(2)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', borderTop: '1px solid #000' }}>
        <div style={{ ...cellStyle, fontWeight: 'bold', textAlign: 'right', paddingRight: 12, gridColumn: 'span 4' }}>Total:</div>
        <div style={cellCenter}>{totalQty}</div>
        <div style={cellRight}>—</div>
        <div style={cellRight}>{fmt(totalAmount)}</div>
        <div style={cellRight}>{discount > 0 ? fmt(Number(discount)) : '—'}</div>
        <div style={cellRight}>{fmt(totalTaxable)}</div>
        <div style={cellCenter}></div>
        <div style={cellRight}>{fmt(totalCgstVal)}</div>
        <div style={cellCenter}></div>
        <div style={cellRight}>{fmt(totalSgstVal)}</div>
        <div style={cellCenter}></div>
        <div style={cellRight}>0.00</div>
        <div style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>{fmt(grandTotal)}</div>
      </div>

      {/* Footer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '2px solid #000' }}>
        <div style={{ padding: '20px 10px 8px', fontSize: 10 }}>
          Goods once sold will not be taken back.<br />
          Interest @ 24% p.a. will be charged if payment is not made within due date.
        </div>
        <div style={{ padding: '20px 10px 8px', fontSize: 10, textAlign: 'right', borderLeft: '2px solid #000' }}>
          For {shop.name || 'Shop Name'}<br /><br /><br />
          Authorised Signatory
        </div>
      </div>
    </div>
    );
  };

  if (!formattedInvoice) {
    return createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>,
      document.body
    );
  }

  const { shop, customer, items, summary, payments, discount, compliance } = formattedInvoice;

  const hcgstTotal = items.reduce((acc: { rate: number; taxable: number; cgst: number; sgst: number }[], item: any) => {
    const rate = item.tax_percent || 0;
    const existing = acc.find((a) => a.rate === rate);
    const itemTotal = Number(item.total) || 0;
    const taxable = Math.round((itemTotal / (1 + rate / 100)) * 100) / 100;
    const halfGst = Math.round((taxable * (rate / 2) / 100) * 100) / 100;
    if (existing) {
      existing.taxable += taxable;
      existing.cgst += halfGst;
      existing.sgst += halfGst;
    } else {
      acc.push({ rate, taxable, cgst: halfGst, sgst: halfGst });
    }
    return acc;
  }, []).filter((g: any) => g.rate > 0);

  const totalTaxable = hcgstTotal.reduce((s: number, g: any) => s + g.taxable, 0);
  const totalCgst = hcgstTotal.reduce((s: number, g: any) => s + g.cgst, 0);
  const totalSgst = hcgstTotal.reduce((s: number, g: any) => s + g.sgst, 0);

  const isThermal = billFormat === '80mm' || billFormat === '58mm';
  const charWidth = billFormat === '58mm' ? 32 : 42;

  const thermalLine = (text: string, align: 'center' | 'left' | 'right' = 'left') => {
    if (align === 'center') {
      const pad = Math.max(0, charWidth - text.length);
      const left = Math.floor(pad / 2);
      return ' '.repeat(left) + text;
    }
    if (align === 'right') {
      return text.padStart(charWidth);
    }
    return text.padEnd(charWidth);
  };

  const thermalSep = (char: string = '-') => char.repeat(charWidth);

  const renderA4 = () => {
    const cs: React.CSSProperties = { border: '1px solid #000', padding: '6px 10px', fontSize: 14 };
    const cc: React.CSSProperties = { ...cs, textAlign: 'center' as const };
    const cr: React.CSSProperties = { ...cs, textAlign: 'right' as const };
    const cb: React.CSSProperties = { ...cs, fontWeight: 'bold' as const };
    const tc2 = (item: any) => Math.round((Number(item.total || 0) / (1 + (item.tax_percent || 0) / 100)) * 100) / 100;
    const hg2 = (item: any) => Math.round((tc2(item) * ((item.tax_percent || 0) / 2) / 100) * 100) / 100;
    const fmt2 = (n: number) => n.toFixed(2);
    const invDate = formattedInvoice.created_at ? new Date(formattedInvoice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const totalQty = items.reduce((s: number, i: any) => s + Number(i.qty || 0), 0);
    const totalTaxable2 = items.reduce((s: number, i: any) => s + tc2(i), 0);
    const totalCgst2 = items.reduce((s: number, i: any) => s + hg2(i), 0);
    const totalSgst2 = items.reduce((s: number, i: any) => s + hg2(i), 0);
    const grandTotal2 = Number(summary.grand_total) || totalTaxable2 + totalCgst2 + totalSgst2;
    const totalAmount2 = items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    return (
    <div id="receipt" className="a4-sheet" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 14, color: '#111' }}>
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 18, borderBottom: '1px solid #000', padding: '8px 10px' }}>Bill of Supply</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ borderRight: '1px solid #000' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={cb}>Invoice No:</div><div style={cs}>{formattedInvoice.invoice_number}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '6px 10px' }}>Date of Issue:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{invDate}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '6px 10px' }}>Bill to Party:</div><div style={{ ...cs, borderTop: '1px solid #000' }}></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '6px 10px' }}>Name:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.name || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '6px 10px' }}>Address:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.address || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '6px 10px' }}>GSTIN/UIN:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.gstin || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #000' }}><div style={{ ...cb, padding: '6px 10px', borderRight: '1px solid #000' }}>State:</div><div style={{ padding: '6px 10px' }}>Code:</div></div>
        </div>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={cb}>State:</div><div style={cs}>{shop.state || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '6px 10px' }}>State Code:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{shop.state_code || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '6px 10px' }}>Ship to Party:</div><div style={{ ...cs, borderTop: '1px solid #000' }}></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '6px 10px' }}>Name:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.name || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '6px 10px' }}>Address:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.address || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '6px 10px' }}>GSTIN:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.gstin || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #000' }}><div style={{ ...cb, padding: '6px 10px', borderRight: '1px solid #000' }}>State:</div><div style={{ padding: '6px 10px' }}>Code:</div></div>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #000' }}>
        <thead>
          <tr>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 12, width: 36 }}>S.No</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 12 }}>Product Description</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 12, width: 60 }}>HSN/SAC</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 12, width: 40 }}>UDM</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 12, width: 40 }}>Qty</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 12, width: 65 }}>Rate</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 12, width: 70 }}>Amount</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 12, width: 60 }}>GST%</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 12, width: 75 }}>Taxable</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => {
            const taxable = tc2(item);
            return (
            <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
              <td style={cc}>{idx + 1}</td>
              <td style={{ ...cs, textAlign: 'left' as const, fontSize: 13 }}>{item.name}</td>
              <td style={cc}>{item.hsn_code || '—'}</td>
              <td style={cc}>{item.unit || 'Nos'}</td>
              <td style={cc}>{item.qty || 0}</td>
              <td style={cr}>{Number(item.price || 0).toFixed(2)}</td>
              <td style={cr}>{Number(item.total || 0).toFixed(2)}</td>
              <td style={cc}>{item.tax_percent > 0 ? `${item.tax_percent}%` : '—'}</td>
              <td style={cr}>{fmt2(taxable)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
        <div style={{ ...cs, fontWeight: 'bold', textAlign: 'right', paddingRight: 12, gridColumn: 'span 3' }}>Total:</div>
        <div style={cc}>{totalQty}</div>
        <div style={cr}>{fmt2(totalAmount2)}</div>
        <div style={cc}></div>
        <div style={cr}>{fmt2(totalTaxable2)}</div>
      </div>
      <div style={{ padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #000' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20 }}>
          {totalCgst2 > 0 && <span>CGST: ₹{fmt2(totalCgst2)}</span>}
          {totalSgst2 > 0 && <span>SGST: ₹{fmt2(totalSgst2)}</span>}
          <span style={{ fontWeight: 'bold' }}>Grand Total: ₹{fmt2(grandTotal2)}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '2px solid #000' }}>
        <div style={{ padding: '28px 10px 10px', fontSize: 13 }}>
          Goods once sold will not be taken back.<br />
          Interest @ 24% p.a. will be charged if payment is not made within due date.
        </div>
        <div style={{ padding: '28px 10px 10px', fontSize: 13, textAlign: 'right', borderLeft: '2px solid #000' }}>
          For {shop.name || 'Shop Name'}<br /><br /><br />
          Authorised Signatory
        </div>
      </div>
    </div>
    );
  };

  const renderA5 = () => {
    const cs: React.CSSProperties = { border: '1px solid #000', padding: '4px 6px', fontSize: 12 };
    const cc: React.CSSProperties = { ...cs, textAlign: 'center' as const };
    const cr: React.CSSProperties = { ...cs, textAlign: 'right' as const };
    const cb: React.CSSProperties = { ...cs, fontWeight: 'bold' as const };
    const tc2 = (item: any) => Math.round((Number(item.total || 0) / (1 + (item.tax_percent || 0) / 100)) * 100) / 100;
    const hg2 = (item: any) => Math.round((tc2(item) * ((item.tax_percent || 0) / 2) / 100) * 100) / 100;
    const fmt2 = (n: number) => n.toFixed(2);
    const invDate = formattedInvoice.created_at ? new Date(formattedInvoice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const totalQty = items.reduce((s: number, i: any) => s + Number(i.qty || 0), 0);
    const totalTaxable2 = items.reduce((s: number, i: any) => s + tc2(i), 0);
    const totalCgst2 = items.reduce((s: number, i: any) => s + hg2(i), 0);
    const totalSgst2 = items.reduce((s: number, i: any) => s + hg2(i), 0);
    const grandTotal2 = Number(summary.grand_total) || totalTaxable2 + totalCgst2 + totalSgst2;
    const totalAmount2 = items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    return (
    <div id="receipt" className="a5-sheet" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12, color: '#111' }}>
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 15, borderBottom: '1px solid #000', padding: '6px 8px' }}>Bill of Supply</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ borderRight: '1px solid #000' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={cb}>Invoice No:</div><div style={cs}>{formattedInvoice.invoice_number}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '4px 6px' }}>Date of Issue:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{invDate}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '4px 6px' }}>Bill to Party:</div><div style={{ ...cs, borderTop: '1px solid #000' }}></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '4px 6px' }}>Name:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.name || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '4px 6px' }}>Address:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.address || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '4px 6px' }}>GSTIN/UIN:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.gstin || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #000' }}><div style={{ ...cb, padding: '4px 6px', borderRight: '1px solid #000' }}>State:</div><div style={{ padding: '4px 6px' }}>Code:</div></div>
        </div>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={cb}>State:</div><div style={cs}>{shop.state || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '4px 6px' }}>State Code:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{shop.state_code || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '4px 6px' }}>Ship to Party:</div><div style={{ ...cs, borderTop: '1px solid #000' }}></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '4px 6px' }}>Name:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.name || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '4px 6px' }}>Address:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.address || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}><div style={{ ...cb, borderTop: '1px solid #000', padding: '4px 6px' }}>GSTIN:</div><div style={{ ...cs, borderTop: '1px solid #000' }}>{customer?.gstin || '—'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #000' }}><div style={{ ...cb, padding: '4px 6px', borderRight: '1px solid #000' }}>State:</div><div style={{ padding: '4px 6px' }}>Code:</div></div>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #000' }}>
        <thead>
          <tr>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 10, width: 30 }}>S.No</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 10 }}>Product Description</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 10, width: 50 }}>HSN</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 10, width: 32 }}>UDM</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 10, width: 32 }}>Qty</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 10, width: 55 }}>Rate</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 10, width: 60 }}>Amount</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 10, width: 48 }}>GST%</th>
            <th style={{ ...cc, fontWeight: 'bold', fontSize: 10, width: 60 }}>Taxable</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => {
            const taxable = tc2(item);
            return (
            <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
              <td style={cc}>{idx + 1}</td>
              <td style={{ ...cs, textAlign: 'left' as const, fontSize: 11 }}>{item.name}</td>
              <td style={cc}>{item.hsn_code || '—'}</td>
              <td style={cc}>{item.unit || 'Nos'}</td>
              <td style={cc}>{item.qty || 0}</td>
              <td style={cr}>{Number(item.price || 0).toFixed(2)}</td>
              <td style={cr}>{Number(item.total || 0).toFixed(2)}</td>
              <td style={cc}>{item.tax_percent > 0 ? `${item.tax_percent}%` : '—'}</td>
              <td style={cr}>{fmt2(taxable)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
        <div style={{ ...cs, fontWeight: 'bold', textAlign: 'right', paddingRight: 8, gridColumn: 'span 3' }}>Total:</div>
        <div style={cc}>{totalQty}</div>
        <div style={cr}>{fmt2(totalAmount2)}</div>
        <div style={cc}></div>
        <div style={cr}>{fmt2(totalTaxable2)}</div>
      </div>
      <div style={{ padding: '6px 8px', fontSize: 11, borderBottom: '1px solid #000' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          {totalCgst2 > 0 && <span>CGST: ₹{fmt2(totalCgst2)}</span>}
          {totalSgst2 > 0 && <span>SGST: ₹{fmt2(totalSgst2)}</span>}
          <span style={{ fontWeight: 'bold' }}>Grand Total: ₹{fmt2(grandTotal2)}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '2px solid #000', fontSize: 11 }}>
        <div style={{ padding: '18px 8px 8px' }}>
          Goods once sold will not be taken back.<br />
          Interest @ 24% p.a. will be charged if payment is not made within due date.
        </div>
        <div style={{ padding: '18px 8px 8px', textAlign: 'right', borderLeft: '2px solid #000' }}>
          For {shop.name || 'Shop Name'}<br /><br />
          Authorised Signatory
        </div>
      </div>
    </div>
    );
  };

  const renderThermal = () => {
    const lines: string[] = [];
    lines.push(thermalLine(shop.name || 'PHARMACY', 'center'));
    if (shop.address) lines.push(thermalLine(shop.address, 'center'));
    if (shop.mobile) lines.push(thermalLine(`Ph: ${shop.mobile}`, 'center'));
    if (shop.gstin) lines.push(thermalLine(`GSTIN: ${shop.gstin}`, 'center'));
    lines.push(thermalSep());
    lines.push(thermalLine(`Invoice #: ${formattedInvoice.invoice_number}`));
    lines.push(thermalLine(`Date: ${formatDate(formattedInvoice.created_at)}`));
    if (customer?.name && customer.name !== 'Walk-in Customer') lines.push(thermalLine(`Customer: ${customer.name}`));
    lines.push(thermalSep());
    lines.push(thermalLine('TAX INVOICE', 'center'));
    lines.push(thermalSep());
    const nameWidth = Math.max(8, charWidth - 28);
    lines.push(thermalLine('Item'.padEnd(nameWidth) + 'Qty'.padStart(6) + 'Rate'.padStart(10) + 'Amt'.padStart(10)));
    lines.push(thermalSep());
    items.forEach((item: any) => {
      const nw = Math.max(8, charWidth - 28);
      const nameCol = item.name.substring(0, nw).padEnd(nw);
      const qtyCol = item.qty.toString().padStart(6);
      const rateCol = Number(item.price).toFixed(2).padStart(10);
      const totalCol = Number(item.total).toFixed(2).padStart(10);
      lines.push(`${nameCol}${qtyCol}${rateCol}${totalCol}`);
      if (item.tax_percent > 0) lines.push(thermalLine(`  ${item.tax_percent}% GST`));
    });
    lines.push(thermalSep());
    lines.push(thermalLine(`Subtotal: Rs.${formatNumber(summary.subtotal)}`, 'right'));
    if (totalCgst > 0) lines.push(thermalLine(`CGST: Rs.${formatNumber(totalCgst)}`, 'right'));
    if (totalSgst > 0) lines.push(thermalLine(`SGST: Rs.${formatNumber(totalSgst)}`, 'right'));
    if (discount > 0) lines.push(thermalLine(`Discount: -Rs.${formatNumber(discount)}`, 'right'));
    lines.push(thermalSep('='));
    lines.push(thermalLine(`TOTAL: Rs.${formatNumber(summary.grand_total)}`, 'center'));
    lines.push(thermalSep('='));
    if (payments.length > 0) {
      lines.push('Payment Details:');
      payments.forEach((p: any) => lines.push(thermalLine(`${p.method}: Rs.${formatNumber(p.amount)}`)));
      lines.push(thermalSep());
    }
    lines.push('');
    lines.push(thermalLine('** THANK YOU **', 'center'));
    lines.push(thermalLine('Visit us again!', 'center'));
    lines.push(thermalLine('Computer generated invoice', 'center'));

    return (
      <div className="thermal-receipt">
        <div className="thermal-notch"><div className="thermal-notch-dot left" /><div className="thermal-notch-dot right" /></div>
        <div id="receipt">
          <div className="thermal-brand">{shop.name || 'RECEIPT'}</div>
          <pre className="thermal-text">{lines.join('\n')}</pre>
        </div>
        <div className="thermal-notch bottom"><div className="thermal-notch-dot left" /><div className="thermal-notch-dot right" /></div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
        <div className="absolute inset-0 overflow-y-auto flex flex-col items-center p-4">
        <div className={`flex flex-col items-center gap-4 ${isThermal ? 'w-full max-w-[400px] my-auto' : billFormat === 'a4' || billFormat === 'supplier' ? 'w-full max-w-[277mm] my-auto' : billFormat === 'a5' ? 'w-full max-w-[190mm] my-auto' : 'w-full max-w-[900px] my-auto'} pb-20`}>

          {billFormat === 'a4' && renderA4()}
          {billFormat === 'a5' && renderA5()}
          {billFormat === 'supplier' && renderSupplier()}
          {(billFormat === '80mm' || billFormat === '58mm') && renderThermal()}

        </div>
      </div>

      <div className="print:hidden fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50">
        <button onClick={handlePrint} className="px-5 py-2.5 bg-white text-gray-800 rounded-xl flex items-center gap-2 shadow-lg hover:bg-gray-100 transition-colors text-sm font-medium border border-gray-200">
          <HugeiconsIcon icon={PrinterIcon} className="text-base" /> Print
        </button>
        <button onClick={handleWhatsApp} className="px-5 py-2.5 bg-green-500 text-white rounded-xl flex items-center gap-2 shadow-lg hover:bg-green-600 transition-colors text-sm font-medium">
          <HugeiconsIcon icon={WhatsappIcon} className="text-base" /> WhatsApp
        </button>
        <button onClick={onClose} className="px-5 py-2.5 bg-black text-white rounded-xl flex items-center gap-2 shadow-lg hover:bg-gray-900 transition-colors text-sm font-medium border border-white/30">
          <HugeiconsIcon icon={Cancel01Icon} className="text-base" /> Close
        </button>
        {onDelete && (
          <button onClick={onDelete} className="px-5 py-2.5 bg-red-500 text-white rounded-xl flex items-center gap-2 shadow-lg hover:bg-red-600 transition-colors text-sm font-medium">
            <HugeiconsIcon icon={Delete01Icon} className="text-base" /> Delete
          </button>
        )}
      </div>

      <style>{`
        * { font-family: 'DM Sans', sans-serif; }
        code, .mono { font-family: 'DM Mono', monospace; }

        .a4-sheet {
          width: 297mm;
          min-height: 210mm;
          background: #ffffff;
          box-shadow: 0 8px 40px rgba(16, 100, 40, 0.12), 0 2px 8px rgba(0,0,0,0.06);
          border-radius: 4px;
          padding: 10mm 12mm;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .a5-sheet {
          width: 210mm;
          min-height: 148mm;
          background: #ffffff;
          box-shadow: 0 8px 40px rgba(16, 100, 40, 0.12), 0 2px 8px rgba(0,0,0,0.06);
          border-radius: 4px;
          padding: 10mm 12mm;
          position: relative;
          display: flex;
          flex-direction: column;
        }



        .thermal-receipt {
          width: fit-content;
          min-width: 220px;
          margin: 0 auto;
          background: #fefcf5;
          border-radius: 10px;
          padding: 0;
          box-shadow: 0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
          border: 1px solid #e8e0d0;
          position: relative;
          overflow: hidden;
        }

        .thermal-notch {
          position: relative;
          height: 12px;
          background: #f5f0e8;
          border-bottom: 1px dashed #d4cfc4;
        }
        .thermal-notch.bottom {
          border-bottom: none;
          border-top: 1px dashed #d4cfc4;
        }
        .thermal-notch-dot {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          background: #e8e0d0;
          border-radius: 50%;
          border: 2px solid #d4cfc4;
        }
        .thermal-notch-dot.left { left: -8px; }
        .thermal-notch-dot.right { right: -8px; }

        .thermal-brand {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 700;
          color: #8a7a60;
          text-align: center;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 8px 14px 4px;
          border-bottom: 1px solid #f0e8d8;
        }

        .thermal-receipt #receipt {
          padding: 10px 14px 14px;
        }

        .thermal-text {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: ${billFormat === '58mm' ? '13px' : '14px'};
          line-height: 1.45;
          color: #1a1a1a;
          white-space: pre;
          margin: 0;
          overflow-x: auto;
        }



        @media print {
          @page { size: ${billFormat === 'a5' ? 'A5' : 'A4'} landscape; margin: 0; }
          body {
            background: white !important;
            padding: 0 !important;
            display: block;
          }
          .a4-sheet, .a5-sheet {
            width: 100%;
            min-height: 100vh;
            box-shadow: none !important;
            border-radius: 0;
            display: block !important;
            overflow: visible !important;
          }
          .a4-sheet { padding: 10mm 12mm; }
          .a5-sheet { padding: 5mm 6mm; }
          .supplier-invoice { display: ${billFormat === 'supplier' ? 'block' : 'none'}; }
        .supplier-invoice .cell { border: 1px solid #000; padding: 6px 10px; }
        .supplier-invoice table { border-collapse: collapse; }
          .thermal-receipt { display: ${billFormat === '80mm' || billFormat === '58mm' ? 'block' : 'none'}; }
          .print\\:hidden { display: none !important; }
          #receipt, #receipt * { visibility: visible; }
        }
      `}</style>
    </div>,
    document.body
  );
}
