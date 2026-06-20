import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CloudUploadIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  File01Icon,
} from "@hugeicons/core-free-icons";
import { previewMigration, confirmMigration } from "../renderer/services/productApi";

// For XLSX parsing — install: npm install xlsx
import * as XLSX from 'xlsx';

type Step = 'upload' | 'preview' | 'done';

export default function ImportProductsModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [onDuplicate, setOnDuplicate] = useState<'skip' | 'overwrite'>('skip');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    setFileName(file.name);

    try {
      let fileContent = '';
      let fileType = '';
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'xml') {
        fileContent = await file.text();
        fileType = 'tally-xml';
      } else if (ext === 'csv') {
        fileContent = await file.text();
        fileType = 'vyapar-csv';
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
        fileContent = JSON.stringify(rows);
        fileType = 'vyapar-xlsx';
      } else {
        throw new Error(t('importProducts.unsupportedFile'));
      }

      const result = await previewMigration(fileContent, fileType);
      if (!result || result.error || result.length === 0) {
        throw new Error(result?.error || t('importProducts.noProducts'));
      }
      setPreviewData(result);
      setStep('preview');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await confirmMigration(previewData, onDuplicate);
      if (result && !result.success) {
        throw new Error(result.error || 'Migration failed');
      }
      setResult(result);
      setStep('done');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to truncate file name
  const displayFileName = fileName.length > 40 ? fileName.slice(0, 37) + '...' : fileName;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-xl lg:max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 text-white rounded-t-2xl flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">{t('importProducts.title')}</h2>
            <p className="text-gray-300 text-sm mt-0.5">
              {step === 'upload' && t('importProducts.uploadStepDesc')}
              {step === 'preview' && t('importProducts.previewStepDesc', { count: previewData.length })}
              {step === 'done' && t('importProducts.doneStepDesc')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
            <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6 text-start">
              {/* Instructions */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
                  <p className="font-semibold text-blue-800 mb-2">{t('importProducts.tallyTitle')}</p>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li dangerouslySetInnerHTML={{ __html: t('importProducts.tallyStep1') }} />
                    <li dangerouslySetInnerHTML={{ __html: t('importProducts.tallyStep2') }} />
                    <li dangerouslySetInnerHTML={{ __html: t('importProducts.tallyStep3') }} />
                    <li dangerouslySetInnerHTML={{ __html: t('importProducts.tallyStep4') }} />
                    <li>{t('importProducts.tallyStep5')}</li>
                  </ol>
                </div>
                <div className="border border-green-200 bg-green-50 rounded-xl p-4">
                  <p className="font-semibold text-green-800 mb-2">{t('importProducts.vyaparTitle')}</p>
                  <ol className="text-sm text-green-700 space-y-1 list-decimal list-inside">
                    <li>{t('importProducts.vyaparStep1')}</li>
                    <li>{t('importProducts.vyaparStep2')}</li>
                    <li>{t('importProducts.vyaparStep3')}</li>
                    <li>{t('importProducts.vyaparStep4')}</li>
                    <li>{t('importProducts.vyaparStep5')}</li>
                  </ol>
                </div>
              </div>

              {/* Drop Zone */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <HugeiconsIcon icon={CloudUploadIcon} className="text-5xl text-gray-400 mb-3"  />
                <p className="font-semibold text-gray-600">{t('importProducts.dropZoneText')}</p>
                <p className="text-sm text-gray-400 mt-1">{t('importProducts.supportedFormats')}</p>
                <input ref={fileRef} type="file" accept=".xml,.csv,.xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span>{t('importProducts.parsing')}</span>
                </div>
              )}
              {error && <p className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">{error}</p>}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Duplicate handling */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="font-semibold text-yellow-800 mb-2">{t('importProducts.duplicateTitle')}</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="dup" value="skip" checked={onDuplicate === 'skip'} onChange={() => setOnDuplicate('skip')} />
                    <span className="text-sm text-yellow-700"><strong>{t('importProducts.skipLabel')}</strong> — {t('importProducts.skipDesc')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="dup" value="overwrite" checked={onDuplicate === 'overwrite'} onChange={() => setOnDuplicate('overwrite')} />
                    <span className="text-sm text-yellow-700"><strong>{t('importProducts.overwriteLabel')}</strong> — {t('importProducts.overwriteDesc')}</span>
                  </label>
                </div>
              </div>

              {/* Preview table */}
              <div className="border border-gray-200 rounded-xl overflow-x-auto overflow-y-hidden">
                <table className="w-full text-sm" style={{ minWidth: 600 }}>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-600">{t('importProducts.tableName')}</th>
                      <th className="text-right p-3 font-semibold text-gray-600">{t('importProducts.tablePrice')}</th>
                      <th className="text-right p-3 font-semibold text-gray-600">{t('importProducts.tableStock')}</th>
                      <th className="text-center p-3 font-semibold text-gray-600">{t('importProducts.tableGst')}</th>
                      <th className="text-left p-3 font-semibold text-gray-600">{t('importProducts.tableSku')}</th>
                      <th className="text-left p-3 font-semibold text-gray-600">{t('importProducts.tableHsn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 50).map((p, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{p.name}</td>
                        <td className="p-3 text-right text-green-600 font-semibold">₹{p.price?.toLocaleString()}</td>
                        <td className="p-3 text-right text-gray-600">{p.stock}</td>
                        <td className="p-3 text-center text-gray-500">{p.gst_percent}%</td>
                        <td className="p-3 text-gray-400 font-mono text-xs">{p.sku || '—'}</td>
                        <td className="p-3 text-gray-400 font-mono text-xs">{p.hsn_code || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 50 && (
                  <p className="text-center text-sm text-gray-400 py-3 border-t">
                    {t('importProducts.moreProducts', { count: previewData.length - 50 })}
                  </p>
                )}
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
            </div>
          )}

          {/* Step 3: Done */}
          {step === 'done' && result && (
            <div className="text-center py-8 space-y-4">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-6xl text-green-500"  />
              <h3 className="text-2xl font-bold text-gray-800">{t('importProducts.successTitle')}</h3>
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-3xl font-bold text-green-600">{result.inserted}</p>
                  <p className="text-sm text-green-700">{t('importProducts.importedCount')}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-3xl font-bold text-orange-600">{result.skipped}</p>
                  <p className="text-sm text-orange-700">{t('importProducts.skippedCount')}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-3xl font-bold text-blue-600">{result.overwritten}</p>
                  <p className="text-sm text-blue-700">{t('importProducts.updatedCount')}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          {step === 'upload' && (
            <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">
              {t('common.cancel')}
            </button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('upload')} className="px-6 py-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">
                ← {t('common.back')}
              </button>
              <button onClick={handleConfirm} disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2">
                {loading ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> {t('importProducts.importing')}</>
                ) : (
                  t('importProducts.importButton', { count: previewData.length })
                )}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={() => { onImported(); onClose(); }}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold">
              {t('common.done')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}