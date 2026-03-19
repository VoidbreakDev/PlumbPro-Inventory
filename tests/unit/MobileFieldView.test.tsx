import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileFieldView } from '../../views/MobileFieldView';

const {
  mobileApiMock,
  setErrorMock,
  toastMock
} = vi.hoisted(() => ({
  mobileApiMock: {
    getActiveCheckIn: vi.fn(),
    getCurrentLocation: vi.fn(),
    checkIn: vi.fn(),
    checkOut: vi.fn(),
    uploadPhoto: vi.fn(),
    getPhotos: vi.fn(),
    getFieldNotes: vi.fn(),
    addFieldNote: vi.fn(),
    scanBarcode: vi.fn(),
    checkJobCompletion: vi.fn(),
    saveSignature: vi.fn(),
    recordGPSBreadcrumb: vi.fn(),
    getJobRoute: vi.fn()
  },
  setErrorMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('../../lib/mobileAPI', () => ({
  mobileAPI: mobileApiMock
}));

vi.mock('../../store/useStore', () => ({
  useStore: (selector: (state: { setError: typeof setErrorMock }) => unknown) =>
    selector({ setError: setErrorMock })
}));

vi.mock('../../components/ToastNotification', () => ({
  useToast: () => toastMock
}));

vi.mock('../../components/BarcodeScanner', () => ({
  BarcodeScanner: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="barcode-scanner">Barcode Scanner Open</div> : null
}));

vi.mock('../../components/VoiceMemoRecorder', () => ({
  VoiceMemoRecorder: () => null
}));

vi.mock('../../components/VoiceNotesList', () => ({
  VoiceNotesList: () => <div>Voice Notes</div>
}));

vi.mock('../../components/PushNotificationManager', () => ({
  PushNotificationManager: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div>Push Notification Settings</div> : null
}));

vi.mock('../../components/GPSBreadcrumbMap', () => ({
  GPSBreadcrumbMap: () => null
}));

vi.mock('../../components/OfflineSyncStatus', () => ({
  OfflineSyncStatus: () => <div>Sync Status</div>
}));

describe('MobileFieldView', () => {
  const location = {
    latitude: -34.9285,
    longitude: 138.6007,
    accuracy: 5
  };

  const activeCheckIn = {
    id: 'check-in-1',
    job_id: 'JOB-100',
    user_id: 'user-1',
    check_in_time: '2026-03-13T08:00:00.000Z',
    check_in_latitude: location.latitude,
    check_in_longitude: location.longitude,
    job_name: 'Leak Repair',
    job_status: 'in_progress',
    job_address: '12 Copper Lane'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mobileApiMock.getActiveCheckIn.mockResolvedValue(null);
    mobileApiMock.getCurrentLocation.mockResolvedValue(location);
    mobileApiMock.checkIn.mockResolvedValue(activeCheckIn);
    mobileApiMock.checkOut.mockResolvedValue({
      ...activeCheckIn,
      duration_minutes: 45
    });
    mobileApiMock.getPhotos.mockResolvedValue([]);
    mobileApiMock.getFieldNotes.mockResolvedValue([]);
    mobileApiMock.addFieldNote.mockResolvedValue({
      id: 'note-1',
      job_id: activeCheckIn.job_id,
      note_type: 'text',
      content: 'Urgent leak behind wall',
      is_important: true,
      created_at: '2026-03-13T08:15:00.000Z',
      author_name: 'Alex Technician'
    });
    mobileApiMock.uploadPhoto.mockResolvedValue({
      id: 'photo-1',
      job_id: activeCheckIn.job_id,
      user_id: activeCheckIn.user_id,
      photo_type: 'after',
      file_path: '/uploads/repair.jpg',
      file_name: 'repair.jpg',
      caption: 'Repair complete',
      taken_at: '2026-03-13T08:20:00.000Z'
    });
  });

  it('checks in through the modal flow instead of a browser prompt', async () => {
    const user = userEvent.setup();

    render(<MobileFieldView />);

    await waitFor(() => {
      expect(mobileApiMock.getActiveCheckIn).toHaveBeenCalledTimes(1);
      expect(mobileApiMock.getCurrentLocation).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Check In to Job' }));

    const jobIdInput = await screen.findByLabelText('Job ID');
    await user.type(jobIdInput, 'JOB-1024');

    fireEvent.submit(jobIdInput.closest('form')!);

    await waitFor(() => {
      expect(mobileApiMock.checkIn).toHaveBeenCalledWith('JOB-1024', location);
    });

    expect(toastMock.success).toHaveBeenCalledWith('Checked in successfully');
  });

  it('adds an important note from the in-app note sheet', async () => {
    const user = userEvent.setup();
    mobileApiMock.getActiveCheckIn.mockResolvedValue(activeCheckIn);

    render(<MobileFieldView />);

    await waitFor(() => {
      expect(mobileApiMock.getPhotos).toHaveBeenCalledWith(activeCheckIn.job_id);
      expect(mobileApiMock.getFieldNotes).toHaveBeenCalledWith(activeCheckIn.job_id);
    });

    await user.click(screen.getByRole('button', { name: 'Note' }));
    await screen.findByText('Add Field Note');

    await user.type(screen.getByLabelText('Note'), 'Urgent leak behind wall');
    await user.click(screen.getByLabelText('Mark this note as important'));

    fireEvent.submit(screen.getByLabelText('Note').closest('form')!);

    await waitFor(() => {
      expect(mobileApiMock.addFieldNote).toHaveBeenCalledWith(
        activeCheckIn.job_id,
        expect.objectContaining({
          noteType: 'text',
          content: 'Urgent leak behind wall',
          isImportant: true,
          location,
          checkInId: activeCheckIn.id
        })
      );
    });

    expect(toastMock.success).toHaveBeenCalledWith('Note added');
  });

  it('collects photo metadata in-app before uploading', async () => {
    const user = userEvent.setup();
    mobileApiMock.getActiveCheckIn.mockResolvedValue(activeCheckIn);

    const { container } = render(<MobileFieldView />);

    await waitFor(() => {
      expect(mobileApiMock.getPhotos).toHaveBeenCalledWith(activeCheckIn.job_id);
    });

    const fileInput = container.querySelector('#photo-input') as HTMLInputElement;
    const photoFile = new File(['photo-bytes'], 'repair.jpg', { type: 'image/jpeg' });

    fireEvent.change(fileInput, {
      target: {
        files: [photoFile]
      }
    });

    await screen.findByText('Photo Details');
    await user.selectOptions(screen.getByLabelText('Photo Type'), 'after');
    await user.type(screen.getByLabelText('Caption'), 'Repair complete');

    fireEvent.submit(screen.getByLabelText('Caption').closest('form')!);

    await waitFor(() => {
      expect(mobileApiMock.uploadPhoto).toHaveBeenCalledWith(
        activeCheckIn.job_id,
        photoFile,
        'after',
        'Repair complete',
        location,
        activeCheckIn.id
      );
    });

    expect(toastMock.success).toHaveBeenCalledWith('Photo uploaded');
  });
});
