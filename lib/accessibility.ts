/**
 * Accessibility Utilities
 * WCAG 2.1 AA/AAA compliance helpers
 */

/**
 * Generate unique ID for accessibility
 */
export function generateA11yId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Announce message to screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const liveRegion = getLiveRegion(priority);
  liveRegion.textContent = message;

  // Clear after announcement
  setTimeout(() => {
    liveRegion.textContent = '';
  }, 1000);
}

/**
 * Get or create ARIA live region
 */
function getLiveRegion(priority: 'polite' | 'assertive'): HTMLElement {
  const id = `a11y-live-${priority}`;
  let region = document.getElementById(id);

  if (!region) {
    region = document.createElement('div');
    region.id = id;
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only'; // Screen reader only
    document.body.appendChild(region);

    // Add CSS for screen reader only
    if (!document.getElementById('a11y-sr-only-styles')) {
      const style = document.createElement('style');
      style.id = 'a11y-sr-only-styles';
      style.textContent = `
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      `;
      document.head.appendChild(style);
    }
  }

  return region;
}

/**
 * Check if element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false;

  const tagName = element.tagName.toLowerCase();
  const focusableTags = ['a', 'button', 'input', 'select', 'textarea'];

  if (focusableTags.includes(tagName)) {
    return !element.hasAttribute('disabled');
  }

  return element.tabIndex >= 0;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  return Array.from(container.querySelectorAll(selector));
}

/**
 * Trap focus within an element (for modals, dialogs)
 */
export class FocusTrap {
  private container: HTMLElement;
  private focusableElements: HTMLElement[];
  private firstFocusable: HTMLElement | null = null;
  private lastFocusable: HTMLElement | null = null;
  private previouslyFocused: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.focusableElements = getFocusableElements(container);

    if (this.focusableElements.length > 0) {
      this.firstFocusable = this.focusableElements[0];
      this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];
    }
  }

  activate() {
    this.previouslyFocused = document.activeElement as HTMLElement;

    // Focus first element
    if (this.firstFocusable) {
      this.firstFocusable.focus();
    }

    // Add event listener
    this.container.addEventListener('keydown', this.handleKeyDown);
  }

  deactivate() {
    this.container.removeEventListener('keydown', this.handleKeyDown);

    // Restore focus
    if (this.previouslyFocused) {
      this.previouslyFocused.focus();
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault();
        this.lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault();
        this.firstFocusable?.focus();
      }
    }
  };
}

/**
 * Check color contrast ratio (WCAG 2.1)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance(color: string): number {
  const rgb = parseColor(color);
  const [r, g, b] = rgb.map(channel => {
    const sRGB = channel / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseColor(color: string): [number, number, number] {
  // Simple RGB parser (extend as needed)
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  }

  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
    }
  }

  return [0, 0, 0];
}

/**
 * Check if contrast meets WCAG standards
 */
export function meetsContrastStandard(
  color1: string,
  color2: string,
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): boolean {
  const ratio = getContrastRatio(color1, color2);

  if (level === 'AAA') {
    return size === 'large' ? ratio >= 4.5 : ratio >= 7;
  }

  return size === 'large' ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Keyboard navigation helpers
 */
export const KeyboardNav = {
  /**
   * Handle arrow key navigation in a list
   */
  handleArrowKeys(
    e: KeyboardEvent,
    currentIndex: number,
    totalItems: number,
    onIndexChange: (newIndex: number) => void,
    options: {
      vertical?: boolean;
      horizontal?: boolean;
      wrap?: boolean;
    } = {}
  ) {
    const { vertical = true, horizontal = false, wrap = true } = options;

    let newIndex = currentIndex;

    if (vertical) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = currentIndex + 1;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = currentIndex - 1;
      }
    }

    if (horizontal) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        newIndex = currentIndex + 1;
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        newIndex = currentIndex - 1;
      }
    }

    if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = totalItems - 1;
    }

    // Handle wrapping
    if (wrap) {
      if (newIndex < 0) newIndex = totalItems - 1;
      if (newIndex >= totalItems) newIndex = 0;
    } else {
      newIndex = Math.max(0, Math.min(newIndex, totalItems - 1));
    }

    if (newIndex !== currentIndex) {
      onIndexChange(newIndex);
    }
  }
};

/**
 * Reduce motion check (respects user preferences)
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Add skip link for keyboard users
 */
export function addSkipLink(targetId: string, label: string = 'Skip to main content') {
  if (document.getElementById('skip-link')) return;

  const skipLink = document.createElement('a');
  skipLink.id = 'skip-link';
  skipLink.href = `#${targetId}`;
  skipLink.textContent = label;
  skipLink.className = 'skip-link';

  // Add styles
  if (!document.getElementById('skip-link-styles')) {
    const style = document.createElement('style');
    style.id = 'skip-link-styles';
    style.textContent = `
      .skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: #000;
        color: #fff;
        padding: 8px;
        text-decoration: none;
        z-index: 10000;
      }
      .skip-link:focus {
        top: 0;
      }
    `;
    document.head.appendChild(style);
  }

  document.body.insertBefore(skipLink, document.body.firstChild);
}

/**
 * ARIA helpers
 */
export const ARIA = {
  /**
   * Create described-by relationship
   */
  describeElement(element: HTMLElement, descriptionId: string) {
    const existing = element.getAttribute('aria-describedby');
    if (existing) {
      if (!existing.includes(descriptionId)) {
        element.setAttribute('aria-describedby', `${existing} ${descriptionId}`);
      }
    } else {
      element.setAttribute('aria-describedby', descriptionId);
    }
  },

  /**
   * Create labelled-by relationship
   */
  labelElement(element: HTMLElement, labelId: string) {
    element.setAttribute('aria-labelledby', labelId);
  },

  /**
   * Set expanded state
   */
  setExpanded(element: HTMLElement, expanded: boolean) {
    element.setAttribute('aria-expanded', String(expanded));
  },

  /**
   * Set selected state
   */
  setSelected(element: HTMLElement, selected: boolean) {
    element.setAttribute('aria-selected', String(selected));
  },

  /**
   * Set disabled state
   */
  setDisabled(element: HTMLElement, disabled: boolean) {
    element.setAttribute('aria-disabled', String(disabled));
    if (disabled) {
      element.setAttribute('tabindex', '-1');
    } else {
      element.removeAttribute('tabindex');
    }
  }
};

/**
 * Form accessibility helpers
 */
export const FormA11y = {
  /**
   * Associate label with input
   */
  associateLabel(input: HTMLInputElement, label: HTMLLabelElement) {
    const id = input.id || generateA11yId('input');
    input.id = id;
    label.setAttribute('for', id);
  },

  /**
   * Add error message to input
   */
  addError(input: HTMLInputElement, errorMessage: string, errorId?: string) {
    const id = errorId || generateA11yId('error');
    input.setAttribute('aria-invalid', 'true');
    ARIA.describeElement(input, id);
    announce(`Error: ${errorMessage}`, 'assertive');
  },

  /**
   * Remove error from input
   */
  removeError(input: HTMLInputElement, errorId?: string) {
    input.setAttribute('aria-invalid', 'false');
    if (errorId) {
      const existing = input.getAttribute('aria-describedby');
      if (existing) {
        const updated = existing.split(' ').filter(id => id !== errorId).join(' ');
        if (updated) {
          input.setAttribute('aria-describedby', updated);
        } else {
          input.removeAttribute('aria-describedby');
        }
      }
    }
  }
};

export default {
  generateA11yId,
  announce,
  isFocusable,
  getFocusableElements,
  FocusTrap,
  getContrastRatio,
  meetsContrastStandard,
  KeyboardNav,
  prefersReducedMotion,
  addSkipLink,
  ARIA,
  FormA11y
};
