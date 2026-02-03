/**
 * Customer Portal View
 * Self-service portal for customers to view quotes, invoices, and job status
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Mail,
  Phone,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  Wrench,
  Loader2,
  ArrowRight,
  Download,
  CreditCard,
  ChevronRight,
  Home,
  ClipboardList,
  Receipt
} from 'lucide-react';
import { portalAPI, type PortalDashboard, type PortalQuote, type PortalInvoice, type PortalJob } from '../lib/portalAPI';
import { getErrorMessage } from '../lib/errors';

interface PortalLoginProps {
  onLogin: (token: string) => void;
}

function PortalLogin({ onLogin }: PortalLoginProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await portalAPI.requestMagicLink(email);
      setMessage(result.message);
      
      // For development, automatically use the magic link token
      if (result.magicLink) {
        const url = new URL(result.magicLink);
        const token = url.searchParams.get('token');
        if (token) {
          // Try to auto-login in development
          try {
            const auth = await portalAPI.verifyToken(token);
            localStorage.setItem('portal_token', auth.token);
            onLogin(auth.token);
          } catch {
            // Silent fail - user will need to check email
          }
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send magic link'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
          <p className="text-gray-600 mt-2">View your quotes, invoices, and job status</p>
        </div>

        {message && (
          <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-5 h-5" />
                Send Magic Link
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          We'll send a secure link to your email to access your account.
        </p>
      </div>
    </div>
  );
}

interface PortalDashboardProps {
  onLogout: () => void;
}

function PortalDashboard({ onLogout }: PortalDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'quotes' | 'invoices'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<PortalDashboard | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<PortalQuote | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<PortalInvoice | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await portalAPI.getDashboard();
      setDashboard(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveQuote = async (quoteId: string) => {
    setActionLoading(true);
    try {
      await portalAPI.approveQuote(quoteId);
      await loadDashboard();
      setSelectedQuote(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to approve quote'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineQuote = async (quoteId: string, reason: string) => {
    setActionLoading(true);
    try {
      await portalAPI.declineQuote(quoteId, reason);
      await loadDashboard();
      setSelectedQuote(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to decline quote'));
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
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
      'Scheduled': 'bg-blue-100 text-blue-800',
      'In Progress': 'bg-yellow-100 text-yellow-800',
      'Completed': 'bg-green-100 text-green-800',
      'draft': 'bg-gray-100 text-gray-800',
      'sent': 'bg-blue-100 text-blue-800',
      'approved': 'bg-green-100 text-green-800',
      'declined': 'bg-red-100 text-red-800',
      'paid': 'bg-green-100 text-green-800',
      'partial': 'bg-yellow-100 text-yellow-800',
      'overdue': 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadDashboard}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Customer Portal</h1>
                <p className="text-xs text-gray-500">{dashboard?.stats.total_jobs || 0} jobs</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Home },
              { id: 'jobs', label: 'Jobs', icon: Wrench },
              { id: 'quotes', label: 'Quotes', icon: FileText },
              { id: 'invoices', label: 'Invoices', icon: Receipt }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 border-b-2 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-gray-600">Total Jobs</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{dashboard?.stats.total_jobs || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-600">Completed</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{dashboard?.stats.completed_jobs || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm text-gray-600">Pending Quotes</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{dashboard?.stats.pending_quotes || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-red-600" />
                  <span className="text-sm text-gray-600">Outstanding</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(dashboard?.stats.outstanding_amount || 0)}
                </p>
              </div>
            </div>

            {/* Pending Quotes */}
            {dashboard?.pendingQuotes && dashboard.pendingQuotes.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Quotes</h2>
                <div className="space-y-3">
                  {dashboard.pendingQuotes.slice(0, 3).map((quote) => (
                    <div
                      key={quote.id}
                      onClick={() => setSelectedQuote(quote)}
                      className="flex items-center justify-between p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{quote.title}</p>
                        <p className="text-sm text-gray-600">{quote.job_type}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(quote.quote_total || 0)}
                        </span>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unpaid Invoices */}
            {dashboard?.unpaidInvoices && dashboard.unpaidInvoices.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Unpaid Invoices</h2>
                <div className="space-y-3">
                  {dashboard.unpaidInvoices.slice(0, 3).map((invoice) => (
                    <div
                      key={invoice.id}
                      onClick={() => setSelectedInvoice(invoice)}
                      className="flex items-center justify-between p-4 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                        <p className="text-sm text-gray-600">Due: {formatDate(invoice.due_date)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(invoice.total_amount - (invoice.amount_paid || 0))}
                        </span>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Jobs */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Jobs</h2>
              <div className="space-y-3">
                {dashboard?.recentJobs?.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{job.title}</p>
                      <p className="text-sm text-gray-600">{formatDate(job.date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(job.status)}
                      {job.quote_status && getStatusBadge(job.quote_status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">All Jobs</h2>
            <div className="space-y-4">
              {dashboard?.recentJobs?.map((job) => (
                <div key={job.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{job.title}</h3>
                      <p className="text-sm text-gray-600">{job.job_type}</p>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><Calendar className="w-4 h-4 inline mr-1" /> {formatDate(job.date)}</p>
                    {job.workers && job.workers.length > 0 && (
                      <p><Wrench className="w-4 h-4 inline mr-1" /> {job.workers.map(w => w.name).join(', ')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quotes Tab */}
        {activeTab === 'quotes' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quotes</h2>
            <div className="space-y-4">
              {dashboard?.pendingQuotes?.map((quote) => (
                <div
                  key={quote.id}
                  onClick={() => setSelectedQuote(quote)}
                  className="border rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{quote.title}</h3>
                      <p className="text-sm text-gray-600">{quote.job_type}</p>
                    </div>
                    {getStatusBadge(quote.quote_status || 'draft')}
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(quote.quote_total || 0)}
                  </p>
                  {quote.quote_expires_at && (
                    <p className="text-sm text-orange-600 mt-1">
                      Expires: {formatDate(quote.quote_expires_at)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoices</h2>
            <div className="space-y-4">
              {dashboard?.unpaidInvoices?.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className="border rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{invoice.invoice_number}</h3>
                      <p className="text-sm text-gray-600">Issued: {formatDate(invoice.issue_date)}</p>
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(invoice.total_amount)}
                    </p>
                    {invoice.status !== 'paid' && (
                      <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Pay Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Quote Detail Modal */}
      {selectedQuote && (
        <QuoteDetailModal
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onApprove={() => handleApproveQuote(selectedQuote.id)}
          onDecline={(reason) => handleDeclineQuote(selectedQuote.id, reason)}
          loading={actionLoading}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

interface QuoteDetailModalProps {
  quote: PortalQuote;
  onClose: () => void;
  onApprove: () => void;
  onDecline: (reason: string) => void;
  loading: boolean;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
}

function QuoteDetailModal({ quote, onClose, onApprove, onDecline, loading, formatCurrency, formatDate }: QuoteDetailModalProps) {
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const handleDeclineSubmit = () => {
    onDecline(declineReason);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Quote Details</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{quote.title}</h3>
            <p className="text-gray-600">{quote.job_type}</p>
            <p className="text-sm text-gray-500 mt-1">Proposed date: {formatDate(quote.date)}</p>
          </div>

          {quote.items && quote.items.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Quote Items</h4>
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
                  {quote.items.map((item, idx) => (
                    <tr key={item.id || `quote-item-${idx}`} className="border-b">
                      <td className="py-3 px-3">{item.description}</td>
                      <td className="py-3 px-3 text-center">{item.quantity}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td colSpan={3} className="py-3 px-3 text-right">Total:</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(quote.quote_total || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {quote.quote_expires_at && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <Clock className="w-4 h-4 inline mr-1" />
                This quote expires on {formatDate(quote.quote_expires_at)}
              </p>
            </div>
          )}

          {quote.quote_status === 'sent' && (
            <div className="flex gap-3">
              {!showDeclineForm ? (
                <>
                  <button
                    onClick={onApprove}
                    disabled={loading}
                    className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                    Accept Quote
                  </button>
                  <button
                    onClick={() => setShowDeclineForm(true)}
                    disabled={loading}
                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    Decline
                  </button>
                </>
              ) : (
                <div className="w-full space-y-3">
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Please provide a reason for declining (optional)"
                    className="w-full p-3 border rounded-lg"
                    rows={3}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeclineSubmit}
                      disabled={loading}
                      className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Decline'}
                    </button>
                    <button
                      onClick={() => setShowDeclineForm(false)}
                      className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface InvoiceDetailModalProps {
  invoice: PortalInvoice;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
}

function InvoiceDetailModal({ invoice, onClose, formatCurrency, formatDate }: InvoiceDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{invoice.invoice_number}</h2>
              <p className="text-sm text-gray-500">Issued: {formatDate(invoice.issue_date)}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Due Date</p>
              <p className={`font-medium ${invoice.status === 'overdue' ? 'text-red-600' : 'text-gray-900'}`}>
                {formatDate(invoice.due_date)}
              </p>
            </div>
          </div>

          {invoice.items && invoice.items.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Invoice Items</h4>
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
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id || `invoice-item-${idx}`} className="border-b">
                      <td className="py-3 px-3">{item.description}</td>
                      <td className="py-3 px-3 text-center">{item.quantity}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-right font-medium">Subtotal:</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(invoice.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-right font-medium">Tax:</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(invoice.tax_amount)}</td>
                  </tr>
                  <tr className="font-semibold text-lg">
                    <td colSpan={3} className="py-3 px-3 text-right">Total:</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(invoice.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {invoice.payments && invoice.payments.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Payment History</h4>
              <div className="space-y-2">
                {invoice.payments.map((payment, idx) => (
                  <div key={payment.id || `payment-${payment.payment_date}-${idx}`} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                      <p className="text-sm text-gray-600">{payment.payment_method}</p>
                    </div>
                    <p className="text-sm text-gray-600">{formatDate(payment.payment_date)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invoice.status !== 'paid' && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600">Amount Due</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(invoice.total_amount - (invoice.amount_paid || 0))}
                  </p>
                </div>
              </div>
              <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" />
                Pay Online
              </button>
            </div>
          )}

          <button className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
            <Download className="w-5 h-5" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerPortalView() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(localStorage.getItem('portal_token'));

  // Check for token in URL (magic link)
  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken && !token) {
      // Verify token and login
      portalAPI.verifyToken(urlToken).then((auth) => {
        localStorage.setItem('portal_token', auth.token);
        setToken(auth.token);
      }).catch(() => {
        // Invalid token, stay on login page
      });
    }
  }, [searchParams]);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    setToken(null);
  };

  if (!token) {
    return <PortalLogin onLogin={handleLogin} />;
  }

  return <PortalDashboard onLogout={handleLogout} />;
}
