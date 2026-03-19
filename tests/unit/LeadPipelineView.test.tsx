import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadPipelineView } from '../../views/LeadPipelineView';

const { leadApiMock, setErrorMock } = vi.hoisted(() => ({
  leadApiMock: {
    getLeads: vi.fn(),
    getLead: vi.fn(),
    createLead: vi.fn(),
    updateStatus: vi.fn(),
    addCommunication: vi.fn(),
    scheduleFollowUp: vi.fn(),
    convertToQuote: vi.fn(),
    markAsWon: vi.fn(),
    markAsLost: vi.fn()
  },
  setErrorMock: vi.fn()
}));

vi.mock('../../lib/leadAPI', () => ({
  leadAPI: leadApiMock
}));

vi.mock('../../store/useStore', () => ({
  useStore: (selector: (state: { setError: typeof setErrorMock }) => unknown) =>
    selector({ setError: setErrorMock })
}));

describe('LeadPipelineView', () => {
  const lead = {
    id: 'lead-1',
    leadNumber: 'LEAD-001',
    contactName: 'Morgan Homeowner',
    email: 'morgan@example.com',
    phone: '0400000000',
    source: 'website',
    status: 'qualified',
    priority: 'warm',
    communications: [],
    tags: ['kitchen'],
    estimatedValue: 4200,
    createdAt: '2026-03-20T09:00:00.000Z',
    updatedAt: '2026-03-20T09:00:00.000Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    leadApiMock.getLeads.mockResolvedValue({
      leads: [lead],
      total: 1,
      page: 1,
      pageSize: 200
    });
    leadApiMock.getLead.mockResolvedValue(lead);
    leadApiMock.createLead.mockResolvedValue({
      ...lead,
      id: 'lead-2',
      leadNumber: 'LEAD-002',
      contactName: 'Jamie Builder',
      phone: '0411222333',
      estimatedValue: 2500
    });
  });

  it('loads the live pipeline and opens a lead detail modal', async () => {
    const user = userEvent.setup();

    render(<LeadPipelineView />);

    expect(await screen.findByText('Morgan Homeowner')).toBeInTheDocument();
    expect(screen.getByText('LEAD-001')).toBeInTheDocument();

    await user.click(screen.getByText('Morgan Homeowner').closest('button')!);

    await waitFor(() => {
      expect(leadApiMock.getLead).toHaveBeenCalledWith('lead-1');
    });

    expect(await screen.findByRole('button', { name: 'Convert to Quote' })).toBeInTheDocument();
    expect(screen.getByText('Lead Details')).toBeInTheDocument();
  });

  it('creates a lead through the live create modal and refreshes the list', async () => {
    const user = userEvent.setup();

    leadApiMock.getLeads
      .mockResolvedValueOnce({
        leads: [],
        total: 0,
        page: 1,
        pageSize: 200
      })
      .mockResolvedValueOnce({
        leads: [
          {
            ...lead,
            id: 'lead-2',
            leadNumber: 'LEAD-002',
            contactName: 'Jamie Builder',
            phone: '0411222333',
            estimatedValue: 2500
          }
        ],
        total: 1,
        page: 1,
        pageSize: 200
      });

    render(<LeadPipelineView />);

    await screen.findByText('Active Pipeline');

    await user.click(screen.getByRole('button', { name: 'New Lead' }));

    await user.type(screen.getByLabelText('Contact Name'), 'Jamie Builder');
    await user.type(screen.getByLabelText('Phone'), '0411222333');
    await user.type(screen.getByLabelText('Estimated Value'), '2500');

    await user.click(screen.getByRole('button', { name: 'Save Lead' }));

    await waitFor(() => {
      expect(leadApiMock.createLead).toHaveBeenCalledWith(expect.objectContaining({
        contactName: 'Jamie Builder',
        phone: '0411222333',
        source: 'website',
        status: 'new',
        priority: 'warm'
      }));
    });

    expect(await screen.findByText('Lead created')).toBeInTheDocument();
    expect(await screen.findByText('Jamie Builder')).toBeInTheDocument();
  });
});
