/**
 * Keyboard Shortcuts System
 * Global keyboard shortcuts for efficient navigation and actions
 */

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean; // Cmd on Mac, Win on Windows
  description: string;
  action: (event?: KeyboardEvent) => void;
  category?: string;
  enabled?: boolean;
}

class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private enabled: boolean = true;
  private modalOpen: boolean = false;

  constructor() {
    this.registerDefaultShortcuts();
    this.attachListener();
  }

  /**
   * Register default keyboard shortcuts
   */
  private registerDefaultShortcuts() {
    // Navigation
    this.register({
      key: 'k',
      meta: true,
      ctrl: true,
      description: 'Open command palette',
      category: 'Navigation',
      action: () => this.openCommandPalette()
    });

    this.register({
      key: 'i',
      meta: true,
      ctrl: true,
      description: 'Go to Inventory',
      category: 'Navigation',
      action: () => this.navigateTo('/inventory')
    });

    this.register({
      key: 'j',
      meta: true,
      ctrl: true,
      description: 'Go to Jobs',
      category: 'Navigation',
      action: () => this.navigateTo('/jobs')
    });

    this.register({
      key: 'c',
      meta: true,
      ctrl: true,
      description: 'Go to Contacts',
      category: 'Navigation',
      action: () => this.navigateTo('/contacts')
    });

    this.register({
      key: 'w',
      meta: true,
      ctrl: true,
      description: 'Go to Workflows',
      category: 'Navigation',
      action: () => this.navigateTo('/workflows')
    });

    this.register({
      key: 'a',
      meta: true,
      ctrl: true,
      description: 'Go to Analytics',
      category: 'Navigation',
      action: () => this.navigateTo('/analytics')
    });

    // Actions
    this.register({
      key: 'n',
      meta: true,
      ctrl: true,
      description: 'Create new item/job (context-aware)',
      category: 'Actions',
      action: () => this.createNew()
    });

    this.register({
      key: 's',
      meta: true,
      ctrl: true,
      description: 'Save current form',
      category: 'Actions',
      action: (e) => {
        e?.preventDefault();
        this.saveForm();
      }
    });

    this.register({
      key: 'f',
      meta: true,
      ctrl: true,
      description: 'Focus search',
      category: 'Actions',
      action: () => this.focusSearch()
    });

    // Help
    this.register({
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      category: 'Help',
      action: () => this.showShortcutsModal()
    });

    this.register({
      key: 'h',
      meta: true,
      ctrl: true,
      description: 'Open help',
      category: 'Help',
      action: () => this.openHelp()
    });

    // Escape
    this.register({
      key: 'Escape',
      description: 'Close modal/dialog',
      category: 'General',
      action: () => this.closeModal()
    });
  }

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut) {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, { ...shortcut, enabled: true });
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(key: string) {
    this.shortcuts.delete(key);
  }

  /**
   * Generate unique key for shortcut
   */
  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.alt) parts.push('alt');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.meta) parts.push('meta');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  /**
   * Attach keyboard event listener
   */
  private attachListener() {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.enabled) return;

      // Don't trigger shortcuts when typing in input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow certain shortcuts even in inputs
        if (!(e.key === 'Escape' || (e.key === 's' && (e.metaKey || e.ctrlKey)))) {
          return;
        }
      }

      const shortcut = this.findMatchingShortcut(e);
      if (shortcut && shortcut.enabled) {
        e.preventDefault();
        shortcut.action();
      }
    });
  }

  /**
   * Find matching shortcut for keyboard event
   */
  private findMatchingShortcut(e: KeyboardEvent): KeyboardShortcut | undefined {
    for (const [_, shortcut] of this.shortcuts) {
      const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

      if (ctrlMatch && altMatch && shiftMatch && metaMatch && keyMatch) {
        return shortcut;
      }
    }
    return undefined;
  }

  /**
   * Enable/disable all shortcuts
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Get all registered shortcuts
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
    const byCategory: Record<string, KeyboardShortcut[]> = {};

    for (const shortcut of this.shortcuts.values()) {
      const category = shortcut.category || 'Other';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(shortcut);
    }

    return byCategory;
  }

  /**
   * Format shortcut for display
   */
  formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
    if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
    if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
    if (shortcut.meta) parts.push(isMac ? '⌘' : 'Win');

    const keyDisplay = shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase();
    parts.push(keyDisplay);

    return parts.join(isMac ? '' : '+');
  }

  // Action implementations
  private openCommandPalette() {
    const event = new CustomEvent('open-command-palette');
    window.dispatchEvent(event);
  }

  private navigateTo(path: string) {
    window.location.hash = path;
  }

  private createNew() {
    const event = new CustomEvent('create-new');
    window.dispatchEvent(event);
  }

  private saveForm() {
    const event = new CustomEvent('save-form');
    window.dispatchEvent(event);
  }

  private focusSearch() {
    const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
    if (searchInput) {
      searchInput.focus();
    }
  }

  private showShortcutsModal() {
    this.modalOpen = !this.modalOpen;
    const event = new CustomEvent('toggle-shortcuts-modal');
    window.dispatchEvent(event);
  }

  private openHelp() {
    const event = new CustomEvent('open-help');
    window.dispatchEvent(event);
  }

  private closeModal() {
    const event = new CustomEvent('close-modal');
    window.dispatchEvent(event);
  }
}

// Export singleton
export const keyboardShortcuts = new KeyboardShortcutManager();

/**
 * React Hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    category?: string;
    description?: string;
  } = {}
) {
  const shortcut: KeyboardShortcut = {
    key,
    ctrl: options.ctrl,
    alt: options.alt,
    shift: options.shift,
    meta: options.meta,
    description: options.description || '',
    category: options.category,
    action: callback
  };

  // Register on mount, unregister on unmount
  const shortcutKey = [
    options.ctrl && 'ctrl',
    options.alt && 'alt',
    options.shift && 'shift',
    options.meta && 'meta',
    key.toLowerCase()
  ].filter(Boolean).join('+');

  keyboardShortcuts.register(shortcut);

  return () => {
    keyboardShortcuts.unregister(shortcutKey);
  };
}

export default keyboardShortcuts;
