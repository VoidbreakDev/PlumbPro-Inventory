/**
 * Invoices View
 * Manage invoices with payment tracking and customer billing
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Eye,
  Edit,
  Trash2,
  Filter,
  Copy,
  Search,
  Users,
  Briefcase,
  AlertTriangle,
  CreditCard,
  Calendar,
  Ban,
  Bell
} from 'lucide-react';
import { invoicesAPI } from '../lib/api';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import type {
  Invoice,
  InvoiceItem,
  InvoiceStats,
  InvoicePayment,
  Contact,
  InventoryItem,
  Job,
  CreateInvoiceInput,
  CreateInvoiceItemInput,
  InvoiceStatus,
  PaymentTerms,
  PaymentMethod,
  RecordPaymentInput
} from '../types';

// Invoice Line Item Interface for form state
interface InvoiceLineItem {
  id: string;
  itemType: 'material' | 'labor' | 'other' | 'subcontractor';
  inventoryItemId?: string;
  itemName: string;
  itemDescription?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  isTaxable: boolean;
  groupName?: string;
}

// Create/Edit Invoice Modal Component
interface CreateInvoiceModalProps {
  onClose: () => void;
  onSave: () => void;
  editingInvoice: Invoice | null;
  contacts: Contact[];
  inventory: InventoryItem[];
  jobs: Job[];
  setError: (error: string | null) => void;
}

function CreateInvoiceModal({ onClose, onSave, editingInvoice, contacts, inventory, jobs, setError }: CreateInvoiceModalProps) {
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerAbn, setCustomerAbn] = useState<string>('');
  const [jobId, setJobId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('NET30');
  const [customTermsDays, setCustomTermsDays] = useState<number>(30);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(10);
  const [terms, setTerms] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [paymentInstructions, setPaymentInstructions] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [bankAccountName, setBankAccountName] = useState<string>('');
  const [bankBsb, setBankBsb] = useState<string>('');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [items, setItems] = useState<InvoiceLineItem[]>([
    { id: crypto.randomUUID(), itemType: 'material', itemName: '', quantity: 1, unit: 'EA', unitPrice: 0, lineTotal: 0, isTaxable: true }
  ]);
  const [saving, setSaving] = useState(false);
  const [sendImmediately, setSendImmediately] = useState(false);

  // Load editing data
  useEffect(() => {
    if (editingInvoice) {
      setCustomerId(editingInvoice.customerId || '');
      setCustomerName(editingInvoice.customerName || '');
      setCustomerEmail(editingInvoice.customerEmail || '');
      setCustomerPhone(editingInvoice.customerPhone || '');
      setCustomerAddress(editingInvoice.customerAddress || '');
      setCustomerAbn(editingInvoice.customerAbn || '');
      setJobId(editingInvoice.jobId || '');
      setTitle(editingInvoice.title || '');
      setDescription(editingInvoice.description || '');
      setInvoiceDate(editingInvoice.invoiceDate?.split('T')[0] || new Date().toISOString().split('T')[0]);
      setPaymentTerms(editingInvoice.paymentTerms || 'NET30');
      setCustomTermsDays(editingInvoice.customTermsDays || 30);
      setDiscountType(editingInvoice.discountType || 'fixed');
      setDiscountValue(editingInvoice.discountValue || 0);
      setTaxRate(editingInvoice.taxRate || 10);
      setTerms(editingInvoice.terms || '');
      setNotes(editingInvoice.notes || '');
      setCustomerNotes(editingInvoice.customerNotes || '');
      setPaymentInstructions(editingInvoice.paymentInstructions || '');
      setBankName(editingInvoice.bankName || '');
      setBankAccountName(editingInvoice.bankAccountName || '');
      setBankBsb(editingInvoice.bankBsb || '');
      setBankAccountNumber(editingInvoice.bankAccountNumber || '');

      if (editingInvoice.items && editingInvoice.items.length > 0) {
        setItems(editingInvoice.items.map(item => ({
          id: item.id,
          itemType: item.itemType,
          inventoryItemId: item.inventoryItemId,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          isTaxable: item.isTaxable,
          groupName: item.groupName
        })));
      }
    }
  }, [editingInvoice]);

  // Auto-fill customer details when selecting from contacts
  useEffect(() => {
    if (customerId) {
      const contact = contacts.find(c => c.id === customerId);
      if (contact) {
        setCustomerName(contact.name);
        setCustomerEmail(contact.email || '');
        setCustomerPhone(contact.phone || '');
      }
    }
  }, [customerId, contacts]);

  // Auto-fill job info
  useEffect(() => {
    if (jobId) {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        if (!title) setTitle(`Invoice for ${job.title}`);
        if (job.builder && !customerName) setCustomerName(job.builder);
      }
    }
  }, [jobId, jobs]);

  // Calculate due date based on payment terms
  const calculateDueDate = () => {
    const date = new Date(invoiceDate);
    switch (paymentTerms) {
      case 'DUE_ON_RECEIPT': return invoiceDate;
      case 'NET7': date.setDate(date.getDate() + 7); break;
      case 'NET14': date.setDate(date.getDate() + 14); break;
      case 'NET30': date.setDate(date.getDate() + 30); break;
      case 'NET60': date.setDate(date.getDate() + 60); break;
      case 'CUSTOM': date.setDate(date.getDate() + customTermsDays); break;
    }
    return date.toISOString().split('T')[0];
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        itemType: 'material',
        itemName: '',
        quantity: 1,
        unit: 'EA',
        unitPrice: 0,
        lineTotal: 0,
        isTaxable: true
      }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceLineItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };

        // If inventory item selected, auto-fill details
        if (field === 'inventoryItemId' && value) {
          const inventoryItem = inventory.find(i => i.id === value);
          if (inventoryItem) {
            updated.itemName = inventoryItem.name;
            updated.unitPrice = inventoryItem.sellPriceExclGST || inventoryItem.price || 0;
          }
        }

        // Recalculate line total
        if (field === 'quantity' || field === 'unitPrice') {
          updated.lineTotal = updated.quantity * updated.unitPrice;
        }

        return updated;
      }
      return item;
    }));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.lineTotal, 0);
  };

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    if (discountType === 'percentage') {
      return subtotal * (discountValue / 100);
    }
    return discountValue;
  };

  const calculateTaxableAmount = () => {
    return items.filter(item => item.isTaxable).reduce((sum, item) => sum + item.lineTotal, 0);
  };

  const calculateTax = () => {
    const taxable = calculateTaxableAmount();
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    // Proportionally apply discount to taxable amount
    const adjustedTaxable = subtotal > 0 ? taxable - (discount * (taxable / subtotal)) : 0;
    return adjustedTaxable * (taxRate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount() + calculateTax();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate
      if (!customerName.trim()) {
        setError('Customer name is required');
        setSaving(false);
        return;
      }

      if (!title.trim()) {
        setError('Invoice title is required');
        setSaving(false);
        return;
      }

      if (items.length === 0 || items.some(item => !item.itemName.trim())) {
        setError('Please add at least one valid item');
        setSaving(false);
        return;
      }

      const invoiceData: CreateInvoiceInput = {
        customerId: customerId || undefined,
        customerName,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        customerAddress: customerAddress || undefined,
        customerAbn: customerAbn || undefined,
        jobId: jobId || undefined,
        title,
        description: description || undefined,
        invoiceDate,
        paymentTerms,
        customTermsDays: paymentTerms === 'CUSTOM' ? customTermsDays : undefined,
        discountType,
        discountValue,
        taxRate,
        terms: terms || undefined,
        notes: notes || undefined,
        customerNotes: customerNotes || undefined,
        paymentInstructions: paymentInstructions || undefined,
        bankName: bankName || undefined,
        bankAccountName: bankAccountName || undefined,
        bankBsb: bankBsb || undefined,
        bankAccountNumber: bankAccountNumber || undefined,
        items: items.map((item, index) => ({
          itemType: item.itemType,
          inventoryItemId: item.inventoryItemId,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          isTaxable: item.isTaxable,
          sortOrder: index,
          groupName: item.groupName
        }))
      };

      if (editingInvoice) {
        await invoicesAPI.update(editingInvoice.id, invoiceData);
      } else {
        const newInvoice = await invoicesAPI.create(invoiceData);

        if (sendImmediately) {
          await invoicesAPI.send(newInvoice.id);
        }
      }

      onSave();
    } catch (error) {
      setError(getErrorMessage(error, editingInvoice ? 'Failed to update invoice' : 'Failed to create invoice'));
      setSaving(false);
    }
  };

  const customerContacts = contacts.filter(c => c.type === 'Customer');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingInvoice ? `Edit Invoice ${editingInvoice.invoiceNumber}` : 'Create Invoice'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Customer Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Customer Information
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Existing Customer
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select or enter new customer</option>
                    {customerContacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} {contact.company ? `(${contact.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ABN
                  </label>
                  <input
                    type="text"
                    value={customerAbn}
                    onChange={(e) => setCustomerAbn(e.target.value)}
                    placeholder="XX XXX XXX XXX"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Invoice Details Section */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g., Bathroom Renovation - Final Invoice"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link to Job (Optional)
                </label>
                <select
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No job linked</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>
                      {job.title} - {job.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description of the work completed..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value as PaymentTerms)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="DUE_ON_RECEIPT">Due on Receipt</option>
                  <option value="NET7">Net 7 Days</option>
                  <option value="NET14">Net 14 Days</option>
                  <option value="NET30">Net 30 Days</option>
                  <option value="NET60">Net 60 Days</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={calculateDueDate()}
                  disabled
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-600"
                />
              </div>

              {paymentTerms === 'CUSTOM' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Days
                  </label>
                  <input
                    type="number"
                    value={customTermsDays}
                    onChange={(e) => setCustomTermsDays(parseInt(e.target.value) || 30)}
                    min="1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {/* Line Items */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-gray-900">Line Items *</h4>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Item #{index + 1}</span>
                        <select
                          value={item.itemType}
                          onChange={(e) => updateItem(item.id, 'itemType', e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="material">Material</option>
                          <option value="labor">Labor</option>
                          <option value="subcontractor">Subcontractor</option>
                          <option value="other">Other</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={item.isTaxable}
                            onChange={(e) => updateItem(item.id, 'isTaxable', e.target.checked)}
                            className="rounded"
                          />
                          Taxable
                        </label>
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {item.itemType === 'material' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Select from Inventory
                        </label>
                        <select
                          value={item.inventoryItemId || ''}
                          onChange={(e) => updateItem(item.id, 'inventoryItemId', e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Manual entry</option>
                          {inventory.map(invItem => (
                            <option key={invItem.id} value={invItem.id}>
                              {invItem.name} - ${(invItem.sellPriceExclGST || invItem.price || 0).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-5 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {item.itemType === 'labor' ? 'Labor Description' : 'Item Name'} *
                        </label>
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) => updateItem(item.id, 'itemName', e.target.value)}
                          required
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {item.itemType === 'labor' ? 'Hours' : 'Qty'} *
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          min="0.01"
                          step="0.01"
                          required
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Unit Price *
                        </label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          required
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Line Total
                        </label>
                        <input
                          type="text"
                          value={`$${item.lineTotal.toFixed(2)}`}
                          disabled
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-gray-100 text-gray-700"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Discount</h4>
                  <div className="flex gap-3">
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percentage')}
                      className="border border-gray-300 rounded px-3 py-2"
                    >
                      <option value="fixed">Fixed Amount ($)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="w-32 border border-gray-300 rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div className="text-right space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal:</span>
                    <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount:</span>
                      <span className="font-medium">-${calculateDiscount().toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>GST ({taxRate}%):</span>
                    <span className="font-medium">${calculateTax().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                    <span>Total:</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Bank Details for Payment (Optional)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g., Commonwealth Bank"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    placeholder="e.g., PlumbPro Services Pty Ltd"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BSB
                  </label>
                  <input
                    type="text"
                    value={bankBsb}
                    onChange={(e) => setBankBsb(e.target.value)}
                    placeholder="XXX-XXX"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Terms and Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Instructions
                </label>
                <textarea
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  rows={2}
                  placeholder="How to pay this invoice..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={2}
                  placeholder="Payment terms, warranty information, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes for Customer
                </label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  rows={2}
                  placeholder="Thank you for your business..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internal Notes (not visible to customer)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal notes for your reference..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Send Immediately Option */}
            {!editingInvoice && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendImmediately"
                  checked={sendImmediately}
                  onChange={(e) => setSendImmediately(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="sendImmediately" className="text-sm text-gray-700">
                  Mark as sent immediately (otherwise save as draft)
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {editingInvoice ? 'Update Invoice' : sendImmediately ? 'Create & Send' : 'Create Invoice'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Record Payment Modal
interface RecordPaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSave: () => void;
  setError: (error: string | null) => void;
}

function RecordPaymentModal({ invoice, onClose, onSave, setError }: RecordPaymentModalProps) {
  const [amount, setAmount] = useState<number>(invoice.amountDue || 0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (amount <= 0) {
        setError('Payment amount must be greater than zero');
        setSaving(false);
        return;
      }

      const paymentData: RecordPaymentInput = {
        amount,
        paymentDate,
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined
      };

      await invoicesAPI.recordPayment(invoice.id, paymentData);
      onSave();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to record payment'));
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Record Payment</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-gray-600">Invoice: {invoice.invoiceNumber}</div>
              <div className="text-sm text-gray-600">Customer: {invoice.customerName}</div>
              <div className="flex justify-between mt-2">
                <span className="text-sm font-medium text-gray-700">Amount Due:</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(invoice.amountDue)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                min="0.01"
                step="0.01"
                max={invoice.amountDue}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="credit_card">Credit Card</option>
                <option value="eftpos">EFTPOS</option>
                <option value="paypal">PayPal</option>
                <option value="stripe">Stripe</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g., Transaction ID"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Invoice Detail Modal
interface InvoiceDetailModalProps {
  invoice: Invoice;
  onClose: () => void;
  onAction: () => void;
  setError: (error: string | null) => void;
}

function InvoiceDetailModal({ invoice, onClose, onAction, setError }: InvoiceDetailModalProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleAction = async (action: 'send' | 'void' | 'duplicate' | 'reminder') => {
    setActionLoading(action);
    try {
      switch (action) {
        case 'send':
          await invoicesAPI.send(invoice.id);
          break;
        case 'void':
          const reason = prompt('Void reason (optional):');
          await invoicesAPI.void(invoice.id, reason || undefined);
          break;
        case 'duplicate':
          await invoicesAPI.duplicate(invoice.id);
          break;
        case 'reminder':
          await invoicesAPI.sendReminder(invoice.id);
          break;
      }
      onAction();
    } catch (error) {
      setError(getErrorMessage(error, `Failed to ${action} invoice`));
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    const badges: Record<InvoiceStatus, { color: string; label: string }> = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      sent: { color: 'bg-blue-100 text-blue-800', label: 'Sent' },
      viewed: { color: 'bg-purple-100 text-purple-800', label: 'Viewed' },
      partially_paid: { color: 'bg-yellow-100 text-yellow-800', label: 'Partially Paid' },
      paid: { color: 'bg-green-100 text-green-800', label: 'Paid' },
      overdue: { color: 'bg-red-100 text-red-800', label: 'Overdue' },
      cancelled: { color: 'bg-gray-100 text-gray-800', label: 'Cancelled' },
      void: { color: 'bg-gray-100 text-gray-800', label: 'Void' }
    };
    const badge = badges[status];
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  const isOverdue = invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'cancelled' &&
    invoice.dueDate && new Date(invoice.dueDate) < new Date();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
                {getStatusBadge(invoice.status)}
                {isOverdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <AlertTriangle className="w-3 h-3" />
                    Overdue
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">{invoice.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Customer</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <span className="ml-2 text-gray-900">{invoice.customerName}</span>
              </div>
              {invoice.customerEmail && (
                <div>
                  <span className="text-gray-500">Email:</span>
                  <span className="ml-2 text-gray-900">{invoice.customerEmail}</span>
                </div>
              )}
              {invoice.customerPhone && (
                <div>
                  <span className="text-gray-500">Phone:</span>
                  <span className="ml-2 text-gray-900">{invoice.customerPhone}</span>
                </div>
              )}
              {invoice.customerAbn && (
                <div>
                  <span className="text-gray-500">ABN:</span>
                  <span className="ml-2 text-gray-900">{invoice.customerAbn}</span>
                </div>
              )}
              {invoice.customerAddress && (
                <div className="col-span-2">
                  <span className="text-gray-500">Address:</span>
                  <span className="ml-2 text-gray-900">{invoice.customerAddress}</span>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Dates */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Invoice Date:</span>
              <span className="text-gray-900">{new Date(invoice.invoiceDate).toLocaleDateString()}</span>
            </div>
            {invoice.dueDate && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Due Date:</span>
                <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Terms:</span>
              <span className="text-gray-900">{invoice.paymentTerms?.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Job Link */}
          {invoice.jobTitle && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Linked Job:</span>
              <span className="text-blue-600 font-medium">{invoice.jobTitle}</span>
            </div>
          )}

          {/* Line Items */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Line Items</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tax</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{item.itemName}</div>
                        {item.itemDescription && (
                          <div className="text-xs text-gray-500">{item.itemDescription}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 capitalize">
                          {item.itemType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.isTaxable ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="text-right space-y-2 min-w-[300px]">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span className="font-medium">-{formatCurrency(invoice.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST ({invoice.taxRate}%):</span>
                  <span className="font-medium">{formatCurrency(invoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                  <span>Total:</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
                {invoice.amountPaid > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Amount Paid:</span>
                    <span className="font-medium">{formatCurrency(invoice.amountPaid)}</span>
                  </div>
                )}
                {invoice.amountDue > 0 && (
                  <div className={`flex justify-between text-lg font-bold ${isOverdue ? 'text-red-600' : 'text-orange-600'}`}>
                    <span>Amount Due:</span>
                    <span>{formatCurrency(invoice.amountDue)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bank Details */}
          {(invoice.bankName || invoice.bankAccountNumber) && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Bank Details for Payment
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {invoice.bankName && (
                  <div>
                    <span className="text-gray-500">Bank:</span>
                    <span className="ml-2 text-gray-900">{invoice.bankName}</span>
                  </div>
                )}
                {invoice.bankAccountName && (
                  <div>
                    <span className="text-gray-500">Account Name:</span>
                    <span className="ml-2 text-gray-900">{invoice.bankAccountName}</span>
                  </div>
                )}
                {invoice.bankBsb && (
                  <div>
                    <span className="text-gray-500">BSB:</span>
                    <span className="ml-2 text-gray-900">{invoice.bankBsb}</span>
                  </div>
                )}
                {invoice.bankAccountNumber && (
                  <div>
                    <span className="text-gray-500">Account Number:</span>
                    <span className="ml-2 text-gray-900">{invoice.bankAccountNumber}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Instructions and Terms */}
          {(invoice.paymentInstructions || invoice.terms || invoice.customerNotes) && (
            <div className="grid grid-cols-2 gap-4">
              {invoice.paymentInstructions && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Payment Instructions</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{invoice.paymentInstructions}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Terms & Conditions</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{invoice.terms}</p>
                </div>
              )}
              {invoice.customerNotes && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{invoice.customerNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Payments History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Payments</h4>
              <div className="space-y-2">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(payment.amount)} via {payment.paymentMethod.replace('_', ' ')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(payment.paymentDate).toLocaleDateString()}
                          {payment.referenceNumber && ` - Ref: ${payment.referenceNumber}`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {invoice.history && invoice.history.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">History</h4>
              <div className="space-y-2">
                {invoice.history.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">{new Date(entry.createdAt).toLocaleString()}</span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 capitalize">{entry.action}</span>
                    {entry.userName && <span className="text-gray-600">by {entry.userName}</span>}
                    {entry.notes && <span className="text-gray-500">- {entry.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            Close
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => handleAction('duplicate')}
              disabled={!!actionLoading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </button>

            {invoice.status === 'draft' && (
              <>
                <button
                  onClick={() => handleAction('send')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === 'send' ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Invoice
                </button>
              </>
            )}

            {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'partially_paid' || invoice.status === 'overdue') && (
              <>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                >
                  <DollarSign className="w-4 h-4" />
                  Record Payment
                </button>
                <button
                  onClick={() => handleAction('reminder')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === 'reminder' ? <Clock className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  Send Reminder
                </button>
              </>
            )}

            {invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'cancelled' && (
              <button
                onClick={() => handleAction('void')}
                disabled={!!actionLoading}
                className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading === 'void' ? <Clock className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                Void
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setShowPaymentModal(false)}
          onSave={() => {
            setShowPaymentModal(false);
            onAction();
          }}
          setError={setError}
        />
      )}
    </div>
  );
}

// Main Invoices View Component
export function InvoicesView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const setError = useStore((state) => state.setError);
  const contacts = useStore((state) => state.contacts);
  const inventory = useStore((state) => state.inventory);
  const jobs = useStore((state) => state.jobs);

  useEffect(() => {
    loadData();
  }, [filterStatus, showOverdueOnly, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoicesData, statsData] = await Promise.all([
        invoicesAPI.getAll({
          status: filterStatus,
          overdue_only: showOverdueOnly || undefined,
          search: searchTerm || undefined
        }),
        invoicesAPI.getStats()
      ]);

      setInvoices(invoicesData);
      setStats(statsData);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load invoices'));
      setInvoices([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = async (invoiceId: string) => {
    try {
      const invoice = await invoicesAPI.getById(invoiceId);
      setSelectedInvoice(invoice);
      setShowDetailModal(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load invoice details'));
    }
  };

  const handleEditInvoice = async (invoiceId: string) => {
    try {
      const invoice = await invoicesAPI.getById(invoiceId);
      setEditingInvoice(invoice);
      setShowCreateModal(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load invoice'));
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Delete this draft invoice? This cannot be undone.')) return;

    try {
      await invoicesAPI.delete(invoiceId);
      loadData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to delete invoice'));
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    if (!confirm('Send this invoice to the customer?')) return;

    try {
      await invoicesAPI.send(invoiceId);
      loadData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to send invoice'));
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    const badges: Record<InvoiceStatus, { color: string; icon: React.ElementType }> = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: Edit },
      sent: { color: 'bg-blue-100 text-blue-800', icon: Send },
      viewed: { color: 'bg-purple-100 text-purple-800', icon: Eye },
      partially_paid: { color: 'bg-yellow-100 text-yellow-800', icon: DollarSign },
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      overdue: { color: 'bg-red-100 text-red-800', icon: AlertTriangle },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
      void: { color: 'bg-gray-100 text-gray-800', icon: Ban }
    };
    const badge = badges[status];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  const isOverdue = (invoice: Invoice) => {
    return invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'cancelled' &&
      invoice.dueDate && new Date(invoice.dueDate) < new Date();
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">Create and manage customer invoices</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Invoice
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-600 text-sm">Total Invoices</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalInvoices}</div>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg shadow border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-blue-600 text-sm">Pending</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">{stats.pendingInvoices}</div>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg shadow border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-red-600 text-sm">Overdue</div>
                <div className="text-2xl font-bold text-red-900 mt-1">{stats.overdueInvoices}</div>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg shadow border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-green-600 text-sm">Paid</div>
                <div className="text-2xl font-bold text-green-900 mt-1">{stats.paidInvoices}</div>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg shadow border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-orange-600 text-sm">Outstanding</div>
                <div className="text-xl font-bold text-orange-900 mt-1">{formatCurrency(stats.totalOutstanding)}</div>
              </div>
              <DollarSign className="w-8 h-8 text-orange-400" />
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg shadow border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-purple-600 text-sm">This Month</div>
                <div className="text-xl font-bold text-purple-900 mt-1">{formatCurrency(stats.paidThisMonth)}</div>
              </div>
              <CreditCard className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Status:</span>
          {[
            { value: undefined, label: 'All' },
            { value: 'draft', label: 'Draft' },
            { value: 'sent', label: 'Sent' },
            { value: 'partially_paid', label: 'Partial' },
            { value: 'paid', label: 'Paid' }
          ].map(filter => (
            <button
              key={filter.label}
              onClick={() => setFilterStatus(filter.value)}
              className={`px-3 py-1 rounded text-sm ${
                filterStatus === filter.value ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showOverdueOnly}
            onChange={(e) => setShowOverdueOnly(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-red-600 font-medium">Overdue only</span>
        </label>

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoices..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No invoices found</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your first invoice
                  </button>
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className={`hover:bg-gray-50 ${isOverdue(invoice) ? 'bg-red-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</div>
                        <div className="text-xs text-gray-500">{invoice.title}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{invoice.customerName}</div>
                    {invoice.customerEmail && (
                      <div className="text-xs text-gray-500">{invoice.customerEmail}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(invoice.status)}
                      {isOverdue(invoice) && invoice.status !== 'overdue' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${isOverdue(invoice) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(invoice.total)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${invoice.amountDue > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(invoice.amountDue)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewInvoice(invoice.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {invoice.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleEditInvoice(invoice.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendInvoice(invoice.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Send to customer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'partially_paid' || invoice.status === 'overdue') && (
                        <button
                          onClick={() => handleViewInvoice(invoice.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Record payment"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Invoice Modal */}
      {showCreateModal && (
        <CreateInvoiceModal
          onClose={() => {
            setShowCreateModal(false);
            setEditingInvoice(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingInvoice(null);
            loadData();
          }}
          editingInvoice={editingInvoice}
          contacts={contacts}
          inventory={inventory}
          jobs={jobs}
          setError={setError}
        />
      )}

      {/* Invoice Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedInvoice(null);
          }}
          onAction={() => {
            setShowDetailModal(false);
            setSelectedInvoice(null);
            loadData();
          }}
          setError={setError}
        />
      )}
    </div>
  );
}

export default InvoicesView;
