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
  hiddenClasses: Set<number>;
  driverCircleSize?: number;
  playerCircleSize?: number;
  trackLineWidth?: number;
  trackOutlineWidth?: number;
  zoomDomain?: [number, number] | null;
  drivingPath?: any[]; // Array of { p: progress } or { x, y }
  observedIdx?: string;
}

const TRACK_DRAWING_WIDTH = 1920;
const TRACK_DRAWING_HEIGHT = 1080;

export const TrackCanvas: React.FC<TrackProps> = ({
  trackId,
  drivers,
  hiddenClasses,
  driverCircleSize = 35,
  playerCircleSize = 45,
  trackLineWidth = 60,
  trackOutlineWidth = 100,
  zoomDomain = null,
  drivingPath = [],
  observedIdx,
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

  const pathElement = useMemo(() => {
    if (!trackDrawing?.active?.inside) return null;
    try {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', trackDrawing.active.inside);
      return path;
    } catch (e) {
      console.error("Failed to create SVG path element", e);
      return null;
    }
  }, [trackDrawing]);

  const totalPathLength = useMemo(() => {
    if (!pathElement) return 0;
    try { return pathElement.getTotalLength(); } catch(e) { return 0; }
  }, [pathElement]);

  const getPos = React.useCallback((progress: number) => {
    if (!trackDrawing) return null;
    const direction = trackDrawing.startFinish?.direction || 'clockwise';
    const intersectionLength = trackDrawing.startFinish?.point?.length || 0;
    const totalLength = trackDrawing.active?.totalLength || totalPathLength;

    const adjustedLength = (totalLength * progress) % totalLength;
    const length = direction === 'anticlockwise'
        ? (intersectionLength + adjustedLength) % totalLength
        : (intersectionLength - adjustedLength + totalLength) % totalLength;

    if (trackDrawing.active?.trackPathPoints && trackDrawing.active?.totalLength) {
        const trackPathPoints = trackDrawing.active.trackPathPoints;
        const floatIndex = (length / totalLength) * (trackPathPoints.length - 1);
        const index1 = Math.floor(floatIndex);
        const index2 = Math.min(index1 + 1, trackPathPoints.length - 1);
        const t = floatIndex - index1;
        const p1 = trackPathPoints[index1];
        const p2 = trackPathPoints[index2];
        return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
    } else if (pathElement && totalPathLength > 0) {
        try {
            return pathElement.getPointAtLength(length);
        } catch (e) { return null; }
    }
    return null;
  }, [trackDrawing, pathElement, totalPathLength]);

  // Position Calculation
  const calculatePositions = useMemo(() => {
    const result: any = {};
    Object.entries(drivers).forEach(([idx, d]: [string, any]) => {
      const pos = getPos(d.progress);
      if (pos) {
        result[idx] = {
          position: pos,
          driver: d,
          isPlayer: d.isPlayer,
          classId: d.classId
        };
      }
    });
    return result;
  }, [drivers, getPos]);

  const mapTransform = useMemo(() => {
    if (canvasSize.width === 0) return { scale: 1, offsetX: 0, offsetY: 0, drawingScale: 1 };

    // Calculate dynamic bounds based on zoomDomain
    let drawingWidth = TRACK_DRAWING_WIDTH + 200;
    let drawingHeight = TRACK_DRAWING_HEIGHT + 200;
    let targetOffsetX = -100;
    let targetOffsetY = -100;

    if (zoomDomain && trackDrawing) {
        try {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const [startPct, endPct] = zoomDomain;
            for (let i = 0; i <= 60; i++) {
                const p = (startPct / 100) + (i / 60) * ((endPct - startPct) / 100);
                const point = getPos(p);
                if (point) {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                }
            }

            const padding = 150;
            drawingWidth = Math.max(300, (maxX - minX) + padding * 2);
            drawingHeight = Math.max(300, (maxY - minY) + padding * 2);
            targetOffsetX = minX - padding;
            targetOffsetY = minY - padding;
        } catch (e) {
            console.error("Zoom bounds calculation failed", e);
        }
    }

    const scaleX = canvasSize.width / drawingWidth;
    const scaleY = canvasSize.height / drawingHeight;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvasSize.width - drawingWidth * scale) / 2 - targetOffsetX * scale;
    const offsetY = (canvasSize.height - drawingHeight * scale) / 2 - targetOffsetY * scale;

    return { scale, offsetX, offsetY, drawingScale: drawingWidth / (TRACK_DRAWING_WIDTH + 200) };
  }, [canvasSize, zoomDomain, trackDrawing, getPos]);

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

    const { scale, offsetX, offsetY, drawingScale } = mapTransform;
    const dpr = window.devicePixelRatio || 1;
    cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
    cacheCtx.scale(dpr, dpr);

    cacheCtx.save();
    cacheCtx.translate(offsetX, offsetY);
    cacheCtx.scale(scale, scale);

    // V1.4.9-FIX: Scale down line widths when zoomed in to prevent "blobbing"
    const adjustedLineWidth = trackLineWidth * (drawingScale || 1);
    const adjustedOutlineWidth = trackOutlineWidth * (drawingScale || 1);

    drawTrack(cacheCtx, path2DObjects, false, adjustedLineWidth, adjustedOutlineWidth, true);
    cacheCtx.restore();
  }, [path2DObjects, canvasSize, mapTransform, trackLineWidth, trackOutlineWidth]);

  // Motion Interpolation Engine
  const interpPositionsRef = useRef<Record<string, any>>({});
  const rafRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !cacheCanvasRef.current || !trackDrawing) return;

    const render = () => {
      // Blit background
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(cacheCanvasRef.current!, 0, 0);
      ctx.restore();

      // Update Interpolated Positions
      const updatedInterp: Record<string, any> = {};
      const smoothingFactor = 0.15; // Adjusted for 60fps against 5Hz data

      Object.entries(calculatePositions).forEach(([idx, target]: [string, any]) => {
        const prev = interpPositionsRef.current[idx];
        
        if (!prev) {
          updatedInterp[idx] = target;
        } else {
          // LERP position for smooth glide
          updatedInterp[idx] = {
            ...target,
            position: {
              x: prev.position.x + (target.position.x - prev.position.x) * smoothingFactor,
              y: prev.position.y + (target.position.y - prev.position.y) * smoothingFactor
            }
          };
        }
      });

      interpPositionsRef.current = updatedInterp;

      // Draw driving path (V1.5.0 makeover feature)
      const { scale, offsetX, offsetY } = mapTransform;
      if (drivingPath && drivingPath.length > 0) {
        ctx.save();
        setupCanvasContext(ctx, scale, offsetX, offsetY, true);
        
        // Base Trail (Past/Future) - Subtly visible
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; 
        ctx.lineWidth = 8 / scale; // Constant pixel width relative to view
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        let first = true;
        const samples = drivingPath.length > 800 ? drivingPath.filter((_, i) => i % Math.ceil(drivingPath.length / 800) === 0) : drivingPath;
        
        samples.forEach(pt => {
          const pos = getPos(pt.p);
          if (pos) {
            if (first) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
            first = false;
          }
        });
        ctx.stroke();
        
        // Active Zoomed Section - PRECISE NEEDLE
        if (zoomDomain) {
           const [start, end] = zoomDomain;
           ctx.beginPath();
           ctx.strokeStyle = '#ff2d55'; 
           ctx.lineWidth = 4 / scale; // Thin precise line
           let zFirst = true;
           samples.forEach(pt => {
             const pPct = pt.p * 100;
             if (pPct >= start && pPct <= end) {
               const pos = getPos(pt.p);
               if (pos) {
                 if (zFirst) ctx.moveTo(pos.x, pos.y);
                 else ctx.lineTo(pos.x, pos.y);
                 zFirst = false;
               }
             }
           });
           ctx.stroke();

           // Core line for focus
           ctx.beginPath();
           ctx.strokeStyle = '#ffffff'; 
           ctx.lineWidth = 1 / scale;
           let cFirst = true;
           samples.forEach(pt => {
             const pPct = pt.p * 100;
             if (pPct >= start && pPct <= end) {
               const pos = getPos(pt.p);
               if (pos) {
                 if (cFirst) ctx.moveTo(pos.x, pos.y);
                 else ctx.lineTo(pos.x, pos.y);
                 cFirst = false;
               }
             }
           });
           ctx.stroke();
        }
        ctx.restore();
      }

      // Draw drivers
      ctx.save();
      setupCanvasContext(ctx, scale, offsetX, offsetY, true);
      drawDrivers(ctx, updatedInterp, driverCircleSize, playerCircleSize, hiddenClasses, observedIdx);
      ctx.restore();

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [calculatePositions, canvasSize, hiddenClasses, trackDrawing, driverCircleSize, playerCircleSize, drivingPath, getPos, mapTransform, zoomDomain]);

  // Combined LayoutEffect (Legacy removal)
  // (The drawing logic is now handled by the render loop above)

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
