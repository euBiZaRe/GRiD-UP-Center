import React, { useState } from 'react';
import { Timer, Clock, Award, History as HistoryIcon, ChevronRight, Activity, Calendar } from 'lucide-react';

interface StintManagerProps {
  telemetry?: any;
  session?: any;
  drivers?: any[];
  history?: any;
}

const formatLapTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return "--:--.---";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
};

const StintManager: React.FC<StintManagerProps> = ({ telemetry, session, drivers = [], history }) => {
  const [viewMode, setViewMode] = useState<'live' | 'history'>('live');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Live Performance State
  const timeInCar = "02:09";
  const stintProgress = telemetry?.stint_laps ? `${telemetry.stint_laps} Laps` : "0 Laps";
  const tyreAge = telemetry?.stint_laps ? `${telemetry.stint_laps} Laps` : "0 Laps";

  // Rolling Live Laps from Telemetry
  const liveLaps = telemetry?.lap_history || [];

  // Parse History Sessions
  const historySessions = history ? Object.entries(history).map(([id, data]: [string, any]) => ({
      id,
      ...data.metadata,
      lapCount: data.laps ? Object.keys(data.laps).length : 0,
      laps: data.laps || {},
      stints: data.stints || {}
  })).sort((a,b) => (b.startTime || 0) - (a.startTime || 0)) : [];

  const selectedSession = selectedSessionId ? historySessions.find(s => s.id === selectedSessionId) : null;
  const historyLaps = selectedSession ? Object.values(selectedSession.laps).sort((a: any, b: any) => b.lap - a.lap) : [];
  const historyStints = selectedSession ? Object.entries(selectedSession.stints).map(([id, s]: [string, any]) => ({ id, ...s }))
      .sort((a,b) => b.timestamp - a.timestamp) : [];

  const activeSessionId = telemetry?.sid?.toString();
  const activeSessionStints = (history && activeSessionId && history[activeSessionId]?.stints) 
      ? Object.entries(history[activeSessionId].stints).map(([id, s]: [string, any]) => ({ id, ...s }))
          .sort((a,b) => b.timestamp - a.timestamp) : [];

  // Team High Scores (Fastest Laps)
  const teamFastestLaps = drivers.map(d => ({
    name: d.name,
    time: d.fastestLap || "--:--.---"
  }));

  if (teamFastestLaps.length === 0) {
      const player = Object.values(telemetry?.drivers || {}).find((d: any) => d.isPlayer);
      if (player) {
          teamFastestLaps.push({ name: (player as any).name, time: "--:--.---" });
      }
  }

  return (
    <div className="p-8 h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-y-auto">
      
      {/* Current Stint Header */}
      <div className="card bg-panel/30 border-white/5 flex flex-col shrink-0 px-8 py-6">
        <div className="flex items-center gap-2 mb-8">
          <Clock size={16} className="text-accent" />
          <h2 className="text-xs font-black italic tracking-widest uppercase text-white/70">Performance Summary</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Time In Car</span>
            <span className="text-3xl font-black text-accent tracking-tighter">{timeInCar}</span>
          </div>
          <div>
            <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Stint Progress</span>
            <span className="text-3xl font-black text-accent tracking-tighter">{stintProgress}</span>
          </div>
          <div>
            <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Current Tyre Age</span>
            <span className="text-3xl font-black text-accent tracking-tighter">{tyreAge}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        
        {/* Lap Times Panel (Live or History) */}
        <div className="card bg-panel/30 border-white/5 flex-1 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
             <div className="flex items-center gap-3">
                {viewMode === 'live' ? <Activity size={18} className="text-accent animate-pulse" /> : <HistoryIcon size={18} className="text-[#ffb000]" />}
                <h2 className="text-sm font-black italic tracking-widest uppercase text-white/90">
                    {viewMode === 'live' ? 'Live Performance' : 'Session Archive'}
                </h2>
             </div>

             <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                <button 
                   onClick={() => setViewMode('live')}
                   className={`px-4 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'live' ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'text-gray-500 hover:text-white'}`}
                >
                   Live
                </button>
                <button 
                   onClick={() => setViewMode('history')}
                   className={`px-4 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-[#ffb000] text-black shadow-lg shadow-[#ffb000]/20' : 'text-gray-500 hover:text-white'}`}
                >
                   Archive
                </button>
             </div>
          </div>

          {viewMode === 'live' ? (
              <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-2 px-2">
                    <span>Lap Number</span>
                    <span>Lap Time</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                    {liveLaps.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-[10px] text-gray-600 italic uppercase font-bold tracking-widest">
                            No laps completed in this stint...
                        </div>
                    ) : (
                        liveLaps.map((lap: any) => (
                          <div key={lap.timestamp} className={`flex justify-between items-center p-3 rounded-lg border border-transparent transition-colors ${lap.valid ? 'bg-white/5 hover:border-white/10' : 'bg-status-error/10 border-status-error/20'}`}>
                            <div className="flex items-center gap-3">
                                <span className="w-8 text-[10px] font-bold text-gray-400">#{lap.lap}</span>
                                <div className={`w-1 h-4 rounded-full ${lap.valid ? 'bg-accent' : 'bg-status-error animate-pulse'}`} />
                            </div>
                            <span className={`text-lg font-black font-mono tracking-tighter ${lap.valid ? 'text-white' : 'text-status-error line-through opacity-70'}`}>
                              {formatLapTime(lap.time)}
                            </span>
                          </div>
                        ))
                    )}
                  </div>

                  {/* Active Session Stints (Visible in Live Mode) */}
                  {activeSessionStints.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/5 shrink-0">
                          <span className="text-[8px] font-black uppercase text-gray-500 tracking-widest mb-3 block">Current Session Stints</span>
                          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                              {activeSessionStints.map((stint, idx) => (
                                  <div key={stint.id} className="min-w-[120px] p-2.5 rounded-lg bg-accent/5 border border-accent/20 flex flex-col gap-0.5">
                                      <div className="flex justify-between items-center">
                                          <span className="text-[7px] font-black uppercase text-accent/60">Stint #{activeSessionStints.length - idx}</span>
                                          <span className="text-[7px] font-bold text-gray-600">{stint.driver.split(' ')[0]}</span>
                                      </div>
                                      <div className="flex items-baseline gap-1">
                                          <span className="text-sm font-black text-white">{stint.laps}</span>
                                          <span className="text-[7px] font-bold text-gray-500 uppercase">Laps</span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          ) : (
              <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
                  {/* Session List */}
                  <div className="w-64 border-r border-white/5 pr-4 flex flex-col gap-2 overflow-y-auto">
                     <span className="text-[9px] font-bold uppercase text-gray-500 tracking-widest mb-2 px-2">Recent Appearances</span>
                     {historySessions.map(s => (
                         <button 
                            key={s.id}
                            onClick={() => setSelectedSessionId(s.id)}
                            className={`w-full text-left p-3 rounded-xl border transition-all ${selectedSessionId === s.id ? 'bg-[#ffb000]/10 border-[#ffb000]/30' : 'bg-black/20 border-white/5 hover:border-white/20'}`}
                         >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] font-black uppercase truncate ${selectedSessionId === s.id ? 'text-[#ffb000]' : 'text-white/80'}`}>{s.trackName}</span>
                                <span className="text-[8px] text-gray-600 font-bold whitespace-nowrap ml-2">{s.lapCount} LAPS</span>
                            </div>
                            <div className="flex items-center gap-2 text-[8px] text-gray-500 font-bold uppercase">
                                <Calendar size={10} />
                                {s.startTime ? new Date(s.startTime).toLocaleDateString() : 'Unknown Date'}
                            </div>
                         </button>
                     ))}
                  </div>

                  {/* Selected Session Detail */}
                  <div className="flex-1 flex flex-col min-w-0">
                      {selectedSessionId ? (
                          <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                             <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-2 px-2">
                                <span>Lap</span>
                                <span>Performance</span>
                             </div>
                             <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                                 {historyLaps.map((lap: any) => (
                                     <div key={lap.timestamp} className="flex justify-between items-center p-3 rounded-lg bg-black/40 border border-white/5">
                                        <span className="text-[10px] font-bold text-gray-400">Lap {lap.lap}</span>
                                        <span className="text-lg font-black font-mono tracking-tighter text-white">
                                            {formatLapTime(lap.time)}
                                        </span>
                                     </div>
                                 ))}
                             </div>

                             {/* Historical Stints Section */}
                             {historyStints.length > 0 && (
                                 <div className="mt-8 border-t border-white/5 pt-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Activity size={12} className="text-[#ffb000]" />
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/50">Stint History</h3>
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
                                        {historyStints.map((stint, idx) => (
                                            <div key={stint.id} className="min-w-[140px] p-4 rounded-xl bg-panel/50 border border-white/10 flex flex-col gap-1 relative overflow-hidden group">
                                                <div className="absolute top-0 left-0 w-full h-1 bg-accent/30 group-hover:bg-accent transition-colors" />
                                                <span className="text-[8px] font-black uppercase text-gray-500 tracking-tighter">Stint #{historyStints.length - idx}</span>
                                                <span className="text-sm font-black text-white leading-tight truncate">{stint.driver}</span>
                                                <div className="flex items-baseline gap-1 mt-2">
                                                    <span className="text-xl font-black text-accent">{stint.laps}</span>
                                                    <span className="text-[8px] font-bold text-gray-600 uppercase">Laps</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                 </div>
                             )}
                          </div>
                      ) : (
                          <div className="flex-1 flex flex-col items-center justify-center opacity-20 italic text-center p-8">
                             <HistoryIcon size={48} className="mb-4" />
                             <span className="text-xs uppercase font-bold tracking-[0.4em]">Select a session to analyze data</span>
                          </div>
                      )}
                  </div>
              </div>
          )}
        </div>

        {/* Team fastest laps sidebar (Stays visible) */}
        <div className="card bg-panel/30 border-white/5 xl:w-[400px] flex flex-col min-h-[500px]">
          <div className="flex items-center gap-2 mb-8 shrink-0 pb-4 border-b border-white/5">
            <Award size={18} className="text-[#ffb000]" />
            <h2 className="text-sm font-black italic tracking-widest uppercase text-[#ffb000]/90">Hall of Fame</h2>
          </div>

          <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest mb-4 px-2">
            <span>Competitor</span>
            <span>All-time Best</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {teamFastestLaps.map((driver, idx) => (
              <div key={idx} className="flex justify-between items-center p-4 rounded-xl bg-black/40 border border-white/5 group hover:border-[#ffb000]/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-[#ffb000] shadow-[0_0_12px_rgba(255,176,0,0.6)]' : 'bg-gray-700'}`} />
                  <span className="text-xs font-black uppercase tracking-wider text-white/90 truncate max-w-[150px]">
                    {driver.name}
                  </span>
                </div>
                <span className={`text-base font-black font-mono tracking-tighter ${idx === 0 ? 'text-[#ffb000]' : 'text-gray-500'}`}>
                  {driver.time}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

export default StintManager;
