import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { NavTab } from '../components/Navigation';
import { addSkipLink } from '../lib/accessibility';
import { clearAuthSession, getAuthToken, getStoredUser } from '../lib/authSession';
import { logger } from '../lib/logging';
import { onboardingService, tours } from '../lib/onboardingService';
import useStore from '../store/useStore';

export interface AppBootstrapOptions {
  syncWithServer?: () => Promise<void>;
  enableAuthBootstrap?: boolean;
  enableDataSyncOnMount?: boolean;
  enableUiBootstrap?: boolean;
  onNavigate?: Dispatch<SetStateAction<NavTab>>;
  onOpenNewJobModal?: Dispatch<SetStateAction<boolean>>;
  onOpenStockTransferModal?: Dispatch<SetStateAction<boolean>>;
}

/**
 * Centralizes app startup work so App.tsx can stay focused on composition.
 * Each flag enables a small slice of the bootstrap lifecycle.
 */
export function useAppBootstrap({
  syncWithServer,
  enableAuthBootstrap = false,
  enableDataSyncOnMount = false,
  enableUiBootstrap = false,
  onNavigate,
  onOpenNewJobModal,
  onOpenStockTransferModal
}: AppBootstrapOptions) {
  useEffect(() => {
    if (!enableAuthBootstrap || !syncWithServer) {
      return;
    }

    const token = getAuthToken();
    const user = getStoredUser();

    if (token && user) {
      try {
        useStore.getState().setUser(user, token);
        void syncWithServer();
      } catch (error) {
        console.error('Failed to restore auth session:', error);
        clearAuthSession();
      }
    }
  }, [enableAuthBootstrap, syncWithServer]);

  useEffect(() => {
    if (!enableDataSyncOnMount || !syncWithServer) {
      return;
    }

    const loadData = async () => {
      try {
        await syncWithServer();
      } catch (error) {
        logger.error('Failed to sync data on mount:', error);
      }
    };

    void loadData();
  }, [enableDataSyncOnMount, syncWithServer]);

  useEffect(() => {
    if (!enableUiBootstrap || !onNavigate || !onOpenNewJobModal || !onOpenStockTransferModal) {
      return;
    }

    addSkipLink('main-content', 'Skip to main content');

    let welcomeTourTimer: ReturnType<typeof setTimeout> | null = null;
    if (!onboardingService.hasCompletedTour('welcome')) {
      welcomeTourTimer = setTimeout(() => {
        onboardingService.startTour(tours.welcome);
      }, 1000);
    }

    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<NavTab>;
      onNavigate(customEvent.detail);
    };

    const handleCreateNewItem = () => {
      onNavigate('inventory');
    };

    const handleCreateNewJob = () => {
      onOpenNewJobModal(true);
    };

    const handleCreateNewContact = () => {
      onNavigate('contacts');
    };

    const handleTransferStock = () => {
      onOpenStockTransferModal(true);
    };

    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('create-new-item', handleCreateNewItem);
    window.addEventListener('create-new-job', handleCreateNewJob);
    window.addEventListener('create-new-contact', handleCreateNewContact);
    window.addEventListener('transfer-stock', handleTransferStock);

    return () => {
      if (welcomeTourTimer) {
        clearTimeout(welcomeTourTimer);
      }

      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('create-new-item', handleCreateNewItem);
      window.removeEventListener('create-new-job', handleCreateNewJob);
      window.removeEventListener('create-new-contact', handleCreateNewContact);
      window.removeEventListener('transfer-stock', handleTransferStock);
    };
  }, [
    enableUiBootstrap,
    onNavigate,
    onOpenNewJobModal,
    onOpenStockTransferModal
  ]);
}
