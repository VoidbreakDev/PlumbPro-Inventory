import React, { useState, useRef, useCallback } from 'react';
import { Mic, Square, Play, Pause, Trash2, Upload, X, Volume2 } from 'lucide-react';

interface VoiceMemoRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (audioBlob: Blob, duration: number) => void;
}

export function VoiceMemoRecorder({ isOpen, onClose, onSave }: VoiceMemoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const MAX_RECORDING_TIME = 300; // 5 minutes in seconds

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setError(null);
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

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

    } catch (err) {
      setError('Could not access microphone. Please ensure microphone permissions are granted.');
      console.error('Recording error:', err);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        // Resume timer
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        // Pause timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
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

  const handleSave = () => {
    if (audioBlob && recordingTime > 0) {
      onSave(audioBlob, recordingTime);
      discardRecording();
      onClose();
    }
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    discardRecording();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Mic className="w-6 h-6 text-red-400" />
          <h2 className="text-lg font-semibold text-white">Voice Memo</h2>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-6 h-6 text-gray-400" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <p className="text-red-200 text-sm text-center">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Recording Visualizer */}
        {isRecording && (
          <div className="mb-8 flex items-center gap-1">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-gradient-to-t from-red-600 to-red-400 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 60 + 20}px`,
                  animationDelay: `${i * 0.05}s`,
                  opacity: isPaused ? 0.3 : 1
                }}
              />
            ))}
          </div>
        )}

        {/* Audio Waveform (when recorded) */}
        {!isRecording && audioUrl && (
          <div className="mb-8 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <Volume2 className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">Preview</span>
            </div>
            
            {/* Waveform visualization */}
            <div className="h-16 bg-gray-800 rounded-lg flex items-center px-4 gap-0.5 overflow-hidden">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-blue-500 rounded-full"
                  style={{
                    height: `${Math.random() * 80 + 20}%`,
                    opacity: (i / 50) < (playbackTime / recordingTime) ? 1 : 0.3
                  }}
                />
              ))}
            </div>

            {/* Hidden audio element */}
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={handleAudioEnded}
              onTimeUpdate={handleTimeUpdate}
              className="hidden"
            />
          </div>
        )}

        {/* Timer */}
        <div className="text-center mb-8">
          <div className={`text-6xl font-mono font-bold ${
            isRecording && !isPaused ? 'text-red-400' : 'text-white'
          }`}>
            {formatTime(isRecording ? recordingTime : playbackTime)}
          </div>
          <p className="text-gray-500 mt-2">
            {isRecording 
              ? isPaused ? 'Paused' : 'Recording...'
              : audioUrl 
                ? 'Ready to save'
                : 'Ready to record'
            }
          </p>
          {isRecording && (
            <p className="text-gray-600 text-sm mt-1">
              Max: {formatTime(MAX_RECORDING_TIME)}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {!isRecording && !audioUrl && (
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
                className="w-16 h-16 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-all"
              >
                {isPaused ? (
                  <Play className="w-6 h-6 text-white" />
                ) : (
                  <Pause className="w-6 h-6 text-white" />
                )}
              </button>

              <button
                onClick={stopRecording}
                className="w-20 h-20 bg-gray-200 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105"
              >
                <Square className="w-8 h-8 text-gray-900" fill="currentColor" />
              </button>
            </>
          )}

          {!isRecording && audioUrl && (
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
                className="w-20 h-20 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-600/30 transition-all transform hover:scale-105"
              >
                <Upload className="w-8 h-8 text-white" />
              </button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center">
          {!isRecording && !audioUrl && (
            <p className="text-gray-500 text-sm">
              Tap the red button to start recording<br />
              Maximum duration: 5 minutes
            </p>
          )}
          {isRecording && (
            <p className="text-gray-500 text-sm">
              {isPaused 
                ? 'Recording paused. Tap play to resume.'
                : 'Recording in progress... Tap square to stop.'}
            </p>
          )}
          {!isRecording && audioUrl && (
            <p className="text-gray-500 text-sm">
              Review your recording and tap upload to save<br />
              Or tap trash to discard and re-record
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceMemoRecorder;
