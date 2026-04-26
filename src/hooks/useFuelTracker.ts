import { useState, useEffect, useRef } from 'react';

export const useFuelTracker = (telemetry: any) => {
  const [fuelHistory, setFuelHistory] = useState<number[]>(() => {
    const saved = localStorage.getItem('gridup_fuel_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [lastLap, setLastLap] = useState<number>(() => {
    const saved = localStorage.getItem('gridup_last_lap');
    return saved ? parseInt(saved) : 0;
  });

  const [fuelAtStartOfLap, setFuelAtStartOfLap] = useState<number>(() => {
    const saved = localStorage.getItem('gridup_fuel_at_start');
    return saved ? parseFloat(saved) : 0;
  });

  useEffect(() => {
    if (!telemetry?.lap || !telemetry?.fuel) return;

    // Initialize if zero (start of session)
    if (lastLap === 0) {
      setLastLap(telemetry.lap);
      localStorage.setItem('gridup_last_lap', telemetry.lap.toString());
      setFuelAtStartOfLap(telemetry.fuel);
      localStorage.setItem('gridup_fuel_at_start', telemetry.fuel.toString());
      return;
    }

    // Detect New Lap
    if (telemetry.lap > lastLap) {
      const consumption = fuelAtStartOfLap - telemetry.fuel;
      
      // Safety check: Consumption must be realistic (e.g., > 0.1 and < 15L per lap)
      if (consumption > 0.1 && consumption < 15) {
        const newHistory = [consumption, ...fuelHistory].slice(0, 20);
        setFuelHistory(newHistory);
        localStorage.setItem('gridup_fuel_history', JSON.stringify(newHistory));
      }

      setLastLap(telemetry.lap);
      localStorage.setItem('gridup_last_lap', telemetry.lap.toString());
      setFuelAtStartOfLap(telemetry.fuel);
      localStorage.setItem('gridup_fuel_at_start', telemetry.fuel.toString());
    }

    // Handle session reset
    if (telemetry.lap < lastLap && telemetry.lap > 0) {
      setLastLap(telemetry.lap);
      localStorage.setItem('gridup_last_lap', telemetry.lap.toString());
      setFuelAtStartOfLap(telemetry.fuel);
      localStorage.setItem('gridup_fuel_at_start', telemetry.fuel.toString());
    }
  }, [telemetry?.lap, telemetry?.fuel]);

  const resetHistory = () => {
    setFuelHistory([]);
    localStorage.removeItem('gridup_fuel_history');
    localStorage.removeItem('gridup_last_lap');
    localStorage.removeItem('gridup_fuel_at_start');
    setLastLap(0);
    setFuelAtStartOfLap(0);
  };

  return { fuelHistory, fuelAtStartOfLap, resetHistory };
};
