/**
 * Contextual Help & Tooltip Components
 * Inline help, tooltips, and contextual documentation
 */

import React, { useState, useRef, useEffect, ReactNode } from 'react';

// Tooltip Component
interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  delay = 200,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updatePosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 8;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - padding;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + padding;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - padding;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + padding;
        break;
    }

    setPosition({ top, left });
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={className}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg max-w-xs"
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
          role="tooltip"
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
              placement === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' :
              placement === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' :
              placement === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' :
              'left-[-4px] top-1/2 -translate-y-1/2'
            }`}
          />
        </div>
      )}
    </div>
  );
};

// Help Icon
interface HelpIconProps {
  content: string | ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

export const HelpIcon: React.FC<HelpIconProps> = ({
  content,
  placement = 'top',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-5 h-5 text-sm',
    lg: 'w-6 h-6 text-base'
  };

  return (
    <Tooltip content={content} placement={placement}>
      <div className={`inline-flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 cursor-help transition-colors ${sizeClasses[size]}`}>
        ?
      </div>
    </Tooltip>
  );
};

// Info Callout
interface InfoCalloutProps {
  type?: 'info' | 'tip' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const InfoCallout: React.FC<InfoCalloutProps> = ({
  type = 'info',
  title,
  children,
  dismissible = false,
  onDismiss
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) return null;

  const styles = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'ℹ️',
      iconBg: 'bg-blue-100',
      title: 'text-blue-900',
      text: 'text-blue-800'
    },
    tip: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: '💡',
      iconBg: 'bg-green-100',
      title: 'text-green-900',
      text: 'text-green-800'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: '⚠️',
      iconBg: 'bg-yellow-100',
      title: 'text-yellow-900',
      text: 'text-yellow-800'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: '❌',
      iconBg: 'bg-red-100',
      title: 'text-red-900',
      text: 'text-red-800'
    }
  };

  const style = styles[type];

  return (
    <div className={`${style.bg} ${style.border} border rounded-lg p-4`}>
      <div className="flex items-start space-x-3">
        <div className={`${style.iconBg} rounded-full p-2 flex-shrink-0`}>
          <span className="text-lg">{style.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`font-semibold ${style.title} mb-1`}>{title}</h4>
          )}
          <div className={`text-sm ${style.text}`}>{children}</div>
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// Inline Help
interface InlineHelpProps {
  children: ReactNode;
  className?: string;
}

export const InlineHelp: React.FC<InlineHelpProps> = ({ children, className = '' }) => {
  return (
    <p className={`text-sm text-gray-600 mt-1 ${className}`}>
      {children}
    </p>
  );
};

// Help Panel (expandable)
interface HelpPanelProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({
  title,
  children,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <span className="text-blue-600">ℹ️</span>
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-4 py-3 bg-white text-sm text-gray-700">
          {children}
        </div>
      )}
    </div>
  );
};

// Field Label with Help
interface FieldLabelProps {
  label: string;
  helpText?: string;
  required?: boolean;
  htmlFor?: string;
}

export const FieldLabel: React.FC<FieldLabelProps> = ({
  label,
  helpText,
  required = false,
  htmlFor
}) => {
  return (
    <div className="mb-2">
      <label htmlFor={htmlFor} className="flex items-center space-x-2 text-sm font-medium text-gray-700">
        <span>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </span>
        {helpText && <HelpIcon content={helpText} size="sm" />}
      </label>
    </div>
  );
};

// Quick Tips
interface QuickTipProps {
  tips: string[];
  title?: string;
}

export const QuickTips: React.FC<QuickTipProps> = ({
  tips,
  title = 'Quick Tips'
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center space-x-2 mb-3">
        <span className="text-2xl">💡</span>
        <h4 className="font-semibold text-blue-900">{title}</h4>
      </div>
      <ul className="space-y-2">
        {tips.map((tip, index) => (
          <li key={index} className="flex items-start space-x-2 text-sm text-blue-800">
            <span className="text-blue-600 mt-0.5">→</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Keyboard Shortcut Hint
interface KeyboardHintProps {
  keys: string[];
  description?: string;
}

export const KeyboardHint: React.FC<KeyboardHintProps> = ({ keys, description }) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const formatKey = (key: string) => {
    const replacements: Record<string, string> = {
      'cmd': isMac ? '⌘' : 'Ctrl',
      'ctrl': isMac ? '⌃' : 'Ctrl',
      'alt': isMac ? '⌥' : 'Alt',
      'shift': isMac ? '⇧' : 'Shift'
    };
    return replacements[key.toLowerCase()] || key.toUpperCase();
  };

  return (
    <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
      <div className="flex items-center space-x-1">
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
              {formatKey(key)}
            </kbd>
            {index < keys.length - 1 && <span>+</span>}
          </React.Fragment>
        ))}
      </div>
      {description && <span>{description}</span>}
    </div>
  );
};

// Feature Highlight
interface FeatureHighlightProps {
  title: string;
  description: string;
  icon?: string;
  badge?: string;
  onDismiss?: () => void;
}

export const FeatureHighlight: React.FC<FeatureHighlightProps> = ({
  title,
  description,
  icon = '✨',
  badge,
  onDismiss
}) => {
  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="text-3xl">{icon}</div>
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-semibold text-purple-900">{title}</h4>
              {badge && (
                <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-medium rounded-full">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-sm text-purple-800">{description}</p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-purple-400 hover:text-purple-600"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default {
  Tooltip,
  HelpIcon,
  InfoCallout,
  InlineHelp,
  HelpPanel,
  FieldLabel,
  QuickTips,
  KeyboardHint,
  FeatureHighlight
};
