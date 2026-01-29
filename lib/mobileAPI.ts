import api from './api';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
}

export interface CheckIn {
  id: string;
  job_id: string;
  user_id: string;
  check_in_time: string;
  check_out_time?: string;
  check_in_latitude: number;
  check_in_longitude: number;
  check_out_latitude?: number;
  check_out_longitude?: number;
  notes?: string;
  job_name?: string;
  job_status?: string;
  job_address?: string;
  duration_minutes?: number;
}

export interface JobPhoto {
  id: string;
  job_id: string;
  user_id: string;
  photo_type: 'before' | 'during' | 'after' | 'issue' | 'completion';
  file_path: string;
  file_name: string;
  caption?: string;
  taken_at: string;
  uploader_name?: string;
}

export interface JobSignature {
  id: string;
  job_id: string;
  signature_type: 'customer' | 'worker' | 'supervisor';
  signature_data: string;
  signer_name: string;
  signer_email?: string;
  signer_phone?: string;
  signed_at: string;
}

export interface FieldNote {
  id: string;
  job_id: string;
  note_type: 'text' | 'voice' | 'checklist';
  content: string;
  audio_file_path?: string;
  audio_duration?: number;
  is_important: boolean;
  created_at: string;
  author_name?: string;
}

export interface BarcodeScanResult {
  scan: {
    id: string;
    barcode_value: string;
    barcode_type: string;
    scan_type: string;
    quantity: number;
  };
  item: any | null;
  found: boolean;
}

export interface NearbyJob {
  id: string;
  name: string;
  status: string;
  scheduled_date: string;
  job_address: string;
  job_latitude: number;
  job_longitude: number;
  distance_km: number;
}

export interface JobCompletionCheck {
  isComplete: boolean;
  completionPercentage: number;
  missingItems: string[];
  recommendations: string[];
  canSubmit: boolean;
  summary: string;
}

export interface SyncQueueItem {
  id: string;
  entity_type: 'photo' | 'voice_memo' | 'note' | 'check_in' | 'barcode_scan' | 'gps_breadcrumb';
  entity_id: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export const mobileAPI = {
  /**
   * Check in to a job
   */
  checkIn: async (jobId: string, location: Location): Promise<CheckIn> => {
    const response = await api.post('/mobile/check-in', { jobId, location });
    return response.data;
  },

  /**
   * Check out from a job
   */
  checkOut: async (
    checkInId: string,
    location: Location,
    notes?: string
  ): Promise<CheckIn> => {
    const response = await api.post('/mobile/check-out', {
      checkInId,
      location,
      notes
    });
    return response.data;
  },

  /**
   * Get active check-in
   */
  getActiveCheckIn: async (): Promise<CheckIn | null> => {
    const response = await api.get('/mobile/active-check-in');
    return response.data.active === false ? null : response.data;
  },

  /**
   * Upload job photo
   */
  uploadPhoto: async (
    jobId: string,
    photo: File,
    photoType: string,
    caption?: string,
    location?: Location,
    checkInId?: string
  ): Promise<JobPhoto> => {
    const formData = new FormData();
    formData.append('photo', photo);
    formData.append('jobId', jobId);
    formData.append('photoType', photoType);
    if (caption) formData.append('caption', caption);
    if (location) {
      formData.append('latitude', location.latitude.toString());
      formData.append('longitude', location.longitude.toString());
    }
    if (checkInId) formData.append('checkInId', checkInId);

    const response = await api.post('/mobile/photos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  /**
   * Get job photos
   */
  getPhotos: async (jobId: string): Promise<JobPhoto[]> => {
    const response = await api.get(`/mobile/photos/${jobId}`);
    return response.data;
  },

  /**
   * Save digital signature
   */
  saveSignature: async (
    jobId: string,
    signatureData: {
      signatureType: string;
      signatureDataUrl: string;
      signerName: string;
      signerEmail?: string;
      signerPhone?: string;
      checkInId?: string;
    }
  ): Promise<JobSignature> => {
    const response = await api.post('/mobile/signatures', {
      jobId,
      ...signatureData
    });
    return response.data;
  },

  /**
   * Get job signatures
   */
  getSignatures: async (jobId: string): Promise<JobSignature[]> => {
    const response = await api.get(`/mobile/signatures/${jobId}`);
    return response.data;
  },

  /**
   * Add field note
   */
  addFieldNote: async (
    jobId: string,
    noteData: {
      noteType: string;
      content: string;
      isImportant?: boolean;
      location?: Location;
      checkInId?: string;
      audio?: File;
    }
  ): Promise<FieldNote> => {
    const formData = new FormData();
    formData.append('jobId', jobId);
    formData.append('noteType', noteData.noteType);
    formData.append('content', noteData.content);
    if (noteData.isImportant) formData.append('isImportant', 'true');
    if (noteData.location) {
      formData.append('latitude', noteData.location.latitude.toString());
      formData.append('longitude', noteData.location.longitude.toString());
    }
    if (noteData.checkInId) formData.append('checkInId', noteData.checkInId);
    if (noteData.audio) formData.append('audio', noteData.audio);

    const response = await api.post('/mobile/field-notes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  /**
   * Get field notes
   */
  getFieldNotes: async (jobId: string): Promise<FieldNote[]> => {
    const response = await api.get(`/mobile/field-notes/${jobId}`);
    return response.data;
  },

  /**
   * Process barcode scan
   */
  scanBarcode: async (scanData: {
    barcodeValue: string;
    barcodeType?: string;
    scanType: string;
    quantity?: number;
    location?: Location;
    jobId?: string;
  }): Promise<BarcodeScanResult> => {
    const response = await api.post('/mobile/barcode-scan', scanData);
    return response.data;
  },

  /**
   * Quick stock check
   */
  quickStockCheck: async (search: string): Promise<any[]> => {
    const response = await api.get('/mobile/quick-stock-check', {
      params: { search }
    });
    return response.data;
  },

  /**
   * Get nearby jobs
   */
  getNearbyJobs: async (location: Location, radiusKm: number = 50): Promise<NearbyJob[]> => {
    const response = await api.post('/mobile/nearby-jobs', {
      location,
      radiusKm
    });
    return response.data;
  },

  /**
   * Record GPS breadcrumb
   */
  recordGPSBreadcrumb: async (locationData: Location & {
    jobId?: string;
    checkInId?: string;
    batteryLevel?: number;
  }): Promise<{ success: boolean }> => {
    const response = await api.post('/mobile/gps-breadcrumb', locationData);
    return response.data;
  },

  /**
   * Get job route
   */
  getJobRoute: async (checkInId: string): Promise<Location[]> => {
    const response = await api.get(`/mobile/job-route/${checkInId}`);
    return response.data;
  },

  /**
   * Check job completion readiness (AI-powered)
   */
  checkJobCompletion: async (jobId: string): Promise<JobCompletionCheck> => {
    const response = await api.get(`/mobile/job-completion-check/${jobId}`);
    return response.data;
  },

  /**
   * Register mobile device for push notifications
   */
  registerDevice: async (deviceData: {
    deviceToken: string;
    deviceType: 'ios' | 'android' | 'web';
    deviceName?: string;
    osVersion?: string;
    appVersion?: string;
    subscription?: any;
  }): Promise<any> => {
    const response = await api.post('/mobile/register-device', deviceData);
    return response.data;
  },

  /**
   * Unregister mobile device from push notifications
   */
  unregisterDevice: async (deviceToken: string): Promise<any> => {
    const response = await api.post('/mobile/unregister-device', { deviceToken });
    return response.data;
  },

  /**
   * Update notification preferences
   */
  updateNotificationPreferences: async (preferences: {
    jobAlerts?: boolean;
    stockAlerts?: boolean;
    teamMessages?: boolean;
    systemUpdates?: boolean;
    emailDigest?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  }): Promise<any> => {
    const response = await api.post('/mobile/notification-preferences', preferences);
    return response.data;
  },

  /**
   * Sync offline queue
   */
  syncOfflineQueue: async (queueItems: any[]): Promise<{ results: any[] }> => {
    const response = await api.post('/mobile/sync-offline', { queueItems });
    return response.data;
  },

  /**
   * Get current location (browser geolocation API)
   */
  getCurrentLocation: (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  },

  /**
   * Watch location changes (for GPS tracking)
   */
  watchLocation: (callback: (location: Location) => void): number => {
    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported');
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined
        });
      },
      (error) => {
        console.error('Location watch error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  },

  /**
   * Clear location watch
   */
  clearLocationWatch: (watchId: number): void => {
    if (navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  },

  /**
   * Get sync queue from server
   */
  getSyncQueue: async (): Promise<SyncQueueItem[]> => {
    const response = await api.get('/mobile/sync-queue');
    return response.data;
  },

  /**
   * Get local sync queue (from IndexedDB)
   */
  getLocalSyncQueue: async (): Promise<SyncQueueItem[]> => {
    // Import dynamically to avoid circular dependency
    const { getSyncQueue } = await import('./storage');
    return getSyncQueue();
  },

  /**
   * Process sync queue
   */
  processSyncQueue: async (): Promise<void> => {
    const response = await api.post('/mobile/process-sync-queue');
    return response.data;
  },

  /**
   * Clear sync queue
   */
  clearSyncQueue: async (): Promise<void> => {
    const response = await api.delete('/mobile/sync-queue');
    return response.data;
  }
};
