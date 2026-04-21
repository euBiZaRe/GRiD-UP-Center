import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import {
  setupCanvasContext,
  drawTrack,
  drawStartFinishLine,
  drawDrivers,
} from './trackDrawingUtils';

export interface TrackProps {
  trackId: number;
  drivers: Record<string, any>;
  visibleClasses: Set<number>;
  driverCircleSize?: number;
  playerCircleSize?: number;
  trackLineWidth?: number;
  trackOutlineWidth?: number;
}

const TRACK_DRAWING_WIDTH = 1920;
const TRACK_DRAWING_HEIGHT = 1080;

export const TrackCanvas: React.FC<TrackProps> = ({
  trackId,
  drivers,
  visibleClasses,
  driverCircleSize = 35,
  playerCircleSize = 45,
  trackLineWidth = 25,
  trackOutlineWidth = 50,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [trackDrawing, setTrackDrawing] = useState<any>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Load track data via IPC
  useEffect(() => {
    setTrackDrawing(null); // Explicitly clear any existing loaded track map

    async function load() {
      if (trackId && window.electron?.invoke) {
        try {
            const data = await window.electron.invoke('get-track-data', trackId);
            setTrackDrawing(data);
        } catch (e) {
            setTrackDrawing(null);
            console.error("Failed to load track data", e);
        }
      }
    }
    load();
  }, [trackId]);

  // Handle Resize
  useEffect(() => {
    if (!trackDrawing) return; // Wait for track to parse and render canvas

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      setCanvasSize({ width: rect.width, height: rect.height });
    };
    
    // Slight timeout ensures DOM has settled
    const timeout = setTimeout(handleResize, 10);
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [trackDrawing]);

  const path2DObjects = useMemo(() => {
    if (!trackDrawing?.active?.inside) return null;
    return {
      inside: new Path2D(trackDrawing.active.inside),
    };
  }, [trackDrawing]);

  // Position Calculation
  const calculatePositions = useMemo(() => {
    if (!trackDrawing?.active?.trackPathPoints || !trackDrawing?.active?.totalLength) return {};

    const trackPathPoints = trackDrawing.active.trackPathPoints;
    const direction = trackDrawing.startFinish?.direction || 'clockwise';
    const intersectionLength = trackDrawing.startFinish?.point?.length || 0;
    const totalLength = trackDrawing.active.totalLength;

    const result: any = {};
    Object.entries(drivers).forEach(([idx, d]: [string, any]) => {
      const progress = d.progress;
      const adjustedLength = (totalLength * progress) % totalLength;
      
      const length = direction === 'anticlockwise'
        ? (intersectionLength + adjustedLength) % totalLength
        : (intersectionLength - adjustedLength + totalLength) % totalLength;

      const floatIndex = (length / totalLength) * (trackPathPoints.length - 1);
      const index1 = Math.floor(floatIndex);
      const index2 = Math.min(index1 + 1, trackPathPoints.length - 1);
      const t = floatIndex - index1;

      const p1 = trackPathPoints[index1];
      const p2 = trackPathPoints[index2];

      result[idx] = {
        position: {
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
        },
        driver: d,
        isPlayer: d.isPlayer,
        classId: d.classId
      };
    });
    return result;
  }, [drivers, trackDrawing]);

  // Static Layer (Track)
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !path2DObjects || canvasSize.width === 0) return;

    if (!cacheCanvasRef.current) {
      cacheCanvasRef.current = document.createElement('canvas');
    }
    const cacheCanvas = cacheCanvasRef.current;
    const cacheCtx = cacheCanvas.getContext('2d');
    if (!cacheCtx) return;

    cacheCanvas.width = canvas.width;
    cacheCanvas.height = canvas.height;

    const scaleX = canvasSize.width / (TRACK_DRAWING_WIDTH + 200);
    const scaleY = canvasSize.height / (TRACK_DRAWING_HEIGHT + 200);
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvasSize.width - TRACK_DRAWING_WIDTH * scale) / 2;
    const offsetY = (canvasSize.height - TRACK_DRAWING_HEIGHT * scale) / 2;

    const dpr = window.devicePixelRatio || 1;
    cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
    cacheCtx.scale(dpr, dpr);

    setupCanvasContext(cacheCtx, scale, offsetX, offsetY, true);
    drawTrack(cacheCtx, path2DObjects, false, trackLineWidth, trackOutlineWidth, true);
    // drawStartFinishLine(cacheCtx, trackDrawing.startFinish);
    cacheCtx.restore();
  }, [path2DObjects, canvasSize, trackDrawing]);

  // Dynamic Layer (Drivers)
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !cacheCanvasRef.current) return;

    // Blit background
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cacheCanvasRef.current, 0, 0);
    ctx.restore();

    // Draw drivers
    const scaleX = canvasSize.width / (TRACK_DRAWING_WIDTH + 200);
    const scaleY = canvasSize.height / (TRACK_DRAWING_HEIGHT + 200);
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvasSize.width - TRACK_DRAWING_WIDTH * scale) / 2;
    const offsetY = (canvasSize.height - TRACK_DRAWING_HEIGHT * scale) / 2;

    setupCanvasContext(ctx, scale, offsetX, offsetY, true);
    drawDrivers(ctx, calculatePositions, driverCircleSize, playerCircleSize, visibleClasses);
    ctx.restore();
  }, [calculatePositions, canvasSize, visibleClasses]);

  if (!trackDrawing) return (
    <div className="flex items-center justify-center h-full text-xs text-gray-500 uppercase tracking-widest font-bold">
      Loading Track Map...
    </div>
  );

  return (
    <div className="w-full h-full relative overflow-hidden bg-black/20 rounded-xl border border-white/5">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};
