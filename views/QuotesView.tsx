/**
 * Quotes View
 * Manage quotes with customer tracking and job integration
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
  RefreshCw,
  Search,
  Users,
  Briefcase,
  Download
} from 'lucide-react';
import { quotesAPI } from '../lib/api';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import type {
  Quote,
  QuoteItem,
  QuoteStats,
  Contact,
  InventoryItem,
  Job,
  CreateQuoteInput,
  CreateQuoteItemInput,
  QuoteStatus
} from '../types';

// Quote Line Item Interface
interface QuoteLineItem {
  id: string;
  itemType: 'material' | 'labor' | 'other' | 'subcontractor';
  inventoryItemId?: string;
  itemName: string;
  itemDescription?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  markupPercentage: number;
  unitPrice: number;
  lineTotal: number;
  groupName?: string;
}

// Create/Edit Quote Modal Component
interface CreateQuoteModalProps {
  onClose: () => void;
  onSave: () => void;
  editingQuote: Quote | null;
  contacts: Contact[];
  inventory: InventoryItem[];
  jobs: Job[];
  setError: (error: string | null) => void;
}

function CreateQuoteModal({ onClose, onSave, editingQuote, contacts, inventory, jobs, setError }: CreateQuoteModalProps) {
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [jobId, setJobId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(10);
  const [defaultMarkup, setDefaultMarkup] = useState<number>(20);
  const [terms, setTerms] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [items, setItems] = useState<QuoteLineItem[]>([
    { id: crypto.randomUUID(), itemType: 'material', itemName: '', quantity: 1, unit: 'EA', unitCost: 0, markupPercentage: 20, unitPrice: 0, lineTotal: 0 }
  ]);
  const [saving, setSaving] = useState(false);
  const [sendImmediately, setSendImmediately] = useState(false);

  // Load editing data
  useEffect(() => {
    if (editingQuote) {
      setCustomerId(editingQuote.customerId || '');
      setCustomerName(editingQuote.customerName || '');
      setCustomerEmail(editingQuote.customerEmail || '');
      setCustomerPhone(editingQuote.customerPhone || '');
      setCustomerAddress(editingQuote.customerAddress || '');
      setJobId(editingQuote.jobId || '');
      setTitle(editingQuote.title || '');
      setDescription(editingQuote.description || '');
      setValidUntil(editingQuote.validUntil || '');
      setDiscountType(editingQuote.discountType || 'fixed');
      setDiscountValue(editingQuote.discountValue || 0);
      setTaxRate(editingQuote.taxRate || 10);
      setDefaultMarkup(editingQuote.defaultMarkupPercentage || 20);
      setTerms(editingQuote.terms || '');
      setNotes(editingQuote.notes || '');
      setCustomerNotes(editingQuote.customerNotes || '');

      if (editingQuote.items && editingQuote.items.length > 0) {
        setItems(editingQuote.items.map(item => ({
          id: item.id,
          itemType: item.itemType,
          inventoryItemId: item.inventoryItemId,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          markupPercentage: item.markupPercentage,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          groupName: item.groupName
        })));
      }
    }
  }, [editingQuote]);

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
        if (!title) setTitle(`Quote for ${job.title}`);
        if (job.builder && !customerName) setCustomerName(job.builder);
      }
    }
  }, [jobId, jobs]);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        itemType: 'material',
        itemName: '',
        quantity: 1,
        unit: 'EA',
        unitCost: 0,
        markupPercentage: defaultMarkup,
        unitPrice: 0,
        lineTotal: 0
      }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof QuoteLineItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };

        // If inventory item selected, auto-fill details
        if (field === 'inventoryItemId' && value) {
          const inventoryItem = inventory.find(i => i.id === value);
          if (inventoryItem) {
            updated.itemName = inventoryItem.name;
            updated.unitCost = inventoryItem.buyPriceExclGST || inventoryItem.price || 0;
            // Apply markup to get sell price
            updated.unitPrice = updated.unitCost * (1 + (updated.markupPercentage / 100));
          }
        }

        // Recalculate unit price when cost or markup changes
        if (field === 'unitCost' || field === 'markupPercentage') {
          updated.unitPrice = updated.unitCost * (1 + (updated.markupPercentage / 100));
        }

        // Recalculate line total
        if (field === 'quantity' || field === 'unitPrice' || field === 'unitCost' || field === 'markupPercentage') {
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

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    return (subtotal - discount) * (taxRate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount() + calculateTax();
  };

  const calculateProfit = () => {
    return items.reduce((sum, item) => {
      const cost = item.quantity * item.unitCost;
      const revenue = item.lineTotal;
      return sum + (revenue - cost);
    }, 0);
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
        setError('Quote title is required');
        setSaving(false);
        return;
      }

      if (items.length === 0 || items.some(item => !item.itemName.trim())) {
        setError('Please add at least one valid item');
        setSaving(false);
        return;
      }

      const quoteData: CreateQuoteInput = {
        customerId: customerId || undefined,
        customerName,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        customerAddress: customerAddress || undefined,
        jobId: jobId || undefined,
        title,
        description: description || undefined,
        validUntil: validUntil || undefined,
        discountType,
        discountValue,
        taxRate,
        defaultMarkupPercentage: defaultMarkup,
        terms: terms || undefined,
        notes: notes || undefined,
        customerNotes: customerNotes || undefined,
        items: items.map((item, index) => ({
          itemType: item.itemType,
          inventoryItemId: item.inventoryItemId,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          markupPercentage: item.markupPercentage,
          unitPrice: item.unitPrice,
          sortOrder: index,
          groupName: item.groupName
        }))
      };

      if (editingQuote) {
        await quotesAPI.update(editingQuote.id, quoteData);
      } else {
        const newQuote = await quotesAPI.create(quoteData);

        if (sendImmediately) {
          await quotesAPI.send(newQuote.id);
        }
      }

      onSave();
    } catch (error) {
      setError(getErrorMessage(error, editingQuote ? 'Failed to update quote' : 'Failed to create quote'));
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
              {editingQuote ? `Edit Quote ${editingQuote.quoteNumber}` : 'Create Quote'}
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

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Quote Details Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quote Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g., Bathroom Renovation Quote"
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

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description of the work..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Markup %
                </label>
                <input
                  type="number"
                  value={defaultMarkup}
                  onChange={(e) => setDefaultMarkup(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
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
                              {invItem.name} - ${(invItem.buyPriceExclGST || invItem.price || 0).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-6 gap-3">
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
                          Cost
                        </label>
                        <input
                          type="number"
                          value={item.unitCost}
                          onChange={(e) => updateItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Markup %
                        </label>
                        <input
                          type="number"
                          value={item.markupPercentage}
                          onChange={(e) => updateItem(item.id, 'markupPercentage', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.1"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Unit Price *
                        </label>
                        <input
                          type="number"
                          value={item.unitPrice.toFixed(2)}
                          onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          required
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        Profit: ${((item.lineTotal) - (item.quantity * item.unitCost)).toFixed(2)}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        Line Total: ${item.lineTotal.toFixed(2)}
                      </span>
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
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>Estimated Profit:</span>
                    <span className="font-medium">${calculateProfit().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={3}
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
                  rows={3}
                  placeholder="Any notes visible to the customer..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="col-span-2">
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
            {!editingQuote && (
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
                  {editingQuote ? 'Update Quote' : sendImmediately ? 'Create & Send' : 'Create Quote'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Quote Detail Modal
interface QuoteDetailModalProps {
  quote: Quote;
  onClose: () => void;
  onAction: () => void;
  setError: (error: string | null) => void;
}

function QuoteDetailModal({ quote, onClose, onAction, setError }: QuoteDetailModalProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: 'send' | 'approve' | 'reject' | 'duplicate' | 'revise') => {
    setActionLoading(action);
    try {
      switch (action) {
        case 'send':
          await quotesAPI.send(quote.id);
          break;
        case 'approve':
          await quotesAPI.approve(quote.id);
          break;
        case 'reject':
          const reason = prompt('Rejection reason (optional):');
          await quotesAPI.reject(quote.id, reason || undefined);
          break;
        case 'duplicate':
          await quotesAPI.duplicate(quote.id);
          break;
        case 'revise':
          await quotesAPI.revise(quote.id);
          break;
      }
      onAction();
    } catch (error) {
      setError(getErrorMessage(error, `Failed to ${action} quote`));
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: QuoteStatus) => {
    const badges: Record<QuoteStatus, { color: string; label: string }> = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      sent: { color: 'bg-blue-100 text-blue-800', label: 'Sent' },
      viewed: { color: 'bg-purple-100 text-purple-800', label: 'Viewed' },
      approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
      expired: { color: 'bg-yellow-100 text-yellow-800', label: 'Expired' },
      converted: { color: 'bg-teal-100 text-teal-800', label: 'Converted' }
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-gray-900">{quote.quoteNumber}</h3>
                {getStatusBadge(quote.status)}
              </div>
              <p className="text-gray-600 mt-1">{quote.title}</p>
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
                <span className="ml-2 text-gray-900">{quote.customerName}</span>
              </div>
              {quote.customerEmail && (
                <div>
                  <span className="text-gray-500">Email:</span>
                  <span className="ml-2 text-gray-900">{quote.customerEmail}</span>
                </div>
              )}
              {quote.customerPhone && (
                <div>
                  <span className="text-gray-500">Phone:</span>
                  <span className="ml-2 text-gray-900">{quote.customerPhone}</span>
                </div>
              )}
              {quote.customerAddress && (
                <div className="col-span-2">
                  <span className="text-gray-500">Address:</span>
                  <span className="ml-2 text-gray-900">{quote.customerAddress}</span>
                </div>
              )}
            </div>
          </div>

          {/* Job Link */}
          {quote.jobTitle && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Linked Job:</span>
              <span className="text-blue-600 font-medium">{quote.jobTitle}</span>
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quote.items?.map((item) => (
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
                  <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span className="font-medium">-{formatCurrency(quote.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST ({quote.taxRate}%):</span>
                  <span className="font-medium">{formatCurrency(quote.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                  <span>Total:</span>
                  <span>{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Terms and Notes */}
          {(quote.terms || quote.customerNotes) && (
            <div className="grid grid-cols-2 gap-4">
              {quote.terms && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Terms & Conditions</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{quote.terms}</p>
                </div>
              )}
              {quote.customerNotes && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{quote.customerNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Validity */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Created: {new Date(quote.createdAt).toLocaleDateString()}</span>
            {quote.validUntil && (
              <span>Valid until: {new Date(quote.validUntil).toLocaleDateString()}</span>
            )}
            {quote.sentAt && (
              <span>Sent: {new Date(quote.sentAt).toLocaleDateString()}</span>
            )}
          </div>

          {/* History */}
          {quote.history && quote.history.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">History</h4>
              <div className="space-y-2">
                {quote.history.map((entry) => (
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

            {quote.status === 'draft' && (
              <button
                onClick={() => handleAction('send')}
                disabled={!!actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading === 'send' ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Quote
              </button>
            )}

            {(quote.status === 'sent' || quote.status === 'viewed') && (
              <>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === 'approve' ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Approve
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === 'reject' ? <Clock className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </button>
                <button
                  onClick={() => handleAction('revise')}
                  disabled={!!actionLoading}
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Create Revision
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Quotes View Component
export function QuotesView() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [stats, setStats] = useState<QuoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);

  const setError = useStore((state) => state.setError);
  const contacts = useStore((state) => state.contacts);
  const inventory = useStore((state) => state.inventory);
  const jobs = useStore((state) => state.jobs);

  useEffect(() => {
    loadData();
  }, [filterStatus, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [quotesData, statsData] = await Promise.all([
        quotesAPI.getAll({ status: filterStatus, search: searchTerm || undefined }),
        quotesAPI.getStats()
      ]);

      setQuotes(quotesData);
      setStats(statsData);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load quotes'));
      setQuotes([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleViewQuote = async (quoteId: string) => {
    try {
      const quote = await quotesAPI.getById(quoteId);
      setSelectedQuote(quote);
      setShowDetailModal(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load quote details'));
    }
  };

  const handleEditQuote = async (quoteId: string) => {
    try {
      const quote = await quotesAPI.getById(quoteId);
      setEditingQuote(quote);
      setShowCreateModal(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load quote'));
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('Delete this draft quote? This cannot be undone.')) return;

    try {
      await quotesAPI.delete(quoteId);
      loadData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to delete quote'));
    }
  };

  const handleSendQuote = async (quoteId: string) => {
    if (!confirm('Send this quote to the customer?')) return;

    try {
      await quotesAPI.send(quoteId);
      loadData();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to send quote'));
    }
  };

  const getStatusBadge = (status: QuoteStatus) => {
    const badges: Record<QuoteStatus, { color: string; icon: React.ElementType }> = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: Edit },
      sent: { color: 'bg-blue-100 text-blue-800', icon: Send },
      viewed: { color: 'bg-purple-100 text-purple-800', icon: Eye },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      expired: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      converted: { color: 'bg-teal-100 text-teal-800', icon: CheckCircle }
    };
    const badge = badges[status];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  if (loading && quotes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading quotes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-gray-600 mt-1">Create and manage customer quotes</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Quote
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-600 text-sm">Total Quotes</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalQuotes}</div>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg shadow border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-blue-600 text-sm">Pending</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">{stats.sentQuotes}</div>
              </div>
              <Send className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg shadow border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-green-600 text-sm">Approved</div>
                <div className="text-2xl font-bold text-green-900 mt-1">{stats.approvedQuotes}</div>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg shadow border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-purple-600 text-sm">Approved Value</div>
                <div className="text-xl font-bold text-purple-900 mt-1">{formatCurrency(stats.approvedValue)}</div>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>
          </div>

          <div className="bg-teal-50 p-4 rounded-lg shadow border border-teal-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-teal-600 text-sm">This Month</div>
                <div className="text-2xl font-bold text-teal-900 mt-1">{stats.quotesThisMonth}</div>
              </div>
              <Clock className="w-8 h-8 text-teal-400" />
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
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' }
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

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search quotes..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quote
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No quotes found</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your first quote
                  </button>
                </td>
              </tr>
            ) : (
              quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{quote.quoteNumber}</div>
                        <div className="text-xs text-gray-500">{quote.title}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{quote.customerName}</div>
                    {quote.customerEmail && (
                      <div className="text-xs text-gray-500">{quote.customerEmail}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(quote.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{quote.itemCount || 0} items</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(quote.total)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(quote.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewQuote(quote.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {quote.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleEditQuote(quote.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendQuote(quote.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Send to customer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuote(quote.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {(quote.status === 'sent' || quote.status === 'viewed') && (
                        <button
                          onClick={() => handleEditQuote(quote.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
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

      {/* Create/Edit Quote Modal */}
      {showCreateModal && (
        <CreateQuoteModal
          onClose={() => {
            setShowCreateModal(false);
            setEditingQuote(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingQuote(null);
            loadData();
          }}
          editingQuote={editingQuote}
          contacts={contacts}
          inventory={inventory}
          jobs={jobs}
          setError={setError}
        />
      )}

      {/* Quote Detail Modal */}
      {showDetailModal && selectedQuote && (
        <QuoteDetailModal
          quote={selectedQuote}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedQuote(null);
          }}
          onAction={() => {
            setShowDetailModal(false);
            setSelectedQuote(null);
            loadData();
          }}
          setError={setError}
        />
      )}
    </div>
  );
}

export default QuotesView;
