import { useState, useEffect, useRef } from 'react';
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

let app = null;
let db = null;
let isConfigValid = false;

try {
  isConfigValid = firebaseConfig.apiKey !== "YOUR_API_KEY";
  if (isConfigValid) {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  }
} catch (e) {}

export { db };

const telemetrySubscribers = new Set<(msg: any) => void>();
const logSubscribers = new Set<(log: string) => void>();
let bridgeLogs: string[] = [];
let isIpcInitialized = false;

const initIpcListener = () => {
  if (isIpcInitialized || !window.electron || !window.electron.on) return;
  window.electron.on('bridge-status', (data: string) => {
    const rawLines = data.toString().split('\n');
    for (const line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Collect for log viewer
      bridgeLogs.push(trimmed);
      if (bridgeLogs.length > 500) bridgeLogs.shift();
      (window as any).bridgeLogs = bridgeLogs;
      logSubscribers.forEach(cb => cb(trimmed));

      if (!trimmed.startsWith('{')) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.telemetry) telemetrySubscribers.forEach(cb => cb(parsed));
      } catch (e) {}
    }
  });
  isIpcInitialized = true;
};

export const useFirebase = (teamId: string | null, watchedDriverId: string | null = null) => {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [drivers, setDrivers] = useState<any>([]);
  const [setups, setSetups] = useState<any[]>([]);
  const [history, setHistory] = useState<any>(null);
  const [appConfig, setAppConfig] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!isConfigValid);

  // Throttling state
  const lastUpdateTime = useRef(0);
  const THROTTLE_MS = 66; // ~15Hz

  const isObserving = !!watchedDriverId;
  const isObservingRef = useRef(isObserving);

  useEffect(() => {
    isObservingRef.current = isObserving;
  }, [isObserving]);

  useEffect(() => {
    setTelemetry(null);
    setSession(null);
  }, [teamId, watchedDriverId]);

  // Persistent Lobby with Smart De-duplication (v1.1.0)
  useEffect(() => {
    if (!db || !teamId) return;
    const driversRef = ref(db, `teams/${teamId}/drivers`);
    onValue(driversRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setDrivers([]);
        return;
      }
      
      const rawList = Object.entries(data).map(([id, val]: [string, any]) => ({ 
        id, 
        ...val,
        lastActive: val.lastActive || val.heartbeat || 0 
      }));

      const now = Date.now();
      const recentlyActive = rawList.filter(d => (now - d.lastActive) < (48 * 60 * 60 * 1000));

      const merged: Record<string, any> = {};
      recentlyActive.forEach(driver => {
        const idKey = driver.id.toUpperCase();
        if (!merged[idKey] || driver.lastActive > merged[idKey].lastActive) {
          merged[idKey] = driver;
        }
      });

      setDrivers(Object.values(merged));
    });
    return () => off(driversRef);
  }, [teamId]);

  // V1.0.6 POLYMORPHIC UNPACKING Logic (v2 Hardened)
  useEffect(() => {
    let isActive = true;
    let receivedLocalData = false;

    initIpcListener();

    const dispatcher = (msg: any) => {
       if (isObservingRef.current || !isActive) return;
       receivedLocalData = true;

       const now = Date.now();
       if (now - lastUpdateTime.current >= THROTTLE_MS) {
         setTelemetry(msg.telemetry);
         setSession(msg.session);
         lastUpdateTime.current = now;
       }
    };

    telemetrySubscribers.add(dispatcher);

    if (!db || !teamId || teamId === 'solo') {
      setIsOffline(true);
      return () => {
        isActive = false;
        telemetrySubscribers.delete(dispatcher);
      };
    }

    setIsOffline(false);
    const base_path = `teams/${teamId}`;
    const stream_path = watchedDriverId ? `${base_path}/streams/${watchedDriverId}` : `${base_path}/telemetry`;
    
    const streamRef = ref(db, stream_path);
    const setupsRef = ref(db, `${base_path}/setups`);
    const historyRef = ref(db, `${base_path}/history`);

    const unpackData = (data: any) => {
        if (!data) return;

        if (data.telemetry && data.session) {
            const enrichedSession = { 
                ...data.session, 
                is_live: data.is_live, 
                v: data.v,
                diag: data.diag
            };
            setTelemetry(data.telemetry);
            setSession(enrichedSession);
            return;
        }

        if (data.record_key || data.speed !== undefined) {
             setTelemetry(data);
             return;
        }

        if (data.telemetry) setTelemetry(data.telemetry);
        if (data.session) setSession({ ...data.session, diag: data.diag });
    };

    onValue(streamRef, (snapshot) => {
      if (!isActive) return;
      const data = snapshot.val();
      
      if (isObserving && !data) {
        get(ref(db, `${base_path}/drivers/${watchedDriverId}`)).then(dSnap => {
          if (dSnap.val()?.protocol !== 'v2') {
             get(ref(db, `${base_path}/telemetry`)).then(lSnap => {
                if (isActive && isObserving) {
                   const leg = lSnap.val();
                   if (leg) unpackData(leg);
                }
             });
          }
        });
        return;
      }

      if (data && (isObserving || !receivedLocalData)) {
        const now = Date.now();
        if (now - lastUpdateTime.current >= THROTTLE_MS) {
          unpackData(data);
          lastUpdateTime.current = now;
        }
      }
    });

    onValue(setupsRef, (snapshot) => {
      if (isActive) setSetups(Object.entries(snapshot.val() || {}).map(([id, val]: [string, any]) => ({ id, ...val })));
    });

    onValue(historyRef, (snapshot) => {
      if (isActive) setHistory(snapshot.val());
    });

    return () => {
      isActive = false;
      telemetrySubscribers.delete(dispatcher);
      off(streamRef);
      off(setupsRef);
      off(historyRef);
    };
  }, [teamId, watchedDriverId, isObserving]);

  useEffect(() => {
    if (!db) return;
    const configRef = ref(db, 'system_config');
    onValue(configRef, (snapshot) => setAppConfig(snapshot.val()));
    return () => off(configRef);
  }, []);

  return { 
    telemetry, 
    session, 
    drivers, 
    setups, 
    history, 
    appConfig, 
    isOffline,
    bridgeLogs
  };
};
