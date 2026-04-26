import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Filter, Map as MapIcon, Activity, Eye, ArrowLeft, Trophy, Timer, FastForward, Gauge, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { TrackCanvas } from '../components/TrackMap/TrackCanvas';
import { TelemetryGraph } from '../components/TelemetryGraph';
import { RollingNumber } from '../components/RollingNumber';
import PremiumLoader from '../components/PremiumLoader';

// --- Sub-components for Atomic Rendering (Optimization) ---

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

const IntelligenceCard = React.memo(({ label, value, icon: Icon, colorClass = "text-white" }: any) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2 mb-1">
      <Icon size={12} className="text-white/20" />
      <span className="data-label">{label}</span>
    </div>
    <span className={`text-2xl font-black italic tracking-tight leading-none ${colorClass}`}>
      {value}
    </span>
  </div>
));

const TelemetryGauge = React.memo(({ telemetry, springConfig }: any) => {
  const isRevLimit = telemetry.rpm > 7200;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="data-label">Engine Response</span>
        <div className="flex items-center gap-2">
            <span className={isRevLimit ? "text-status-error animate-pulse font-black text-[10px]" : "text-white/20 font-bold text-[10px]"}>
                {isRevLimit ? 'REV LIMIT' : 'SYNCED'}
            </span>
            <RollingNumber 
              value={telemetry.rpm} 
              className={`font-mono font-black text-xs ${isRevLimit ? 'text-status-error' : 'text-accent'}`} 
            />
        </div>
      </div>
      
      <div className="space-y-3">
        {/* Throttle */}
        <div className="space-y-1">
          <div className="flex justify-between data-label opacity-50">
            <span>Throttle</span>
            <span className="text-status-success">{Math.round(telemetry.throttle)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
            <motion.div 
              className="h-full bg-status-success rounded-full shadow-[0_0_10px_rgba(0,255,163,0.3)]" 
              animate={{ width: `${telemetry.throttle}%` }}
              transition={springConfig}
            />
          </div>
        </div>

        {/* Brake */}
        <div className="space-y-1">
          <div className="flex justify-between data-label opacity-50">
            <span>Brake Pressure</span>
            <span className="text-status-error">{Math.round(telemetry.brake)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px] relative">
            <motion.div 
                className="absolute inset-0 bg-status-error/10"
                animate={{ width: `${telemetry.brake_applied || 0}%` }}
                transition={springConfig}
            />
            <motion.div 
              className={`h-full relative z-10 rounded-full shadow-[0_0_10px_rgba(255,45,85,0.3)] ${telemetry.abs ? 'bg-status-warning' : 'bg-status-error'}`}
              animate={{ width: `${telemetry.brake}%` }}
              transition={springConfig}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

const SpeedReadout = React.memo(({ telemetry, settings, convertSpeed }: any) => (
  <div className="flex items-center gap-8">
    <div className="text-center">
      <span className="data-label block mb-1">Gear</span>
      <span className={`text-7xl font-black italic tracking-tighter ${telemetry.gear === 0 ? 'text-white/10' : 'text-white'} drop-shadow-2xl`}>
        {telemetry.gear === -1 ? 'R' : (telemetry.gear === 0 ? 'N' : telemetry.gear)}
      </span>
    </div>
    
    <div className="h-16 w-px bg-white/5" />

    <div>
      <span className="data-label block mb-1">Velocity</span>
      <div className="flex items-baseline gap-2">
        <RollingNumber 
          value={parseFloat(convertSpeed(telemetry.speed || 0))} 
          className="text-7xl font-black italic tracking-tighter text-accent leading-none"
        />
        <span className="text-sm font-black italic text-white/20 uppercase">{settings.speedUnit}</span>
      </div>
    </div>
  </div>
));

// --- Main Page Component ---

interface RaceMonitorProps {
  telemetry: any;
  session: any;
  watchedDriver?: any;
  onStopWatching?: () => void;
}

const RaceMonitor: React.FC<RaceMonitorProps> = ({ telemetry, session, watchedDriver, onStopWatching }) => {
  const { settings, convertSpeed } = useSettings();
  const [showRadar, setShowRadar] = useState(true);
  const [hiddenClasses, setHiddenClasses] = useState<Set<number>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSidRef = useRef<number | null>(null);

  // High-Precision Interpolation (HPTI) Engine
  const [interpolatedTelemetry, setInterpolatedTelemetry] = useState(telemetry || { rpm: 0, speed: 0, throttle: 0, brake: 0 });
  const targetRef = useRef(telemetry);

  useEffect(() => {
    targetRef.current = telemetry;
  }, [telemetry]);

  useEffect(() => {
    if (session?.sid && lastSidRef.current !== null && session.sid !== lastSidRef.current) {
        setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 2000);
    }
    lastSidRef.current = session?.sid || null;
  }, [session?.sid]);

  useEffect(() => {
    let rafId: number;
    const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

    const update = () => {
        setInterpolatedTelemetry((prev: any) => {
            const target = targetRef.current;
            if (!target) return prev;
            const alpha = 0.12; // Adjusted for snappy yet premium feel
            
            return {
                ...target,
                rpm: lerp(prev.rpm ?? 0, target.rpm ?? 0, alpha),
                speed: lerp(prev.speed ?? 0, target.speed ?? 0, alpha),
                throttle: lerp(prev.throttle ?? 0, target.throttle ?? 0, alpha),
                brake: lerp(prev.brake ?? 0, target.brake ?? 0, alpha),
                brake_applied: lerp(prev.brake_applied ?? 0, target.brake_applied ?? 0, alpha),
            };
        });
        rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const activeTelemetry = watchedDriver ? interpolatedTelemetry : telemetry;

  const carClasses = useMemo(() => {
    if (!telemetry?.drivers) return [];
    const classes: Record<number, string> = {};
    Object.values(telemetry.drivers).forEach((d: any) => {
      if (d.classId) classes[d.classId] = d.className;
    });
    return Object.entries(classes).map(([id, name]) => ({ id: parseInt(id), name }));
  }, [telemetry?.drivers]);

  const formatLapTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '--:--.---';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const times = useMemo(() => {
    const laps = telemetry?.lap_history || [];
    const last = laps.length > 0 ? formatLapTime(laps[0].time) : '--:--.---';
    const valid = laps.filter((l: any) => l.time > 0);
    const best = valid.length > 0 ? formatLapTime(Math.min(...valid.map((l: any) => l.time))) : '--:--.---';
    return { last, best };
  }, [telemetry?.lap_history]);

  if (!activeTelemetry || isSyncing) {
    return <PremiumLoader text={isSyncing ? "TRANSITIONING" : "CONNECTING"} />;
  }

  const springConfig = { stiffness: 150, damping: 25, mass: 1 };

  const observedIdx = useMemo(() => {
    if (!watchedDriver || !telemetry?.drivers) return undefined;
    const entry = Object.entries(telemetry.drivers).find(([_, d]: [string, any]) => d.carNum === watchedDriver.carNum);
    return entry ? entry[0] : undefined;
  }, [watchedDriver, telemetry?.drivers]);

  return (
    <div className="p-8 h-full flex flex-col gap-8 animate-reveal overflow-y-auto">
      {/* Header Info */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-black italic tracking-tight text-white uppercase leading-none">
            {session?.trackName || 'ESTABLISHING HANDSHAKE'}
          </h1>
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="data-label text-white/20">System Vehicle</span>
              <span className="text-xs font-black uppercase text-accent">{session?.carName || 'GRID UP PRO'}</span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div className="flex flex-col">
              <span className="data-label text-white/20">Climatology</span>
              <span className="text-xs font-black uppercase text-white/80">{session?.weather || 'STABLE'}</span>
            </div>
          </div>
        </div>

        {watchedDriver && (
          <div className="flex items-center gap-4 platinum-glass p-3 px-6 rounded-2xl border-accent/20">
            <div className="p-2 bg-accent/10 rounded-lg text-accent animate-pulse">
                <Eye size={20} />
            </div>
            <div>
                <span className="data-label text-accent/50 block">Observing</span>
                <span className="text-lg font-black text-white italic">{watchedDriver.name}</span>
            </div>
            <button onClick={onStopWatching} className="ml-4 p-2 hover:bg-white/5 rounded-lg text-white/20 hover:text-white transition-all">
                <ArrowLeft size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col xl:grid xl:grid-cols-12 gap-8 min-h-0">
        {/* Primary Dashboard (Left) */}
        <div className="xl:col-span-7 flex flex-col gap-8">
          
          {/* Main Instrumentation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Intelligence Card */}
             <div className="card p-8 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-8">
                    <span className="text-[10px] font-black tracking-[0.3em] text-white/20 uppercase italic">Session Stats</span>
                    <Trophy size={16} className="text-accent/40" />
                </div>
                
                <div className="grid grid-cols-2 gap-y-8">
                    <IntelligenceCard label="Position" value={`P${activeTelemetry.position || '--'}`} icon={Trophy} colorClass="text-accent" />
                    <IntelligenceCard label="Lap" value={activeTelemetry.lap || '0'} icon={FastForward} />
                    <IntelligenceCard label="Personal Best" value={times.best} icon={Gauge} colorClass="text-accent/60" />
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Timer size={12} className="text-white/20" />
                            <span className="data-label">Relatives</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-status-success uppercase opacity-40">Ahead</span>
                                <span className="text-lg font-black italic text-status-success leading-none">{activeTelemetry.gap_ahead || '--'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-status-error uppercase opacity-40">Behind</span>
                                <span className="text-lg font-black italic text-status-error leading-none">{activeTelemetry.gap_behind || '--'}</span>
                            </div>
                        </div>
                    </div>
                </div>
             </div>

             {/* Speed & Gaps Card */}
             <div className="card p-8 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-8">
                    <span className="text-[10px] font-black tracking-[0.3em] text-white/20 uppercase italic">Info</span>
                    <Activity size={16} className="text-white/10" />
                </div>
                
                <div className="flex flex-col gap-6 h-full justify-center">
                   <div className="flex items-center justify-center">
                      <SpeedReadout telemetry={activeTelemetry} settings={settings} convertSpeed={convertSpeed} />
                   </div>
                </div>
             </div>
          </div>

          {/* Dynamic Analysis Hub */}
          <div className="card overflow-hidden border-white/5">
             <div className="p-8 pb-4">
                <TelemetryGauge telemetry={activeTelemetry} springConfig={springConfig} />
             </div>
             
             <div className="h-[140px] premium-scanline border-t border-white/5 bg-white/[0.01]">
                <TelemetryGraph data={{
                    throttle: activeTelemetry.throttle,
                    brake: activeTelemetry.brake,
                    abs: activeTelemetry.abs || false
                }} />
             </div>
             
             <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-accent/5 blur-[80px] rounded-full pointer-events-none" />
          </div>
        </div>

        {/* Safety & Track (Right) */}
        <div className="xl:col-span-5 flex flex-col gap-8">
           <div className="card flex-1 flex flex-col min-h-[500px]">
              <div className="p-4 flex justify-between items-center border-b border-white/5 bg-white/[0.01]">
                <div className="flex items-center gap-2">
                    <Shield size={14} className="text-accent" />
                    <span className="text-[10px] font-black tracking-widest uppercase italic">Safety Radar</span>
                </div>
                <button 
                  onClick={() => setShowRadar(!showRadar)}
                  className={cn("p-1.5 rounded-lg transition-all", showRadar ? "bg-accent/10 text-accent" : "text-white/20")}
                >
                  <MapIcon size={14} />
                </button>
              </div>

              <div className="flex-1 p-4 relative">
                {showRadar ? (
                  <TrackCanvas 
                    trackId={session?.trackId} 
                    drivers={activeTelemetry.drivers || {}} 
                    hiddenClasses={hiddenClasses}
                    observedIdx={observedIdx}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-white/10 italic">
                    <MapIcon size={48} className="mb-4 opacity-50" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Radar Suspended</span>
                  </div>
                )}
              </div>

              <div className="p-6 bg-white/[0.01] border-t border-white/5">
                 <div className="flex items-center gap-2 mb-4">
                    <Filter size={12} className="text-white/20" />
                    <span className="data-label">Class Filters</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {carClasses.map(cls => (
                      <button
                        key={cls.id}
                        onClick={() => {
                          const next = new Set(hiddenClasses);
                          if (next.has(cls.id)) next.delete(cls.id);
                          else next.add(cls.id);
                          setHiddenClasses(next);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                          !hiddenClasses.has(cls.id) 
                            ? "bg-accent text-black shadow-lg" 
                            : "bg-white/5 text-white/30 border border-white/5 hover:border-white/20"
                        )}
                      >
                        {cls.name}
                      </button>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(RaceMonitor);
