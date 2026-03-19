import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TechnicianPerformanceView } from '../../views/TechnicianPerformanceView';

const { analyticsApiMock, setErrorMock } = vi.hoisted(() => ({
  analyticsApiMock: {
    getWorkerPerformance: vi.fn()
  },
  setErrorMock: vi.fn()
}));

vi.mock('../../lib/analyticsAPI', () => ({
  analyticsAPI: analyticsApiMock
}));

vi.mock('../../store/useStore', () => ({
  useStore: (selector: (state: { setError: typeof setErrorMock }) => unknown) =>
    selector({ setError: setErrorMock })
}));

describe('TechnicianPerformanceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders live worker performance metrics from analytics', async () => {
    analyticsApiMock.getWorkerPerformance.mockResolvedValue({
      workers: [
        {
          id: 'worker-1',
          name: 'Taylor Tech',
          totalJobs: 12,
          completedJobs: 10,
          inProgressJobs: 2,
          totalMaterialsHandled: 48,
          completionRate: 83.3
        }
      ]
    });

    render(<TechnicianPerformanceView />);

    expect(await screen.findAllByText('Taylor Tech')).toHaveLength(3);
    expect(screen.getByText('Top Performer')).toBeInTheDocument();
    expect(screen.getAllByText('83.3%').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(analyticsApiMock.getWorkerPerformance).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the empty state when no technician activity exists in the selected period', async () => {
    analyticsApiMock.getWorkerPerformance.mockResolvedValue({
      workers: []
    });

    render(<TechnicianPerformanceView />);

    expect(await screen.findByText('No technician activity in this period')).toBeInTheDocument();
    expect(screen.getByText(/Completed jobs and material handling activity will appear here/i)).toBeInTheDocument();
  });
});
