import { useState, useEffect } from 'react';

export type SpeedUnit = 'KMH' | 'MPH';
export type TempUnit = 'C' | 'F';
export type PressUnit = 'PSI' | 'BAR' | 'KPA';
export type LiquidUnit = 'L' | 'GAL';

export interface GridTheme {
  id: string;
  name: string;
  color: string;
}

export const PRESET_THEMES: GridTheme[] = [
  { id: 'CYBERPUNK', name: 'Cyberpunk', color: '#00e5ff' },
  { id: 'EMERALD', name: 'Emerald', color: '#00ff88' },
  { id: 'VULCAN', name: 'Vulcan', color: '#ff4d00' },
  { id: 'ROYAL', name: 'Royal', color: '#be00ff' },
  { id: 'GHOST', name: 'Ghost', color: '#ffffff' },
  { id: 'CUSTOM', name: 'Custom', color: '#888888' }
];

export interface GridSettings {
  speedUnit: SpeedUnit;
  tempUnit: TempUnit;
  pressUnit: PressUnit;
  liquidUnit: LiquidUnit;
  driverName: string;
  theme: string;
  customColor: string;
}

const DEFAULT_SETTINGS: GridSettings = {
  speedUnit: 'KMH',
  tempUnit: 'C',
  pressUnit: 'PSI',
  liquidUnit: 'L',
  driverName: '',
  theme: 'CYBERPUNK',
  customColor: '#00e5ff'
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
  const convertSpeed = (ms: number) => {
    const kmh = ms * 3.6;
    if (settings.speedUnit === 'MPH') return Math.round(kmh * 0.621371);
    return Math.round(kmh);
  };

  const convertTemp = (celsius: number, decimals = 1) => {
    if (settings.tempUnit === 'F') return Number((celsius * 9/5 + 32).toFixed(decimals));
    return Number(celsius.toFixed(decimals));
  };

  const convertPress = (kpa: number, decimals = 1) => {
    // iRacing sends pressures in KPa
    if (settings.pressUnit === 'PSI') return Number((kpa * 0.145038).toFixed(decimals));
    if (settings.pressUnit === 'BAR') return Number((kpa / 100).toFixed(decimals));
    return Number(kpa.toFixed(decimals)); // KPA
  };

  const convertLiquid = (litres: number, decimals = 1) => {
    // iRacing sends fuel in Litres
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
