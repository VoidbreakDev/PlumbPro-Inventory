/**
 * QuoteList
 * Statistics cards, filter/search controls, and the quotes table.
 */

import React from 'react';
import {
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Eye,
  Edit,
  Trash2,
  Filter,
  Search
} from 'lucide-react';
import type { Quote, QuoteStats, QuoteStatus } from '../../types';

export interface QuoteListProps {
  quotes: Quote[];
  stats: QuoteStats | null;
  filterStatus: string | undefined;
  searchTerm: string;
  onFilterChange: (status: string | undefined) => void;
  onSearchChange: (term: string) => void;
  onViewQuote: (quoteId: string) => void;
  onEditQuote: (quoteId: string) => void;
  onSendQuote: (quoteId: string) => void;
  onDeleteQuote: (quoteId: string) => void;
  onCreateQuote: () => void;
}

export function QuoteList({
  quotes,
  stats,
  filterStatus,
  searchTerm,
  onFilterChange,
  onSearchChange,
  onViewQuote,
  onEditQuote,
  onSendQuote,
  onDeleteQuote,
  onCreateQuote
}: QuoteListProps) {
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

  return (
    <>
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
              onClick={() => onFilterChange(filter.value)}
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
              onChange={(e) => onSearchChange(e.target.value)}
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
                    onClick={onCreateQuote}
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
                        onClick={() => onViewQuote(quote.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {quote.status === 'draft' && (
                        <>
                          <button
                            onClick={() => onEditQuote(quote.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onSendQuote(quote.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Send to customer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteQuote(quote.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {(quote.status === 'sent' || quote.status === 'viewed') && (
                        <button
                          onClick={() => onEditQuote(quote.id)}
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
    </>
  );
}

export default QuoteList;
