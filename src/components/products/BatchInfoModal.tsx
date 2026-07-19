import { createPortal } from "react-dom";
import { format } from "date-fns";

export default function BatchInfoModal({
  batches,
  onClose,
}: {
  batches: any[];
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Product Batches</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left pb-2 text-xs font-medium text-gray-500">Batch No</th>
                <th className="text-center pb-2 text-xs font-medium text-gray-500">Qty</th>
                <th className="text-center pb-2 text-xs font-medium text-gray-500">Sold</th>
                <th className="text-right pb-2 text-xs font-medium text-gray-500">Mfg</th>
                <th className="text-right pb-2 text-xs font-medium text-gray-500">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 pr-4 text-gray-800 font-medium">{b.batch_number || "-"}</td>
                  <td className="py-2.5 text-center text-gray-700">{b.quantity || 0}</td>
                  <td className="py-2.5 text-center text-gray-400">{b.sold_quantity || 0}</td>
                  <td className="py-2.5 text-right text-gray-500">{b.manufacture_date ? format(new Date(b.manufacture_date + "T00:00:00"), "dd MMM yyyy") : "-"}</td>
                  <td className="py-2.5 text-right text-gray-500">{b.expiry_date ? format(new Date(b.expiry_date + "T00:00:00"), "dd MMM yyyy") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}
