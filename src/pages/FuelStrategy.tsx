import React, { useMemo } from 'react';
import { Activity, Target, Fuel } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

interface FuelStrategyProps {
  telemetry: any;
  session: any;
  fuelTracking: any;
}

const FuelStrategy: React.FC<FuelStrategyProps> = ({ telemetry, session, fuelTracking }) => {
  const { settings, convertLiquid } = useSettings();
  const { fuelHistory, fuelAtStartOfLap, resetHistory } = fuelTracking;

  // Calculate dynamic average
  const currentAvg = useMemo(() => {
    if (fuelHistory.length === 0) return 3.80; // Default fallback
    const sum = fuelHistory.reduce((a: number, b: number) => a + b, 0);
    return sum / fuelHistory.length;
  }, [fuelHistory]);

  const fuelInTank = telemetry?.fuel || 0;
  
  // --- Live Projection Engine ---
  const liveProjectedConsumption = useMemo(() => {
    if (!telemetry?.p || telemetry.p < 0.05) return null; // Wait for at least 5% progress for stability
    const usedSoFar = fuelAtStartOfLap - telemetry.fuel;
    // Basic linear projection (pro is 0-1 or 0-100)
    const progress = telemetry.p > 1.1 ? telemetry.p / 100 : telemetry.p;
    if (progress <= 0) return null;
    return usedSoFar / progress;
  }, [telemetry?.p, telemetry?.fuel, fuelAtStartOfLap]);

  const estimatedLaps = fuelInTank > 0 ? (fuelInTank / currentAvg) : 0;
  const currentLapsInt = Math.floor(estimatedLaps);

  const generateSaveMatrix = () => {
    if (fuelInTank <= 0) return [];
    
    return [1, 2, 3].map(extraLaps => {
      const targetLaps = currentLapsInt + extraLaps;
      const targetConsumption = fuelInTank / targetLaps;
      
      // Live Delta Calculation
      let saveNeededLive = 0;
      if (liveProjectedConsumption !== null) {
          saveNeededLive = liveProjectedConsumption - targetConsumption;
      } else {
          saveNeededLive = currentAvg - targetConsumption;
      }

      const isOnTarget = liveProjectedConsumption !== null && liveProjectedConsumption <= targetConsumption;
      
      return {
        extension: `+${extraLaps} LAP${extraLaps > 1 ? 'S' : ''}`,
        targetLapsText: `(${targetLaps})`,
        targetConsumptionStr: targetConsumption.toFixed(2),
        saveNeededStr: saveNeededLive.toFixed(2),
        isOnTarget,
        targetConsumption,
        isLive: liveProjectedConsumption !== null
      };
    });
  };

  const matrix = generateSaveMatrix();

  return (
    <div className="p-8 h-full flex gap-6 animate-in fade-in duration-500 overflow-hidden">
      
      {/* Left Column */}
      <div className="flex-1 flex flex-col gap-6 min-h-0 min-w-0">
        
        {/* Live Range Predictor */}
        <div className="card bg-panel/30 border-white/5 flex flex-col relative group">
          <button 
            onClick={resetHistory}
            className="absolute top-4 right-4 text-[8px] font-black uppercase tracking-widest text-gray-600 hover:text-status-error transition-colors opacity-0 group-hover:opacity-100"
          >
            Reset History
          </button>
          
          <div className="flex items-center gap-2 mb-8">
            <Activity size={14} className="text-accent" />
            <h2 className="text-[10px] font-black italic tracking-widest uppercase text-white/70">Live Range Predictor</h2>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center border-b border-white/5 pb-8 mb-6">
            <div className="flex flex-col items-center">
                <span className="text-8xl font-black italic tracking-tighter text-accent leading-none">
                {estimatedLaps > 0 ? estimatedLaps.toFixed(1) : '0.0'}
                </span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-2">Estimated Laps Remaining</span>
            </div>

            {/* Live Projection Overlay */}
            {liveProjectedConsumption !== null && (
                <div className="mt-8 px-6 py-3 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center gap-1 animate-in zoom-in-95 duration-300">
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-600">Lap Projection</span>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-black italic ${liveProjectedConsumption > currentAvg ? 'text-status-error' : 'text-status-success'}`}>
                            {convertLiquid(liveProjectedConsumption, 2)}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{settings.liquidUnit}/LAP</span>
                    </div>
                </div>
            )}
          </div>

          <div className="flex justify-between px-4 pb-2">
            <div>
              <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Fuel In Tank</span>
              <span className="text-xl font-bold text-[#ffb000]">{convertLiquid(fuelInTank, 1)}{settings.liquidUnit}</span>
            </div>
            <div className="text-right">
              <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Rolling Avg ({fuelHistory.length} laps)</span>
              <span className="text-xl font-bold text-accent">{convertLiquid(currentAvg, 2)}{settings.liquidUnit}</span>
            </div>
          </div>
        </div>

        {/* Automatic Save Matrix */}
        <div className="card bg-panel/30 border-white/5 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
                <Target size={14} className="text-accent" />
                <h2 className="text-[10px] font-black italic tracking-widest uppercase text-white/70">Automatic Save Matrix</h2>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-status-success" />
                    <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">ON TARGET</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-status-error" />
                    <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">OVER LIMIT</span>
                </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-4 text-[8px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-4 px-2">
              <span>Stint Extension</span>
              <span className="text-center">Target Cons.</span>
              <span className="text-center">Save Needed</span>
              <span className="text-right">Live Status</span>
            </div>

            <div className="space-y-3">
              {matrix.length > 0 ? matrix.map((row, i) => (
                <div key={i} className={`grid grid-cols-4 items-center p-3 rounded-xl border transition-all ${row.isOnTarget ? 'bg-status-success/5 border-status-success/20' : 'bg-black/20 border-white/5'}`}>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-black text-white uppercase tracking-wider">{row.extension}</span>
                    <span className="text-[9px] text-gray-600 font-bold">{row.targetLapsText}</span>
                  </div>
                  <div className="text-center text-white/90 font-mono text-[11px]">
                    {convertLiquid(row.targetConsumption, 2)}{settings.liquidUnit}
                  </div>
                  <div className={`text-center font-black text-[11px] ${parseFloat(row.saveNeededStr) > 0 ? 'text-status-error' : 'text-status-success'}`}>
                    {parseFloat(row.saveNeededStr) > 0 ? '+' : ''}{convertLiquid(parseFloat(row.saveNeededStr), 2)}<span className="text-[8px] ml-0.5">{settings.liquidUnit}</span>
                    {row.isLive && <span className="block text-[6px] opacity-50 -mt-1">LIVE GAP</span>}
                  </div>
                  <div className="flex justify-end">
                     {liveProjectedConsumption === null ? (
                        <div className="w-2 h-2 rounded-full bg-gray-800" />
                     ) : (
                        <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full border ${row.isOnTarget ? 'bg-status-success/20 border-status-success/30 text-status-success' : 'bg-status-error/20 border-status-error/30 text-status-error'}`}>
                            <span className="text-[7px] font-black uppercase tracking-widest">{row.isOnTarget ? 'OK' : 'LIFT'}</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${row.isOnTarget ? 'bg-status-success' : 'bg-status-error animate-pulse'}`} />
                        </div>
                     )}
                  </div>
                </div>
              )) : (
                <div className="text-center text-[10px] text-gray-600 italic tracking-widest uppercase py-4">
                  Insufficient Fuel Data
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Right Column: Consumption History */}
      <div className="flex-[1.2] card bg-panel/30 border-white/5 flex flex-col min-h-0 min-w-0">
        <div className="flex items-center gap-2 mb-6">
          <Fuel size={14} className="text-accent" />
          <h2 className="text-[10px] font-black italic tracking-widest uppercase text-white/70">Consumption History</h2>
        </div>

        <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">
          <span>Relative Lap</span>
          <span>Consumption</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
            {fuelHistory.length > 0 ? fuelHistory.map((cons, i) => (
              <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-black/20 border border-white/5 hover:border-white/10 transition-colors">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  {i === 0 ? 'Last Lap' : `Lap -${i}`}
                </span>
                <span className="text-sm font-black text-white">
                  {convertLiquid(cons, 2)}{settings.liquidUnit}
                </span>
              </div>
            )) : (
              <div className="h-full flex items-center justify-center">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest animate-pulse">
                    Awaiting Track Data....
                </span>
              </div>
            )}
        </div>
      </div>

    </div>
  );
};

export default FuelStrategy;
