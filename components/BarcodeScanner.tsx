import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Flashlight, Camera as CameraIcon, ScanLine } from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string, format: string) => void;
  scanType?: 'inventory' | 'job' | 'general';
}

export function BarcodeScanner({ isOpen, onClose, onScan, scanType = 'general' }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFlashlight, setHasFlashlight] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get available cameras on mount
  useEffect(() => {
    if (isOpen) {
      getCameras();
    }
    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const getCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Prefer back camera
        const backCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        setSelectedCamera(backCamera?.id || devices[0].id);
      } else {
        setError('No cameras found on this device');
      }
    } catch (err) {
      setError('Could not access cameras. Please ensure camera permissions are granted.');
      console.error('Camera access error:', err);
    }
  };

  const startScanning = async () => {
    if (!selectedCamera || !containerRef.current) return;

    try {
      setError(null);
      setIsScanning(true);

      scannerRef.current = new Html5Qrcode('barcode-scanner-container');
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ]
      };

      await scannerRef.current.start(
        selectedCamera,
        config,
        (decodedText, decodedResult) => {
          // Successfully scanned
          handleScanSuccess(decodedText, decodedResult);
        },
        (errorMessage) => {
          // Scanning error (usually "No barcode found" which is normal)
          // Don't show these errors to user
        }
      );

      // Check if flashlight is available
      const capabilities = scannerRef.current.getRunningTrackCameraCapabilities();
      if (capabilities && capabilities.torchFeature) {
        setHasFlashlight(true);
      }

    } catch (err) {
      setError('Failed to start scanner. Please try again.');
      setIsScanning(false);
      console.error('Scanner start error:', err);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Stop scanning error:', err);
      }
    }
    setIsScanning(false);
    setFlashlightOn(false);
  };

  const handleScanSuccess = (text: string, result: any) => {
    const format = result.result.format?.formatName || 'UNKNOWN';
    
    // Stop scanning and close
    stopScanning();
    onScan(text, format);
    onClose();
  };

  const toggleFlashlight = async () => {
    if (!scannerRef.current) return;
    
    try {
      const capabilities = scannerRef.current.getRunningTrackCameraCapabilities();
      if (capabilities && capabilities.torchFeature) {
        const torch = capabilities.torchFeature();
        await torch.apply(!flashlightOn);
        setFlashlightOn(!flashlightOn);
      }
    } catch (err) {
      console.error('Flashlight toggle error:', err);
    }
  };

  const handleManualEntry = () => {
    const manualCode = prompt('Enter barcode manually:');
    if (manualCode && manualCode.trim()) {
      onScan(manualCode.trim(), 'MANUAL');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
        <div className="flex items-center gap-2">
          <ScanLine className="w-6 h-6 text-blue-400" />
          <h2 className="text-lg font-semibold">
            {scanType === 'inventory' ? 'Scan Inventory Item' : 
             scanType === 'job' ? 'Scan Job Materials' : 'Scan Barcode'}
          </h2>
        </div>
        <button
          onClick={() => {
            stopScanning();
            onClose();
          }}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <p className="text-red-200 text-sm text-center">{error}</p>
          <button
            onClick={getCameras}
            className="mt-2 w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
          >
            Retry Camera Access
          </button>
        </div>
      )}

      {/* Camera Selection */}
      {!isScanning && cameras.length > 1 && (
        <div className="mx-4 mt-4 p-4 bg-gray-800 rounded-lg">
          <label className="block text-sm text-gray-400 mb-2">Select Camera</label>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
          >
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Scanner Container */}
      <div className="flex-1 relative bg-black">
        <div 
          ref={containerRef}
          id="barcode-scanner-container" 
          className="w-full h-full"
          style={{ 
            minHeight: '300px',
            display: isScanning ? 'block' : 'none'
          }}
        />

        {/* Scanning Guide Overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner markers */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500" />
              
              {/* Scan line animation */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan" 
                style={{
                  animation: 'scan 2s linear infinite'
                }}
              />
            </div>

            {/* Instructions */}
            <div className="absolute bottom-20 left-0 right-0 text-center">
              <p className="text-white text-sm bg-black/50 px-4 py-2 rounded-full inline-block">
                Position barcode within the frame
              </p>
            </div>
          </div>
        )}

        {/* Not Scanning State */}
        {!isScanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <CameraIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">Camera ready</p>
              <button
                onClick={startScanning}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <ScanLine className="w-5 h-5" />
                Start Scanning
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-gray-900 space-y-3">
        {isScanning ? (
          <div className="flex gap-3">
            {hasFlashlight && (
              <button
                onClick={toggleFlashlight}
                className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                  flashlightOn 
                    ? 'bg-yellow-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Flashlight className="w-5 h-5" />
                {flashlightOn ? 'Light On' : 'Light'}
              </button>
            )}
            <button
              onClick={stopScanning}
              className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium"
            >
              Stop Scanning
            </button>
          </div>
        ) : (
          <button
            onClick={startScanning}
            disabled={!selectedCamera}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:bg-gray-700 disabled:text-gray-500"
          >
            {cameras.length === 0 ? 'Loading Cameras...' : 'Start Scanning'}
          </button>
        )}

        <button
          onClick={handleManualEntry}
          className="w-full py-3 bg-gray-700 text-gray-300 rounded-lg font-medium hover:bg-gray-600 transition-colors"
        >
          Enter Manually
        </button>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default BarcodeScanner;
