import React, { useRef, useEffect } from 'react';

interface TelemetryPoint {
  throttle: number;
  brake: number;
  abs: boolean;
}

interface TelemetryGraphProps {
  data: TelemetryPoint;
}

const MAX_POINTS = 180; // 3 seconds at 60Hz

export const TelemetryGraph: React.FC<TelemetryGraphProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // We initialize the history buffer with empty data
  const historyRef = useRef<TelemetryPoint[]>(Array(MAX_POINTS).fill({ throttle: 0, brake: 0, abs: false }));

  useEffect(() => {
    // Shift old data and push new data
    historyRef.current.push(data);
    if (historyRef.current.length > MAX_POINTS) {
      historyRef.current.shift();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use actual dimensions for High-DPI displays later if needed, but for now CSS handles scaling
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Draw Rolling Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Vertical lines that appear to move to the left
    const offset = (Date.now() / 10) % 50; 
    for (let i = width; i > -50; i -= 50) {
      const x = i - offset;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    // Horizontal lines
    for (let i = 0; i <= height; i += height / 4) {
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
    }
    ctx.stroke();

    const drawLine = (key: 'throttle' | 'brake', color: string, fillArea: boolean) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        
        historyRef.current.forEach((point, i) => {
            const x = (i / MAX_POINTS) * width;
            const y = height - (point[key] / 100) * height;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              // Add slight bezier smoothing for the line
              const prevPoint = historyRef.current[i - 1];
              const prevX = ((i - 1) / MAX_POINTS) * width;
              const prevY = height - (prevPoint[key] / 100) * height;
              const cpX = (prevX + x) / 2;
              
              ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
            }
        });
        
        if (fillArea) {
            // Drop to bottom to fill
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.fillStyle = color.replace(')', ', 0.1)').replace('rgb', 'rgba'); 
            if (color.startsWith('#')) {
                ctx.fillStyle = color + '15'; // Hex alpha representation
            }
            ctx.fill();
        }
        
        ctx.stroke();
    };

    // Draw lines
    drawLine('throttle', '#00e5ff', true); // Cyan / Greenish (Accent)
    drawLine('brake', '#ff3366', true); // Red (Status Error)

    // Draw ABS Triggers
    historyRef.current.forEach((point, i) => {
        if (point.abs) {
            const x = (i / MAX_POINTS) * width;
            const y = height - (point.brake / 100) * height;
            
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffb000'; // Yellow/Orange
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffb000';
            ctx.fill();
            ctx.shadowBlur = 0; // Reset
        }
    });

  }, [data]);

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
              <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_5px_rgba(0,229,255,0.5)]" />
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
