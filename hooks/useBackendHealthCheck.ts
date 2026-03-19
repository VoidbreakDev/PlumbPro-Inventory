import { useEffect } from 'react';

interface ToastLike {
  warning: (message: string, title?: string) => void;
}

export interface BackendHealthCheckOptions {
  apiRootUrl: string;
  defaultBackendPort: number;
  hasExplicitApiUrl: boolean;
  toast: ToastLike;
}

/**
 * Shows the current API configuration warning and validates the backend health
 * endpoint on mount.
 */
export function useBackendHealthCheck({
  apiRootUrl,
  defaultBackendPort,
  hasExplicitApiUrl,
  toast
}: BackendHealthCheckOptions) {
  useEffect(() => {
    if (!hasExplicitApiUrl && window.location.port !== `${defaultBackendPort}`) {
      toast.warning(
        `VITE_API_URL is not set. The app is using the default API at ${apiRootUrl}. Set VITE_API_URL in your .env file if your backend runs elsewhere.`,
        'API configuration'
      );
    }
  }, [apiRootUrl, defaultBackendPort, hasExplicitApiUrl, toast]);

  useEffect(() => {
    const controller = new AbortController();

    const checkHealth = async () => {
      try {
        const response = await fetch(`${apiRootUrl}/health`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        toast.warning(
          `Backend health check failed for ${apiRootUrl}. Confirm the server is running and VITE_API_URL is correct.`,
          'Backend connection'
        );
      }
    };

    void checkHealth();

    return () => {
      controller.abort();
    };
  }, [apiRootUrl, toast]);
}

