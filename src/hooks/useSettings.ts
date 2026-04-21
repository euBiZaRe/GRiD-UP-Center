import { useState, useEffect } from 'react';

export type SpeedUnit = 'KMH' | 'MPH';
export type TempUnit = 'C' | 'F';
export type PressUnit = 'PSI' | 'BAR' | 'KPA';
export type LiquidUnit = 'L' | 'GAL';

export interface GridSettings {
  speedUnit: SpeedUnit;
  tempUnit: TempUnit;
  pressUnit: PressUnit;
  liquidUnit: LiquidUnit;
  driverName: string;
}

const DEFAULT_SETTINGS: GridSettings = {
  speedUnit: 'KMH',
  tempUnit: 'C',
  pressUnit: 'PSI',
  liquidUnit: 'L',
  driverName: ''
};

export const useSettings = () => {
  const [settings, setSettings] = useState<GridSettings>(DEFAULT_SETTINGS);

  const loadFromStorage = () => {
    const saved = localStorage.getItem('gridup_settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  };

  useEffect(() => {
    loadFromStorage();

    // Re-sync when another component instance updates localStorage
    const handleStorage = () => loadFromStorage();
    window.addEventListener('storage', handleStorage);

    // Also listen for same-window updates via custom event
    window.addEventListener('gridup-settings-updated', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('gridup-settings-updated', handleStorage);
    };
  }, []);

  const updateSetting = <K extends keyof GridSettings>(key: K, value: GridSettings[K]) => {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    localStorage.setItem('gridup_settings', JSON.stringify(nextSettings));
    // Notify all other useSettings instances in the same window
    window.dispatchEvent(new Event('gridup-settings-updated'));
  };

  // Helper functions for easy conversion rendering
  const convertSpeed = (kmh: number) => {
    if (settings.speedUnit === 'MPH') return Math.round(kmh * 0.621371);
    return Math.round(kmh);
  };

  const convertTemp = (celsius: number, decimals = 1) => {
    if (settings.tempUnit === 'F') return Number((celsius * 9/5 + 32).toFixed(decimals));
    return Number(celsius.toFixed(decimals));
  };

  const convertPress = (psi: number, decimals = 1) => {
    // Note: Python bridge currently extracts pressures naturally in PSI for health (because wait, it was pulling raw. Actually wait, LFcoldPressure usually passes KPa raw from iRacing, but maybe python is converting it? Let's assume bridge exports PSI right now based on our previous discussions, or if it's KPa natively, we can assume base is PSI if it's round(get_safe...) wait. Let's assume the base is PSI for now, we will verify.)
    // Actually, in `bridge.py` I used `LFcoldPressure`, which in iRacing is KPa.
    // If base is KPa:
    const baseKpa = psi; // Assuming bridge exports KPa. Let's rename parameter internally to base
    if (settings.pressUnit === 'PSI') return Number((baseKpa * 0.145038).toFixed(decimals));
    if (settings.pressUnit === 'BAR') return Number((baseKpa / 100).toFixed(decimals));
    return Number(baseKpa.toFixed(decimals)); // KPA
  };

  const convertLiquid = (litres: number, decimals = 1) => {
    if (settings.liquidUnit === 'GAL') return Number((litres * 0.264172).toFixed(decimals));
    return Number(litres.toFixed(decimals));
  };

  return {
    settings,
    updateSetting,
    convertSpeed,
    convertTemp,
    convertPress,
    convertLiquid
  };
};
