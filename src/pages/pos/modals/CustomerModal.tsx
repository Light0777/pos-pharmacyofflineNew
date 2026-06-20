import { useState } from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  UserAdd01Icon,
  CallIcon,
  SaveIcon,
  MapPinIcon,
  File01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";

interface CustomerModalProps {
  initialMobile?: string;
  onClose: () => void;
  onCreateCustomer: (data: {
    name: string;
    mobile: string;
    address?: string;
    gstin?: string;
    credit_limit?: number;
  }) => Promise<void>;
}

export default function CustomerModal({ initialMobile, onClose, onCreateCustomer }: CustomerModalProps) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState(initialMobile?.replace(/\D/g, '').slice(0, 10) ?? "");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Customer name is required";
    if (!mobile.trim()) newErrors.mobile = "Mobile number is required";
    else if (mobile.replace(/\D/g, '').length !== 10)
      newErrors.mobile = "Enter a valid 10-digit mobile number";
    if (gstin.trim() && !/^[0-9A-Z]{15}$/.test(gstin.trim().toUpperCase()))
      newErrors.gstin = "GSTIN must be exactly 15 alphanumeric characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onCreateCustomer({
        name: name.trim(),
        mobile: mobile.trim(),
        address: address.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        credit_limit: creditLimit || undefined,
      });
      onClose();
    } catch {
      // handled upstream
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        className="bg-[#1a1a1a] rounded-2xl w-full max-w-lg shadow-2xl border border-gray-700 animate-fadeIn"
      >
        {/* Header */}
        <div className="border-b border-gray-700/80 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <HugeiconsIcon icon={UserAdd01Icon} className="text-blue-400 text-2xl"  />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add New Customer</h2>
              <p className="text-xs text-gray-500 mt-0.5">Enter customer details below</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-xl transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="text-gray-400 text-xl"  />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Customer Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <HugeiconsIcon icon={UserAdd01Icon} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none"  />
              <input
                type="text"
                placeholder="Enter customer name"
                className={`w-full bg-[#212121] border ${errors.name ? 'border-red-500' : 'border-gray-600'} rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all`}
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                autoFocus
              />
            </div>
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Mobile */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Mobile Number <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <HugeiconsIcon icon={CallIcon} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none"  />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Enter 10-digit mobile number"
                className={`w-full bg-[#212121] border ${errors.mobile ? 'border-red-500' : 'border-gray-600'} rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all`}
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setErrors((p) => ({ ...p, mobile: "" }));
                }}
              />
            </div>
            {errors.mobile && <p className="text-red-400 text-xs mt-1">{errors.mobile}</p>}
            <p className="text-xs text-gray-500 mt-1">
              Used for customer identification and payment reminders
            </p>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Address</label>
            <div className="relative">
              <HugeiconsIcon icon={MapPinIcon} className="absolute left-3.5 top-3 text-gray-500 text-lg pointer-events-none"  />
              <textarea
                rows={2}
                placeholder="Enter customer address (optional)"
                className="w-full bg-[#212121] border border-gray-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          {/* GSTIN */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">GSTIN</label>
            <div className="relative">
              <HugeiconsIcon icon={File01Icon} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none"  />
              <input
                type="text"
                placeholder="Enter GSTIN (optional)"
                className={`w-full bg-[#212121] border ${errors.gstin ? 'border-red-500' : 'border-gray-600'} rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all uppercase`}
                value={gstin}
                onChange={(e) => {
                  setGstin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15));
                  setErrors((p) => ({ ...p, gstin: "" }));
                }}
                maxLength={15}
              />
            </div>
            {errors.gstin && <p className="text-red-400 text-xs mt-1">{errors.gstin}</p>}
          </div>

          {/* Credit Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Credit Limit</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">₹</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                className="w-full bg-[#212121] border border-gray-600 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                value={creditLimit || ""}
                onChange={(e) => setCreditLimit(e.target.value === "" ? 0 : Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum credit amount allowed (0 for no limit)
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="mx-6 mb-4 p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl">
          <div className="flex items-start gap-2">
            <HugeiconsIcon icon={InformationCircleIcon} className="text-blue-400 text-lg mt-0.5 shrink-0"  />
            <div>
              <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Note</span>
              <p className="text-gray-500 text-xs mt-0.5">
                Fields marked with <span className="text-red-400">*</span> are required. Other details can be updated later from the Customers page.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700/80 px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            className="flex-1 px-4 py-2.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <HugeiconsIcon icon={SaveIcon} className="text-lg"  />
                <span>Create Customer</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}