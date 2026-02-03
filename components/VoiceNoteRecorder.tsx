/**
 * Voice Note Recorder with Real-Time Transcription
 * Records audio and transcribes speech in real-time
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Save,
  X,
  Volume2,
  Sparkles,
  Languages,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { voiceNotesAPI } from '../lib/voiceNotesAPI';
import type { VoiceTranscriptionResult } from '../types';

interface VoiceNoteRecorderProps {
  isOpen: boolean;
  jobId?: string;
  contactId?: string;
  onClose: () => void;
  onSave: (voiceNote: {
    audioBlob: Blob;
    duration: number;
    transcription: string;
  }) => void;
}

const LANGUAGES = [
  { code: 'en-AU', name: 'English (AU)' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'vi-VN', name: 'Vietnamese' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'el-GR', name: 'Greek' },
];

export function VoiceNoteRecorder({
  isOpen,
  jobId,
  contactId,
  onClose,
  onSave,
}: VoiceNoteRecorderProps) {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Transcription state
  const [transcription, setTranscription] = useState('');
  const [interimTranscription, setInterimTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-AU');
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  
  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  const MAX_RECORDING_TIME = 300; // 5 minutes

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize speech recognition
  const initSpeechRecognition = useCallback(() => {
    if (!voiceNotesAPI.isSpeechRecognitionSupported()) {
      setTranscriptionError('Speech recognition not supported in this browser');
      return null;
    }

    const recognition = voiceNotesAPI.createSpeechRecognition(selectedLanguage);
    if (!recognition) return null;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setTranscription(prev => prev + final);
      }
      setInterimTranscription(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setTranscriptionError(`Transcription error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Restart if still recording
      if (isRecording && !isPaused) {
        try {
          recognition.start();
        } catch (e) {
          // Already started or other error
        }
      }
    };

    return recognition;
  }, [selectedLanguage, isRecording, isPaused]);

  const startRecording = async () => {
    try {
      setTranscriptionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        
        stream.getTracks().forEach(track => track.stop());
        
        // Stop speech recognition
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setTranscription('');
      setInterimTranscription('');

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      // Start speech recognition
      const recognition = initSpeechRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        try {
          recognition.start();
          setIsTranscribing(true);
        } catch (e) {
          console.error('Failed to start speech recognition:', e);
        }
      }

    } catch (err) {
      setTranscriptionError('Could not access microphone. Please check permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        
        // Resume speech recognition
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // May already be started
          }
        }
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        // Pause speech recognition
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      setIsTranscribing(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  };

  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setPlaybackTime(0);
    setIsPlaying(false);
    setTranscription('');
    setInterimTranscription('');
    setTranscriptionError(null);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlaybackTime(0);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setPlaybackTime(Math.floor(audioRef.current.currentTime));
    }
  };

  const handleSave = async () => {
    if (!audioBlob || recordingTime === 0) return;
    
    setIsSaving(true);
    try {
      await onSave({
        audioBlob,
        duration: recordingTime,
        transcription: transcription.trim(),
      });
      discardRecording();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    discardRecording();
    onClose();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [audioUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Voice Note</h2>
            <p className="text-sm text-slate-400">
              {jobId ? 'Recording for job' : contactId ? 'Recording for contact' : 'New voice note'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          {!isRecording && !audioBlob && (
            <div className="relative">
              <button
                onClick={() => setShowLanguageSelect(!showLanguageSelect)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
              >
                <Languages className="w-4 h-4" />
                {LANGUAGES.find(l => l.code === selectedLanguage)?.name || 'English'}
              </button>
              
              {showLanguageSelect && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setSelectedLanguage(lang.code);
                        setShowLanguageSelect(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                        selectedLanguage === lang.code ? 'text-blue-400 bg-blue-900/20' : 'text-slate-300'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Error */}
      {transcriptionError && (
        <div className="mx-4 mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">{transcriptionError}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Recording Controls */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-700">
          {/* Visualizer */}
          {isRecording && (
            <div className="mb-8 flex items-center gap-1 h-16">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 60 + 20}%`,
                    animationDelay: `${i * 0.05}s`,
                    opacity: isPaused ? 0.3 : 1
                  }}
                />
              ))}
            </div>
          )}

          {/* Timer */}
          <div className="text-center mb-8">
            <div className={`text-6xl font-mono font-bold ${
              isRecording && !isPaused ? 'text-blue-400' : 'text-white'
            }`}>
              {formatTime(isRecording ? recordingTime : playbackTime)}
            </div>
            <p className="text-slate-500 mt-2">
              {isRecording 
                ? isPaused ? 'Paused' : 'Recording...'
                : audioBlob 
                  ? 'Ready to save'
                  : 'Ready to record'
              }
            </p>
            {isRecording && (
              <p className="text-slate-600 text-sm mt-1">
                Max: {formatTime(MAX_RECORDING_TIME)}
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {!isRecording && !audioBlob && (
              <button
                onClick={startRecording}
                className="w-20 h-20 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-600/30 transition-all transform hover:scale-105"
              >
                <Mic className="w-8 h-8 text-white" />
              </button>
            )}

            {isRecording && (
              <>
                <button
                  onClick={pauseRecording}
                  className="w-16 h-16 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center transition-all"
                >
                  {isPaused ? (
                    <Play className="w-6 h-6 text-white" />
                  ) : (
                    <Pause className="w-6 h-6 text-white" />
                  )}
                </button>

                <button
                  onClick={stopRecording}
                  className="w-20 h-20 bg-slate-200 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105"
                >
                  <Square className="w-8 h-8 text-slate-900" fill="currentColor" />
                </button>
              </>
            )}

            {!isRecording && audioBlob && (
              <>
                <button
                  onClick={togglePlayback}
                  className="w-16 h-16 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center transition-all"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-1" />
                  )}
                </button>

                <button
                  onClick={discardRecording}
                  className="w-16 h-16 bg-red-900/50 hover:bg-red-900 border border-red-500 rounded-full flex items-center justify-center transition-all"
                >
                  <Trash2 className="w-6 h-6 text-red-400" />
                </button>

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-20 h-20 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-600/30 transition-all transform hover:scale-105 disabled:opacity-50"
                >
                  {isSaving ? (
                    <RotateCcw className="w-8 h-8 text-white animate-spin" />
                  ) : (
                    <Save className="w-8 h-8 text-white" />
                  )}
                </button>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 text-center max-w-md">
            {!isRecording && !audioBlob && (
              <p className="text-slate-500 text-sm">
                Tap the red button to start recording.<br />
                Your speech will be transcribed automatically.<br />
                Maximum: 5 minutes.
              </p>
            )}
            {isRecording && isTranscribing && (
              <div className="flex items-center justify-center gap-2 text-green-400">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm">Live transcription active</span>
              </div>
            )}
            {isRecording && !isTranscribing && (
              <p className="text-amber-400 text-sm">
                Recording without transcription
              </p>
            )}
          </div>

          {/* Hidden audio element */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={handleAudioEnded}
              onTimeUpdate={handleTimeUpdate}
              className="hidden"
            />
          )}
        </div>

        {/* Right: Transcription */}
        <div className="flex-1 flex flex-col bg-slate-800/50">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <h3 className="font-medium text-white">Transcription</h3>
            </div>
            {transcription && (
              <button
                onClick={() => setTranscription('')}
                className="text-sm text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto">
            {isRecording && (
              <div className="text-slate-300 text-lg leading-relaxed">
                {transcription}
                <span className="text-slate-500">{interimTranscription}</span>
                {isTranscribing && !interimTranscription && (
                  <span className="animate-pulse">|</span>
                )}
              </div>
            )}
            
            {!isRecording && transcription && (
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                className="w-full h-full bg-transparent text-slate-300 text-lg leading-relaxed resize-none focus:outline-none"
                placeholder="Transcription will appear here..."
              />
            )}
            
            {!isRecording && !transcription && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <FileText className="w-12 h-12 mb-3 opacity-50" />
                <p>Your transcription will appear here</p>
                <p className="text-sm mt-1">Speak clearly for best results</p>
              </div>
            )}
          </div>
          
          {/* Stats */}
          {(transcription || isRecording) && (
            <div className="p-4 border-t border-slate-700 flex items-center justify-between text-sm text-slate-400">
              <span>
                {transcription.split(/\s+/).filter(w => w.length > 0).length} words
              </span>
              <span>
                {transcription.length} characters
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceNoteRecorder;
