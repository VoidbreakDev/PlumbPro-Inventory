/**
 * Voice Notes List Component
 * Displays voice notes with transcription for jobs/contacts
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Play,
  Pause,
  Trash2,
  FileText,
  Clock,
  User,
  Calendar,
  Sparkles,
  AlertCircle,
  Volume2,
  X,
  Download,
  RotateCcw,
} from 'lucide-react';
import { voiceNotesAPI } from '../lib/voiceNotesAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import type { VoiceNote } from '../types';
import { VoiceNoteRecorder } from './VoiceNoteRecorder';

interface VoiceNotesListProps {
  jobId?: string;
  contactId?: string;
  readOnly?: boolean;
}

export function VoiceNotesList({ jobId, contactId, readOnly = false }: VoiceNotesListProps) {
  const setError = useStore((state) => state.setError);
  const user = useStore((state) => state.user);
  
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadNotes();
  }, [jobId, contactId]);

  const loadNotes = async () => {
    if (!jobId && !contactId) return;
    
    setLoading(true);
    try {
      const filters: any = {};
      if (jobId) filters.jobId = jobId;
      if (contactId) filters.contactId = contactId;
      
      const response = await voiceNotesAPI.getVoiceNotes(filters);
      setNotes(response.notes);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load voice notes'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVoiceNote = async (data: {
    audioBlob: Blob;
    duration: number;
    transcription: string;
  }) => {
    try {
      await voiceNotesAPI.uploadVoiceNote({
        audioBlob: data.audioBlob,
        audioDuration: data.duration,
        jobId,
        contactId,
        language: 'en-AU',
      });
      
      // Reload notes
      loadNotes();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save voice note'));
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this voice note?')) return;
    
    setDeletingNoteId(noteId);
    try {
      await voiceNotesAPI.deleteVoiceNote(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete voice note'));
    } finally {
      setDeletingNoteId(null);
    }
  };

  const togglePlayback = (note: VoiceNote) => {
    if (playingNoteId === note.id) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingNoteId(null);
    } else {
      // Stop current if any
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Start new
      const audio = new Audio(note.audioUrl);
      audio.onended = () => setPlayingNoteId(null);
      audio.onerror = () => {
        setError('Failed to play audio');
        setPlayingNoteId(null);
      };
      
      audio.play();
      audioRef.current = audio;
      setPlayingNoteId(note.id);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RotateCcw className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {!readOnly && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-800">
              Voice Notes ({notes.length})
            </h3>
          </div>
          <button
            onClick={() => setShowRecorder(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Mic className="w-4 h-4" />
            Record Note
          </button>
        </div>
      )}

      {/* Empty State */}
      {notes.length === 0 && (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Mic className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No voice notes yet</p>
          {!readOnly && (
            <button
              onClick={() => setShowRecorder(true)}
              className="mt-3 text-blue-600 hover:underline text-sm"
            >
              Record your first note
            </button>
          )}
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {notes.map(note => (
          <div
            key={note.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Audio Player Row */}
            <div className="p-4 flex items-center gap-4">
              <button
                onClick={() => togglePlayback(note)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  playingNoteId === note.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {playingNoteId === note.id ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Volume2 className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-800">
                    Voice Note
                  </span>
                  <span className="text-slate-400">•</span>
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-sm text-slate-500">
                    {formatDuration(note.audioDuration)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {note.userName || 'Unknown'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(note.recordedAt)}
                  </span>
                </div>
              </div>

              {/* Transcription Status */}
              {note.transcriptionStatus === 'processing' && (
                <div className="flex items-center gap-1 text-amber-600 text-sm">
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Transcribing...</span>
                </div>
              )}
              {note.transcriptionStatus === 'error' && (
                <div className="flex items-center gap-1 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Error</span>
                </div>
              )}
              {note.transcription && (
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>Transcribed</span>
                </div>
              )}

              {/* Actions */}
              {!readOnly && (
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  disabled={deletingNoteId === note.id}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  {deletingNoteId === note.id ? (
                    <RotateCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {/* Transcription */}
            {note.transcription && (
              <div className="px-4 pb-4">
                <div className="bg-slate-50 rounded-lg p-3 text-slate-700 text-sm leading-relaxed">
                  {note.transcription}
                </div>
                
                {/* Extracted Items */}
                {note.extractedItems && note.extractedItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {note.extractedItems.map((item, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-1 rounded-full text-xs ${
                          item.type === 'inventory'
                            ? 'bg-blue-100 text-blue-700'
                            : item.type === 'task'
                            ? 'bg-green-100 text-green-700'
                            : item.type === 'date'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.type}: {item.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Voice Recorder Modal */}
      {showRecorder && (
        <VoiceNoteRecorder
          isOpen={showRecorder}
          jobId={jobId}
          contactId={contactId}
          onClose={() => setShowRecorder(false)}
          onSave={handleSaveVoiceNote}
        />
      )}
    </div>
  );
}

export default VoiceNotesList;
