/**
 * Onboarding Tour Service
 * Guides new users through the application with interactive tours
 */

export interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void;
  beforeShow?: () => void;
  afterShow?: () => void;
}

export interface Tour {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
  autoStart?: boolean;
  onComplete?: () => void;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

class OnboardingService {
  private currentTour: Tour | null = null;
  private currentStepIndex: number = 0;
  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private completedTours: Set<string> = new Set();

  constructor() {
    this.loadCompletedTours();
  }

  /**
   * Load completed tours from localStorage
   */
  private loadCompletedTours() {
    try {
      const completed = localStorage.getItem('plumbpro_completed_tours');
      if (completed) {
        const parsed = JSON.parse(completed);
        if (Array.isArray(parsed)) {
          this.completedTours = new Set(parsed.filter(item => typeof item === 'string'));
        }
      }
    } catch (error) {
      console.warn('Failed to load completed tours from localStorage:', error);
      this.completedTours = new Set();
    }
  }

  /**
   * Save completed tours to localStorage
   */
  private saveCompletedTours() {
    localStorage.setItem(
      'plumbpro_completed_tours',
      JSON.stringify(Array.from(this.completedTours))
    );
  }

  /**
   * Check if user has completed a tour
   */
  hasCompletedTour(tourId: string): boolean {
    return this.completedTours.has(tourId);
  }

  /**
   * Mark tour as completed
   */
  markTourCompleted(tourId: string) {
    this.completedTours.add(tourId);
    this.saveCompletedTours();
  }

  /**
   * Reset all tours (for testing or re-onboarding)
   */
  resetTours() {
    this.completedTours.clear();
    localStorage.removeItem('plumbpro_completed_tours');
  }

  /**
   * Start a tour
   */
  startTour(tour: Tour) {
    if (this.currentTour) {
      this.endTour();
    }

    this.currentTour = tour;
    this.currentStepIndex = 0;
    this.createOverlay();
    this.showStep(0);
  }

  /**
   * Create overlay element
   */
  private createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(this.overlay);
  }

  /**
   * Show a specific step
   */
  private showStep(index: number) {
    if (!this.currentTour || index >= this.currentTour.steps.length) {
      this.endTour();
      return;
    }

    const step = this.currentTour.steps[index];

    // Execute before show callback
    if (step.beforeShow) {
      step.beforeShow();
    }

    // Find target element
    const targetElement = document.querySelector(step.target);
    if (!targetElement) {
      console.warn(`Onboarding: Target element not found: ${step.target}`);
      this.nextStep();
      return;
    }

    // Highlight target element
    this.highlightElement(targetElement as HTMLElement);

    // Create tooltip
    this.createTooltip(step, targetElement as HTMLElement);

    // Execute action if provided
    if (step.action) {
      step.action();
    }

    // Execute after show callback
    if (step.afterShow) {
      step.afterShow();
    }
  }

  /**
   * Highlight target element
   */
  private highlightElement(element: HTMLElement) {
    // Remove previous highlights
    document.querySelectorAll('.onboarding-highlight').forEach(el => {
      el.classList.remove('onboarding-highlight');
    });

    // Add highlight class
    element.classList.add('onboarding-highlight');

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add CSS for highlight
    if (!document.getElementById('onboarding-styles')) {
      const style = document.createElement('style');
      style.id = 'onboarding-styles';
      style.textContent = `
        .onboarding-highlight {
          position: relative;
          z-index: 9999 !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5) !important;
          border-radius: 8px;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Create tooltip for step
   */
  private createTooltip(step: TourStep, targetElement: HTMLElement) {
    // Remove previous tooltip
    if (this.tooltip) {
      this.tooltip.remove();
    }

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'onboarding-tooltip';
    this.tooltip.style.cssText = `
      position: absolute;
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      padding: 20px;
      max-width: 400px;
      z-index: 10000;
    `;

    const stepNumber = this.currentStepIndex + 1;
    const totalSteps = this.currentTour!.steps.length;

    // SECURITY: Escape HTML to prevent XSS attacks
    const safeTitle = escapeHtml(step.title);
    const safeContent = escapeHtml(step.content);

    this.tooltip.innerHTML = `
      <div style="margin-bottom: 12px; font-size: 12px; color: #6b7280; font-weight: 500;">
        STEP ${stepNumber} OF ${totalSteps}
      </div>
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #111827;">
        ${safeTitle}
      </h3>
      <p style="margin: 0 0 20px 0; color: #4b5563; line-height: 1.6;">
        ${safeContent}
      </p>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button id="onboarding-skip" style="
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          font-size: 14px;
          padding: 8px 12px;
        ">Skip Tour</button>
        <div style="display: flex; gap: 8px;">
          ${stepNumber > 1 ? `
            <button id="onboarding-back" style="
              background: #f3f4f6;
              border: none;
              border-radius: 6px;
              color: #374151;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              padding: 8px 16px;
            ">Back</button>
          ` : ''}
          <button id="onboarding-next" style="
            background: #3b82f6;
            border: none;
            border-radius: 6px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            padding: 8px 16px;
          ">${stepNumber === totalSteps ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.tooltip);

    // Position tooltip
    this.positionTooltip(targetElement, step.placement || 'bottom');

    // Add event listeners
    const skipBtn = this.tooltip.querySelector('#onboarding-skip');
    const backBtn = this.tooltip.querySelector('#onboarding-back');
    const nextBtn = this.tooltip.querySelector('#onboarding-next');

    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.skipTour());
    }
    if (backBtn) {
      backBtn.addEventListener('click', () => this.previousStep());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextStep());
    }
  }

  /**
   * Position tooltip relative to target
   */
  private positionTooltip(targetElement: HTMLElement, placement: string) {
    if (!this.tooltip) return;

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const padding = 20;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = targetRect.top - tooltipRect.height - padding;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - padding;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + padding;
        break;
    }

    // Keep tooltip within viewport
    const maxLeft = window.innerWidth - tooltipRect.width - padding;
    const maxTop = window.innerHeight - tooltipRect.height - padding;

    left = Math.max(padding, Math.min(left, maxLeft));
    top = Math.max(padding, Math.min(top, maxTop));

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }

  /**
   * Go to next step
   */
  nextStep() {
    this.currentStepIndex++;
    if (this.currentTour && this.currentStepIndex < this.currentTour.steps.length) {
      this.showStep(this.currentStepIndex);
    } else {
      this.completeTour();
    }
  }

  /**
   * Go to previous step
   */
  previousStep() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.showStep(this.currentStepIndex);
    }
  }

  /**
   * Skip current tour
   */
  skipTour() {
    this.endTour();
  }

  /**
   * Complete current tour
   */
  private completeTour() {
    if (this.currentTour) {
      this.markTourCompleted(this.currentTour.id);

      if (this.currentTour.onComplete) {
        this.currentTour.onComplete();
      }
    }

    this.endTour();
  }

  /**
   * End current tour and cleanup
   */
  private endTour() {
    // Remove highlight
    document.querySelectorAll('.onboarding-highlight').forEach(el => {
      el.classList.remove('onboarding-highlight');
    });

    // Remove overlay
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    // Remove tooltip
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }

    this.currentTour = null;
    this.currentStepIndex = 0;
  }
}

// Export singleton instance
export const onboardingService = new OnboardingService();

// Pre-defined tours
export const tours: Record<string, Tour> = {
  welcome: {
    id: 'welcome',
    name: 'Welcome Tour',
    description: 'Get started with PlumbPro Inventory',
    autoStart: true,
    steps: [
      {
        target: 'body',
        title: 'Welcome to PlumbPro Inventory!',
        content: 'Let\'s take a quick tour to help you get started. This will only take a minute.',
        placement: 'bottom'
      },
      {
        target: '[data-tour="inventory"]',
        title: 'Inventory Management',
        content: 'Track all your stock levels, reorder points, and supplier information here.',
        placement: 'right'
      },
      {
        target: '[data-tour="jobs"]',
        title: 'Job Scheduling',
        content: 'Create jobs, assign workers, and allocate materials all in one place.',
        placement: 'right'
      },
      {
        target: '[data-tour="workflows"]',
        title: 'Workflow Automation',
        content: 'Automate repetitive tasks like reordering stock and notifying customers.',
        placement: 'right'
      },
      {
        target: '[data-tour="search"]',
        title: 'Quick Search',
        content: 'Use Cmd+K (Mac) or Ctrl+K (Windows) to quickly search anything.',
        placement: 'bottom'
      },
      {
        target: '[data-tour="notifications"]',
        title: 'Notifications',
        content: 'Stay updated with alerts for low stock, job updates, and more.',
        placement: 'left'
      }
    ],
    onComplete: () => {
      console.log('Welcome tour completed!');
    }
  },

  inventory: {
    id: 'inventory',
    name: 'Inventory Management Tour',
    description: 'Learn how to manage your inventory',
    steps: [
      {
        target: '[data-tour="add-item"]',
        title: 'Add New Items',
        content: 'Click here to add new items to your inventory. You can set stock levels, pricing, and supplier information.',
        placement: 'bottom'
      },
      {
        target: '[data-tour="item-list"]',
        title: 'Your Inventory',
        content: 'View all your items here. Click on any item to see details or make changes.',
        placement: 'top'
      },
      {
        target: '[data-tour="low-stock"]',
        title: 'Low Stock Alerts',
        content: 'Items below their reorder level are highlighted. Set up workflows to automate reordering!',
        placement: 'right'
      },
      {
        target: '[data-tour="export"]',
        title: 'Export Data',
        content: 'Export your inventory to CSV or Excel for reporting and analysis.',
        placement: 'left'
      }
    ]
  },

  workflows: {
    id: 'workflows',
    name: 'Workflow Automation Tour',
    description: 'Automate your business processes',
    steps: [
      {
        target: '[data-tour="workflow-templates"]',
        title: 'Start with Templates',
        content: 'We\'ve created 12 pre-built workflow templates for common tasks.',
        placement: 'right'
      },
      {
        target: '[data-tour="create-workflow"]',
        title: 'Create Custom Workflows',
        content: 'Build your own workflows with triggers and actions tailored to your business.',
        placement: 'bottom'
      },
      {
        target: '[data-tour="workflow-stats"]',
        title: 'Monitor Performance',
        content: 'Track how your workflows are performing with detailed analytics.',
        placement: 'top'
      }
    ]
  }
};

export default onboardingService;
