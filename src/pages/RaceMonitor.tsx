import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Filter, Map as MapIcon, Activity } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { TrackCanvas } from '../components/TrackMap/TrackCanvas';
import { TelemetryGraph } from '../components/TelemetryGraph';
import PremiumLoader from '../components/PremiumLoader';

interface RaceMonitorProps {
  telemetry: any;
  session: any;
}

const RaceMonitor: React.FC<RaceMonitorProps> = ({ telemetry, session }) => {
  const { settings, convertSpeed } = useSettings();
  const [showRadar, setShowRadar] = useState(true);
  const [radarRefreshKey, setRadarRefreshKey] = useState(0);
  const [visibleClasses, setVisibleClasses] = useState<Set<number>>(new Set());

  // Extract unique classes from telemetry data
  const carClasses = useMemo(() => {
    if (!telemetry?.drivers) return [];
    const classes: Record<number, string> = {};
    Object.values(telemetry.drivers).forEach((d: any) => {
      if (d.classId) classes[d.classId] = d.className;
    });
    return Object.entries(classes).map(([id, name]) => ({ id: parseInt(id), name }));
  }, [telemetry?.drivers]);

  const toggleClass = (id: number) => {
    const next = new Set(visibleClasses);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisibleClasses(next);
  };

  if (!telemetry || !session) {
    return <PremiumLoader text="INITIALISING TELEMETRY STREAM" />;
  }

  const rpmPercent = (telemetry.rpm / 8000) * 100;
  const isRevLimit = telemetry.rpm > 7200;

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-y-auto">
      {/* Session Header */}
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none text-white/90">
            {session.trackName || 'GRID UP PERFORMANCE'}
          </h1>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Weather</span>
              <span className="text-xs font-bold text-accent uppercase tracking-widest">{session.weather || 'CLEAR'}</span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Race Position</span>
          <span className="text-4xl font-black italic text-accent leading-none">{telemetry.position}</span>
          <span className="text-sm font-bold text-gray-600 ml-1">/ 24</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-0">
        {/* Left Column: Dashboard */}
        <div className="flex-1 flex flex-col gap-6 xl:overflow-y-auto min-w-[320px]">
          {/* Live Session Relative Dashboard */}
          <div className="card bg-panel/50 backdrop-blur-xl border-white/5 relative overflow-hidden flex-1 flex flex-col p-6 lg:p-8 justify-center min-h-[400px] shrink-0">
             <div className="flex items-center gap-3 mb-10">
                <Activity className="text-accent" size={24} />
                <h2 className="text-xl font-black italic tracking-widest uppercase text-white/90">Live Session</h2>
             </div>

             <div className="grid grid-cols-2 gap-y-8 sm:gap-y-16 gap-x-12">
                 <div>
                    <span className="block text-[12px] text-gray-500 font-bold uppercase tracking-widest mb-3">Position</span>
                    <span className="text-5xl font-black text-accent tracking-tighter drop-shadow-md">
                        {telemetry.position ? `P${telemetry.position}` : 'P--'}
                    </span>
                 </div>
                 <div>
                    <span className="block text-[12px] text-gray-500 font-bold uppercase tracking-widest mb-3">Lap</span>
                    <span className="text-5xl font-black text-accent tracking-tighter drop-shadow-md">
                        {telemetry.lap || 0}
                    </span>
                 </div>
                 <div>
                    <span className="block text-[12px] text-gray-500 font-bold uppercase tracking-widest mb-3">Gap Ahead</span>
                    <span className="text-3xl font-black text-status-success tracking-tighter drop-shadow-md">
                        {telemetry.gap_ahead || '--'}
                    </span>
                 </div>
                 <div>
                    <span className="block text-[12px] text-gray-500 font-bold uppercase tracking-widest mb-3">Gap Behind</span>
                    <span className="text-3xl font-black text-status-error tracking-tighter drop-shadow-md">
                        {telemetry.gap_behind || '--'}
                    </span>
                 </div>
             </div>
          </div>

          {/* Primary Speed & Gear Readout */}
          <div className="flex flex-wrap xl:flex-nowrap items-end justify-between px-4 pb-2 border-b border-white/5 shrink-0 gap-y-6">
              <div className="w-24 md:w-32">
                  <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Gear</span>
                  <span className={`text-6xl font-black italic tracking-tighter drop-shadow-xl ${telemetry.gear === 0 ? 'text-gray-600' : 'text-white'}`}>
                      {telemetry.gear === 0 ? 'N' : telemetry.gear}
                  </span>
              </div>

              {/* Center Input Visuals */}
              <div className="flex-[0.5] min-w-[200px] flex flex-col justify-end gap-3 mx-4 md:mx-8 pb-3">
                  {/* Throttle */}
                  <div className="flex items-center gap-3">
                      <span className="w-10 text-right text-[10px] text-gray-500 font-bold uppercase tracking-widest">THR</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-sm overflow-hidden relative border border-white/5">
                          <div className="h-full bg-accent transition-all duration-75" style={{ width: `${telemetry.throttle}%` }} />
                      </div>
                      <span className="w-10 text-left text-[10px] text-accent font-black tracking-widest">{telemetry.throttle}%</span>
                  </div>
                  {/* Brake */}
                  <div className="flex items-center gap-3">
                      <span className="w-10 text-right text-[10px] text-gray-500 font-bold uppercase tracking-widest">BRK</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-sm overflow-hidden relative border border-white/5">
                          <div className={`h-full transition-all duration-75 ${telemetry.abs ? 'bg-status-warning animate-pulse' : 'bg-status-error'}`} style={{ width: `${telemetry.brake}%` }} />
                      </div>
                      <span className={`w-10 text-left text-[10px] font-black tracking-widest ${telemetry.abs ? 'text-status-warning' : 'text-status-error'}`}>{telemetry.brake}%</span>
                  </div>
              </div>

              <div className="text-right w-36 md:w-48 ml-auto">
                  <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Speed</span>
                  <div className="flex items-baseline justify-end gap-2">
                      <span className="text-7xl font-black italic text-accent tracking-tighter drop-shadow-xl leading-none">{convertSpeed(telemetry.speed || 0)}</span>
                      <span className="text-sm font-bold italic text-gray-600 uppercase tracking-widest">{settings.speedUnit}</span>
                  </div>
              </div>
          </div>

          {/* Real-time Telemetry Trace Graph */}
          <div className="min-h-[140px] flex-1">
              <TelemetryGraph data={{
                  throttle: telemetry.throttle,
                  brake: telemetry.brake,
                  abs: telemetry.abs || false
              }} />
          </div>
        </div>

        {/* Right Column: Safety Radar */}
        <div className="xl:flex-[0.4] min-w-[320px] w-full xl:max-w-[450px] flex flex-col gap-4 min-h-[500px] xl:min-h-0 shrink-0">
           <div className="card flex-1 flex flex-col overflow-hidden bg-panel/30 border-white/5 relative">
              <div className="p-4 flex justify-between items-center bg-black/40 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Shield className="text-accent" size={18} />
                  <span className="text-xs font-black italic tracking-widest uppercase">Safety Radar</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setRadarRefreshKey(prev => prev + 1)}
                        className="p-1.5 rounded transition-colors bg-white/5 text-gray-500 hover:text-white"
                        title="Force Radar Refresh"
                    >
                        <span className="text-xs font-black">⟳</span>
                    </button>
                    <button 
                        onClick={() => setShowRadar(!showRadar)}
                        className={`p-1.5 rounded transition-colors ${showRadar ? 'bg-accent/10 text-accent' : 'bg-white/5 text-gray-500'}`}
                    >
                        <MapIcon size={14} />
                    </button>
                    <div className="w-[1px] h-4 bg-white/10 mx-1" />
                    <span className="text-[10px] font-bold text-status-success uppercase bg-status-success/10 px-2 py-0.5 rounded tracking-tighter animate-pulse">Live Radar On</span>
                </div>
              </div>

              {/* Radar Map Area */}
              <div className="flex-1 p-2">
                <AnimatePresence mode="wait">
                  {showRadar ? (
                    <motion.div 
                        key="radar"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full"
                    >
                         <TrackCanvas 
                            key={`radar-${session?.trackId}-${radarRefreshKey}`}
                            trackId={session.trackId} 
                            drivers={telemetry.drivers || {}} 
                            visibleClasses={visibleClasses}
                        />
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
                        <MapIcon size={64} className="mb-4" />
                        <span className="text-xs uppercase font-bold tracking-[0.4em]">Radar Disabled</span>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Class Filters Sidebar/Overlay */}
              <div className="p-4 bg-black/40 border-t border-white/5">
                 <div className="flex items-center gap-2 mb-3">
                    <Filter size={12} className="text-gray-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Class Filters</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {carClasses.map((cls) => (
                        <button
                            key={cls.id}
                            onClick={() => toggleClass(cls.id)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${
                                !visibleClasses.has(cls.id) 
                                ? 'bg-accent text-black shadow-[0_0_10px_rgba(0,229,255,0.3)]' 
                                : 'bg-black/40 text-gray-500 border border-white/5'
                            }`}
                        >
                            {cls.name}
                        </button>
                    ))}
                    {carClasses.length === 0 && (
                        <span className="text-[9px] text-gray-700 italic">No classes detected...</span>
                    )}
                 </div>
              </div>

              {/* Footer Info */}
              <div className="p-3 bg-black/20 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                <span>Track: {session.trackName}</span>
                <span className="text-accent">Accuracy: High (LERP)</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default RaceMonitor;
