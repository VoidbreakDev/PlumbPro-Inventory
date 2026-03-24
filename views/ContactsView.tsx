/**
 * Contacts View - Enhanced Customer Management
 * Full contact management with history, notes, pricing, and service agreements
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Eye,
  Users,
  Building,
  Phone,
  Mail,
  MapPin,
  Star,
  Clock,
  DollarSign,
  FileText,
  Briefcase,
  MessageSquare,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Tag,
  CreditCard,
  RefreshCw,
  X
} from 'lucide-react';
import { contactsAPI } from '../lib/api';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import { Badge } from '../components/Shared';
import { ConfirmationModal } from '../components/ConfirmationModal';
import type {
  Contact,
  ContactType,
  CustomerType,
  ContactStatus,
  ContactStats,
  CustomerHistory,
  CustomerNote,
  ServiceAgreement,
  CustomerPricing,
  CreateCustomerNoteInput,
  CreateServiceAgreementInput,
  NoteType,
  PaymentTerms
} from '../types';

// Props interface for backwards compatibility
interface ContactsViewProps {
  contacts?: Contact[];
  onAddContact?: () => void;
  onEditContact?: (contact: Contact) => void;
  onDeleteContact?: (contact: Contact) => void;
}

// Create/Edit Contact Modal
interface ContactFormModalProps {
  contact: Contact | null;
  onClose: () => void;
  onSave: () => void;
  setError: (error: string | null) => void;
}

function ContactFormModal({ contact, onClose, onSave, setError }: ContactFormModalProps) {
  const [name, setName] = useState(contact?.name || '');
  const [type, setType] = useState<ContactType>(contact?.type || 'Customer');
  const [email, setEmail] = useState(contact?.email || '');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [company, setCompany] = useState(contact?.company || '');
  const [addressStreet, setAddressStreet] = useState(contact?.addressStreet || '');
  const [addressCity, setAddressCity] = useState(contact?.addressCity || '');
  const [addressState, setAddressState] = useState(contact?.addressState || '');
  const [addressPostcode, setAddressPostcode] = useState(contact?.addressPostcode || '');
  const [abn, setAbn] = useState(contact?.abn || '');
  const [customerType, setCustomerType] = useState<CustomerType>(contact?.customerType || 'residential');
  const [status, setStatus] = useState<ContactStatus>(contact?.status || 'active');
  const [isVip, setIsVip] = useState(contact?.isVip || false);
  const [defaultMarkupPercentage, setDefaultMarkupPercentage] = useState(contact?.defaultMarkupPercentage || 0);
  const [defaultDiscountPercentage, setDefaultDiscountPercentage] = useState(contact?.defaultDiscountPercentage || 0);
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState<PaymentTerms>(contact?.defaultPaymentTerms || 'NET30');
  const [internalNotes, setInternalNotes] = useState(contact?.internalNotes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!name.trim()) {
        setError('Name is required');
        setSaving(false);
        return;
      }

      const contactData: Partial<Contact> = {
        name,
        type,
        email: email || undefined,
        phone: phone || undefined,
        company: company || undefined,
        addressStreet: addressStreet || undefined,
        addressCity: addressCity || undefined,
        addressState: addressState || undefined,
        addressPostcode: addressPostcode || undefined,
        abn: abn || undefined,
        customerType: type === 'Customer' ? customerType : undefined,
        status,
        isVip: type === 'Customer' ? isVip : undefined,
        defaultMarkupPercentage: defaultMarkupPercentage || undefined,
        defaultDiscountPercentage: defaultDiscountPercentage || undefined,
        defaultPaymentTerms,
        internalNotes: internalNotes || undefined
      };

      if (contact) {
        await contactsAPI.update(contact.id, contactData);
      } else {
        await contactsAPI.create(contactData);
      }

      onSave();
    } catch (error) {
      setError(getErrorMessage(error, contact ? 'Failed to update contact' : 'Failed to create contact'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              {contact ? 'Edit Contact' : 'New Contact'}
            </h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ContactType)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Customer">Customer</option>
                  <option value="Supplier">Supplier</option>
                  <option value="Plumber">Plumber</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ContactStatus)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blacklisted">Blacklisted</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ABN</label>
                <input
                  type="text"
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  placeholder="XX XXX XXX XXX"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Address
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={addressStreet}
                    onChange={(e) => setAddressStreet(e.target.value)}
                    placeholder="Street address"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                    placeholder="City"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addressState}
                    onChange={(e) => setAddressState(e.target.value)}
                    placeholder="State"
                    className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={addressPostcode}
                    onChange={(e) => setAddressPostcode(e.target.value)}
                    placeholder="Postcode"
                    className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Customer-specific fields */}
            {type === 'Customer' && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Customer Settings
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
                    <select
                      value={customerType}
                      onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="builder">Builder</option>
                      <option value="developer">Developer</option>
                      <option value="government">Government</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                    <select
                      value={defaultPaymentTerms}
                      onChange={(e) => setDefaultPaymentTerms(e.target.value as PaymentTerms)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="DUE_ON_RECEIPT">Due on Receipt</option>
                      <option value="NET7">Net 7 Days</option>
                      <option value="NET14">Net 14 Days</option>
                      <option value="NET30">Net 30 Days</option>
                      <option value="NET60">Net 60 Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Markup %</label>
                    <input
                      type="number"
                      value={defaultMarkupPercentage}
                      onChange={(e) => setDefaultMarkupPercentage(parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Discount %</label>
                    <input
                      type="number"
                      value={defaultDiscountPercentage}
                      onChange={(e) => setDefaultDiscountPercentage(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      step="0.1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isVip"
                      checked={isVip}
                      onChange={(e) => setIsVip(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="isVip" className="text-sm text-gray-700 flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      VIP Customer
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Internal Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

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
              {saving ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {contact ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Contact Detail Modal with history, notes, agreements
interface ContactDetailModalProps {
  contactId: string;
  onClose: () => void;
  onEdit: () => void;
  setError: (error: string | null) => void;
}

function ContactDetailModal({ contactId, onClose, onEdit, setError }: ContactDetailModalProps) {
  const [history, setHistory] = useState<CustomerHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'quotes' | 'invoices' | 'notes' | 'agreements'>('overview');
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('general');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [contactId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await contactsAPI.getHistory(contactId);
      setHistory(data);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load contact history'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await contactsAPI.addNote(contactId, {
        content: newNote,
        noteType
      });
      setNewNote('');
      loadHistory();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to add note'));
    } finally {
      setAddingNote(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      blacklisted: 'bg-red-100 text-red-800',
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      partially_paid: 'bg-yellow-100 text-yellow-800'
    };
    return (
      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading || !history) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-gray-500">Loading contact details...</div>
        </div>
      </div>
    );
  }

  const { contact, quotes, invoices, notes, serviceAgreements, stats } = history;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl ${
                contact.type === 'Supplier' ? 'bg-amber-500' : contact.type === 'Customer' ? 'bg-blue-500' : 'bg-green-500'
              }`}>
                {contact.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">{contact.name}</h2>
                  {contact.isVip && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                  {getStatusBadge(contact.status || 'active')}
                  <Badge variant={contact.type === 'Supplier' ? 'yellow' : contact.type === 'Customer' ? 'primary' : 'green'}>
                    {contact.type}
                  </Badge>
                </div>
                {contact.company && <p className="text-gray-600">{contact.company}</p>}
                <div className="flex gap-4 mt-2 text-sm text-gray-500">
                  {contact.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {contact.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {contact.type === 'Customer' && (
          <div className="grid grid-cols-5 gap-4 px-6 py-4 bg-gray-50 border-b">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalQuotes}</div>
              <div className="text-xs text-gray-500">Quotes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</div>
              <div className="text-xs text-gray-500">Invoices</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</div>
              <div className="text-xs text-gray-500">Total Paid</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${stats.outstandingBalance > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                {formatCurrency(stats.outstandingBalance)}
              </div>
              <div className="text-xs text-gray-500">Outstanding</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.activeAgreements}</div>
              <div className="text-xs text-gray-500">Active Agreements</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-1 px-6">
            {['overview', 'quotes', 'invoices', 'notes', 'agreements'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'quotes' && ` (${quotes.length})`}
                {tab === 'invoices' && ` (${invoices.length})`}
                {tab === 'notes' && ` (${notes.length})`}
                {tab === 'agreements' && ` (${serviceAgreements.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Contact Details */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Contact Details</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                  {contact.addressStreet && (
                    <div>
                      <span className="text-gray-500">Address:</span>
                      <div className="text-gray-900">
                        {contact.addressStreet}<br />
                        {contact.addressCity && `${contact.addressCity}, `}
                        {contact.addressState} {contact.addressPostcode}
                      </div>
                    </div>
                  )}
                  {contact.abn && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">ABN:</span>
                      <span className="text-gray-900">{contact.abn}</span>
                    </div>
                  )}
                  {contact.customerType && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Customer Type:</span>
                      <span className="text-gray-900 capitalize">{contact.customerType}</span>
                    </div>
                  )}
                  {contact.defaultPaymentTerms && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payment Terms:</span>
                      <span className="text-gray-900">{contact.defaultPaymentTerms.replace('_', ' ')}</span>
                    </div>
                  )}
                  {(contact.defaultMarkupPercentage || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Default Markup:</span>
                      <span className="text-gray-900">{contact.defaultMarkupPercentage}%</span>
                    </div>
                  )}
                  {(contact.defaultDiscountPercentage || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Default Discount:</span>
                      <span className="text-gray-900">{contact.defaultDiscountPercentage}%</span>
                    </div>
                  )}
                </div>

                {contact.internalNotes && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Internal Notes</h4>
                    <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg">{contact.internalNotes}</p>
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Recent Activity</h3>
                <div className="space-y-3">
                  {quotes.slice(0, 3).map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{quote.quoteNumber}</div>
                          <div className="text-xs text-gray-500">{quote.title}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(quote.status)}
                        <div className="text-sm font-medium text-gray-900 mt-1">{formatCurrency(quote.total)}</div>
                      </div>
                    </div>
                  ))}
                  {invoices.slice(0, 3).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</div>
                          <div className="text-xs text-gray-500">{invoice.title}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(invoice.status)}
                        <div className="text-sm font-medium text-gray-900 mt-1">{formatCurrency(invoice.total)}</div>
                      </div>
                    </div>
                  ))}
                  {quotes.length === 0 && invoices.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quotes' && (
            <div className="space-y-3">
              {quotes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No quotes found for this customer</p>
              ) : (
                quotes.map((quote) => (
                  <div key={quote.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-4">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{quote.quoteNumber}</div>
                        <div className="text-sm text-gray-500">{quote.title}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(quote.createdAt).toLocaleDateString()}
                          {quote.validUntil && ` • Valid until ${new Date(quote.validUntil).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(quote.status)}
                      <div className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(quote.total)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="space-y-3">
              {invoices.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No invoices found for this customer</p>
              ) : (
                invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-4">
                      <DollarSign className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{invoice.invoiceNumber}</div>
                        <div className="text-sm text-gray-500">{invoice.title}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                          {invoice.dueDate && ` • Due ${new Date(invoice.dueDate).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(invoice.status)}
                      <div className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(invoice.total)}</div>
                      {invoice.amountDue > 0 && (
                        <div className="text-sm text-orange-600">Due: {formatCurrency(invoice.amountDue)}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Add Note Form */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex gap-3">
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as NoteType)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="general">General</option>
                    <option value="phone_call">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="meeting">Meeting</option>
                    <option value="site_visit">Site Visit</option>
                    <option value="complaint">Complaint</option>
                    <option value="follow_up">Follow Up</option>
                  </select>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={addingNote || !newNote.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingNote ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Notes List */}
              {notes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No notes yet</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">{note.note_type?.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-500">by {note.user_name}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-gray-700">{note.content}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'agreements' && (
            <div className="space-y-3">
              {serviceAgreements.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No service agreements</p>
              ) : (
                serviceAgreements.map((agreement) => (
                  <div key={agreement.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{agreement.agreement_number}</span>
                          {getStatusBadge(agreement.status)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{agreement.title}</div>
                        <div className="text-xs text-gray-500 mt-2">
                          {new Date(agreement.start_date).toLocaleDateString()} -
                          {agreement.end_date ? new Date(agreement.end_date).toLocaleDateString() : 'Ongoing'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 capitalize">{agreement.billing_frequency}</div>
                        {agreement.billing_amount && (
                          <div className="text-lg font-semibold text-gray-900">{formatCurrency(agreement.billing_amount)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Contacts View Component
export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts: propContacts,
  onAddContact,
  onEditContact,
  onDeleteContact
}) => {
  // If props are provided, use simple mode for backwards compatibility
  const isSimpleMode = !!propContacts;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(!isSimpleMode);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const setError = useStore((state) => state.setError);

  useEffect(() => {
    if (!isSimpleMode) {
      loadData();
    }
  }, [filterType, filterStatus, searchTerm, isSimpleMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contactsData, statsData] = await Promise.all([
        contactsAPI.getAll({
          type: filterType || undefined,
          status: filterStatus || undefined,
          search: searchTerm || undefined
        }),
        contactsAPI.getStats()
      ]);
      setContacts(contactsData);
      setStats(statsData);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load contacts'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewContact = (contactId: string) => {
    setSelectedContactId(contactId);
  };

  const handleEditContact = (contact: Contact) => {
    if (onEditContact) {
      onEditContact(contact);
    } else {
      setEditingContact(contact);
      setShowFormModal(true);
    }
  };

  const handleDeleteContact = (contact: Contact) => {
    if (onDeleteContact) {
      onDeleteContact(contact);
    } else {
      setConfirmModal({
        title: 'Delete Contact',
        description: `Delete ${contact.name}? This cannot be undone.`,
        onConfirm: async () => {
          setConfirmModal(null);
          try {
            await contactsAPI.delete(contact.id);
            loadData();
          } catch (error) {
            setError(getErrorMessage(error, 'Failed to delete contact'));
          }
        }
      });
    }
  };

  const handleAddContact = () => {
    if (onAddContact) {
      onAddContact();
    } else {
      setEditingContact(null);
      setShowFormModal(true);
    }
  };

  const displayContacts = isSimpleMode ? (propContacts || []) : contacts;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header and Stats - only in full mode */}
      {!isSimpleMode && (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
              <p className="text-gray-600 mt-1">Manage customers, suppliers, and team members</p>
            </div>
            <button
              onClick={handleAddContact}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Contact
            </button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-600 text-sm">Customers</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalCustomers}</div>
                  </div>
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-600 text-sm">VIP Customers</div>
                    <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.vipCustomers}</div>
                  </div>
                  <Star className="w-8 h-8 text-yellow-400" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-600 text-sm">Suppliers</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalSuppliers}</div>
                  </div>
                  <Building className="w-8 h-8 text-amber-400" />
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

              <div className="bg-red-50 p-4 rounded-lg shadow border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-red-600 text-sm">Overdue</div>
                    <div className="text-2xl font-bold text-red-900 mt-1">{stats.overdueInvoicesCount}</div>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Types</option>
                <option value="Customer">Customers</option>
                <option value="Supplier">Suppliers</option>
                <option value="Plumber">Plumbers</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Contacts Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading contacts...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayContacts.map(contact => (
            <div key={contact.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative">
              <div className="absolute top-4 right-4 flex items-center gap-2">
                {contact.isVip && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                <Badge variant={contact.type === 'Supplier' ? 'yellow' : contact.type === 'Customer' ? 'primary' : 'green'}>
                  {contact.type}
                </Badge>
              </div>

              <div className="flex items-center space-x-4 mb-6">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                  contact.type === 'Supplier' ? 'bg-amber-500' : contact.type === 'Customer' ? 'bg-blue-500' : 'bg-green-500'
                }`}>
                  {contact.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 text-lg">{contact.name}</h4>
                  {contact.company && <p className="text-slate-500 text-sm font-medium">{contact.company}</p>}
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-600 mb-4">
                {contact.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline truncate">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.addressCity && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{contact.addressCity}, {contact.addressState}</span>
                  </div>
                )}
              </div>

              {/* Customer Stats */}
              {contact.type === 'Customer' && (contact.quoteCount !== undefined || contact.outstandingBalance !== undefined) && (
                <div className="flex gap-4 text-xs text-gray-500 mb-4 py-2 border-t border-gray-100">
                  {contact.quoteCount !== undefined && (
                    <span>{contact.quoteCount} quotes</span>
                  )}
                  {contact.invoiceCount !== undefined && (
                    <span>{contact.invoiceCount} invoices</span>
                  )}
                  {(contact.outstandingBalance || 0) > 0 && (
                    <span className="text-orange-600">{formatCurrency(contact.outstandingBalance || 0)} due</span>
                  )}
                </div>
              )}

              <div className="flex space-x-2 pt-4 border-t border-slate-100">
                {!isSimpleMode && (
                  <button
                    onClick={() => handleViewContact(contact.id)}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                  </button>
                )}
                <button
                  onClick={() => handleEditContact(contact)}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteContact(contact)}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}

          {/* Add New Contact Card */}
          <button
            onClick={handleAddContact}
            className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-8 hover:border-blue-400 hover:bg-blue-50 group transition-all min-h-[250px]"
          >
            <Plus className="w-10 h-10 text-slate-300 group-hover:text-blue-500 mb-2 transition-colors" />
            <span className="text-slate-500 font-bold group-hover:text-blue-700">Add New Contact</span>
          </button>
        </div>
      )}

      {/* Contact Detail Modal */}
      {selectedContactId && (
        <ContactDetailModal
          contactId={selectedContactId}
          onClose={() => setSelectedContactId(null)}
          onEdit={() => {
            const contact = contacts.find(c => c.id === selectedContactId);
            if (contact) {
              setSelectedContactId(null);
              setEditingContact(contact);
              setShowFormModal(true);
            }
          }}
          setError={setError}
        />
      )}

      {/* Contact Form Modal */}
      {showFormModal && (
        <ContactFormModal
          contact={editingContact}
          onClose={() => {
            setShowFormModal(false);
            setEditingContact(null);
          }}
          onSave={() => {
            setShowFormModal(false);
            setEditingContact(null);
            loadData();
          }}
          setError={setError}
        />
      )}

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
};

export default ContactsView;
