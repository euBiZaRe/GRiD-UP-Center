import React from 'react';
import { User, Eye, ArrowLeftRight, Users, ShieldAlert } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

interface TeamLobbyProps {
  drivers: any[];
  onSwitchTeam: () => void;
  onWatchDriver: (driver: any) => void;
  machineId?: string;
}

const RecordingIndicator: React.FC<{ isMe: boolean }> = ({ isMe }) => {
  const [buffer, setBuffer] = React.useState<number>(0);
  
  React.useEffect(() => {
    if (!isMe || !window.electron) return;
    const interval = setInterval(() => {
        const logs = (window as any).bridgeLogs || [];
        // Scan last 5 logs for buffer status
        const lastLogs = logs.slice(-5).reverse();
        const bufferLog = lastLogs.find((l: string) => l.includes('Buffer:'));
        if (bufferLog) {
            const match = bufferLog.match(/Buffer: (\d+) samples/);
            if (match) setBuffer(parseInt(match[1]));
        } else {
            setBuffer(0);
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [isMe]);

  if (!isMe || buffer === 0) return null;

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-status-error/10 border border-status-error/20 rounded animate-pulse">
        <div className="w-1.5 h-1.5 rounded-full bg-status-error" />
        <span className="text-[8px] font-black uppercase text-status-error tracking-widest">REC {buffer} SAMPLES</span>
    </div>
  );
};

const DriverCard: React.FC<{ driver: any; isMe: boolean; onWatch: () => void; myName?: string }> = ({ driver, isMe, onWatch, myName }) => (
  <div className="card group hover:border-accent/30 transition-all duration-300 bg-panel/50 backdrop-blur-xl">
    <div className="flex justify-between items-start mb-6">
      <div className="p-3 bg-white/5 rounded-lg border border-white/5">
        <User className="text-gray-400 group-hover:text-accent transition-colors" />
      </div>
      <div className="text-right space-y-2">
        <div className={`text-[8px] uppercase font-bold tracking-widest px-2 py-1 rounded inline-block bg-status-success/10 text-status-success`}>
          Online
        </div>
        <RecordingIndicator isMe={isMe} />
        <p className="text-[8px] text-gray-500 mt-1 uppercase font-bold">
          {driver.lastActive ? new Date(driver.lastActive).toLocaleTimeString() : 'Never'}
        </p>
      </div>
    </div>

    <h3 className="text-xl font-bold uppercase tracking-tight text-white/90">
      {isMe ? (myName || driver.name || 'Unknown Driver') : (driver.name || 'Unknown Driver')} {isMe && <span className="text-accent text-[10px] ml-2">(ME)</span>}
    </h3>
    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
      {driver.className ? `${driver.className} / #${driver.carNum}` : 'Standby / Waiting for iRacing'}
    </p>

    <div className="mt-8 flex flex-col gap-3">
      <button 
        onClick={onWatch}
        className="btn-accent text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <Eye size={14} /> Watch Telemetry
      </button>

      {/* V1.4.9.10-DEBUG: Connection Metadata */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/20 rounded-lg border border-white/5">
        <div className="flex flex-col">
          <span className="text-[6px] text-gray-500 font-black uppercase tracking-widest">Machine ID</span>
          <span className="text-[8px] font-mono text-white/40">{driver.id?.substring(0, 16) || 'UNKNOWN'}</span>
        </div>
        <div className="text-right">
          <span className="text-[6px] text-gray-500 font-black uppercase tracking-widest block">Protocol</span>
          <span className={`text-[8px] font-black uppercase ${driver.protocol === 'v2' ? 'text-accent' : 'text-status-warning'}`}>
            {driver.protocol || 'LEGACY'}
          </span>
        </div>
      </div>
    </div>
  </div>
);

const TeamLobby: React.FC<TeamLobbyProps> = ({ drivers, onSwitchTeam, onWatchDriver, machineId }) => {
  const { settings } = useSettings();
  const ACTIVE_TIMEOUT_MS = 30 * 1000; // 30 seconds (Snappy Update)
  const now = Date.now();

  const activeDrivers = drivers.filter(driver => {
    const isPaceCar = driver.name?.toLowerCase().includes('pace car');
    // Extreme Permissiveness: Show anyone who is online OR has been seen in the last 48 hours
    const isRecentlyActive = (driver.lastActive || 0) > (now - (48 * 60 * 60 * 1000));
    const isOnline = driver.status === 'online' || driver.online !== false;
    
    // As long as they aren't a pace car, show them if they are online or recently active
    return !isPaceCar && (isRecentlyActive || isOnline);
  });

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500 h-full overflow-y-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">TEAM LOBBY</h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mt-2">Active Drivers & Crew</p>
        </div>
        <div className="flex items-center gap-4">
            {/* Global Diagnostic Pulse */}
            <div className="hidden lg:flex flex-col items-end border-r border-white/10 pr-4">
                <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Cloud Identity</span>
                <span className="text-[9px] font-mono text-accent/60 uppercase">{machineId || 'Initialising...'}</span>
            </div>
            <button 
                onClick={onSwitchTeam}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 text-[10px] uppercase font-bold tracking-widest text-gray-400 hover:text-white transition-all"
            >
                <ArrowLeftRight size={14} /> Switch Team
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {activeDrivers.length > 0 ? (
          activeDrivers.map((driver) => {
            // Fuzzy Identification Logic (V2.1)
            const isMe = 
                driver.id === machineId || 
                driver.id === settings.driverName || 
                driver.name === settings.driverName || 
                driver.name?.toUpperCase() === settings.driverName?.toUpperCase() ||
                driver.name?.toUpperCase() === machineId?.toUpperCase();

            return (
              <DriverCard 
                  key={driver.id} 
                  driver={driver} 
                  isMe={isMe} 
                  onWatch={() => onWatchDriver(driver)} 
                  myName={settings.driverName}
              />
            );
          })
        ) : (
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
             {/* Diagnostic Mode if data exists but is hidden */}
             {drivers.length > 0 ? (
               <div className="card border-dashed border-accent/20 bg-accent/[0.02] p-8">
                  <div className="flex items-center gap-4 mb-8">
                     <div className="p-3 bg-accent/10 rounded-xl">
                        <Users className="text-accent" />
                     </div>
                     <div>
                        <h2 className="text-xl font-bold uppercase italic text-white/90">Diagnostic Mode Active</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                           {drivers.length} Driver(s) found, but they do not meet the "Live Roster" requirements.
                        </p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                     {drivers.map(d => {
                        const ageSec = Math.round((now - (d.lastActive || 0)) / 1000);
                        const isV2 = d.protocol === 'v2';
                        const isStale = ageSec > 30;
                        const isMe = d.id === machineId;

                        return (
                           <div key={d.id} className="flex flex-wrap items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 gap-4">
                              <div className="flex items-center gap-3 min-w-[200px]">
                                 <div className={`w-2 h-2 rounded-full ${isStale ? 'bg-status-error' : 'bg-status-success'}`} />
                                 <div>
                                    <p className="text-sm font-bold uppercase text-white/80">
                                       {isMe ? (settings.driverName || d.name || 'Unknown Driver') : (d.name || 'Unknown Driver')} {isMe && <span className="text-accent text-[9px] ml-1">(ME)</span>}
                                    </p>
                                    <p className="text-[9px] text-gray-600 font-bold uppercase">
                                       Last Pulse: {ageSec}s ago | GUID: {d.id.substring(0, 8)} | Proto: {d.protocol || 'none'}
                                    </p>
                                 </div>
                              </div>

                              <div className="flex gap-2">
                                 {!isV2 && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-status-warning/10 border border-status-warning/20">
                                       <ShieldAlert size={10} className="text-status-warning" />
                                       <span className="text-[9px] font-black uppercase text-status-warning">Old Version</span>
                                    </div>
                                 )}
                                 {isStale && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-status-error/10 border border-status-error/20">
                                       <ShieldAlert size={10} className="text-status-error" />
                                       <span className="text-[9px] font-black uppercase text-status-error">Sync Stale</span>
                                    </div>
                                 )}
                                 {d.status !== 'online' && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10">
                                       <span className="text-[9px] font-black uppercase text-gray-500">{d.status || 'Offline'}</span>
                                    </div>
                                 )}
                              </div>
                           </div>
                        );
                     })}
                  </div>

                  <div className="mt-8 text-center bg-white/5 p-4 rounded-xl border border-white/5">
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                        <span className="text-accent underline">PRO-TIP:</span> Drivers must have the <span className="text-white">v2.0</span> bridge and a heartrate under <span className="text-white">30 seconds</span> to appear in the live roster.
                     </p>
                  </div>
               </div>
             ) : (
                <div className="py-16 flex flex-col items-center justify-center text-gray-700 bg-white/[0.01] rounded-2xl border-2 border-dashed border-white/5">
                   <User size={64} className="mb-4 opacity-10" />
                   <p className="text-lg font-black italic uppercase tracking-widest">No Drivers Active</p>
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamLobby;
