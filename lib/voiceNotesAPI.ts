/**
 * Voice Notes API
 * Handles recording, storage, and transcription of voice notes
 */

import api from './api';
import type {
  VoiceNote,
  CreateVoiceNoteInput,
  VoiceNoteFilterOptions,
  VoiceTranscriptionResult,
} from '../types';

export interface VoiceNotesResponse {
  notes: VoiceNote[];
  total: number;
}

class VoiceNotesAPI {
  private baseUrl = '/api/voice-notes';

  // ==================== CRUD Operations ====================

  async getVoiceNotes(options: VoiceNoteFilterOptions & { page?: number; pageSize?: number } = {}): Promise<VoiceNotesResponse> {
    const params = new URLSearchParams();
    
    if (options.jobId) params.append('jobId', options.jobId);
    if (options.contactId) params.append('contactId', options.contactId);
    if (options.userId) params.append('userId', options.userId);
    if (options.transcriptionStatus) params.append('transcriptionStatus', options.transcriptionStatus);
    if (options.dateFrom) params.append('dateFrom', options.dateFrom);
    if (options.dateTo) params.append('dateTo', options.dateTo);
    if (options.search) params.append('search', options.search);
    if (options.page) params.append('page', options.page.toString());
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async getVoiceNote(id: string): Promise<VoiceNote> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async uploadVoiceNote(input: CreateVoiceNoteInput): Promise<VoiceNote> {
    const formData = new FormData();
    formData.append('audio', input.audioBlob);
    formData.append('audioDuration', input.audioDuration.toString());
    if (input.jobId) formData.append('jobId', input.jobId);
    if (input.contactId) formData.append('contactId', input.contactId);
    if (input.language) formData.append('language', input.language);
    if (input.transcription) formData.append('transcription', input.transcription);

    const response = await api.post(this.baseUrl, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteVoiceNote(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // ==================== Transcription ====================

  async requestTranscription(id: string, language?: string): Promise<VoiceNote> {
    const response = await api.post(`${this.baseUrl}/${id}/transcribe`, { language });
    return response.data;
  }

  async updateTranscription(id: string, transcription: string): Promise<VoiceNote> {
    const response = await api.put(`${this.baseUrl}/${id}/transcription`, { transcription });
    return response.data;
  }

  // ==================== AI Extraction ====================

  async extractItems(id: string): Promise<VoiceNote> {
    const response = await api.post(`${this.baseUrl}/${id}/extract`);
    return response.data;
  }

  async convertToJobNote(id: string): Promise<{ jobNoteId: string }> {
    const response = await api.post(`${this.baseUrl}/${id}/convert-to-note`);
    return response.data;
  }

  // ==================== Speech Recognition (Client-side) ====================

  /**
   * Check if browser supports speech recognition
   */
  isSpeechRecognitionSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Create a real-time speech recognition instance
   */
  createSpeechRecognition(language: string = 'en-AU'): SpeechRecognition | null {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    
    return recognition;
  }

  // ==================== Stats ====================

  async getStats(): Promise<{
    totalNotes: number;
    totalMinutes: number;
    transcribedCount: number;
    pendingCount: number;
  }> {
    const response = await api.get(`${this.baseUrl}/stats`);
    return response.data;
  }
}

export const voiceNotesAPI = new VoiceNotesAPI();
export default voiceNotesAPI;
