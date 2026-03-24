import React, { useState } from 'react';
import { Upload, Download, Edit2, Trash2, CheckSquare, X, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { itemSuppliersAPI } from '../lib/supplierAPI';
import { Contact, InventoryItem } from '../types';
import { useToast } from './ToastNotification';

interface BulkSupplierOperationsProps {
  items: InventoryItem[];
  suppliers: Contact[];
  onComplete?: () => void;
}

interface BulkOperation {
  itemId: string;
  itemName: string;
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  unitPriceExclGst: number;
  unitPriceInclGst: number;
  leadTimeDays: number;
  isPreferred: boolean;
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

export const BulkSupplierOperations: React.FC<BulkSupplierOperationsProps> = ({
  items,
  suppliers,
  onComplete
}) => {
  const toast = useToast();
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // CSV Import
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        const headers = lines[0].toLowerCase().split(',');

        const importedOps: BulkOperation[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          const row: any = {};
          headers.forEach((header, index) => {
            row[header.trim()] = values[index]?.trim();
          });

          // Find item
          const item = items.find(
            it => it.name.toLowerCase() === row.itemname?.toLowerCase() || it.id === row.itemid
          );

          // Find supplier
          const supplier = suppliers.find(
            s => s.name.toLowerCase() === row.suppliername?.toLowerCase() || s.id === row.supplierid
          );

          if (item && supplier) {
            importedOps.push({
              itemId: item.id,
              itemName: item.name,
              supplierId: supplier.id,
              supplierName: supplier.name,
              supplierCode: row.suppliercode || '',
              unitPriceExclGst: parseFloat(row.unitpriceexclgst || '0'),
              unitPriceInclGst: parseFloat(row.unitpriceinclgst || '0'),
              leadTimeDays: parseInt(row.leadtimedays || '7'),
              isPreferred: row.ispreferred?.toLowerCase() === 'true',
              status: 'pending'
            });
          }
        }

        setOperations(importedOps);
        setShowPreview(true);
      } catch (error) {
        console.error('CSV parse error:', error);
        toast.error('Failed to parse CSV file. Please check the format.');
      }
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // CSV Export Template
  const handleExportTemplate = () => {
    const headers = [
      'ItemName',
      'ItemID',
      'SupplierName',
      'SupplierID',
      'SupplierCode',
      'UnitPriceExclGST',
      'UnitPriceInclGST',
      'LeadTimeDays',
      'IsPreferred'
    ];

    const sampleRow = [
      'Sample Item Name',
      'item-uuid',
      'Sample Supplier',
      'supplier-uuid',
      'SUP-001',
      '25.00',
      '27.50',
      '7',
      'false'
    ];

    const csv = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplier_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Process Bulk Operations
  const handleProcessOperations = async () => {
    setProcessing(true);

    const updatedOps = [...operations];

    for (let i = 0; i < updatedOps.length; i++) {
      try {
        await itemSuppliersAPI.create({
          itemId: updatedOps[i].itemId,
          supplierId: updatedOps[i].supplierId,
          supplierCode: updatedOps[i].supplierCode,
          unitPriceExclGst: updatedOps[i].unitPriceExclGst,
          unitPriceInclGst: updatedOps[i].unitPriceInclGst,
          leadTimeDays: updatedOps[i].leadTimeDays,
          isPreferred: updatedOps[i].isPreferred
        });

        updatedOps[i].status = 'success';
      } catch (error: any) {
        updatedOps[i].status = 'error';
        updatedOps[i].error = error.response?.data?.error || 'Failed to create';
      }

      setOperations([...updatedOps]);
    }

    setProcessing(false);

    // Check if all successful
    if (updatedOps.every(op => op.status === 'success')) {
      setTimeout(() => {
        setShowPreview(false);
        setOperations([]);
        if (onComplete) onComplete();
      }, 2000);
    }
  };

  const handleRemoveOperation = (index: number) => {
    setOperations(ops => ops.filter((_, i) => i !== index));
  };

  const stats = {
    total: operations.length,
    success: operations.filter(op => op.status === 'success').length,
    error: operations.filter(op => op.status === 'error').length,
    pending: operations.filter(op => op.status === 'pending').length
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Import CSV
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            className="hidden"
          />
        </label>

        <button
          onClick={handleExportTemplate}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download Template
        </button>

        <div className="flex-1" />

        {operations.length > 0 && (
          <span className="text-sm text-gray-600">
            {stats.total} operations loaded
          </span>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Bulk Supplier Operations</h2>
                <p className="text-sm text-gray-600 mt-1">Review and process supplier assignments</p>
              </div>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setOperations([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Stats */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-sm text-gray-600">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
                  <p className="text-sm text-gray-600">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.success}</p>
                  <p className="text-sm text-gray-600">Success</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{stats.error}</p>
                  <p className="text-sm text-gray-600">Errors</p>
                </div>
              </div>
            </div>

            {/* Operations List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {operations.map((op, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      op.status === 'success'
                        ? 'border-green-200 bg-green-50'
                        : op.status === 'error'
                        ? 'border-red-200 bg-red-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {op.status === 'success' ? (
                          <CheckSquare className="w-5 h-5 text-green-600" />
                        ) : op.status === 'error' ? (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        ) : (
                          <FileSpreadsheet className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{op.itemName}</p>
                            <p className="text-sm text-gray-600">→ {op.supplierName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              ${op.unitPriceExclGst.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">Excl GST</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                          <div>
                            <span className="text-gray-500">Code: </span>
                            <span className="text-gray-900">{op.supplierCode}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Lead Time: </span>
                            <span className="text-gray-900">{op.leadTimeDays} days</span>
                          </div>
                          <div>
                            {op.isPreferred && (
                              <span className="inline-flex items-center gap-1 text-blue-600">
                                <CheckSquare className="w-3 h-3" />
                                Preferred
                              </span>
                            )}
                          </div>
                        </div>

                        {op.error && (
                          <p className="text-sm text-red-600 mt-2">{op.error}</p>
                        )}
                      </div>

                      {/* Remove Button */}
                      {op.status === 'pending' && !processing && (
                        <button
                          onClick={() => handleRemoveOperation(index)}
                          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setOperations([]);
                }}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessOperations}
                disabled={processing || stats.pending === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    Process {stats.pending} Operations
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Bulk Import Instructions</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Download the CSV template using the "Download Template" button</li>
          <li>Fill in the spreadsheet with your supplier data</li>
          <li>Save the file and import it using the "Import CSV" button</li>
          <li>Review the operations and click "Process" to create all supplier relationships</li>
        </ol>
      </div>
    </div>
  );
};
