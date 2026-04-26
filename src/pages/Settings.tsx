import React, { useState, useEffect } from 'react';
import { useSettings, SpeedUnit, TempUnit, PressUnit, LiquidUnit, PRESET_THEMES } from '../hooks/useSettings';
import { Settings as SettingsIcon, Gauge, Thermometer, Wind, Beaker, User, Activity, RefreshCw } from 'lucide-react';

const UnitToggle = ({ 
  title, 
  icon: Icon, 
  options, 
  currentValue, 
  onSelect 
}: { 
  title: string; 
  icon: any; 
  options: string[]; 
  currentValue: string; 
  onSelect: (val: any) => void;
}) => (
  <div className="card bg-panel/30 border border-white/5 p-6 rounded-xl flex items-center justify-between">
      <div className="flex items-center gap-4">
          <div className="p-3 bg-black/40 rounded-lg">
              <Icon className="text-accent" size={24} />
          </div>
          <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
              <p className="text-[10px] text-gray-500 font-bold tracking-wider">Select preferred telemetry output format</p>
          </div>
      </div>
      <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
          {options.map((opt) => (
              <button
                  key={opt}
                  onClick={() => onSelect(opt)}
                  className={`px-6 py-2 rounded text-xs font-black uppercase tracking-widest transition-all ${
                      currentValue === opt 
                      ? 'bg-accent text-black shadow-[0_0_10px_rgba(0,229,255,0.3)]' 
                      : 'text-gray-500 hover:text-white'
                  }`}
              >
                  {opt}
              </button>
          ))}
      </div>
  </div>
);

const Settings: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const [localName, setLocalName] = useState(settings.driverName);
  const [isSaved, setIsSaved] = useState(false);

  // Keep local name in sync if global settings change (e.g. from other instances)
  useEffect(() => {
    setLocalName(settings.driverName);
  }, [settings.driverName]);

  const handleSaveName = () => {
    updateSetting('driverName', localName);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="p-8 h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-y-auto">
      <div className="flex justify-between items-end shrink-0 mb-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none text-white/90">
            SYSTEM PARAMETERS
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Global Telemetry Unit Configuration</span>
          </div>
        </div>
        <button
            onClick={() => {
                if ((window as any).electron) (window as any).electron.send('check-for-updates');
            }}
            className="flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group active:scale-95 shadow-lg"
        >
            <RefreshCw size={16} className="text-accent group-hover:rotate-180 transition-transform duration-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Check for Updates</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 max-w-4xl">

          {/* Driver Identity */}
          <div className="card bg-panel/30 border border-white/5 p-6 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-black/40 rounded-lg">
                      <User className="text-accent" size={24} />
                  </div>
                  <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-white">Driver Identity</h3>
                      <p className="text-[10px] text-gray-500 font-bold tracking-wider">Your display name shown in the team roster</p>
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <input
                      type="text"
                      value={localName}
                      onChange={(e) => {
                          setLocalName(e.target.value);
                          setIsSaved(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                      }}
                      placeholder="Enter your name..."
                      className="bg-black/50 border border-white/10 focus:border-accent text-white px-4 py-2 rounded-lg outline-none text-sm font-bold tracking-wider w-56 transition-colors placeholder:text-gray-600"
                  />
                  <button
                      onClick={handleSaveName}
                      disabled={localName === settings.driverName}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          localName === settings.driverName && !isSaved
                          ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5' 
                          : isSaved
                          ? 'bg-status-success text-black shadow-[0_0_15px_rgba(7,201,155,0.4)]'
                          : 'bg-accent text-black hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                      }`}
                  >
                      {isSaved ? 'Identity Saved' : 'Update Identity'}
                  </button>
              </div>
          </div>
          <UnitToggle 
            title="Speed & Velocity"
            icon={Gauge}
            options={['KMH', 'MPH']}
            currentValue={settings.speedUnit}
            onSelect={(val) => updateSetting('speedUnit', val as SpeedUnit)}
          />

          <UnitToggle 
            title="Temperature Constraints"
            icon={Thermometer}
            options={['C', 'F']}
            currentValue={settings.tempUnit}
            onSelect={(val) => updateSetting('tempUnit', val as TempUnit)}
          />

          <UnitToggle 
            title="Atmospheric & Fluid Pressure"
            icon={Wind}
            options={['PSI', 'BAR', 'KPA']}
            currentValue={settings.pressUnit}
            onSelect={(val) => updateSetting('pressUnit', val as PressUnit)}
          />

          <UnitToggle 
            title="Liquid Fuel Volume"
            icon={Beaker}
            options={['L', 'GAL']}
            currentValue={settings.liquidUnit}
            onSelect={(val) => updateSetting('liquidUnit', val as LiquidUnit)}
          />

          {/* Visual Aesthetic */}
          <div className="card bg-panel/30 border border-white/5 p-6 rounded-xl space-y-6">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-black/40 rounded-lg">
                      <Wind className="text-accent" size={24} />
                  </div>
                  <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-white">Visual Aesthetic</h3>
                      <p className="text-[10px] text-gray-500 font-bold tracking-wider">Customize the application primary color scheme</p>
                  </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {PRESET_THEMES.map((theme) => (
                      <button
                          key={theme.id}
                          onClick={() => updateSetting('theme', theme.id)}
                          className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all group ${
                              settings.theme === theme.id 
                              ? 'bg-accent/10 border-accent shadow-[0_0_15px_color-mix(in srgb,var(--color-accent)_20%,transparent)]' 
                              : 'bg-black/40 border-white/5 hover:border-white/20'
                          }`}
                      >
                          <div 
                              className="w-full h-8 rounded-lg shadow-inner flex items-center justify-center"
                              style={{ backgroundColor: theme.id === 'CUSTOM' ? settings.customColor : theme.color }}
                          >
                              {settings.theme === theme.id && (
                                  <div className="w-2 h-2 bg-black rounded-full" />
                              )}
                          </div>
                      <span className={`text-[10px] uppercase font-black tracking-widest ${
                          settings.theme === theme.id ? 'text-accent' : 'text-gray-500 group-hover:text-white'
                      }`}>
                          {theme.name}
                      </span>
                  </button>
                  ))}
              </div>

              {/* Custom Color Chart */}
              {settings.theme === 'CUSTOM' && (
                  <div className="pt-6 border-t border-white/5 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/40 rounded-lg">
                            <Activity className="text-accent" size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] text-white font-black uppercase tracking-widest leading-none">Custom Accent Color</p>
                            <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-1">Pick a specific team livery color</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                          <span className="text-xs font-mono text-accent font-bold">{settings.customColor.toUpperCase()}</span>
                          <input 
                              type="color"
                              value={settings.customColor}
                              onChange={(e) => updateSetting('customColor', e.target.value)}
                              className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 p-1 cursor-crosshair overflow-hidden"
                          />
                      </div>
                  </div>
              )}
          </div>

          {/* Bridge Diagnostic Console */}
          <div className="card bg-panel/30 border border-white/5 p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-black/40 rounded-lg">
                          <Activity className="text-accent" size={24} />
                      </div>
                      <div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-white">Bridge Diagnostic Console</h3>
                          <p className="text-[10px] text-gray-500 font-bold tracking-wider">Real-time status updates from the telemetry bridge</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 italic">Listening for heartbeats...</span>
                  </div>
              </div>

              <div className="bg-black/60 rounded-xl p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar border border-white/5 shadow-inner">
                  {(window as any).bridgeLogs?.length > 0 ? (
                      (window as any).bridgeLogs.map((log: string, i: number) => (
                          <div key={i} className="flex gap-4 group">
                              <span className="text-gray-700 select-none w-8 text-right">{i + 1}</span>
                              <span className={log.includes('Error') ? 'text-status-error' : log.includes('Sync') || log.includes('🏁') ? 'text-accent font-bold' : 'text-gray-400 group-hover:text-gray-200'}>
                                  {log}
                              </span>
                          </div>
                      ))
                  ) : (
                      <div className="h-full flex items-center justify-center text-gray-800 uppercase font-black tracking-widest">
                          No bridge activity detected. Ensure bridge.exe is running.
                      </div>
                  )}
              </div>
              <p className="text-[9px] text-gray-600 italic">Note: Only the last 500 lines are stored in volatile memory.</p>
          </div>
      </div>
    </div>
  );
};

export default Settings;
