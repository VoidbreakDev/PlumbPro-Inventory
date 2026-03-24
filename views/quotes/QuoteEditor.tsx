/**
 * QuoteEditor
 * Modal form for creating and editing quotes with line items.
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  XCircle,
  Clock,
  CheckCircle,
  Trash2,
  Users
} from 'lucide-react';
import { quotesAPI } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type {
  Quote,
  Contact,
  InventoryItem,
  Job,
  CreateQuoteInput
} from '../../types';

// Quote Line Item Interface
export interface QuoteLineItem {
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

export interface QuoteEditorProps {
  onClose: () => void;
  onSave: () => void;
  editingQuote: Quote | null;
  contacts: Contact[];
  inventory: InventoryItem[];
  jobs: Job[];
  setError: (error: string | null) => void;
}

export function QuoteEditor({ onClose, onSave, editingQuote, contacts, inventory, jobs, setError }: QuoteEditorProps) {
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

export default QuoteEditor;
