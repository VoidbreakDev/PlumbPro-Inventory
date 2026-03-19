import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface ResponsiveShellState {
  isMobile: boolean;
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

/**
 * Tracks the shell state that changes with viewport size.
 * The sidebar stays user-controlled; we only detect mobile vs desktop here.
 */
export function useResponsiveShell(initialSidebarOpen = true): ResponsiveShellState {
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialSidebarOpen);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return { isMobile, isSidebarOpen, setIsSidebarOpen };
}
