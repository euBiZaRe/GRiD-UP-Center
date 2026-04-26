import React, { useState, useEffect } from 'react';
import { Shield, Users, Minus, Square, X } from 'lucide-react';
import { db } from '../hooks/useFirebase';
import { ref, onValue, off } from 'firebase/database';

interface TeamSelectorProps {
  onSelect: (teamId: string) => void;
}

const TEAMS = [
  { id: 'gridUp_sim',      name: 'GRiD UP Sim Racing',    img: 'teams/Grid Up Sim Endurance.png', glow: 'var(--color-accent)' },
  { id: 'gridUp_black',   name: 'GRiD UP Black',          img: 'teams/Team Black.png',            glow: '#555555' },
  { id: 'gridUp_blue',    name: 'GRiD UP Blue',           img: 'teams/Team Blue.png',             glow: '#3b82f6' },
  { id: 'gridUp_red',     name: 'GRiD UP Red',            img: 'teams/Team Red.png',              glow: '#ef4444' },
  { id: 'gridUp_white',   name: 'GRiD UP White',          img: 'teams/Team White.png',            glow: '#ffffff' },
  { id: 'solo',           name: 'SOLO',                   img: 'teams/Solo Mode.png',             glow: 'var(--color-accent)' },
  { id: 'gridUp_practice',name: 'PRACTICE SERVER',        img: 'teams/Practice Mode.png',         glow: 'var(--color-accent)' },
];

const TeamSelector: React.FC<TeamSelectorProps> = ({ onSelect }) => {
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!db) return;

    const teamsRef = ref(db, 'teams');
    onValue(teamsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const newCounts: Record<string, number> = {};
      const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;

      Object.entries(data).forEach(([teamId, teamData]: [string, any]) => {
        if (teamData?.drivers) {
          const onlineCount = Object.values(teamData.drivers || {}).filter((d: any) => 
            d && (d.status === 'online' || d.online !== false) && (d.lastActive || 0) > fifteenMinutesAgo
          ).length;
          newCounts[teamId] = onlineCount;
        } else {
          newCounts[teamId] = 0;
        }
      });
      setTeamCounts(newCounts);
    });

    return () => off(teamsRef);
  }, []);

  const renderCard = (team: typeof TEAMS[0]) => (
    <div
      key={team.id}
      onClick={() => onSelect(team.id)}
      className="group relative w-64 h-80 rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-500 hover:-translate-y-2 bg-panel"
      style={{ boxShadow: 'none', borderColor: 'rgba(255,255,255,0.05)' } as any}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 0 40px ${team.glow}`;
        e.currentTarget.style.borderColor = team.glow;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
      }}
    >
      {/* Per-team glow orb - hover only */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 55%, ${team.glow} 0%, transparent 65%)` }}
      />

      {/* Logo background layer */}
      <div className="absolute inset-0 p-4 flex items-center justify-center">
        <img
          src={team.img}
          alt={team.name}
          className="w-full h-auto object-contain drop-shadow-2xl transition-all duration-500 group-hover:scale-105"
          style={{ filter: 'none' }}
          onMouseEnter={e => ((e.currentTarget as HTMLImageElement).style.filter = `drop-shadow(0 0 14px ${team.glow})`)}
          onMouseLeave={e => ((e.currentTarget as HTMLImageElement).style.filter = 'none')}
        />
      </div>

      {/* Gradient overlay to isolate text */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80" />

      {/* Content Layer */}
      <div className="absolute inset-x-0 bottom-0 p-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-black italic tracking-widest uppercase text-white">{team.name}</h3>
          {team.id !== 'solo' && team.id !== 'gridUp_practice' && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${teamCounts[team.id] > 0 ? 'bg-accent/10 border-accent/30' : 'bg-white/5 border-white/10 opacity-40'}`}>
              <Users size={10} className={teamCounts[team.id] > 0 ? 'text-accent' : 'text-gray-500'} />
              <span className={`text-[10px] font-black ${teamCounts[team.id] > 0 ? 'text-accent' : 'text-gray-500'}`}>
                {teamCounts[team.id] || 0}
              </span>
            </div>
          )}
        </div>
        <span className="text-[10px] font-bold text-accent uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
          Bind Telemetry Target &rarr;
        </span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-8 animate-in fade-in duration-1000 select-none">

      {/* Full-Width Drag Handle with double-click maximize/restore */}
      <div
        className="absolute top-0 left-0 right-0 h-16 z-40"
        style={{ WebkitAppRegion: 'drag' } as any}
        onDoubleClick={() => window.electron && window.electron.send('window-control', 'maximize')}
      />

      {/* Frame Controls */}
      <div className="absolute top-0 right-0 h-8 flex items-center z-50">
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
      
      <div className="text-center mb-16">
        <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-4 text-white">
          <span className="text-accent">GRiD</span> UP
        </h1>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2">
            <Shield size={16} /> Select Active Endurance Team
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Row 1: GRiD UP Teams */}
        <div className="flex gap-6 justify-center">
          {TEAMS.filter(t => t.id !== 'solo' && t.id !== 'gridUp_practice').map(renderCard)}
        </div>

        {/* Row 2: Solo / Practice */}
        <div className="flex gap-6 justify-center">
          {TEAMS.filter(t => t.id === 'solo' || t.id === 'gridUp_practice').map(renderCard)}
        </div>
      </div>
    </div>
  );
};

export default TeamSelector;
