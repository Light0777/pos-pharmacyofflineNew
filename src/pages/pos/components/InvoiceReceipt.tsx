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

export default function InvoiceReceipt({ invoice, onClose, autoPrint, onDelete }: InvoiceReceiptProps) {
  const { t } = useTranslation();
  const [formattedInvoice, setFormattedInvoice] = useState<any>(null);

  useEffect(() => {
    if (invoice) {
      formatInvoiceData();
    }
  }, [invoice]);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, formattedInvoice]);

  useEffect(() => {
    const handleEnterKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleEnterKey);
    return () => window.removeEventListener('keydown', handleEnterKey);
  }, []);

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
      },
      invoice_number: invoice.invoice_number || invoice.invoice_no || 'N/A',
      created_at: invoice.created_at || invoice.date || new Date().toISOString(),
      customer: {
        name: customerData.name || 'Walk-in Customer',
        mobile: customerData.mobile || '',
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
    try {
      const response = await fetch('http://localhost:3000/api/printing/print-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedInvoice || invoice),
      });
      const result = await response.json();
      if (result.success && result.printed) {
        onClose();
      } else {
        window.print();
      }
    } catch (error) {
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

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
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

  return createPortal(
    <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="absolute inset-0 overflow-y-auto flex flex-col items-center p-4">
      <div className="flex flex-col items-center gap-4 w-full max-w-[210mm] pb-20">

        {/* A4 Sheet */}
        <div id="receipt" className="a4-sheet">
          <div className="top-accent"></div>

          {/* HEADER */}
          <div className="flex items-start justify-between mb-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="text-left">
                <h1 className="text-xl font-bold text-green-900 leading-tight">{shop.name}</h1>
                <p className="text-xs text-green-700 font-medium">Licensed Retail Pharmacy &amp; Drug Store</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {shop.drug_license_number && <>DL No: {shop.drug_license_number}</>}
                  {shop.drug_license_number && shop.gstin && <> &nbsp;|&nbsp; </>}
                  {shop.gstin && <>GST: {shop.gstin}</>}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="inline-flex items-center gap-2 mb-1">
                <span className="paid-pill">PAID</span>
                <span className="text-xs font-bold text-green-800 bg-green-50 border border-green-200 px-2 py-1 rounded">TAX INVOICE</span>
              </div>
              <p className="label-text mt-1">Invoice No</p>
              <p className="value-text mono text-green-800 text-sm font-bold">#{formattedInvoice.invoice_number}</p>
              <p className="label-text mt-1">Date &amp; Time</p>
              <p className="value-text text-sm">{formatDate(formattedInvoice.created_at)}</p>
            </div>
          </div>

          {/* Address Strip */}
          <div className="flex items-center gap-4 rounded-lg px-3 py-2 mb-3 flex-wrap">
            {shop.address && (
              <div className="flex items-center gap-1.5 text-xs text-green-800">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {shop.address}
              </div>
            )}
            {shop.mobile && (
              <div className="flex items-center gap-1.5 text-xs text-green-800">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.8 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/></svg>
                {shop.mobile}
              </div>
            )}

          </div>

          <hr className="divider-dark mb-3" />

          {/* Prescription Info */}
          {formattedInvoice.prescription?.length > 0 && formattedInvoice.prescription[0]?.prescription_number && (
            <div className="mb-3 mr-auto">
              <div className="border border-green-100 rounded-lg p-3 bg-white" style={{ display: 'inline-block' }}>
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 2v4h4M4 22h16M12 22V6M8 22V10m8 12V6"/></svg>
                  Prescription Info
                </p>
                <table className="w-full text-xs">
                  <tbody>
                    <tr><td className="label-text py-0.5 w-20">Rx No.</td><td className="value-text py-0.5 font-semibold">{formattedInvoice.prescription[0].prescription_number}</td></tr>
                    {formattedInvoice.prescription[0].doctor_name && <tr><td className="label-text py-0.5">Doctor</td><td className="value-text py-0.5">{formattedInvoice.prescription[0].doctor_name}</td></tr>}
                    {formattedInvoice.prescription[0].doctor_license && <tr><td className="label-text py-0.5">License</td><td className="value-text py-0.5 mono">{formattedInvoice.prescription[0].doctor_license}</td></tr>}
                    {formattedInvoice.prescription[0].patient_name && <tr><td className="label-text py-0.5">Patient</td><td className="value-text py-0.5">{formattedInvoice.prescription[0].patient_name}</td></tr>}
                    {(formattedInvoice.prescription[0].patient_age || formattedInvoice.prescription[0].patient_gender) && (
                      <tr><td className="label-text py-0.5">Age/Gender</td><td className="value-text py-0.5">
                        {[formattedInvoice.prescription[0].patient_age, formattedInvoice.prescription[0].patient_gender].filter(Boolean).join(' / ')}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Medicines Table */}
          <div className="mb-3">
            <p className="text-xs font-bold text-green-800 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              Dispensed Medicines
            </p>
            <div className="border border-green-100 rounded-lg overflow-hidden">
              <table className="bill-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">#</th>
                    <th className="text-left">Drug Name</th>
                    <th className="text-left">Batch / Mfg</th>
                    {items.some((i: any) => i.expiry) && <th className="text-center">Expiry</th>}
                    <th className="text-center">Qty</th>
                    <th className="text-right">MRP</th>
                    <th className="text-center">GST%</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="text-gray-400 text-center">{idx + 1}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {item.prescription_required > 0 && <span className="rx-badge">Rx</span>}
                          <div>
                            <p className="font-semibold text-gray-900" style={{ fontSize: '11.5px' }}>{item.name}</p>
                            {item.manufacturer && <p style={{ fontSize: '9.5px', color: '#6b7280' }}>{item.manufacturer}</p>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {item.batch_number && <span className="mono" style={{ fontSize: '10px', color: '#059669' }}>{item.batch_number}</span>}
                        {item.batch_number && item.manufacturer && <br />}
                        {item.manufacturer && <span style={{ fontSize: '9px', color: '#9ca3af' }}>{item.manufacturer}</span>}
                        {!item.batch_number && !item.manufacturer && <span style={{ fontSize: '10px', color: '#9ca3af' }}>—</span>}
                      </td>
                      {items.some((i: any) => i.expiry) && <td className="text-center" style={{ fontSize: '10.5px', color: '#374151' }}>{item.expiry || '—'}</td>}
                      <td className="text-center font-semibold" style={{ fontSize: '11px', color: '#166534' }}>{item.qty}</td>
                      <td className="text-right mono" style={{ fontSize: '11px' }}>₹{formatNumber(item.price)}</td>
                      <td className="text-center" style={{ fontSize: '10.5px', color: '#6366f1', fontWeight: 600 }}>{item.tax_percent > 0 ? `${item.tax_percent}%` : '—'}</td>
                      <td className="text-right font-semibold mono" style={{ fontSize: '11px', color: '#166534' }}>₹{formatNumber(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals + Payment Grid */}
          <div className="grid grid-cols-2 gap-3 mb-3">

            {/* GST Breakup */}
            {hcgstTotal.length > 0 && (
              <div className="border border-green-100 rounded-lg p-3">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">GST Summary</p>
                <table className="w-full" style={{ fontSize: '10.5px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #d1fae5' }}>
                      <th className="text-left pb-1 font-semibold text-gray-500" style={{ fontSize: '9.5px' }}>GST %</th>
                      <th className="text-right pb-1 font-semibold text-gray-500" style={{ fontSize: '9.5px' }}>Taxable</th>
                      <th className="text-right pb-1 font-semibold text-gray-500" style={{ fontSize: '9.5px' }}>CGST</th>
                      <th className="text-right pb-1 font-semibold text-gray-500" style={{ fontSize: '9.5px' }}>SGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hcgstTotal.map((g: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0fdf4' }}>
                        <td className="py-0.5 text-purple-700 font-semibold">{g.rate}%</td>
                        <td className="py-0.5 text-right mono">₹{formatNumber(g.taxable)}</td>
                        <td className="py-0.5 text-right mono">₹{formatNumber(g.cgst)}</td>
                        <td className="py-0.5 text-right mono">₹{formatNumber(g.sgst)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 700, color: '#166534', borderTop: '1px solid #86efac' }}>
                      <td className="pt-1">Total</td>
                      <td className="pt-1 text-right mono">₹{formatNumber(totalTaxable)}</td>
                      <td className="pt-1 text-right mono">₹{formatNumber(totalCgst)}</td>
                      <td className="pt-1 text-right mono">₹{formatNumber(totalSgst)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Payment Details */}
            <div className="border border-green-100 rounded-lg p-3">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">Payment Details</p>
              <table className="w-full" style={{ fontSize: '11px' }}>
                <tbody>
                  <tr><td className="label-text py-0.5">Subtotal</td><td className="text-right mono py-0.5 font-medium">₹{formatNumber(summary.subtotal)}</td></tr>
                  {discount > 0 && <tr><td className="label-text py-0.5">Discount</td><td className="text-right mono py-0.5 font-medium text-amber-600">− ₹{formatNumber(discount)}</td></tr>}
                  {totalCgst > 0 && <tr><td className="label-text py-0.5">CGST</td><td className="text-right mono py-0.5 font-medium">₹{formatNumber(totalCgst)}</td></tr>}
                  {totalSgst > 0 && <tr><td className="label-text py-0.5">SGST</td><td className="text-right mono py-0.5 font-medium">₹{formatNumber(totalSgst)}</td></tr>}
                  <tr style={{ borderTop: '2px solid #86efac' }}>
                    <td className="font-bold text-green-900 pt-1.5" style={{ fontSize: '13px' }}>Grand Total</td>
                    <td className="text-right mono font-black text-green-800 pt-1.5" style={{ fontSize: '14px' }}>₹{formatNumber(summary.grand_total)}</td>
                  </tr>
                  {payments.length > 0 && (
                    <>
                      {payments.map((p: any, i: number) => (
                        <tr key={i}>
                          <td className="label-text pt-1">{i === 0 ? 'Payment Mode' : ''}</td>
                          <td className="text-right py-1 capitalize" style={{ fontSize: '11px', fontWeight: 600, color: '#166534' }}>{p.method} ₹{formatNumber(p.amount)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Amount in Words + Pharmacist */}
          <div className="border border-green-100 rounded-lg p-3 mb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Amount in Words</p>
                <p style={{ fontSize: '10.5px', color: '#374151', fontStyle: 'italic', lineHeight: 1.5 }}>
                  {numberToWords(summary.grand_total)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Pharmacist on Duty</p>
                <div className="sign-box flex items-end px-2 pb-1 justify-end">
                  <p style={{ fontSize: '9px', color: '#9ca3af' }}>Signature</p>
                </div>
                {shop.pharmacist_name && <p style={{ fontSize: '9.5px', color: '#374151', marginTop: '3px', fontWeight: 500 }}>{shop.pharmacist_name}</p>}
              </div>
            </div>
          </div>

          {/* Schedule Warnings */}
          {(compliance.contains_schedule_h || compliance.contains_schedule_h1) && (
            <div className="mb-3">
              {compliance.contains_schedule_h && (
                <div className="text-center text-[8px] text-red-600 border border-red-200 bg-red-50 p-1 rounded mb-1">
                  ⚠️ Schedule H drug - Prescription required
                </div>
              )}
              {compliance.contains_schedule_h1 && (
                <div className="text-center text-[8px] text-orange-600 border border-orange-200 bg-orange-50 p-1 rounded">
                  📋 Schedule H1 drug - Prescription recorded
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto pt-2">
            <hr className="divider mb-2" />
            <div className="grid grid-cols-3 gap-2 text-center" style={{ fontSize: '9.5px', color: '#6b7280' }}>
              <div>
                <p className="font-semibold text-green-800" style={{ fontSize: '9.5px' }}>Return Policy</p>
                <p>Medicines once sold are not returnable without valid reason.</p>
              </div>
              <div>
                <p className="font-semibold text-green-800" style={{ fontSize: '9.5px' }}>Storage Advisory</p>
                <p>Store in cool &amp; dry place. Keep out of reach of children.</p>
              </div>
              <div>
                <p className="font-semibold text-green-800" style={{ fontSize: '9.5px' }}>Narcotics Declaration</p>
                <p>No Schedule H1 or narcotic drug dispensed without valid prescription.</p>
              </div>
            </div>
            <hr className="divider mt-2 mb-1.5" />
            <div className="flex items-center justify-between" style={{ fontSize: '9px', color: '#9ca3af' }}>
              <span>Generated by <span className="font-semibold text-green-700">{shop.name} POS</span></span>
              <span>This is a computer-generated invoice.</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
      </div>
      </div>

      {/* Buttons - fixed at bottom */}
      <div className="print:hidden fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50">
        <button onClick={handlePrint} className="px-5 py-2.5 bg-white text-gray-800 rounded-xl flex items-center gap-2 shadow-lg hover:bg-gray-100 transition-colors text-sm font-medium border border-gray-200">
          <HugeiconsIcon icon={PrinterIcon} className="text-base"  /> Print
        </button>
        <button onClick={handleWhatsApp} className="px-5 py-2.5 bg-green-500 text-white rounded-xl flex items-center gap-2 shadow-lg hover:bg-green-600 transition-colors text-sm font-medium">
          <HugeiconsIcon icon={WhatsappIcon} className="text-base"  /> WhatsApp
        </button>
        <button onClick={onClose} className="px-5 py-2.5 bg-black text-white rounded-xl flex items-center gap-2 shadow-lg hover:bg-gray-900 transition-colors text-sm font-medium border border-white/30">
          <HugeiconsIcon icon={Cancel01Icon} className="text-base"  /> Close
        </button>
        {onDelete && (
          <button onClick={onDelete} className="px-5 py-2.5 bg-red-500 text-white rounded-xl flex items-center gap-2 shadow-lg hover:bg-red-600 transition-colors text-sm font-medium">
            <HugeiconsIcon icon={Delete01Icon} className="text-base"  /> Delete
          </button>
        )}
      </div>

      <style>{`
        * { font-family: 'DM Sans', sans-serif; }
        code, .mono { font-family: 'DM Mono', monospace; }

        .a4-sheet {
          width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          box-shadow: 0 8px 40px rgba(16, 100, 40, 0.12), 0 2px 8px rgba(0,0,0,0.06);
          border-radius: 4px;
          padding: 10mm 12mm;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .top-accent {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 5px;
          background: linear-gradient(90deg, #15803d, #22c55e, #86efac);
          border-radius: 4px 4px 0 0;
        }

        .divider { border: none; border-top: 1px solid #d1fae5; margin: 0; }
        .divider-dark { border: none; border-top: 2px solid #15803d; margin: 0; }

        .bill-table th {
          background: #f0fdf4;
          color: #166534;
          font-weight: 600;
          font-size: 10.5px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 7px 8px;
          border-bottom: 2px solid #86efac;
        }
        .bill-table td {
          font-size: 11.5px;
          padding: 6px 8px;
          border-bottom: 1px solid #f0fdf4;
          color: #1a1a1a;
          vertical-align: middle;
        }
        .bill-table tr:last-child td { border-bottom: none; }
        .bill-table tr:nth-child(even) td { background: #f9fefb; }

        .rx-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px; height: 18px;
          background: #166534;
          color: white;
          border-radius: 50%;
          font-size: 9px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .sign-box {
          border: 1.5px dashed #86efac;
          border-radius: 6px;
          height: 56px;
          min-width: 120px;
          background: #f9fefb;
        }

        .paid-pill {
          display: inline-block;
          background: #dcfce7;
          color: #166534;
          font-weight: 700;
          font-size: 10px;
          letter-spacing: 0.06em;
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid #86efac;
          text-transform: uppercase;
        }

        .label-text { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
        .value-text { font-size: 12px; color: #111827; font-weight: 500; }

        @media print {
          @page { size: A4; margin: 0; }
          body {
            background: white !important;
            padding: 0 !important;
            display: block;
          }
          .a4-sheet {
            width: 100%;
            min-height: 100vh;
            box-shadow: none !important;
            border-radius: 0;
            padding: 10mm 12mm;
            page-break-inside: avoid;
          }
          .print\\:hidden { display: none !important; }
          #receipt, #receipt * { visibility: visible; }
        }
      `}</style>
    </div>,
    document.body
  );
}
