import React from 'react';
import { 
  Activity, 
  Users, 
  Fuel, 
  Timer, 
  ShieldAlert, 
  MessageSquare, 
  Settings,
  Wrench,
  ChevronRight
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
  onEject: (teamId: string | null) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, isOffline, onEject }) => {
  const navItems = [
    { id: 'monitor', label: 'Race Monitor', icon: Activity },
    { id: 'lobby', label: 'Team Lobby', icon: Users },
    { id: 'fuel', label: 'Fuel Strategy', icon: Fuel },
    { id: 'stint', label: 'Stint Manager', icon: Timer },
    { id: 'health', label: 'Car Health', icon: ShieldAlert },
    { id: 'control', label: 'Race Control', icon: MessageSquare },
    { id: 'setups', label: 'Setup Hub', icon: Wrench },
    { id: 'settings', label: 'Parameters', icon: Settings },
  ];

  return (
    <div className="w-64 border-r border-white/5 flex flex-col h-full bg-panel">
      {/* Brand */}
      <div className="p-6 mb-4">
        <h1 className="font-black text-xl tracking-tighter italic">
          GRID <span className="text-accent underline decoration-2 offset-4">UP</span>
        </h1>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">
          Performance Center
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={cn(
              "nav-item group relative",
              activePage === item.id && "active"
            )}
          >
            <item.icon size={18} />
            <span className="font-medium text-sm">{item.label}</span>
            {activePage === item.id && (
              <ChevronRight size={14} className="ml-auto text-accent" />
            )}
          </div>
        ))}
      </nav>

      {/* Team Section */}
      <div className="p-4 mt-auto border-t border-white/5">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">My Team</span>
        </div>
        
        {/* Connection Status */}
        <div className={cn(
          "px-3 py-4 rounded-lg flex flex-col gap-1",
          isOffline ? "bg-status-error/10" : "bg-status-success/5"
        )}>
          <span className={cn(
            "text-[9px] uppercase font-bold tracking-wider",
            isOffline ? "text-status-error" : "text-status-success"
          )}>
            {isOffline ? "No Bridge Connected" : "Telemetry Active"}
          </span>
          <span className="text-[8px] text-gray-500 uppercase tracking-widest">
            {isOffline ? "Local Simulation Active" : "Firebase Real-time"}
          </span>
        </div>

        {/* Eject Team */}
        <button 
          onClick={() => {
              localStorage.removeItem('gridup_active_team');
              onEject(null);
          }}
          className="mt-4 w-full py-2 bg-red-900/10 text-status-error/50 border border-red-900/20 rounded text-[9px] font-black uppercase tracking-widest hover:bg-red-900/30 hover:text-status-error hover:border-status-error/50 transition-colors"
        >
            Eject Team
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
