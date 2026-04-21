import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, off, get, child, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDBLsyitez6RbP87lL0QAaStn8kotK-B-c",
  authDomain: "grid-up-racedash.firebaseapp.com",
  databaseURL: "https://grid-up-racedash-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "grid-up-racedash",
  storageBucket: "grid-up-racedash.firebasestorage.app",
  messagingSenderId: "1071074771312",
  appId: "1:1071074771312:web:14f2b1c7435de2d6ab8fb5",
  measurementId: "G-LSV6EJMEDS"
};

const isConfigValid = firebaseConfig.apiKey !== "YOUR_API_KEY";

const app = isConfigValid ? initializeApp(firebaseConfig) : null;
export const db = app ? getDatabase(app) : null;

export const useFirebase = (teamId: string | null) => {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [drivers, setDrivers] = useState<any>([]);
  const [setups, setSetups] = useState<any[]>([]);
  const [history, setHistory] = useState<any>(null);
  const [appConfig, setAppConfig] = useState<{ version: string; updateUrl: string; isCritical: boolean } | null>(null);
  const [isOffline, setIsOffline] = useState(!isConfigValid);

  // CRITICAL: Wipe all stale data when team changes to prevent black screen crash
  useEffect(() => {
    setTelemetry(null);
    setSession(null);
    setDrivers([]);
    setSetups([]);
    setHistory(null);
  }, [teamId]);

  // Global Config Listener (Runs once on mount)
  useEffect(() => {
    if (!db) return;
    const configRef = ref(db, 'system_config');
    onValue(configRef, (snapshot) => {
      setAppConfig(snapshot.val());
    });
    return () => off(configRef);
  }, []);

  useEffect(() => {
    if (!db) {
      console.warn("Firebase not initialised. Running in local fallback mode.");
      return;
    }

    if (!teamId) {
      setIsOffline(true);
      return;
    }

    if (teamId === 'solo') {
      setIsOffline(true);
      return;
    }

    setIsOffline(false);

    const base_path = `teams/${teamId}`;
    const telemetryRef = ref(db, `${base_path}/telemetry`);
    const sessionRef = ref(db, `${base_path}/session`);
    const driversRef = ref(db, `${base_path}/drivers`);
    const setupsRef = ref(db, `${base_path}/setups`);
    const historyRef = ref(db, `${base_path}/history`);

    let receivedLocalData = false;
    let isActive = true; // Guard against stale closures

    onValue(telemetryRef, (snapshot) => {
      if (!isActive) return;
      if (!receivedLocalData) {
        setTelemetry(snapshot.val());
      }
      setIsOffline(false);
    });

    onValue(sessionRef, (snapshot) => {
      if (!isActive) return;
      if (!receivedLocalData) {
        setSession(snapshot.val());
      }
    });

    onValue(driversRef, (snapshot) => {
      if (!isActive) return;
      const data = snapshot.val();
      if (data) {
        setDrivers(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setDrivers([]);
      }
    });

    onValue(setupsRef, (snapshot) => {
      if (!isActive) return;
      const data = snapshot.val();
      if (data) {
        setSetups(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setSetups([]);
      }
    });

    onValue(historyRef, (snapshot) => {
      if (!isActive) return;
      setHistory(snapshot.val());
    });

    // Electron Bridge Native 60Hz Stream (Prefers Local IPC)
    if (window.electron && window.electron.on) {
      window.electron.on('bridge-status', (data: string) => {
        if (!isActive) return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.telemetry) {
            receivedLocalData = true;
            setTelemetry(parsed.telemetry);
            setSession(parsed.session);
          }
        } catch (e) {
          // Normal log text from bridge
        }
      });
    }

    return () => {
      isActive = false; // Prevent stale closures from updating state
      off(telemetryRef);
      off(sessionRef);
      off(driversRef);
      off(setupsRef);
      off(historyRef);
    };
  }, [teamId]);

  return { telemetry, session, drivers, setups, history, appConfig, isOffline };
};
