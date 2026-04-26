import React, { useRef, useEffect } from 'react';

interface TelemetryPoint {
  throttle: number;
  brake: number;
  abs: boolean;
}

interface TelemetryGraphProps {
  data: TelemetryPoint;
}

const MAX_POINTS = 600; // 10 seconds at 60Hz

export const TelemetryGraph: React.FC<TelemetryGraphProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // We initialize the history buffer with empty data
  const historyRef = useRef<TelemetryPoint[]>(Array(MAX_POINTS).fill({ throttle: 0, brake: 0, abs: false }));

  useEffect(() => {
    // Add current data to history
    historyRef.current.push(data);
    if (historyRef.current.length > MAX_POINTS) {
      historyRef.current.shift();
    }
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle High-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;

    let rafId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      
      // Clear background
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Draw Rolling Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      const gridSpacing = 80; 
      const scrollOffset = (performance.now() / 50) % gridSpacing; 
      for (let i = width; i > -gridSpacing; i -= gridSpacing) {
        const x = i - scrollOffset;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      
      for (let i = 0; i <= height; i += height / 4) {
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
      }
      ctx.stroke();

      const drawLine = (key: 'throttle' | 'brake', color: string, glowColor: string) => {
          const history = historyRef.current;
          if (history.length < 2) return;

          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = 3.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          
          // Add neon glow
          ctx.shadowBlur = 10;
          ctx.shadowColor = glowColor;

          // Start position
          const startX = 0;
          const startY = height - (history[0][key] / 100) * height;
          ctx.moveTo(startX, startY);

          // Quadratic Bezier Smoothing
          for (let i = 1; i < history.length - 2; i++) {
              const x = (i / MAX_POINTS) * width;
              const y = height - (history[i][key] / 100) * height;
              
              const nextX = ((i + 1) / MAX_POINTS) * width;
              const nextY = height - (history[i + 1][key] / 100) * height;
              
              const xc = (x + nextX) / 2;
              const yc = (y + nextY) / 2;
              
              ctx.quadraticCurveTo(x, y, xc, yc);
          }

          // Final segment
          const lastIdx = history.length - 1;
          const lx = (lastIdx / MAX_POINTS) * width;
          const ly = height - (history[lastIdx][key] / 100) * height;
          ctx.lineTo(lx, ly);
          ctx.stroke();

          // Reset glow for fill
          ctx.shadowBlur = 0;

          // Premium Gradient Fill
          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, glowColor + '30');
          grad.addColorStop(1, glowColor + '00');
          
          ctx.lineTo(lx, height);
          ctx.lineTo(0, height);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
      };

      drawLine('throttle', '#00ff88', '#00ff88');
      drawLine('brake', '#ff3366', '#ff3366');
      
      ctx.restore();

      historyRef.current.forEach((point, i) => {
          if (point.abs) {
              const x = (i / MAX_POINTS) * width;
              const y = height - (point.brake / 100) * height;
              ctx.beginPath();
              ctx.arc(x, y, 4, 0, Math.PI * 2);
              ctx.fillStyle = '#ffb000';
              ctx.fill();
          }
      });

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="card w-full h-[150px] bg-panel/30 border-white/5 relative overflow-hidden shrink-0">
        <canvas 
            ref={canvasRef} 
            width={800} 
            height={150} 
            className="w-full h-full"
        />
        <div className="absolute top-2 left-3 flex gap-4">
           <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-status-success shadow-[0_0_5px_rgba(0,255,136,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Throttle</span>
           </div>
           <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-status-error shadow-[0_0_5px_rgba(255,51,102,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Brake</span>
           </div>
           <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#ffb000] shadow-[0_0_5px_rgba(255,176,0,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">ABS Active</span>
           </div>
        </div>
    </div>
  );
};
