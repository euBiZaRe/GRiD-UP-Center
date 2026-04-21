import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';

interface RaceControlProps {
  telemetry: any;
  session: any;
}

const RaceControl: React.FC<RaceControlProps> = ({ telemetry, session }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const prevIncs = useRef<number>(0);
  const prevSurfaces = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!telemetry || !telemetry.drivers) return;

    const newLogs: any[] = [];
    const timestamp = new Date().toLocaleTimeString('en-GB'); // 06:47:52 style

    // Detect Player/Team Incidents
    const currentIncs = telemetry.incidents || 0;
    if (currentIncs > prevIncs.current) {
        const delta = currentIncs - prevIncs.current;
        const player = Object.values(telemetry.drivers).find((d: any) => d.isPlayer) as any;
        
        newLogs.unshift({
            id: Date.now() + Math.random(),
            time: timestamp,
            type: '[INCIDENT]',
            severity: 'error',
            info: `+${delta}x Points`,
            driver: player ? player.name : 'Team Driver',
            carNum: player ? player.carNum : 0,
            lap: telemetry.lap || 0,
            sessionTime: telemetry.session_time || null
        });
        prevIncs.current = currentIncs;
    }

    // Detect Opponent Excursions
    Object.values(telemetry.drivers).forEach((driver: any) => {
        if (driver.isPlayer) return; // Handled by team incident points

        const prevSurf = prevSurfaces.current[driver.carNum];
        // 0 is OffTrack in iRacing surface enum
        if (driver.surface === 0 && prevSurf !== 0 && prevSurf !== undefined) {
             newLogs.unshift({
                id: Date.now() + Math.random(),
                time: timestamp,
                type: '[EXCURSION]',
                severity: 'warning',
                info: `Off Track Detected`,
                driver: driver.name,
                carNum: driver.carNum,
                lap: telemetry.lap || 0,
                sessionTime: telemetry.session_time || null
            });
        }
        prevSurfaces.current[driver.carNum] = driver.surface;
    });

    if (newLogs.length > 0) {
        setLogs(prev => [...newLogs, ...prev].slice(0, 100)); // Keep last 100
    }

  }, [telemetry]);

  const handleJump = (carNum: string | number, sessionTime?: number | null) => {
      if (window.electron && window.electron.sendCommand) {
          window.electron.sendCommand({
              action: 'spectator_jump',
              carNum,
              sessionTime: sessionTime ?? null
          });
      }
  };

  return (
    <div className="p-8 h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-hidden">
      
      {/* Feed Container */}
      <div className="card bg-panel/30 border-white/5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-6 shrink-0 border-b border-white/5 pb-4 px-2">
            <AlertCircle size={16} className="text-accent" />
            <h2 className="text-xs font-black italic tracking-widest uppercase text-accent">Live Event Feed // Race Control</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 pr-4">
            {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                   <div className="text-[10px] text-gray-600 italic tracking-widest uppercase animate-pulse">Scanning track sectors...</div>
                </div>
            ) : (
                logs.map(log => (
                    <div 
                        key={log.id} 
                        onClick={() => handleJump(log.carNum, log.sessionTime)}
                        className="group flex items-center p-3 rounded-lg bg-black/40 border border-white/5 hover:border-accent/40 cursor-pointer transition-colors"
                    >
                        <div className="w-24 text-[10px] font-mono text-gray-500 font-bold tracking-widest">
                            {log.time}
                        </div>
                        <div className={`w-28 text-[9px] font-black uppercase tracking-widest ${log.severity === 'error' ? 'text-status-error' : 'text-[#ffb000]'}`}>
                            {log.type}
                        </div>
                        <div className="flex-1">
                            <span className="block text-xs font-bold text-white tracking-widest mb-1">{log.info}</span>
                            <span className="text-[10px] text-gray-500">{log.driver}</span>
                        </div>
                        <div className="w-16 text-right">
                            <span className="text-accent text-[10px] font-bold group-hover:bg-accent group-hover:text-black px-2 py-1 rounded transition-colors uppercase tracking-widest">
                                Jump 🎥
                            </span>
                        </div>
                        <div className="w-12 text-right text-[10px] font-black text-accent tracking-widest">
                            L{log.lap}
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Safety Notice Footer */}
      <div className="card bg-status-error/5 border-status-error/20 flex flex-col shrink-0 p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-status-error" />
          <h2 className="text-[10px] font-black italic tracking-widest uppercase text-status-error">Safety Notice</h2>
        </div>
        <p className="text-[10px] text-gray-400">
            This feed logs all teammate incidents and track-wide hazards in real-time. Use this data to anticipate multi-car incidents or track blockages ahead. Click any log event to instantly focus your simulator spectator camera.
        </p>
      </div>

    </div>
  );
};

export default RaceControl;
