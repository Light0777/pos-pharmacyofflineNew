import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getCustomerLedger,
  addCustomerPayment,
} from "../../renderer/services/customerApi";
import CustomerStatement from "./CustomerStatement";
import { IndianRupee } from "../../components/IndianRupee";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  PrinterIcon,
  WhatsappIcon,
  ReceiptTextIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CustomerLedgerModal({ customer, onClose }: any) {
  const { t } = useTranslation();
  const [ledger, setLedger] = useState<any[]>([]);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("cash");

  useEffect(() => {
    load();
  }, [customer]);

  const load = async () => {
    const data = await getCustomerLedger(customer.customer_uuid);
    setLedger(Array.isArray(data) ? data : []);
  };

  const handlePayment = async () => {
    if (!amount) return alert(t('customerLedger.enterAmount'));

    await addCustomerPayment(customer.customer_uuid, {
      amount,
      method,
    });

    setAmount(0);
    await load();
    window.dispatchEvent(new CustomEvent('refresh-customers'));
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write("<html><body>");
    printWindow.document.write(
      document.getElementById("print-area")!.innerHTML
    );
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  };

  const sendWhatsApp = () => {
    if (!customer.mobile) {
      return alert(t('customerLedger.noMobileNumber'));
    }

    const msg = `${t('customerLedger.whatsappMessage', { 
      name: customer.name, 
      balance: customer.credit_balance || 0 
    })}

- ${t('customerLedger.storeName')}
  `;

    const url = `https://wa.me/${customer.mobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[720px] max-h-[85vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
          <div className="text-left">
            <h2 className="text-xl font-bold text-slate-800">{customer.name}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {t('customerLedger.creditLabel')}: <span className="font-semibold text-slate-700">₹{customer.credit_balance || 0}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Payment Controls */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">{t('customerLedger.payButton')}</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  {t('customerLedger.amountPlaceholder')}
                </label>
                <Input
                  type="number"
                  placeholder={t('customerLedger.amountPlaceholder')}
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="h-10 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="w-[140px]">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Method
                </label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-10 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-xl">
                    <SelectItem value="cash">{t('customerLedger.methodCash')}</SelectItem>
                    <SelectItem value="upi">{t('customerLedger.methodUPI')}</SelectItem>
                    <SelectItem value="card">{t('customerLedger.methodCard')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handlePayment} className="bg-green-600 hover:bg-green-700 text-white gap-1.5 rounded-full h-10 px-5">
                <IndianRupee className="text-lg" />
                {t('customerLedger.payButton')}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint} className="gap-1.5 rounded-full border-slate-300 text-slate-700 hover:bg-slate-100">
                <HugeiconsIcon icon={PrinterIcon} className="text-lg"  />
                {t('customerLedger.printButton')}
              </Button>
              <Button variant="outline" onClick={sendWhatsApp} className="gap-1.5 rounded-full text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                <HugeiconsIcon icon={WhatsappIcon} className="text-lg"  />
                {t('customerLedger.whatsappButton')}
              </Button>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>{t('customerLedger.tableType')}</span>
              <span>{t('customerLedger.tableAmount')}</span>
              <span>{t('customerLedger.tableNote')}</span>
              <span>{t('customerLedger.tableDate')}</span>
            </div>
            <div className="max-h-[320px]">
              {ledger.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  {t('customerLedger.noEntries')}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {ledger.map((l) => (
                    <div
                      key={l.id}
                      className="grid grid-cols-4 gap-2 px-5 py-3 text-sm hover:bg-slate-50/80 transition-colors"
                    >
                      <span>
                        <Badge
                          variant="secondary"
                          className={l.type === 'credit'
                            ? "bg-emerald-100 text-emerald-700 border-0 text-xs rounded-full"
                            : "bg-red-100 text-red-700 border-0 text-xs rounded-full"
                          }
                        >
                          {l.type === 'credit' ? t('customerLedger.creditType') : t('customerLedger.debitType')}
                        </Badge>
                      </span>
                      <span className={`font-medium ${l.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                        ₹{l.amount}
                      </span>
                      <span className="text-slate-500 truncate">{l.note || '-'}</span>
                      <span className="text-slate-400 text-xs">
                        {new Date(l.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Print Area (hidden) */}
          <div id="print-area" className="hidden">
            <CustomerStatement customer={customer} ledger={ledger} />
          </div>
        </div>
      </div>
    </div>
  );
}
