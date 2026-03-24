/**
 * Quotes View
 * Manage quotes with customer tracking and job integration.
 *
 * Sub-components live in views/quotes/:
 *   QuoteList    — statistics cards, filter/search bar, quotes table
 *   QuoteEditor  — create/edit quote modal with line items
 *   QuotePreview — read-only detail modal with workflow actions
 */

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { quotesAPI } from '../lib/api';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { QuoteList } from './quotes/QuoteList';
import { QuoteEditor } from './quotes/QuoteEditor';
import { QuotePreview } from './quotes/QuotePreview';
import type { Quote, QuoteStats } from '../types';

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
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

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

  const handleDeleteQuote = (quoteId: string) => {
    setConfirmModal({
      title: 'Delete Quote',
      description: 'Delete this draft quote? This cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await quotesAPI.delete(quoteId);
          loadData();
        } catch (error) {
          setError(getErrorMessage(error, 'Failed to delete quote'));
        }
      }
    });
  };

  const handleSendQuote = (quoteId: string) => {
    setConfirmModal({
      title: 'Send Quote',
      description: 'Send this quote to the customer?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await quotesAPI.send(quoteId);
          loadData();
        } catch (error) {
          setError(getErrorMessage(error, 'Failed to send quote'));
        }
      }
    });
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

      {/* List: stats cards + filter bar + table */}
      <QuoteList
        quotes={quotes}
        stats={stats}
        filterStatus={filterStatus}
        searchTerm={searchTerm}
        onFilterChange={setFilterStatus}
        onSearchChange={setSearchTerm}
        onViewQuote={handleViewQuote}
        onEditQuote={handleEditQuote}
        onSendQuote={handleSendQuote}
        onDeleteQuote={handleDeleteQuote}
        onCreateQuote={() => setShowCreateModal(true)}
      />

      {/* Create/Edit Quote Modal */}
      {showCreateModal && (
        <QuoteEditor
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

      {/* Quote Detail / Preview Modal */}
      {showDetailModal && selectedQuote && (
        <QuotePreview
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

export default QuotesView;
