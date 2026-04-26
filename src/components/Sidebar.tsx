import React from 'react';
import { 
  Users, 
  Fuel, 
  Timer,
  MessageSquare, 
  Maximize2,
  Trash2,
  UploadCloud,
  Activity,
  Settings,
  Compass,
  Wrench,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Info,
  ChevronRight,
  BarChart3,
  Video,
  Plus
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
  isOffline: boolean;
  session: any;
  telemetry: any;
  onEject: (teamId: string | null) => void;
  isRecording?: boolean;
  onToggleRecording?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, isOffline, session, telemetry, onEject, isRecording, onToggleRecording }) => {
  const [showDiag, setShowDiag] = React.useState(false);
  const diag = session?.diag || telemetry?.diag || null;

  const navItems = [
    { id: 'monitor', label: 'Race Monitor', icon: Activity },
    { id: 'data', label: 'Data Hub', icon: BarChart3 },
    { id: 'lobby', label: 'Team Lobby', icon: Users },
    { id: 'fuel', label: 'Fuel Strategy', icon: Fuel },
    { id: 'stint', label: 'Stint Manager', icon: Timer },
    { id: 'health', label: 'Car Health', icon: ShieldAlert },
    { id: 'control', label: 'Race Control', icon: MessageSquare },
    { id: 'setups', label: 'Setup Hub', icon: Wrench },
    { id: 'settings', label: 'Parameters', icon: Settings },
  ];

  return (
    <div className="w-64 flex flex-col h-full bg-panel border-r border-white/5">
      {/* Brand */}
      <div className="p-8 mb-4">
        <h1 className="font-black text-2xl tracking-tighter italic text-white flex items-center gap-2">
          GRID <span className="text-accent underline decoration-4 underline-offset-8">UP</span>
        </h1>
        <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.4em] mt-3">
          Performance Center
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={cn(
              "nav-item w-full group transition-all duration-300",
              activePage === item.id && "active"
            )}
          >
            <item.icon size={18} className={cn(activePage === item.id ? "text-accent" : "text-white/20 group-hover:text-white/60")} />
            <span className="text-xs font-semibold tracking-wide">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer Area */}
      <div className="p-4 mt-auto space-y-4">
        {/* Connection Status Card */}
        <div className={cn(
          "p-4 rounded-2xl border backdrop-blur-md transition-all duration-500",
          isOffline 
            ? "bg-status-error/5 border-status-error/20" 
            : (session?.is_live ? "bg-status-success/5 border-status-success/20" : "bg-status-warning/5 border-status-warning/20")
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className={cn(
              "text-[8px] font-black uppercase tracking-[0.2em]",
              isOffline ? "text-status-error" : ((session?.is_live || telemetry?.is_live) ? "text-status-success" : "text-status-warning")
            )}>
              {isOffline ? "Sync Offline" : ((session?.is_live || telemetry?.is_live) ? "iRacing Live" : "Sim Mode")}
            </span>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isOffline ? "bg-status-error" : "bg-status-success animate-pulse shadow-[0_0_8px_currentColor]"
            )} />
          </div>
          
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-white/40 font-medium">Precision V2.4</span>
            <span className="text-[8px] font-mono text-white/20">#{telemetry?.v || '2.0'}</span>
          </div>

          {!isOffline && (
            <button 
              onClick={() => setShowDiag(!showDiag)}
              className="mt-3 w-full py-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center gap-2 hover:bg-white/10 transition-all group"
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/60 group-hover:text-white">Diagnostics</span>
              <Activity size={10} className="text-white/20 group-hover:text-accent" />
            </button>
          )}
        </div>

        {/* Eject / Team Control */}
        <div className="flex gap-2">
           <button 
             onClick={onToggleRecording}
             className={cn(
               "flex-1 p-3 rounded-xl border flex items-center justify-center transition-all",
               isRecording 
                 ? "bg-status-error/20 border-status-error/40 text-status-error" 
                 : "bg-white/2 border-white/5 text-white/20 hover:text-white hover:bg-white/5"
             )}
           >
             <Video size={16} className={isRecording ? "animate-pulse" : ""} />
           </button>
           <button 
             onClick={() => {
                localStorage.removeItem('gridup_active_team');
                onEject(null);
             }}
             className="flex-[3] py-3 bg-white/2 hover:bg-status-error/10 border border-white/5 hover:border-status-error/20 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-status-error transition-all"
           >
             Eject
           </button>
        </div>
      </div>

      {/* Diagnostic Overlay */}
      {showDiag && (
        <div className="absolute left-64 bottom-20 w-72 p-6 platinum-glass rounded-3xl shadow-2xl z-[100] animate-reveal">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">System Inspector</span>
            <button onClick={() => setShowDiag(false)} className="text-white/20 hover:text-white transition-colors">
              <Plus className="rotate-45" size={14} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5">
              <span className="data-label">Privileges</span>
              <span className={cn("text-[10px] font-bold uppercase", diag?.admin ? "text-status-success" : "text-status-warning")}>
                {diag?.admin ? "Admin" : "Standard"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/2 border border-white/5">
              <span className="data-label block mb-2">Bridge Status</span>
              <p className="text-[10px] text-white/60 leading-relaxed italic">
                "{diag?.msg || "Waiting for signal..."}"
              </p>
            </div>

            {diag && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {[
                  { label: 'RPM', val: Math.round(telemetry?.rpm || 0), color: 'text-accent' },
                  { label: 'SPD', val: Math.round(telemetry?.speed || 0), color: 'text-white' },
                  { label: 'THR', val: `${Math.round(telemetry?.throttle || 0)}%`, color: 'text-status-success' },
                  { label: 'BRK', val: `${Math.round(telemetry?.brake || 0)}%`, color: 'text-status-error' }
                ].map(stat => (
                  <div key={stat.label} className="bg-white/2 p-2 rounded-xl border border-white/5">
                    <span className="text-[7px] font-bold text-white/20 block uppercase mb-1">{stat.label}</span>
                    <span className={cn("text-xs font-mono font-black", stat.color)}>{stat.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(Sidebar);
