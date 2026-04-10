import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../views/EnhancedDashboardView', () => ({
  EnhancedDashboardView: () => <div>Enhanced Analytics Content</div>
}));

import { DashboardView } from '../../views/DashboardView';

describe('DashboardView', () => {
  const inventory = [
    {
      id: 'item-1',
      name: 'Copper Pipe',
      category: 'Pipes',
      supplierCode: 'CP-100',
      quantity: 2,
      reorderLevel: 5,
      price: 12
    }
  ] as any;

  const jobs = [
    {
      id: 'job-1',
      title: 'Leak Repair',
      date: '2026-03-18',
      status: 'Scheduled',
      assignedWorkerIds: ['worker-1']
    }
  ] as any;

  const contacts = [
    { id: 'worker-1', name: 'Taylor Tech', type: 'Plumber' }
  ] as any;

  it('navigates to calendar from the overview schedule action', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <DashboardView
        inventory={inventory}
        jobs={jobs}
        contacts={contacts}
        onNavigate={onNavigate}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Full Schedule' }));

    expect(onNavigate).toHaveBeenCalledWith('calendar');
  });

  it('switches to the surfaced analytics dashboard mode', async () => {
    const user = userEvent.setup();

    render(
      <DashboardView
        inventory={inventory}
        jobs={jobs}
        contacts={contacts}
        onNavigate={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Analytics' }));

    expect(await screen.findByText('Enhanced Analytics Content')).toBeInTheDocument();
  });
});
