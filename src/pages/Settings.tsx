import React, { useState, useEffect } from 'react';
import { useSettings, SpeedUnit, TempUnit, PressUnit, LiquidUnit } from '../hooks/useSettings';
import { Settings as SettingsIcon, Gauge, Thermometer, Wind, Beaker, User } from 'lucide-react';

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
      </div>
    </div>
  );
};

export default Settings;
