/**
 * Command Palette Component
 * Quick access to all actions via Cmd+K/Ctrl+K
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  action: () => void;
  keywords?: string[];
  category?: string;
  shortcut?: string;
}

interface CommandPaletteProps {
  commands?: Command[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ commands: customCommands }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default commands
  const defaultCommands: Command[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      description: 'View your overview and analytics',
      icon: '📊',
      category: 'Navigation',
      action: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }));
      },
      keywords: ['home', 'overview']
    },
    {
      id: 'nav-inventory',
      label: 'Go to Inventory',
      description: 'Manage your stock and items',
      icon: '📦',
      category: 'Navigation',
      action: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'inventory' }));
      },
      keywords: ['stock', 'items', 'products']
    },
    {
      id: 'nav-calendar',
      label: 'Go to Calendar',
      description: 'View jobs in calendar format',
      icon: '📅',
      category: 'Navigation',
      action: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'calendar' }));
      },
      keywords: ['jobs', 'schedule', 'dates']
    },
    {
      id: 'nav-job-planning',
      label: 'Go to Job Planning',
      description: 'Create and manage jobs',
      icon: '🔧',
      category: 'Navigation',
      action: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'job-planning' }));
      },
      keywords: ['work', 'tasks', 'planning', 'create job']
    },
    {
      id: 'nav-contacts',
      label: 'Go to Contacts',
      description: 'Manage suppliers and customers',
      icon: '👥',
      category: 'Navigation',
      action: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'contacts' }));
      },
      keywords: ['suppliers', 'customers', 'people']
    },
    {
      id: 'nav-ordering',
      label: 'Go to Smart Ordering',
      description: 'Manage your orders',
      icon: '🛒',
      category: 'Navigation',
      action: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'ordering' }));
      },
      keywords: ['order', 'purchase', 'buy']
    },
    {
      id: 'nav-history',
      label: 'Go to Stock History',
      description: 'View stock movements',
      icon: '📜',
      category: 'Navigation',
      action: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'history' }));
      },
      keywords: ['movements', 'log', 'history']
    },
    {
      id: 'nav-approvals',
      label: 'Go to Approvals',
      description: 'Manage approval workflows',
      icon: '✅',
      category: 'Navigation',
      action: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'approvals' }));
      },
      keywords: ['approve', 'review', 'workflow']
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      description: 'Configure application settings',
      icon: '⚙️',
      category: 'Navigation',
      action: () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'settings' }));
      },
      keywords: ['preferences', 'config', 'options']
    },

    // Actions
    {
      id: 'action-new-item',
      label: 'Create New Item',
      description: 'Add item to inventory',
      icon: '➕',
      category: 'Actions',
      action: () => {
        window.dispatchEvent(new CustomEvent('create-new-item'));
      },
      keywords: ['add', 'create', 'new', 'stock']
    },
    {
      id: 'action-new-job',
      label: 'Create New Job',
      description: 'Schedule a new job',
      icon: '📝',
      category: 'Actions',
      action: () => {
        window.dispatchEvent(new CustomEvent('create-new-job'));
      },
      keywords: ['add', 'create', 'new', 'appointment']
    },
    {
      id: 'action-new-contact',
      label: 'Add New Contact',
      description: 'Add supplier or customer',
      icon: '👤',
      category: 'Actions',
      action: () => {
        window.dispatchEvent(new CustomEvent('create-new-contact'));
      },
      keywords: ['add', 'create', 'new', 'person']
    },

    // Quick actions
    {
      id: 'quick-backup',
      label: 'Create Backup',
      description: 'Backup your database',
      icon: '💾',
      category: 'Quick Actions',
      action: () => {
        alert('Creating backup... (This would trigger backup service)');
      },
      keywords: ['save', 'export']
    },
    {
      id: 'quick-tour',
      label: 'Start Tour',
      description: 'Guided tour of features',
      icon: '🎓',
      category: 'Quick Actions',
      action: () => {
        const event = new CustomEvent('start-welcome-tour');
        window.dispatchEvent(event);
      },
      keywords: ['help', 'guide', 'tutorial', 'onboarding']
    },
    {
      id: 'quick-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all shortcuts',
      icon: '⌨️',
      category: 'Quick Actions',
      action: () => {
        const event = new CustomEvent('toggle-shortcuts-modal');
        window.dispatchEvent(event);
      },
      keywords: ['help', 'keys', 'hotkeys']
    },

    // Settings
    {
      id: 'settings-profile',
      label: 'Edit Profile',
      description: 'Update your account',
      icon: '⚙️',
      category: 'Settings',
      action: () => {
        alert('Settings feature - Coming soon!');
      },
      keywords: ['account', 'user', 'preferences']
    }
  ], []);

  const allCommands = useMemo(() => {
    return [...defaultCommands, ...(customCommands || [])];
  }, [defaultCommands, customCommands]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return allCommands;

    const searchLower = search.toLowerCase();
    return allCommands.filter(cmd => {
      const labelMatch = cmd.label.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(searchLower));
      return labelMatch || descMatch || keywordMatch;
    });
  }, [search, allCommands]);

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      const category = cmd.category || 'Other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open/close palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setSearch('');
        setSelectedIndex(0);
        return;
      }

      // Close on escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
        return;
      }

      if (!isOpen) return;

      // Navigate with arrow keys
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          selected.action();
          setIsOpen(false);
          setSearch('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex]);

  // Custom event listener
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    window.addEventListener('open-command-palette', handleOpen);
    return () => window.removeEventListener('open-command-palette', handleOpen);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-50 px-4">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">
                🔍
              </span>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a command or search..."
                className="w-full pl-12 pr-4 py-3 text-lg border-none focus:outline-none focus:ring-0"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 font-mono">
                {isMac ? '⌘K' : 'Ctrl+K'}
              </span>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No commands found
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, commands]) => (
                <div key={category}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                    {category}
                  </div>
                  {commands.map((cmd, idx) => {
                    const globalIndex = filteredCommands.indexOf(cmd);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          cmd.action();
                          setIsOpen(false);
                          setSearch('');
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full text-left px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{cmd.icon}</span>
                            <div>
                              <div className="font-medium text-gray-900">{cmd.label}</div>
                              {cmd.description && (
                                <div className="text-sm text-gray-500">{cmd.description}</div>
                              )}
                            </div>
                          </div>
                          {cmd.shortcut && (
                            <div className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded">
                              {cmd.shortcut}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span>
                <kbd className="px-2 py-1 bg-white rounded border border-gray-300">↑↓</kbd> Navigate
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white rounded border border-gray-300">Enter</kbd> Select
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white rounded border border-gray-300">Esc</kbd> Close
              </span>
            </div>
            <div>
              {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
