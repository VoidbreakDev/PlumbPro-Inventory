export interface StandardApiError {
  error: string;
  code: string;
  details?: unknown;
}

export const isStandardApiError = (data: unknown): data is StandardApiError =>
  typeof data === 'object' && data !== null && 'error' in data && 'code' in data;

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const apiError = error as {
      response?: { data?: { error?: string; code?: string; details?: string; message?: string } };
      message?: string;
    };

    return (
      apiError.response?.data?.error ||
      apiError.response?.data?.details ||
      apiError.response?.data?.message ||
      apiError.message ||
      fallback
    );
  }

  return fallback;
};

export const getErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === 'object') {
    const apiError = error as { response?: { data?: { code?: string } } };
    return apiError.response?.data?.code;
  }
  return undefined;
};

export const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  if (error && typeof error === 'object') {
    return {
      ...error
    };
  }

  return {
    message: String(error)
  };
};
