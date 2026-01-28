import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Camera,
  FileSignature,
  Clock,
  CheckCircle,
  AlertCircle,
  Mic,
  StickyNote,
  Navigation,
  QrCode,
  Package,
  Play,
  Square,
  Upload,
  CheckSquare,
  XCircle,
  Route,
  Wifi,
  Bell
} from 'lucide-react';
import { mobileAPI, type CheckIn, type Location } from '../lib/mobileAPI';
import { useStore } from '../store/useStore';
import { getErrorMessage } from '../lib/errors';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { VoiceMemoRecorder } from '../components/VoiceMemoRecorder';
import { PushNotificationManager } from '../components/PushNotificationManager';
import { GPSBreadcrumbMap } from '../components/GPSBreadcrumbMap';
import { OfflineSyncStatus } from '../components/OfflineSyncStatus';

export function MobileFieldView() {
  const [activeCheckIn, setActiveCheckIn] = useState<CheckIn | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'photos' | 'notes' | 'signature' | 'checklist'>('overview');

  // State for various features
  const [photos, setPhotos] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [signatureCanvas, setSignatureCanvas] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [completionCheck, setCompletionCheck] = useState<any>(null);
  const [barcodeScanMode, setBarcodeScanMode] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showPushSettings, setShowPushSettings] = useState(false);
  const [showGPSMap, setShowGPSMap] = useState(false);
  const [showGPSRoute, setShowGPSRoute] = useState(false);
  const [gpsBreadcrumbs, setGpsBreadcrumbs] = useState<any[]>([]);
  const setError = useStore((state) => state.setError);

  const signaturePadRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const breadcrumbTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadActiveCheckIn();
    getCurrentLocationData();
  }, []);

  const loadActiveCheckIn = async () => {
    try {
      const checkIn = await mobileAPI.getActiveCheckIn();
      setActiveCheckIn(checkIn);
      setIsCheckedIn(!!checkIn);

      if (checkIn) {
        loadJobData(checkIn.job_id);
      }
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load check-in'));
    }
  };

  const loadJobData = async (jobId: string) => {
    try {
      const [photosData, notesData] = await Promise.all([
        mobileAPI.getPhotos(jobId),
        mobileAPI.getFieldNotes(jobId)
      ]);
      setPhotos(photosData);
      setNotes(notesData);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load job data'));
    }
  };

  const getCurrentLocationData = async () => {
    setIsLoadingLocation(true);
    try {
      const location = await mobileAPI.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to get location'));
      alert('Please enable location services');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleCheckIn = async (jobId: string) => {
    if (!currentLocation) {
      await getCurrentLocationData();
      if (!currentLocation) {
        alert('Location required for check-in');
        return;
      }
    }

    try {
      const checkIn = await mobileAPI.checkIn(jobId, currentLocation);
      setActiveCheckIn(checkIn);
      setIsCheckedIn(true);
      alert('Checked in successfully!');
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to check in');
      setError(message);
      alert(message);
    }
  };

  const handleCheckOut = async () => {
    if (!activeCheckIn || !currentLocation) return;

    const notes = prompt('Add any checkout notes:');

    try {
      const checkOut = await mobileAPI.checkOut(activeCheckIn.id, currentLocation, notes || undefined);
      alert(`Checked out! Duration: ${checkOut.duration_minutes} minutes`);
      setActiveCheckIn(null);
      setIsCheckedIn(false);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to check out');
      setError(message);
      alert(message);
    }
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !activeCheckIn) return;

    const file = event.target.files[0];
    const photoType = prompt('Photo type (before/during/after/issue):') || 'during';
    const caption = prompt('Add a caption (optional):');

    try {
      const photo = await mobileAPI.uploadPhoto(
        activeCheckIn.job_id,
        file,
        photoType,
        caption || undefined,
        currentLocation || undefined,
        activeCheckIn.id
      );
      setPhotos([photo, ...photos]);
      alert('Photo uploaded!');
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to upload photo');
      setError(message);
      alert(message);
    }
  };

  const handleSignature = async () => {
    if (!signaturePadRef.current || !activeCheckIn) return;

    const canvas = signaturePadRef.current;
    const signatureDataUrl = canvas.toDataURL('image/png');

    const signerName = prompt('Customer name:');
    if (!signerName) return;

    const signerPhone = prompt('Customer phone (optional):');

    try {
      await mobileAPI.saveSignature(activeCheckIn.job_id, {
        signatureType: 'customer',
        signatureDataUrl,
        signerName,
        signerPhone: signerPhone || undefined,
        checkInId: activeCheckIn.id
      });
      alert('Signature saved! Job marked as completed.');
      setSignatureCanvas(null);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to save signature');
      setError(message);
      alert(message);
    }
  };

  const handleAddNote = async () => {
    if (!activeCheckIn) return;

    const content = prompt('Enter note:');
    if (!content) return;

    const isImportant = confirm('Mark as important?');

    try {
      const note = await mobileAPI.addFieldNote(activeCheckIn.job_id, {
        noteType: 'text',
        content,
        isImportant,
        location: currentLocation || undefined,
        checkInId: activeCheckIn.id
      });
      setNotes([note, ...notes]);
      alert('Note added!');
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to add note');
      setError(message);
      alert(message);
    }
  };

  const handleCheckCompletion = async () => {
    if (!activeCheckIn) return;

    try {
      const check = await mobileAPI.checkJobCompletion(activeCheckIn.job_id);
      setCompletionCheck(check);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to check completion');
      setError(message);
      alert(message);
    }
  };

  const handleBarcodeScan = () => {
    setBarcodeScanMode(true);
  };

  const handleBarcodeDetected = async (barcode: string, format: string) => {
    try {
      const result = await mobileAPI.scanBarcode({
        barcodeValue: barcode,
        barcodeType: format,
        scanType: 'inventory_check',
        location: currentLocation || undefined,
        jobId: activeCheckIn?.job_id
      });

      if (result.found) {
        alert(`✅ Found: ${result.item.name}\nQuantity: ${result.item.quantity}\nPrice: £${result.item.price}`);
      } else {
        alert('❌ Item not found in inventory');
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Scan failed');
      setError(message);
      alert(message);
    }
    setBarcodeScanMode(false);
  };

  const handleVoiceMemoSave = async (audioBlob: Blob, duration: number) => {
    if (!activeCheckIn) return;

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, `voice-memo-${Date.now()}.webm`);
      formData.append('jobId', activeCheckIn.job_id);
      formData.append('noteType', 'voice');
      formData.append('content', `Voice memo (${Math.round(duration)}s)`);
      formData.append('audioDuration', duration.toString());
      if (currentLocation) {
        formData.append('latitude', currentLocation.latitude.toString());
        formData.append('longitude', currentLocation.longitude.toString());
      }
      formData.append('checkInId', activeCheckIn.id);

      // TODO: Add API endpoint for voice upload
      // await mobileAPI.uploadVoiceMemo(formData);
      
      alert(`✅ Voice memo saved (${Math.round(duration)} seconds)`);
      loadJobData(activeCheckIn.job_id);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to save voice memo');
      setError(message);
      alert(message);
    }
  };

  const startGPSBreadcrumbTracking = () => {
    // Record breadcrumb every 30 seconds
    breadcrumbTimerRef.current = setInterval(async () => {
      if (activeCheckIn && currentLocation) {
        try {
          await mobileAPI.recordGPSBreadcrumb({
            checkInId: activeCheckIn.id,
            jobId: activeCheckIn.job_id,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            accuracy: currentLocation.accuracy,
            speed: currentLocation.speed,
            heading: currentLocation.heading
          });
          
          // Add to local breadcrumbs
          setGpsBreadcrumbs(prev => [...prev, {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            recorded_at: new Date().toISOString(),
            accuracy: currentLocation.accuracy
          }]);
        } catch (err) {
          console.error('Failed to record breadcrumb:', err);
        }
      }
    }, 30000); // 30 seconds
  };

  const stopGPSBreadcrumbTracking = () => {
    if (breadcrumbTimerRef.current) {
      clearInterval(breadcrumbTimerRef.current);
      breadcrumbTimerRef.current = null;
    }
  };

  const viewGPSRoute = async () => {
    if (!activeCheckIn) return;
    
    try {
      const route = await mobileAPI.getJobRoute(activeCheckIn.id);
      setGpsBreadcrumbs(route || []);
      setShowGPSMap(true);
    } catch (error) {
      // Use local breadcrumbs if API fails
      setShowGPSMap(true);
    }
  };

  // Start/stop breadcrumb tracking based on check-in status
  useEffect(() => {
    if (isCheckedIn) {
      startGPSBreadcrumbTracking();
    } else {
      stopGPSBreadcrumbTracking();
    }
    
    return () => stopGPSBreadcrumbTracking();
  }, [isCheckedIn, activeCheckIn]);

  // Signature pad drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!signaturePadRef.current) return;
    const canvas = signaturePadRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!signaturePadRef.current) return;
    const canvas = signaturePadRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clearSignature = () => {
    if (!signaturePadRef.current) return;
    const canvas = signaturePadRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 sticky top-0 z-10 shadow-lg">
        <h1 className="text-xl font-bold">Field Service</h1>
        {activeCheckIn && (
          <p className="text-sm opacity-90 mt-1">{activeCheckIn.job_name}</p>
        )}
      </div>

      {/* Status Banner */}
      <div className={`p-4 ${isCheckedIn ? 'bg-green-50 border-l-4 border-green-500' : 'bg-gray-50 border-l-4 border-gray-300'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCheckedIn ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">On Site</span>
              </>
            ) : (
              <>
                <Clock className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Not Checked In</span>
              </>
            )}
          </div>

          {isCheckedIn ? (
            <button
              onClick={handleCheckOut}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium"
            >
              Check Out
            </button>
          ) : (
            <button
              onClick={() => {
                const jobId = prompt('Enter Job ID to check in:');
                if (jobId) handleCheckIn(jobId);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              Check In
            </button>
          )}
        </div>

        {activeCheckIn && (
          <div className="mt-2 text-sm text-gray-700">
            <p>Started: {new Date(activeCheckIn.check_in_time).toLocaleTimeString()}</p>
            {activeCheckIn.job_address && (
              <p className="flex items-center gap-1 mt-1">
                <MapPin className="w-4 h-4" />
                {activeCheckIn.job_address}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Top Bar - Sync Status & Notifications */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <OfflineSyncStatus variant="compact" />
        <button
          onClick={() => setShowPushSettings(true)}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Bell className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Quick Actions */}
      {isCheckedIn && (
        <div className="p-4 grid grid-cols-4 gap-3">
          <button
            onClick={() => document.getElementById('photo-input')?.click()}
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <Camera className="w-6 h-6 text-blue-600 mb-2" />
            <span className="text-xs font-medium text-blue-900">Photo</span>
          </button>
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />

          <button
            onClick={handleAddNote}
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
          >
            <StickyNote className="w-6 h-6 text-green-600 mb-2" />
            <span className="text-xs font-medium text-green-900">Note</span>
          </button>

          <button
            onClick={handleBarcodeScan}
            className="flex flex-col items-center p-4 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors"
          >
            <QrCode className="w-6 h-6 text-purple-600 mb-2" />
            <span className="text-xs font-medium text-purple-900">Scan</span>
          </button>

          <button
            onClick={() => setShowVoiceRecorder(true)}
            className="flex flex-col items-center p-4 bg-orange-50 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors"
          >
            <Mic className="w-6 h-6 text-orange-600 mb-2" />
            <span className="text-xs font-medium text-orange-900">Voice</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      {isCheckedIn && (
        <>
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {['overview', 'photos', 'notes', 'signature', 'checklist'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Job Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium">{activeCheckIn?.job_status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Photos:</span>
                      <span className="font-medium">{photos.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Notes:</span>
                      <span className="font-medium">{notes.length}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckCompletion}
                    className="w-full mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium"
                  >
                    Check Completion Status
                  </button>

                  {gpsBreadcrumbs.length > 0 && (
                    <button
                      onClick={viewGPSRoute}
                      className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Route className="w-4 h-4" />
                      View GPS Route ({gpsBreadcrumbs.length} points)
                    </button>
                  )}
                </div>

                {completionCheck && (
                  <div className={`rounded-lg border p-4 ${
                    completionCheck.canSubmit
                      ? 'bg-green-50 border-green-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Completion Check</h3>
                      <span className="text-2xl font-bold">{completionCheck.completionPercentage}%</span>
                    </div>

                    <p className="text-sm mb-3">{completionCheck.summary}</p>

                    {completionCheck.missingItems.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-orange-900 mb-1">Missing:</p>
                        <ul className="list-disc list-inside text-xs text-orange-800 space-y-1">
                          {completionCheck.missingItems.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {completionCheck.recommendations.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-blue-900 mb-1">Next Steps:</p>
                        <ul className="list-disc list-inside text-xs text-blue-800 space-y-1">
                          {completionCheck.recommendations.map((rec: string, i: number) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Photos Tab */}
            {activeTab === 'photos' && (
              <div className="space-y-4">
                <button
                  onClick={() => document.getElementById('photo-input')?.click()}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Take Photo
                </button>

                <div className="grid grid-cols-2 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="bg-gray-100 rounded-lg overflow-hidden">
                      <div className="aspect-square bg-gray-200 flex items-center justify-center">
                        <Camera className="w-12 h-12 text-gray-400" />
                      </div>
                      <div className="p-2">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                          {photo.photo_type}
                        </span>
                        {photo.caption && (
                          <p className="text-xs text-gray-600 mt-1">{photo.caption}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(photo.taken_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {photos.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Camera className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No photos yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <button
                  onClick={handleAddNote}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <StickyNote className="w-5 h-5" />
                  Add Note
                </button>

                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3 rounded-lg border ${
                        note.is_important
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      {note.is_important && (
                        <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-900 rounded font-medium">
                          Important
                        </span>
                      )}
                      <p className="text-sm mt-2">{note.content}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {note.author_name} • {new Date(note.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {notes.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <StickyNote className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No notes yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Signature Tab */}
            {activeTab === 'signature' && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                    <p className="text-sm font-medium text-gray-700">Customer Signature</p>
                  </div>
                  <canvas
                    ref={signaturePadRef}
                    width={400}
                    height={200}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    className="w-full touch-none"
                    style={{ touchAction: 'none' }}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={clearSignature}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleSignature}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <FileSignature className="w-4 h-4" />
                    Save & Complete
                  </button>
                </div>

                <p className="text-xs text-gray-600 text-center">
                  Customer signature will mark job as completed
                </p>
              </div>
            )}

            {/* Checklist Tab */}
            {activeTab === 'checklist' && (
              <div className="space-y-3">
                <ChecklistItem label="Before photos taken" completed={photos.some(p => p.photo_type === 'before')} />
                <ChecklistItem label="Work completed" completed={activeCheckIn?.job_status === 'completed'} />
                <ChecklistItem label="After photos taken" completed={photos.some(p => p.photo_type === 'after')} />
                <ChecklistItem label="Customer signature obtained" completed={false} />
                <ChecklistItem label="Site cleaned up" completed={false} />
                <ChecklistItem label="All materials accounted for" completed={false} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Not Checked In State */}
      {!isCheckedIn && (
        <div className="p-8 text-center">
          <Navigation className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ready to Start?</h2>
          <p className="text-gray-600 mb-6">
            Check in to a job to access mobile field features
          </p>
          <button
            onClick={() => {
              const jobId = prompt('Enter Job ID to check in:');
              if (jobId) handleCheckIn(jobId);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium"
          >
            Check In to Job
          </button>
        </div>
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onScan={handleBarcodeDetected}
        onClose={() => setShowBarcodeScanner(false)}
        scanType="job"
      />

      {/* Voice Recorder */}
      <VoiceMemoRecorder
        isOpen={showVoiceRecorder}
        onClose={() => setShowVoiceRecorder(false)}
        onSave={handleVoiceMemoSave}
      />

      {/* GPS Route Viewer */}
      <GPSBreadcrumbMap
        isOpen={showGPSMap}
        onClose={() => setShowGPSMap(false)}
        breadcrumbs={gpsBreadcrumbs}
      />
    </div>
  );
}

function ChecklistItem({ label, completed }: { label: string; completed: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
      completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
    }`}>
      {completed ? (
        <CheckSquare className="w-5 h-5 text-green-600" />
      ) : (
        <div className="w-5 h-5 border-2 border-gray-300 rounded" />
      )}
      <span className={`text-sm ${completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>
        {label}
      </span>
    </div>
  );
}
