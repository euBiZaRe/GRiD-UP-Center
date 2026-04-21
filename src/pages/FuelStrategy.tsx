import React, { useMemo } from 'react';
import { Activity, Target, Fuel } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

interface FuelStrategyProps {
  telemetry: any;
  session: any;
}

const FuelStrategy: React.FC<FuelStrategyProps> = ({ telemetry, session }) => {
  const { settings, convertLiquid } = useSettings();

  // In a real scenario, this would be calculated from historical laps.
  // We'll use a realistic default (e.g., GT3 at Spa) if telemetry doesn't have an avg yet.
  const currentAvg = 3.80; 

  const fuelInTank = telemetry?.fuel || 0;
  
  const estimatedLaps = fuelInTank > 0 ? (fuelInTank / currentAvg) : 0;
  const currentLapsInt = Math.floor(estimatedLaps);

  const generateSaveMatrix = () => {
    if (fuelInTank <= 0) return [];
    
    return [1, 2, 3].map(extraLaps => {
      const targetLaps = currentLapsInt + extraLaps;
      const targetConsumption = fuelInTank / targetLaps;
      const saveNeeded = targetConsumption - currentAvg;
      
      return {
        extension: `+${extraLaps} LAP${extraLaps > 1 ? 'S' : ''}`,
        targetLapsText: `(${targetLaps.toFixed(1)})`,
        targetConsumptionStr: targetConsumption.toFixed(2),
        saveNeededStr: saveNeeded.toFixed(2)
      };
    });
  };

  const matrix = generateSaveMatrix();

  return (
    <div className="p-8 h-full flex gap-6 animate-in fade-in duration-500 overflow-hidden">
      
      {/* Left Column */}
      <div className="flex-1 flex flex-col gap-6 min-h-0 min-w-0">
        
        {/* Live Range Predictor */}
        <div className="card bg-panel/30 border-white/5 flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <Activity size={14} className="text-accent" />
            <h2 className="text-[10px] font-black italic tracking-widest uppercase text-white/70">Live Range Predictor</h2>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center border-b border-white/5 pb-8 mb-6">
            <span className="text-8xl font-black italic tracking-tighter text-accent leading-none">
              {estimatedLaps > 0 ? estimatedLaps.toFixed(1) : '0.0'}
            </span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-2">Estimated Laps Remaining</span>
          </div>

          <div className="flex justify-between px-4 pb-2">
            <div>
              <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Fuel In Tank</span>
              <span className="text-xl font-bold text-[#ffb000]">{convertLiquid(fuelInTank, 1)}{settings.liquidUnit}</span>
            </div>
            <div className="text-right">
              <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">Current Avg</span>
              <span className="text-xl font-bold text-accent">{convertLiquid(currentAvg, 2)}{settings.liquidUnit}</span>
            </div>
          </div>
        </div>

        {/* Automatic Save Matrix */}
        <div className="card bg-panel/30 border-white/5 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Target size={14} className="text-accent" />
            <h2 className="text-[10px] font-black italic tracking-widest uppercase text-white/70">Automatic Save Matrix</h2>
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-3 text-[8px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">
              <span>Stint Extension</span>
              <span className="text-center">Target Consumption</span>
              <span className="text-right">Save Needed</span>
            </div>

            <div className="space-y-4">
              {matrix.length > 0 ? matrix.map((row, i) => (
                <div key={i} className="grid grid-cols-3 items-center text-xs font-bold">
                  <div className="flex items-baseline gap-1">
                    <span className="text-accent uppercase tracking-wider">{row.extension}</span>
                    <span className="text-[10px] text-gray-600">{row.targetLapsText}</span>
                  </div>
                  <div className="text-center text-white/90">
                    {convertLiquid(parseFloat(row.targetConsumptionStr), 2)}{settings.liquidUnit}<span className="text-[9px] text-gray-500">/lap</span>
                  </div>
                  <div className="text-right text-status-error">
                    {row.saveNeededStr}
                  </div>
                </div>
              )) : (
                <div className="text-center text-[10px] text-gray-600 italic tracking-widest uppercase py-4">
                  Insufficient Full
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

        <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2">
          <span>Lap Number</span>
          <span>Consumption</span>
        </div>

        <div className="flex-1 flex items-center justify-center">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest animate-pulse">
                Awaiting Track Data....
            </span>
        </div>
      </div>

    </div>
  );
};

export default FuelStrategy;
