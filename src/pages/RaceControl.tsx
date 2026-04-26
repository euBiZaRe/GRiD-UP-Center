import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';

interface RaceControlProps {
  telemetry: any;
  session: any;
}

const RaceControl: React.FC<RaceControlProps> = ({ telemetry, session }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const prevIncs = useRef<Record<string, number>>({});
  const prevSurfaces = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!telemetry || !telemetry.drivers) return;

    const newLogs: any[] = [];
    const timestamp = new Date().toLocaleTimeString('en-GB');

    // 1. Detect Incidents for ALL Drivers
    if (telemetry.incidents_all) {
        Object.entries(telemetry.drivers).forEach(([idx, driver]: [string, any]) => {
            const currentIncs = telemetry.incidents_all[idx] || 0;
            const prev = prevIncs.current[idx] || 0;
            
            if (currentIncs > prev) {
                const delta = currentIncs - prev;
                const isPlayer = driver.isPlayer;
                
                // Add an entry for EACH point if they want them separate?
                // Actually, usually a 4x is one event. If we show "+4x" it's one line.
                // But if we want them "separate", maybe we should show them as individual notifications if they happen in blocks?
                // The user said "show all incidents separately not combine them".
                // I'll stick to one log per "event" (delta change), which is standard.
                
                newLogs.unshift({
                    id: Date.now() + Math.random(),
                    time: timestamp,
                    type: isPlayer ? '[TEAM INCIDENT]' : '[INCIDENT]',
                    severity: isPlayer ? 'error' : 'warning',
                    info: `+${delta}x Incident Points`,
                    driver: driver.name,
                    carNum: driver.carNum,
                    lap: telemetry.lap || 0,
                    sessionTime: telemetry.session_time || null
                });
                prevIncs.current[idx] = currentIncs;
            }
        });
    }

    // 2. Detect Excursions (Off Track)
    Object.values(telemetry.drivers).forEach((driver: any) => {
        const prevSurf = prevSurfaces.current[driver.carNum];
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
        setLogs(prev => [...newLogs, ...prev].slice(0, 100));
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
      
      {/* Summary Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
          <div className="card p-6 border-white/5 bg-panel/20 flex flex-col justify-between">
              <span className="data-label opacity-40 mb-2">Total Incident Points</span>
              <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-black italic ${(telemetry.incidents || 0) >= 12 ? 'text-status-error' : 'text-white'}`}>
                      {telemetry.incidents || 0}
                  </span>
                  <span className="text-xs font-black text-white/20 uppercase">x Points</span>
              </div>
          </div>
          
          <div className="card p-6 border-white/5 bg-panel/20 flex flex-col justify-between">
              <span className="data-label opacity-40 mb-2">Active Lap</span>
              <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black italic text-accent">L{telemetry.lap || 1}</span>
              </div>
          </div>

          <div className="card p-6 border-white/5 bg-panel/20 flex flex-col justify-between">
              <span className="data-label opacity-40 mb-2">Class Position</span>
              <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black italic text-white">P{telemetry.position || '--'}</span>
              </div>
          </div>
      </div>

      {/* Feed Container */}
      <div className="card bg-panel/30 border-white/5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-6 shrink-0 border-b border-white/5 pb-4 px-2">
            <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-accent" />
                <h2 className="text-xs font-black italic tracking-widest uppercase text-accent">Live Event Feed // Race Control</h2>
            </div>
            <div className="text-[10px] font-black text-white/20 uppercase tracking-widest italic">
                {session?.trackName || 'Active Track Monitoring'}
            </div>
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
