import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2 } from 'lucide-react';

interface TitleBarProps {
  title?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title = 'PlumbPro Inventory' }) => {
  const [isElectron, setIsElectron] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    const electronAPI = (window as any).electronAPI;
    setIsElectron(!!electronAPI);
    
    if (electronAPI) {
      setIsMac(electronAPI.getPlatform?.() === 'darwin');
    }
  }, []);

  // Don't show title bar if not in Electron
  if (!isElectron) return null;

  const handleMinimize = () => {
    (window as any).electronAPI?.minimize?.();
  };

  const handleMaximize = () => {
    (window as any).electronAPI?.maximize?.();
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    (window as any).electronAPI?.close?.();
  };

  // On macOS, we only need the drag region since window controls are on the left
  // On Windows/Linux, we need drag region + window controls on the right
  return (
    <div 
      className="h-9 bg-slate-900 dark:bg-slate-950 flex items-center justify-between select-none shrink-0 z-50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left section - Window title (centered on macOS, left on Windows) */}
      <div className={`flex items-center ${isMac ? 'flex-1 justify-center' : 'pl-4'}`}>
        <span className="text-xs font-medium text-slate-400 truncate">
          {title}
        </span>
      </div>

      {/* Right section - Window controls (only on non-macOS) */}
      {!isMac && (
        <div 
          className="flex items-center h-full"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            className="h-full px-4 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleMaximize}
            className="h-full px-4 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="h-full px-4 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* On macOS, add empty right section to balance the layout */}
      {isMac && <div className="w-20" />}
    </div>
  );
};

export default TitleBar;
