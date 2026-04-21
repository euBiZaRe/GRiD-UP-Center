import React from 'react';
import { User, Eye, ArrowLeftRight } from 'lucide-react';

interface TeamLobbyProps {
  drivers: any[];
  onSwitchTeam: () => void;
}

const TeamLobby: React.FC<TeamLobbyProps> = ({ drivers, onSwitchTeam }) => {
  const ACTIVE_TIMEOUT_MS = 120 * 1000; // 2 minutes
  const now = Date.now();

  const activeDrivers = drivers.filter(driver => {
    const isPaceCar = driver.name?.toLowerCase().includes('pace car');
    const isRecentlyActive = (driver.lastActive || 0) > (now - ACTIVE_TIMEOUT_MS);
    const isOnline = driver.status === 'online';
    
    return !isPaceCar && isRecentlyActive && isOnline;
  });

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">TEAM LOBBY</h1>
        <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] mt-2">Active Drivers & Crew</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {activeDrivers.length === 0 ? (
          <div className="col-span-3 card py-12 flex flex-col items-center justify-center text-gray-600">
              <User size={48} className="mb-4 opacity-10" />
              <span className="uppercase tracking-widest font-bold">No Drivers Active</span>
          </div>
        ) : (
          activeDrivers.map((driver) => (
            <div key={driver.id} className="card group hover:border-accent/30 transition-all duration-300">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-white/5 rounded-lg">
                  <User className="text-gray-400 group-hover:text-accent transition-colors" />
                </div>
                <div className="text-right">
                  <div className={`text-[8px] uppercase font-bold tracking-widest px-2 py-1 rounded inline-block ${
                    driver.status === 'online' ? 'bg-status-success/10 text-status-success' : 'bg-gray-800 text-gray-500'
                  }`}>
                    {driver.status || 'Offline'}
                  </div>
                  <p className="text-[8px] text-gray-500 mt-1 uppercase font-bold">
                    {driver.lastActive ? new Date(driver.lastActive).toLocaleTimeString() : 'Never'}
                  </p>
                </div>
              </div>

              <h3 className="text-xl font-bold uppercase tracking-tight">{driver.name || 'Unknown Driver'}</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
                {driver.className ? `${driver.className} / #${driver.carNum}` : 'Unknown Class'}
              </p>

              <div className="mt-8 flex gap-2">
                <button className="flex-1 btn-accent text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                  <Eye size={14} /> Watch Telemetry
                </button>
              </div>
            </div>
          ))
        )}

        {/* Switch Team Button */}
        <div 
            onClick={onSwitchTeam}
            className="card border-dashed border-white/10 flex flex-col items-center justify-center py-12 opacity-50 hover:opacity-100 hover:border-accent/40 transition-all cursor-pointer group"
        >
            <ArrowLeftRight size={20} className="text-gray-600 group-hover:text-accent transition-colors mb-3" />
            <span className="text-[10px] text-gray-500 group-hover:text-accent font-bold uppercase tracking-widest transition-colors">Switch Team</span>
        </div>
      </div>
    </div>
  );
};

export default TeamLobby;
