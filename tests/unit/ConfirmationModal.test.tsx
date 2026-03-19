import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmationModal } from '../../components/ConfirmationModal';

describe('ConfirmationModal', () => {
  it('does not render when closed', () => {
    render(
      <ConfirmationModal
        isOpen={false}
        title="Delete Van"
        description="This removes the van."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls the right handlers for confirm and cancel actions', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        isOpen
        title="Delete Van"
        description="This removes the van."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks the dialog while processing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ConfirmationModal
        isOpen
        title="Revoke Key"
        description="This revokes the key."
        confirmLabel="Revoke"
        processingLabel="Revoking..."
        isProcessing
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('button', { name: 'Revoking...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await user.click(screen.getByLabelText('Close Revoke Key'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
