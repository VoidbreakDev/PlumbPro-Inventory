import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Camera, RotateCcw, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import type { Job, Contact, JobNote, JobStatus } from '../../types';
import { canPerform } from '../../lib/permissions';
import { jobsAPI } from '../../lib/api';

interface JobDetailSheetProps {
  job: Job | null;
  contacts: Contact[];
  userRole: string;
  userId: string;
  onClose: () => void;
  onStatusChange: (jobId: string, status: JobStatus) => Promise<void>;
  onReschedule?: (job: Job) => void;
  onReassign?: (job: Job) => void;
  onViewFullJob?: (job: Job) => void;
}

const ALL_STATUSES: JobStatus[] = ['Unscheduled', 'Scheduled', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];

export const JobDetailSheet: React.FC<JobDetailSheetProps> = ({
  job, contacts, userRole, userId, onClose, onStatusChange, onReschedule, onReassign, onViewFullJob
}) => {
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);

  const isAssigned = job ? job.assignedWorkerIds.includes(userId) : false;

  useEffect(() => {
    if (job) {
      requestAnimationFrame(() => setIsOpen(true));
    } else {
      setIsOpen(false);
    }
  }, [job]);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    jobsAPI.getNotes(job.id)
      .then(data => { if (!cancelled) setNotes(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [job?.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
    const delta = touchCurrentY.current - touchStartY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };

  const handleTouchEnd = () => {
    const delta = touchCurrentY.current - touchStartY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
    if (delta > 100) {
      onClose();
    }
  };

  const handleAddNote = async () => {
    if (!job || !newNote.trim()) return;
    setAddingNote(true);
    setNoteError(null);
    try {
      const note = await jobsAPI.addNote(job.id, newNote.trim());
      setNotes(prev => [note, ...prev]);
      setNewNote('');
    } catch {
      setNoteError('Failed to add note. Please try again.');
    } finally {
      setAddingNote(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!job || !file) return;
    setUploadingPhoto(true);
    try {
      await jobsAPI.addPhoto(job.id, file);
    } catch {
      // error surfaced via store toast in parent
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!job) return null;

  const workerNames = job.assignedWorkerIds
    .map(id => contacts.find(c => c.id === id)?.name ?? id)
    .join(', ');

  return (
    <>
      {/* Overlay (desktop) */}
      <div
        className="fixed inset-0 bg-black/40 z-40 hidden lg:block"
        onClick={onClose}
        role="presentation"
      />

      {/* Sheet panel */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label="Job details"
        aria-modal="true"
        className={`
          fixed z-50 bg-white shadow-2xl overflow-y-auto transition-transform duration-300
          bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
          lg:bottom-0 lg:top-0 lg:left-auto lg:right-0 lg:w-96 lg:rounded-none lg:max-h-full
          ${isOpen ? 'lg:translate-x-0' : 'lg:translate-x-full'}
        `}
      >
        {/* Drag handle (mobile only) */}
        <div
          className="flex justify-center pt-3 lg:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className={`p-4 text-white ${
          job.status === 'In Progress' ? 'bg-amber-500' :
          job.status === 'Completed'   ? 'bg-green-600' :
          job.status === 'On Hold'     ? 'bg-orange-500' :
          'bg-blue-600'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base truncate">{job.title}</h3>
              {job.jobAddress && (
                <p className="text-sm opacity-90 truncate">{job.jobAddress}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full">{job.status}</span>
                {workerNames && <span className="text-xs opacity-80 truncate">{workerNames}</span>}
                {(job.scheduledStart || job.scheduledEnd) && (
                  <span className="text-xs opacity-80">
                    {job.scheduledStart ? format(new Date(job.scheduledStart), 'h:mm a') : ''}
                    {job.scheduledEnd ? ` – ${format(new Date(job.scheduledEnd), 'h:mm a')}` : ''}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close job details" className="ml-2 p-1 hover:bg-white/20 rounded-lg flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Status update */}
          {canPerform(userRole, 'updateStatus', isAssigned) && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Status
              </label>
              <select
                value={job.status}
                onChange={(e) => onStatusChange(job.id, e.target.value as JobStatus)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {/* Manager-only actions */}
          {canPerform(userRole, 'reschedule', isAssigned) && (
            <div className="border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Manager Only</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onReschedule?.(job)}
                  className="flex items-center justify-center gap-1 px-3 py-2 border border-blue-200 text-blue-700 bg-blue-50 rounded-lg text-sm hover:bg-blue-100"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reschedule
                </button>
                <button
                  onClick={() => onReassign?.(job)}
                  className="flex items-center justify-center gap-1 px-3 py-2 border border-blue-200 text-blue-700 bg-blue-50 rounded-lg text-sm hover:bg-blue-100"
                >
                  <UserPlus className="w-4 h-4" />
                  Reassign
                </button>
              </div>
            </div>
          )}

          {/* Add note */}
          {canPerform(userRole, 'addNote', isAssigned) && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Add Note
              </label>
              <div className="flex gap-2">
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                  placeholder="Type a note…"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                  aria-label="Add note"
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {noteError && <p className="text-red-500 text-xs mt-1">{noteError}</p>}
            </div>
          )}

          {/* Add photo */}
          {canPerform(userRole, 'addPhoto', isAssigned) && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Add Photo
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-3 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                {uploadingPhoto ? 'Uploading…' : 'Take or choose photo'}
              </button>
            </div>
          )}

          {/* Stub buttons (coming soon) */}
          <div className="border border-slate-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Field actions</p>
            <button disabled className="w-full text-left px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-400 cursor-not-allowed">
              🕒 Clock In/Out — coming in Timesheets
            </button>
            <button disabled className="w-full text-left px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-400 cursor-not-allowed">
              📦 Van Stock Used — coming in Van Stock
            </button>
            <button disabled className="w-full text-left px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-400 cursor-not-allowed">
              📋 Complete SWMS — coming in Compliance
            </button>
          </div>

          {/* Notes list */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
            {notes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No notes yet</p>
            ) : (
              <div className="space-y-2">
                {notes.map(n => (
                  <div key={n.id} className="bg-slate-50 rounded-lg p-3 text-sm">
                    <p className="text-slate-700">{n.note}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View full job */}
          <button
            onClick={() => { onViewFullJob ? onViewFullJob(job) : onClose(); }}
            className="block w-full text-center py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            View Full Job →
          </button>
        </div>
      </div>
    </>
  );
};
