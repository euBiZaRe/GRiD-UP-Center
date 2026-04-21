import React from 'react';
import { Shield, Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

interface CarHealthProps {
  telemetry: any;
  session: any;
}

const CarHealth: React.FC<CarHealthProps> = ({ telemetry }) => {
  const { settings, convertTemp, convertPress } = useSettings();

  // Extract health object with safe fallbacks
  const h = telemetry?.health || {
    oilTemp: 0,
    waterTemp: 0,
    oilPress: 0,
    tyres: {
      LF: { p: 0, t: 0 },
      RF: { p: 0, t: 0 },
      LR: { p: 0, t: 0 },
      RR: { p: 0, t: 0 }
    }
  };

  return (
    <div className="p-8 h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-hidden">
      
      {/* Engine Vitals */}
      <div className="card bg-panel/30 border-white/5 flex flex-col shrink-0 px-8 py-6">
        <div className="flex items-center gap-2 mb-8">
          <Shield size={16} className="text-accent" />
          <h2 className="text-xs font-black italic tracking-widest uppercase text-white/70">Engine Vitals</h2>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div>
            <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Oil Temp</span>
            <span className="text-3xl font-black text-accent tracking-tighter shadow-accent/20 drop-shadow-md">
              {h.oilTemp > 0 ? convertTemp(h.oilTemp) : '--'}<span className="text-lg opacity-70"> °{settings.tempUnit}</span>
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Water Temp</span>
            <span className="text-3xl font-black text-accent tracking-tighter shadow-accent/20 drop-shadow-md">
              {h.waterTemp > 0 ? convertTemp(h.waterTemp) : '--'}<span className="text-lg opacity-70"> °{settings.tempUnit}</span>
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Oil Pressure</span>
            <span className="text-3xl font-black text-accent tracking-tighter shadow-accent/20 drop-shadow-md">
              {h.oilPress > 0 ? convertPress(h.oilPress) : '--'}<span className="text-lg opacity-70 px-1">{settings.pressUnit}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tyre Vitals */}
      <div className="card bg-panel/30 border-white/5 flex flex-col shrink-0 px-8 py-6">
        <div className="flex items-center gap-2 mb-8">
          <SettingsIcon size={16} className="text-accent" />
          <h2 className="text-xs font-black italic tracking-widest uppercase text-white/70">Tyre Status</h2>
        </div>

        <div className="grid grid-cols-2 gap-y-12 gap-x-12 w-full xl:max-w-4xl">
            {/* Front Left */}
            <div className="flex justify-between items-center bg-black/20 p-4 rounded-lg border border-white/5">
                <div>
                   <span className="block text-2xl font-black italic text-gray-300">LF</span>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pressure</span>
                    <span className="text-xl font-black text-white">{h.tyres.LF.p > 0 ? convertPress(h.tyres.LF.p) : '--'} {settings.pressUnit}</span>
                    <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Surface Temp</span>
                    <span className="text-lg font-black text-[#ffb000]">{h.tyres.LF.t > 0 ? convertTemp(h.tyres.LF.t) : '--'} °{settings.tempUnit}</span>
                </div>
            </div>

            {/* Front Right */}
            <div className="flex justify-between items-center bg-black/20 p-4 rounded-lg border border-white/5">
                <div>
                   <span className="block text-2xl font-black italic text-gray-300">RF</span>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pressure</span>
                    <span className="text-xl font-black text-white">{h.tyres.RF.p > 0 ? convertPress(h.tyres.RF.p) : '--'} {settings.pressUnit}</span>
                    <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Surface Temp</span>
                    <span className="text-lg font-black text-[#ffb000]">{h.tyres.RF.t > 0 ? convertTemp(h.tyres.RF.t) : '--'} °{settings.tempUnit}</span>
                </div>
            </div>

            {/* Rear Left */}
            <div className="flex justify-between items-center bg-black/20 p-4 rounded-lg border border-white/5">
                <div>
                   <span className="block text-2xl font-black italic text-gray-300">LR</span>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pressure</span>
                    <span className="text-xl font-black text-white">{h.tyres.LR.p > 0 ? convertPress(h.tyres.LR.p) : '--'} {settings.pressUnit}</span>
                    <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Surface Temp</span>
                    <span className="text-lg font-black text-[#ffb000]">{h.tyres.LR.t > 0 ? convertTemp(h.tyres.LR.t) : '--'} °{settings.tempUnit}</span>
                </div>
            </div>

            {/* Rear Right */}
            <div className="flex justify-between items-center bg-black/20 p-4 rounded-lg border border-white/5">
                <div>
                   <span className="block text-2xl font-black italic text-gray-300">RR</span>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pressure</span>
                    <span className="text-xl font-black text-white">{h.tyres.RR.p > 0 ? convertPress(h.tyres.RR.p) : '--'} {settings.pressUnit}</span>
                    <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Surface Temp</span>
                    <span className="text-lg font-black text-[#ffb000]">{h.tyres.RR.t > 0 ? convertTemp(h.tyres.RR.t) : '--'} °{settings.tempUnit}</span>
                </div>
            </div>
        </div>

      </div>

    </div>
  );
};

export default CarHealth;
