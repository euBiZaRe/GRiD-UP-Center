import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Fuel, 
  Timer, 
  ShieldAlert, 
  MessageSquare,
  AlertTriangle,
  Minus,
  Square,
  X
} from 'lucide-react';
import { useFirebase } from './hooks/useFirebase';
import { db } from './hooks/useFirebase';
import { ref, set } from 'firebase/database';
import { useSettings } from './hooks/useSettings';
import RaceMonitor from './pages/RaceMonitor';
import TeamLobby from './pages/TeamLobby';
import FuelStrategy from './pages/FuelStrategy';
import StintManager from './pages/StintManager';
import CarHealth from './pages/CarHealth';
import RaceControl from './pages/RaceControl';
import Settings from './pages/Settings';
import SetupCenter from './pages/SetupCenter';
import TeamSelector from './pages/TeamSelector';
import Sidebar from './components/Sidebar';
import PremiumLoader from './components/PremiumLoader';
import { Download, AlertCircle, X as CloseIcon } from 'lucide-react';

const APP_VERSION = '1.0.0';

const App = () => {
  const [activePage, setActivePage] = useState('monitor');
  const [activeTeam, setActiveTeam] = useState<string | null>(localStorage.getItem('gridup_active_team'));
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showUpdate, setShowUpdate] = useState(true);
  const { telemetry, session, drivers, setups, history, appConfig, isOffline } = useFirebase(activeTeam);
  const { settings } = useSettings();

  const hasUpdate = appConfig && appConfig.version && appConfig.version !== APP_VERSION;

  // Initial Splash Screen Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const writePresence = (teamId: string, name: string) => {
    if (!teamId || teamId === 'solo' || teamId === 'gridUp_practice') return;
    const displayName = name.trim() || 'Unknown Driver';
    if (window.electron && window.electron.sendCommand) {
      window.electron.sendCommand({ action: 'write_presence', teamId, name: displayName });
    }
  };

  const leaveTeam = (teamId: string | null, name: string) => {
    if (!teamId || teamId === 'solo' || teamId === 'gridUp_practice') return;
    const displayName = name.trim() || 'Unknown Driver';
    if (window.electron && window.electron.sendCommand) {
      window.electron.sendCommand({ action: 'leave_team', teamId, name: displayName });
    }
  };

  // Write presence on load AND whenever team or driver name changes
  useEffect(() => {
    if (activeTeam) {
      writePresence(activeTeam, settings.driverName);
    }
  }, [activeTeam, settings.driverName]);

  useEffect(() => {
    if (activeTeam && window.electron && window.electron.sendCommand) {
       window.electron.sendCommand({ action: 'set_team', teamId: activeTeam });
    }
  }, [activeTeam]);

  const handleTeamSelect = (teamId: string) => {
    leaveTeam(activeTeam, settings.driverName);
    localStorage.setItem('gridup_active_team', teamId);
    setActiveTeam(teamId);
    setIsTransitioning(false);
  };


  const handleEject = () => {
    leaveTeam(activeTeam, settings.driverName);
    setIsTransitioning(true);
    localStorage.removeItem('gridup_active_team');
    setTimeout(() => {
      setActiveTeam(null);
      setIsTransitioning(false);
    }, 300);
  };

  if (isInitialLoad || isTransitioning) {
    return (
      <PremiumLoader 
        text={isInitialLoad ? 'INITIALIZING PERFORMANCE CENTER' : 'SYNCING SESSION DATA'} 
      />
    );
  }

  if (!activeTeam) {
    return <TeamSelector onSelect={handleTeamSelect} />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'monitor': return <RaceMonitor telemetry={telemetry} session={session} />;
      case 'lobby': return <TeamLobby drivers={drivers} onSwitchTeam={handleEject} />;
      case 'fuel': return <FuelStrategy telemetry={telemetry} session={session} />;
      case 'stint': return <StintManager telemetry={telemetry} session={session} drivers={drivers} history={history} />;
      case 'health': return <CarHealth telemetry={telemetry} session={session} />;
      case 'control': return <RaceControl telemetry={telemetry} session={session} />;
      case 'settings': return <Settings />;
      case 'setups': return <SetupCenter setups={setups} activeTeam={activeTeam} session={session} telemetry={telemetry} />;
      default: return <RaceMonitor telemetry={telemetry} session={session} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans border border-white/5 rounded-xl shadow-2xl relative select-none">
      {/* Full-Width Drag Handle with double-click maximize/restore */}
      <div
        className="absolute top-0 left-0 right-0 h-16 z-40"
        style={{ WebkitAppRegion: 'drag' } as any}
        onDoubleClick={() => window.electron && window.electron.send('window-control', 'maximize')}
      />

      {/* Frame Controls (Top Right) */}
      <div className="absolute top-0 right-0 h-8 flex items-center z-50 overflow-hidden rounded-tr-xl">
          <button 
              onClick={() => window.electron && window.electron.send('window-control', 'minimize')}
              className="h-full px-4 flex items-center justify-center text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
              style={{ WebkitAppRegion: 'no-drag' } as any}
          >
              <Minus size={14} strokeWidth={3} />
          </button>
          <button 
              onClick={() => window.electron && window.electron.send('window-control', 'maximize')}
              className="h-full px-4 flex items-center justify-center text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
              style={{ WebkitAppRegion: 'no-drag' } as any}
          >
              <Square size={12} strokeWidth={3} />
          </button>
          <button 
              onClick={() => window.electron && window.electron.send('window-control', 'close')}
              className="h-full px-4 flex items-center justify-center text-gray-500 hover:bg-status-error hover:text-white transition-colors"
              style={{ WebkitAppRegion: 'no-drag' } as any}
          >
              <X size={16} strokeWidth={3} />
          </button>
      </div>

      {/* Sidebar */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isOffline={isOffline} 
        onEject={handleEject}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative pt-8" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {renderPage()}
        
        {/* Offline Warning */}
        {isOffline && (
          <div className="absolute bottom-4 left-4 right-4 bg-status-error/20 border border-status-error/50 p-3 rounded-lg flex items-center gap-3 backdrop-blur-md">
            <AlertTriangle className="text-status-error animate-pulse" size={18} />
            <span className="text-xs uppercase tracking-widest text-status-error font-bold">
              Firebase offline — using local simulation
            </span>
          </div>
        )}

        {/* Update Notification Banner */}
        {hasUpdate && showUpdate && (
          <div className={`absolute bottom-4 left-4 right-4 animate-in slide-in-from-bottom-8 duration-500 z-[60] ${appConfig.isCritical ? 'fixed inset-0 bg-background/95 backdrop-blur-xl flex items-center justify-center p-0' : ''}`}>
             <div className={`${appConfig.isCritical ? 'max-w-md w-full p-8 card bg-panel border-accent/20' : 'p-4 card bg-accent/10 border-accent/30 flex items-center justify-between backdrop-blur-md shadow-[0_10px_50px_rgba(0,0,0,0.5)]'}`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${appConfig.isCritical ? 'bg-status-error/20 text-status-error' : 'bg-accent/20 text-accent'}`}>
                    {appConfig.isCritical ? <AlertCircle size={32} /> : <Download size={24} />}
                  </div>
                  <div>
                    <h4 className={`font-black uppercase tracking-tighter italic ${appConfig.isCritical ? 'text-2xl mb-2' : 'text-sm'}`}>
                      {appConfig.isCritical ? 'Critical Update Required' : 'New Performance Center Version'}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      Version {appConfig.version} is now available on GitHub
                    </p>
                    {appConfig.isCritical && (
                      <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                        This update contains critical performance fixes required for active racing. Access is restricted until you update.
                      </p>
                    )}
                  </div>
                </div>
                
                <div className={`flex items-center gap-3 ${appConfig.isCritical ? 'mt-8' : ''}`}>
                  {!appConfig.isCritical && (
                    <button 
                      onClick={() => setShowUpdate(false)}
                      className="p-2 text-gray-500 hover:text-white transition-colors"
                    >
                      <CloseIcon size={18} />
                    </button>
                  )}
                  <a 
                    href={appConfig.updateUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95 ${
                      appConfig.isCritical 
                      ? 'bg-status-success text-black w-full justify-center shadow-[0_0_30px_rgba(7,201,155,0.4)]' 
                      : 'bg-accent text-black shadow-[0_0_20px_rgba(0,229,255,0.3)]'
                    }`}
                  >
                    <Download size={14} />
                    Download Update
                  </a>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
