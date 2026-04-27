import React, { useState, useEffect } from 'react';
import TeamSelectorPage from './pages/TeamSelector';
import { 
  Activity, 
  Users, 
  Fuel, 
  Timer, 
  ShieldAlert, 
  Shield,
  MessageSquare,
  AlertTriangle,
  Minus,
  Square
} from 'lucide-react';

const APP_VERSION = '1.5.2';
import { useFirebase } from './hooks/useFirebase';
import { db } from './hooks/useFirebase';
import { ref, set, update } from 'firebase/database';
import { useSettings, PRESET_THEMES } from './hooks/useSettings';
import { useLicense } from './hooks/useLicense';
import LicenseScreen from './pages/LicenseScreen';
import RaceMonitor from './pages/RaceMonitor';
import TeamLobby from './pages/TeamLobby';
import FuelStrategy from './pages/FuelStrategy';
import StintManager from './pages/StintManager';
import CarHealth from './pages/CarHealth';
import RaceControl from './pages/RaceControl';
import Settings from './pages/Settings';
import SetupHub from './pages/SetupCenter';
import DataHub from './pages/DataHub';
import Sidebar from './components/Sidebar';
import PremiumLoader from './components/PremiumLoader';
import { Download, AlertCircle, X } from 'lucide-react';
import { useVideoRecorder } from './hooks/useVideoRecorder';
import { useFuelTracker } from './hooks/useFuelTracker';

// --- Diagnostic Error Boundary ---
class SafeModeBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("DIAGNOSTIC - App Crash Captured:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#050505] flex items-center justify-center p-10 font-sans">
          <div className="platinum-glass p-16 rounded-[48px] max-w-2xl w-full text-center border-status-error/20">
             <h1 className="text-4xl font-black italic mb-2">GRID <span className="text-accent underline">UP</span></h1>
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-12">Performance Center // Recovery // V{APP_VERSION}</p>
             
             <div className="bg-status-error/5 p-8 rounded-3xl border border-status-error/10 text-left mb-12">
                <p className="text-status-error text-xs font-black uppercase tracking-widest mb-4">Core Exception Caught</p>
                <p className="text-white/60 text-sm font-mono leading-relaxed">{this.state.error?.message}</p>
             </div>
             
             <button 
               onClick={() => window.location.reload()}
               className="btn-premium px-12"
             >
               Attempt System Restart
             </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent = () => {
  const { isValidated, error: licenseError, machineId, activate } = useLicense();
  const [activePage, setActivePage] = useState('monitor');
  const [activeTeam, setActiveTeam] = useState<string | null>(localStorage.getItem('gridup_active_team'));
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [watchedDriver, setWatchedDriver] = useState<any>(null);
  const { telemetry, session, drivers, setups, history, appConfig, isOffline } = useFirebase(activeTeam, watchedDriver?.id);
  const { settings } = useSettings();
  const { isRecording, startRecording, stopRecording, bestLapVideoUrl, bestLapTime } = useVideoRecorder(telemetry);
  const fuelTracking = useFuelTracker(telemetry);

  const getAccentColor = () => {
    if (settings.theme === 'CUSTOM') return settings.customColor;
    const theme = PRESET_THEMES.find(t => t.id === settings.theme);
    return theme ? theme.color : PRESET_THEMES[0].color;
  };

  useEffect(() => {
    const color = getAccentColor();
    document.documentElement.style.setProperty('--accent-hex', color);
    document.documentElement.style.setProperty('--accent-primary', color);
    document.documentElement.style.setProperty('--color-accent', color);
  }, [settings.theme, settings.customColor]);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!activeTeam || activeTeam === 'solo' || activeTeam === 'gridUp_practice' || !machineId) return;
    const syncIdentity = () => {
      const displayName = settings.driverName.trim() || machineId || 'Unknown Driver';
      if (window.electron?.sendCommand) {
        window.electron.sendCommand({ 
          action: 'write_presence', 
          teamId: activeTeam, 
          name: displayName.toUpperCase(),
          mid: machineId,
          protocol: 'v2'
        });
      }
    };
    syncIdentity();
    const heartbeat = setInterval(syncIdentity, 30000);
    return () => clearInterval(heartbeat);
  }, [activeTeam, settings.driverName, machineId, activePage]);
  
  const [updateInfo, setUpdateInfo] = useState<{ version: string; progress: number; ready: boolean; status?: 'checking' | 'available' | 'uptodate' | 'error' } | null>(null);

  useEffect(() => {
    if (!window.electron) return;
    window.electron.on('checking-for-update', () => setUpdateInfo({ version: '', progress: 0, ready: false, status: 'checking' }));
    window.electron.on('update-available', (version: string) => setUpdateInfo({ version, progress: 0, ready: false, status: 'available' }));
    window.electron.on('update-not-available', (version: string) => {
      setUpdateInfo({ version: '', progress: 100, ready: false, status: 'uptodate' });
      setTimeout(() => setUpdateInfo(null), 5000);
    });
    window.electron.on('update-progress', (progress: number) => setUpdateInfo(prev => prev ? { ...prev, progress, status: 'available' } : { version: '', progress, ready: false, status: 'available' }));
    window.electron.on('update-ready', () => setUpdateInfo(prev => prev ? { ...prev, ready: true, status: 'available' } : null));
    window.electron.on('update-error', () => {
      setUpdateInfo({ version: 'Error', progress: 0, ready: false, status: 'error' });
      setTimeout(() => setUpdateInfo(null), 5000);
    });
  }, []);

  const handleInstallUpdate = () => window.electron?.send('install-update');


  useEffect(() => {
    if (machineId && window.electron?.sendCommand) {
       window.electron.sendCommand({ action: 'set_mid', mid: machineId });
       window.electron.sendCommand({ action: 'set_name', name: settings.driverName || machineId });
    }
  }, [machineId, settings.driverName]);

  useEffect(() => {
    if (activeTeam && window.electron?.sendCommand) {
      window.electron.sendCommand({ action: 'set_team', teamId: activeTeam });
      const interval = setInterval(() => window.electron.sendCommand({ action: 'set_team', teamId: activeTeam }), 5000);
      return () => clearInterval(interval);
    }
  }, [activeTeam]);

  // Note: History metadata update moved to bridge.py to avoid UI render loops


  if (isValidated === null) return <PremiumLoader text="SECURITY HANDSHAKE" />;
  if (isValidated === false && !isInitialLoad) return <LicenseScreen onActivate={activate} machineId={machineId} licenseError={licenseError} />;
  if (isInitialLoad || isTransitioning) return <PremiumLoader text={isInitialLoad ? 'INITIALIZING' : 'SYNCING'} />;

  if (!activeTeam) return <TeamSelectorPage onSelect={(teamId) => {
    setIsTransitioning(true);
    localStorage.setItem('gridup_active_team', teamId);
    setActiveTeam(teamId);
    setTimeout(() => { setIsTransitioning(false); setActivePage('monitor'); }, 1000);
  }} />;

  const handleEject = () => {
    setIsTransitioning(true);
    localStorage.removeItem('gridup_active_team');
    setTimeout(() => { setActiveTeam(null); setWatchedDriver(null); setActivePage('monitor'); setIsTransitioning(false); }, 300);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'monitor': return <RaceMonitor telemetry={telemetry} session={session} watchedDriver={watchedDriver} onStopWatching={() => setWatchedDriver(null)} />;
      case 'lobby': return <TeamLobby drivers={drivers} onSwitchTeam={handleEject} onWatchDriver={(d) => { setWatchedDriver(d); setActivePage('monitor'); }} machineId={machineId} />;
      case 'fuel': return <FuelStrategy telemetry={telemetry} session={session} fuelTracking={fuelTracking} />;
      case 'stint': return <StintManager telemetry={telemetry} session={session} drivers={drivers} history={history} />;
      case 'health': return <CarHealth telemetry={telemetry} session={session} />;
      case 'control': return <RaceControl telemetry={telemetry} session={session} />;
      case 'setups': return <SetupHub activeTeam={activeTeam} telemetry={telemetry} session={session} setups={setups} />;
      case 'data': return <DataHub activeTeam={activeTeam} telemetry={telemetry} session={session} videoUrl={bestLapVideoUrl} bestLapTime={bestLapTime} />;
      case 'settings': return <Settings />;
      default: return <RaceMonitor telemetry={telemetry} session={session} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans relative select-none text-white">
      {/* Title Bar Drag Handle */}
      <div className="absolute top-0 left-0 right-0 h-12 z-40" style={{ WebkitAppRegion: 'drag' } as any} onDoubleClick={() => window.electron?.send('window-control', 'maximize')} />

      {/* Frame Controls */}
      <div className="absolute top-0 right-0 h-10 flex items-center z-50 px-2">
          <button onClick={() => window.electron?.send('window-control', 'minimize')} className="p-2 text-white/20 hover:text-white transition-colors" style={{ WebkitAppRegion: 'no-drag' } as any}><Minus size={14} /></button>
          <button onClick={() => window.electron?.send('window-control', 'maximize')} className="p-2 text-white/20 hover:text-white transition-colors" style={{ WebkitAppRegion: 'no-drag' } as any}><Square size={12} /></button>
          <button onClick={() => window.electron?.send('window-control', 'close')} className="p-2 text-white/20 hover:text-status-error transition-colors" style={{ WebkitAppRegion: 'no-drag' } as any}><X size={16} /></button>
      </div>

      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isOffline={isOffline} 
        session={session}
        telemetry={telemetry}
        onEject={handleEject}
        isRecording={isRecording}
        onToggleRecording={() => isRecording ? stopRecording() : startRecording()}
      />

      <main className="flex-1 overflow-y-auto relative pt-10" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div key={activePage} className="h-full">
          {renderPage()}
        </div>
        
        {/* Notifications */}
        <div className="fixed bottom-8 right-8 w-96 z-50 flex flex-col gap-4 pointer-events-none">
          {updateInfo && (
            <div className="w-full animate-reveal pointer-events-auto">
              <div className={cn(
                "platinum-glass p-6 rounded-3xl shadow-2xl border-t-2",
                updateInfo.status === 'error' ? 'border-status-error/40' : (updateInfo.status === 'uptodate' ? 'border-status-success/40' : 'border-accent/40')
              )}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-2xl bg-white/5 text-accent"><Activity size={24} /></div>
                  <div>
                    <span className="data-label block mb-1">Update Synchronization</span>
                    <h5 className="text-sm font-black italic">{updateInfo.ready ? 'RESTART REQUIRED' : (updateInfo.status === 'available' ? 'NEW BUILD DETECTED' : 'SYSTEMS OPTIMISED')}</h5>
                  </div>
                </div>
                {updateInfo.status === 'available' && !updateInfo.ready && (
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-accent shadow-[0_0_10px_var(--color-accent)] transition-all duration-300" style={{ width: `${updateInfo.progress}%` }} />
                  </div>
                )}
                {updateInfo.ready && <button onClick={handleInstallUpdate} className="btn-premium w-full">Apply & Restart</button>}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const App = () => (
  <SafeModeBoundary>
    <AppContent />
  </SafeModeBoundary>
);

export default App;

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
