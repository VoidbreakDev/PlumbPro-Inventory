/**
 * Invoices Management View
 * Business-side invoice creation, management, and sending
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  Send,
  MoreVertical,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  FileText,
  X,
  Trash2,
  Edit,
  CreditCard,
  Loader2,
  ChevronDown,
  Calendar,
  Mail
} from 'lucide-react';
import { invoicesAPI, type Invoice, type InvoiceStats, type CreateInvoiceRequest } from '../lib/invoicesAPI';
import { contactsAPI, jobsAPI } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { useStore } from '../store/useStore';
import type { Job as AppJob } from '../types';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface Contact {
  id: string;
  name: string;
  email: string;
  type: string;
}

interface Job {
  id: string;
  title: string;
  builder?: string;
}

function getAppCurrency(): string {
  try {
    const raw = localStorage.getItem('plumbpro-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.appearance?.currency ?? 'AUD';
    }
  } catch { /* ignore */ }
  return 'AUD';
}

export default function InvoicesView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const appCurrency = getAppCurrency();

  const setGlobalError = useStore((state) => state.setError);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invoicesData, statsData] = await Promise.all([
        invoicesAPI.getInvoices(statusFilter ? { status: statusFilter } : undefined),
        invoicesAPI.getStats()
      ]);
      setInvoices(invoicesData);
      setStats(statsData);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load invoices'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (data: CreateInvoiceRequest) => {
    try {
      await invoicesAPI.createInvoice(data);
      await loadData();
      setShowCreateModal(false);
    } catch (err) {
      setGlobalError(getErrorMessage(err, 'Failed to create invoice'));
    }
  };

  const handleSendInvoice = async (id: string) => {
    try {
      await invoicesAPI.sendInvoice(id);
      await loadData();
    } catch (err) {
      setGlobalError(getErrorMessage(err, 'Failed to send invoice'));
    }
  };

  const handleDeleteInvoice = (id: string) => {
    setConfirmModal({
      title: 'Delete Invoice',
      description: 'Are you sure you want to delete this draft invoice?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await invoicesAPI.deleteInvoice(id);
          await loadData();
        } catch (err) {
          setGlobalError(getErrorMessage(err, 'Failed to delete invoice'));
        }
      }
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: appCurrency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'draft': 'bg-gray-100 text-gray-800',
      'sent': 'bg-blue-100 text-blue-800',
      'paid': 'bg-green-100 text-green-800',
      'partial': 'bg-yellow-100 text-yellow-800',
      'overdue': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-500'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">Manage and send invoices to customers</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Create Invoice
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Outstanding</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.outstanding_count}</p>
            <p className="text-sm text-gray-500">{formatCurrency(stats.due_amount)} due</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm text-gray-600">Overdue</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.overdue_count}</p>
            <p className="text-sm text-red-600">Action required</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">Paid (30d)</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.paid_count}</p>
            <p className="text-sm text-green-600">{formatCurrency(stats.collected_30d)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">Total Outstanding</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.outstanding_amount)}</p>
            <p className="text-sm text-gray-500">Across all invoices</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Invoice #</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Customer</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Due Date</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Status</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setSelectedInvoice(invoice)}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {invoice.invoice_number}
                    </button>
                  </td>
                  <td className="py-3 px-4">{invoice.customer_name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{formatDate(invoice.issue_date)}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{formatDate(invoice.due_date)}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(invoice.total_amount)}</td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(invoice.status)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {invoice.status === 'draft' && (
                        <button
                          onClick={() => handleSendInvoice(invoice.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Send Invoice"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {invoice.status === 'draft' && (
                        <button
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="View"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <CreateInvoiceModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateInvoice}
        />
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}

interface CreateInvoiceModalProps {
  onClose: () => void;
  onCreate: (data: CreateInvoiceRequest) => void;
}

function CreateInvoiceModal({ onClose, onCreate }: CreateInvoiceModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateInvoiceRequest>({
    contact_id: '',
    job_id: '',
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 10 }],
    notes: '',
    terms: 'Payment due within 30 days'
  });

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (formData.contact_id) {
      loadJobs(formData.contact_id);
    }
  }, [formData.contact_id]);

  const loadContacts = async () => {
    try {
      const data = await contactsAPI.getContacts();
      setContacts(data.filter((c: Contact) => c.type === 'Customer'));
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  const loadJobs = async (contactId: string) => {
    try {
      const data = await jobsAPI.getJobs();
      setJobs(data.filter((j: AppJob) => j.builder === contactId));
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unit_price: 0, tax_rate: 10 }]
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;
    
    formData.items.forEach(item => {
      const lineTotal = item.quantity * item.unit_price;
      const lineTax = lineTotal * (item.tax_rate || 0) / 100;
      subtotal += lineTotal;
      taxAmount += lineTax;
    });
    
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    onCreate(formData);
    setLoading(false);
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Create Invoice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer & Job */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer *
              </label>
              <select
                value={formData.contact_id}
                onChange={(e) => setFormData({ ...formData, contact_id: e.target.value, job_id: '' })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Customer</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Related Job (Optional)
              </label>
              <select
                value={formData.job_id}
                onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={!formData.contact_id}
              >
                <option value="">Select Job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date *
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Invoice Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Invoice Items *
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add Item
              </button>
            </div>
            
            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                      placeholder="Qty"
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                      placeholder="Price"
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      value={item.tax_rate}
                      onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value))}
                      placeholder="Tax %"
                      min="0"
                      max="100"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    disabled={formData.items.length === 1}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Tax:</span>
              <span className="font-medium">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold border-t pt-2">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes for the customer..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Terms & Conditions
              </label>
              <textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Payment terms..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Invoice'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface InvoiceDetailModalProps {
  invoice: Invoice;
  onClose: () => void;
  onUpdate: () => void;
}

function InvoiceDetailModal({ invoice, onClose, onUpdate }: InvoiceDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: invoice.total_amount - invoice.amount_paid,
    payment_method: 'credit_card' as const,
    reference: '',
    notes: ''
  });
  const detailCurrency = getAppCurrency();

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await invoicesAPI.recordPayment(invoice.id, paymentData);
      onUpdate();
      setShowPaymentForm(false);
    } catch (err) {
      console.error('Payment error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: detailCurrency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{invoice.invoice_number}</h2>
            <p className="text-sm text-gray-500">Created: {formatDate(invoice.created_at)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Customer</h3>
              <p className="font-medium text-gray-900">{invoice.customer_name}</p>
              <p className="text-sm text-gray-600">{invoice.customer_email}</p>
              {invoice.customer_phone && (
                <p className="text-sm text-gray-600">{invoice.customer_phone}</p>
              )}
            </div>
            <div className="text-right">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Invoice Items */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Invoice Items</h3>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Description</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-600">Qty</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Price</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item, idx) => (
                  <tr key={item.id || `item-${idx}`} className="border-b">
                    <td className="py-3 px-3">{item.description}</td>
                    <td className="py-3 px-3 text-center">{item.quantity}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right font-medium">Subtotal:</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(invoice.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right font-medium">Tax:</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(invoice.tax_amount)}</td>
                </tr>
                <tr className="font-semibold text-lg">
                  <td colSpan={3} className="py-3 px-3 text-right">Total:</td>
                  <td className="py-3 px-3 text-right">{formatCurrency(invoice.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Payment History</h3>
              <div className="space-y-2">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                      <p className="text-sm text-gray-600">{payment.payment_method}</p>
                      {payment.reference && (
                        <p className="text-xs text-gray-500">Ref: {payment.reference}</p>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{formatDate(payment.payment_date)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <div className="border-t pt-6">
              {!showPaymentForm ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPaymentForm(true)}
                    className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-5 h-5" />
                    Record Payment
                  </button>
                  {invoice.status === 'draft' && (
                    <button
                      onClick={() => {/* Send invoice */}}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Mail className="w-5 h-5" />
                      Send to Customer
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleRecordPayment} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <input
                        type="number"
                        value={paymentData.amount}
                        onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) })}
                        step="0.01"
                        min="0.01"
                        max={invoice.total_amount - invoice.amount_paid}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                      <select
                        value={paymentData.payment_method}
                        onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value as any })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="credit_card">Credit Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="stripe">Stripe</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                    <input
                      type="text"
                      value={paymentData.reference}
                      onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Transaction ID, check number, etc."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Record Payment'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPaymentForm(false)}
                      className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModal !== null}
        title={confirmModal?.title ?? ''}
        description={confirmModal?.description ?? ''}
        confirmLabel="Confirm"
        variant="danger"
        onConfirm={() => confirmModal?.onConfirm()}
        onClose={() => setConfirmModal(null)}
      />
    </div>
  );
}
