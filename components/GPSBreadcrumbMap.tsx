import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Clock, Route, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface GPSPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  recorded_at: string;
  speed?: number;
}

interface GPSBreadcrumbMapProps {
  isOpen: boolean;
  onClose: () => void;
  breadcrumbs: GPSPoint[];
  jobAddress?: string;
  startTime?: string;
  endTime?: string;
}

export function GPSBreadcrumbMap({ 
  isOpen, 
  onClose, 
  breadcrumbs, 
  jobAddress,
  startTime,
  endTime 
}: GPSBreadcrumbMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [stats, setStats] = useState({
    totalDistance: 0,
    duration: 0,
    pointCount: 0,
    avgSpeed: 0
  });

  useEffect(() => {
    if (isOpen && breadcrumbs.length > 0) {
      calculateStats();
      drawMap();
    }
  }, [isOpen, breadcrumbs, scale, offset]);

  const calculateStats = () => {
    if (breadcrumbs.length < 2) return;

    let totalDistance = 0;
    let totalSpeed = 0;
    let speedCount = 0;

    for (let i = 1; i < breadcrumbs.length; i++) {
      const prev = breadcrumbs[i - 1];
      const curr = breadcrumbs[i];
      
      totalDistance += calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );

      if (curr.speed && curr.speed > 0) {
        totalSpeed += curr.speed;
        speedCount++;
      }
    }

    const duration = startTime && endTime 
      ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000 / 60
      : 0;

    setStats({
      totalDistance: Math.round(totalDistance * 100) / 100,
      duration: Math.round(duration * 10) / 10,
      pointCount: breadcrumbs.length,
      avgSpeed: speedCount > 0 ? Math.round((totalSpeed / speedCount) * 10) / 10 : 0
    });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas || breadcrumbs.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate bounds
    const lats = breadcrumbs.map(p => p.latitude);
    const lons = breadcrumbs.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // Add padding
    const latPadding = (maxLat - minLat) * 0.1 || 0.001;
    const lonPadding = (maxLon - minLon) * 0.1 || 0.001;

    const bounds = {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLon: minLon - lonPadding,
      maxLon: maxLon + lonPadding
    };

    // Convert lat/lon to canvas coordinates
    const toCanvas = (lat: number, lon: number) => {
      const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * canvas.width;
      const y = canvas.height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * canvas.height;
      return { 
        x: (x - canvas.width / 2) * scale + canvas.width / 2 + offset.x, 
        y: (y - canvas.height / 2) * scale + canvas.height / 2 + offset.y 
      };
    };

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridSize = 50 * scale;
    
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw route line
    if (breadcrumbs.length > 1) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3 * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      const start = toCanvas(breadcrumbs[0].latitude, breadcrumbs[0].longitude);
      ctx.moveTo(start.x, start.y);
      
      for (let i = 1; i < breadcrumbs.length; i++) {
        const point = toCanvas(breadcrumbs[i].latitude, breadcrumbs[i].longitude);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();

      // Draw gradient under route
      ctx.lineWidth = 8 * scale;
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.stroke();
    }

    // Draw points
    breadcrumbs.forEach((point, index) => {
      const pos = toCanvas(point.latitude, point.longitude);
      
      // Skip if outside canvas
      if (pos.x < -10 || pos.x > canvas.width + 10 || pos.y < -10 || pos.y > canvas.height + 10) {
        return;
      }

      const isFirst = index === 0;
      const isLast = index === breadcrumbs.length - 1;

      // Draw accuracy circle
      if (point.accuracy) {
        const accuracyRadius = Math.max(5, point.accuracy * scale);
        ctx.fillStyle = isFirst ? 'rgba(34, 197, 94, 0.2)' : 
                        isLast ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, accuracyRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw point
      ctx.fillStyle = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isFirst || isLast ? 8 * scale : 4 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Draw white border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();

      // Draw labels for first and last
      if (isFirst || isLast) {
        ctx.fillStyle = '#1f2937';
        ctx.font = `bold ${12 * scale}px sans-serif`;
        ctx.fillText(isFirst ? 'START' : 'END', pos.x + 12 * scale, pos.y + 4 * scale);
      }
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.3, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.3, 0.3));
  };

  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <Route className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">GPS Route</h2>
            {jobAddress && (
              <p className="text-sm text-gray-400 truncate max-w-xs">{jobAddress}</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-around p-3 bg-gray-800 border-b border-gray-700">
        <StatItem 
          icon={<Route className="w-4 h-4" />}
          label="Distance"
          value={`${stats.totalDistance.toFixed(2)} km`}
        />
        <StatItem 
          icon={<Clock className="w-4 h-4" />}
          label="Duration"
          value={`${stats.duration.toFixed(1)} min`}
        />
        <StatItem 
          icon={<MapPin className="w-4 h-4" />}
          label="Points"
          value={stats.pointCount.toString()}
        />
        <StatItem 
          icon={<Navigation className="w-4 h-4" />}
          label="Avg Speed"
          value={`${stats.avgSpeed.toFixed(1)} m/s`}
        />
      </div>

      {/* Map Canvas */}
      <div className="flex-1 relative bg-gray-100 overflow-hidden">
        {breadcrumbs.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Route className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No GPS data available for this job</p>
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-full cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        )}

        {/* Zoom Controls */}
        {breadcrumbs.length > 0 && (
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button
              onClick={handleZoomIn}
              className="p-2 bg-white shadow-lg rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ZoomIn className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-white shadow-lg rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ZoomOut className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 bg-white shadow-lg rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
              <span className="text-gray-700">Start</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
              <span className="text-gray-700">End</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-500" />
              <span className="text-gray-700">Route</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-gray-900 text-white border-t border-gray-800">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {startTime && (
              <span className="text-gray-400">
                Started: {new Date(startTime).toLocaleTimeString()}
              </span>
            )}
            {endTime && (
              <span className="text-gray-400">
                Ended: {new Date(endTime).toLocaleTimeString()}
              </span>
            )}
          </div>
          <span className="text-gray-500">
            {breadcrumbs.length} GPS points recorded
          </span>
        </div>
      </div>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-300">
      <span className="text-gray-500">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

export default GPSBreadcrumbMap;
