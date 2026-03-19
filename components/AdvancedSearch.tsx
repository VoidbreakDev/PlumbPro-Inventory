/**
 * Advanced Search Component
 * Global search with autocomplete, filters, and recent searches
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import { loadRecentSearches, saveRecentSearches } from '../lib/recentSearches';

export interface SearchResult {
  id: string;
  type: 'inventory' | 'job' | 'contact' | 'workflow' | 'project';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
  icon?: string;
}

interface AdvancedSearchProps {
  onSelect?: (result: SearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSelect,
  placeholder = 'Search inventory, jobs, contacts...',
  autoFocus = false
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['all']));

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const setError = useStore((state) => state.setError);

  // Load recent searches from persisted storage
  useEffect(() => {
    let isMounted = true;
    const fetchRecentSearches = async () => {
      try {
        const recent = await loadRecentSearches();
        if (isMounted) {
          setRecentSearches(recent);
        }
      } catch (error) {
        console.error('Failed to load recent searches:', error);
      }
    };

    void fetchRecentSearches();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save to recent searches
  const saveRecentSearch = (query: string) => {
    const updated = [query, ...recentSearches.filter(q => q !== query)].slice(0, 10);
    setRecentSearches(updated);
    void saveRecentSearches(updated);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeFilters]);

  // Perform search
  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const filters = Array.from(activeFilters);
      const includeAll = filters.includes('all');

      const results: SearchResult[] = [];

      // Search inventory
      if (includeAll || filters.includes('inventory')) {
        const inventoryResponse = await api.get(`/inventory?search=${searchQuery}&limit=5`);
        const inventoryResults: SearchResult[] = inventoryResponse.data.map((item: any) => ({
          id: item.id,
          type: 'inventory' as const,
          title: item.name,
          subtitle: item.category,
          description: `Qty: ${item.quantity} | £${item.price}`,
          metadata: item,
          icon: '📦'
        }));
        results.push(...inventoryResults);
      }

      // Search jobs
      if (includeAll || filters.includes('job')) {
        const jobsResponse = await api.get(`/jobs?search=${searchQuery}&limit=5`);
        const jobResults: SearchResult[] = jobsResponse.data.map((job: any) => ({
          id: job.id,
          type: 'job' as const,
          title: job.title || job.name,
          subtitle: job.status,
          description: job.date ? `Scheduled: ${new Date(job.date).toLocaleDateString()}` : '',
          metadata: job,
          icon: '🔧'
        }));
        results.push(...jobResults);
      }

      // Search development projects
      if (includeAll || filters.includes('job')) {
        const projectsResponse = await api.get(`/development-projects?search=${searchQuery}&limit=5`);
        const projectResults: SearchResult[] = projectsResponse.data.map((project: any) => ({
          id: project.id,
          type: 'project' as const,
          title: project.title,
          subtitle: project.overallStatus,
          description: project.siteAddress || project.builder || '',
          metadata: project,
          icon: '🏗️'
        }));
        results.push(...projectResults);
      }

      // Search contacts
      if (includeAll || filters.includes('contact')) {
        const contactsResponse = await api.get(`/contacts?search=${searchQuery}&limit=5`);
        const contactResults: SearchResult[] = contactsResponse.data.map((contact: any) => ({
          id: contact.id,
          type: 'contact' as const,
          title: contact.name,
          subtitle: contact.email,
          description: contact.company || '',
          metadata: contact,
          icon: '👤'
        }));
        results.push(...contactResults);
      }

      // Search workflows
      if (includeAll || filters.includes('workflow')) {
        try {
          const workflowsResponse = await api.get(`/workflows?search=${searchQuery}&limit=5`);
          const workflowResults: SearchResult[] = workflowsResponse.data.map((workflow: any) => ({
            id: workflow.id,
            type: 'workflow' as const,
            title: workflow.name,
            subtitle: workflow.trigger_type,
            description: workflow.description || '',
            metadata: workflow,
            icon: '⚙️'
          }));
          results.push(...workflowResults);
        } catch (error) {
          // Workflows might not be available
        }
      }

      setResults(results);
    } catch (error) {
      setError(getErrorMessage(error, 'Search failed. Please try again.'));
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle result selection
  const handleSelect = (result: SearchResult) => {
    saveRecentSearch(query);
    setQuery('');
    setIsFocused(false);

    if (onSelect) {
      onSelect(result);
    } else {
      // Default navigation
      switch (result.type) {
        case 'inventory':
          navigate(`/inventory/${result.id}`);
          break;
        case 'job':
          navigate(`/jobs/${result.id}`);
          break;
        case 'contact':
          navigate(`/contacts/${result.id}`);
          break;
        case 'workflow':
          navigate(`/workflows/${result.id}`);
          break;
        case 'project':
          window.dispatchEvent(new CustomEvent('navigate', { detail: 'project-stages' }));
          window.dispatchEvent(new CustomEvent('open-development-project', {
            detail: { projectId: result.id }
          }));
          break;
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocused) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, results, selectedIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus event listener
  useEffect(() => {
    const handleFocusSearch = () => {
      inputRef.current?.focus();
    };

    window.addEventListener('focus-search', handleFocusSearch);
    return () => window.removeEventListener('focus-search', handleFocusSearch);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const toggleFilter = (filter: string) => {
    const newFilters = new Set(activeFilters);

    if (filter === 'all') {
      newFilters.clear();
      newFilters.add('all');
    } else {
      newFilters.delete('all');
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
      } else {
        newFilters.add(filter);
      }
      if (newFilters.size === 0) {
        newFilters.add('all');
      }
    }

    setActiveFilters(newFilters);
  };

  const showDropdown = isFocused && (results.length > 0 || query.trim().length >= 2 || recentSearches.length > 0);

  return (
    <div className="relative w-full max-w-2xl" data-search-input>
      {/* Search Input */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        {isLoading && (
          <span className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </span>
        )}
      </div>

      {/* Filters */}
      {isFocused && (
        <div className="flex gap-2 mt-2">
          {['all', 'inventory', 'job', 'contact', 'workflow'].map(filter => (
            <button
              key={filter}
              onClick={() => toggleFilter(filter)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                activeFilters.has(filter)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50"
        >
          {/* Recent Searches */}
          {query.trim().length === 0 && recentSearches.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                Recent Searches
              </div>
              {recentSearches.map((recent, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(recent);
                    performSearch(recent);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3"
                >
                  <span className="text-gray-400">🕒</span>
                  <span className="text-gray-700">{recent}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {results.length > 0 ? (
            results.map((result, idx) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                  idx === selectedIndex ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-2xl flex-shrink-0">{result.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900 truncate">{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          {result.subtitle}
                        </span>
                      )}
                    </div>
                    {result.description && (
                      <div className="text-sm text-gray-500 mt-1 truncate">
                        {result.description}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 capitalize flex-shrink-0">
                    {result.type}
                  </span>
                </div>
              </button>
            ))
          ) : query.trim().length >= 2 && !isLoading ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No results found for "{query}"
            </div>
          ) : null}

          {/* Footer */}
          {results.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span>
                  <kbd className="px-2 py-1 bg-white rounded border border-gray-300">↑↓</kbd> Navigate
                </span>
                <span>
                  <kbd className="px-2 py-1 bg-white rounded border border-gray-300">Enter</kbd> Select
                </span>
              </div>
              <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
