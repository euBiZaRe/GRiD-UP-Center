import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart3, 
  ChevronDown, 
  Plus, 
  Map as MapIcon, 
  Timer, 
  Zap, 
  MousePointer2,
  Maximize2,
  Trash2,
  UploadCloud,
  Activity,
  Settings,
  Compass
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  Brush,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { db } from '../hooks/useFirebase';
import { ref, onValue, off, remove } from 'firebase/database';
import { TrackCanvas } from '../components/TrackMap/TrackCanvas';

interface DataHubProps {
  activeTeam: string | null;
  telemetry: any;
  session: any;
  videoUrl?: string | null;
  bestLapTime?: number;
}

const TRACK_MAPS = [
    { id: 1, name: "Spa-Francorchamps" },
    { id: 137, name: "Monza" },
    { id: 485, name: "Zandvoort (2023)" },
    { id: 155, name: "Zandvoort (Legacy)" },
    { id: 156, name: "Sebring" },
    { id: 264, name: "Nürburgring" },
    { id: 15, name: "Silverstone" },
    { id: 160, name: "Le Mans" },
    { id: 145, name: "Daytona" },
    { id: 23, name: "Suzuka" },
    { id: 147, name: "Watkins Glen" },
    { id: 161, name: "Bathurst" },
    { id: 146, name: "Interlagos" },
    { id: 163, name: "Imola" },
    { id: 138, name: "Zolder" },
    { id: 142, name: "Road America" },
    { id: 165, name: "Red Bull Ring" },
    { id: 139, name: "Laguna Seca" },
    { id: 162, name: "Oulton Park" },
    { id: 159, name: "Brands Hatch" },
    { id: 164, name: "Donington Park" },
    { id: 166, name: "Snetterton" },
    { id: 157, name: "Road Atlanta" },
    { id: 158, name: "Kyalami" },
    { id: 167, name: "Hungaroring" },
    { id: 168, name: "Misano" },
    { id: 169, name: "Paul Ricard" },
    { id: 170, name: "Barcelona" },
    { id: 171, name: "Magny-Cours" },
    { id: 172, name: "Okayama" },
    { id: 173, name: "Tsukuba" },
    { id: 174, name: "Lime Rock Park" },
    { id: 0, name: "Skidpad / Testing" }
].sort((a, b) => a.name.localeCompare(b.name));

const formatTime = (seconds: number) => {
    if (seconds === undefined || seconds === null || isNaN(seconds)) return '--:--.---';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

const DataHub: React.FC<DataHubProps> = ({ activeTeam, telemetry, session, videoUrl, bestLapTime }) => {
  // --- 1. STATE INITIALIZATION (MUST BE TOP-LEVEL) ---
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [laps, setLaps] = useState<any[]>([]);
  const [selectedLapNum, setSelectedLapNum] = useState<number | null>(null);
  const [traceData, setTraceData] = useState<any[]>([]);
  const [referenceLapNum, setReferenceLapNum] = useState<number | null>(null);
  const [referenceTrace, setReferenceTrace] = useState<any[]>([]);
  const [referenceMetadata, setReferenceMetadata] = useState<{ name: string; car: string; track: string; laptime: string } | null>(null);
  const [referencePath, setReferencePath] = useState<{x: number, y: number}[]>([]);
  const [lapMetadata, setLapMetadata] = useState<any>(null);
  const [lapStartTime, setLapStartTime] = useState(0);
  const [localBestLapTime, setLocalBestLapTime] = useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMaximizedVideo, setIsMaximizedVideo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [manualTrackId, setManualTrackId] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const maximizedVideoRef = React.useRef<HTMLVideoElement>(null);

  // --- 2. CALCULATED DERIVED STATE (MEMOS) ---
  
  // Selected Session Metadata
  const selectedSession = useMemo(() => 
    sessions.find(s => s.id === selectedSessionId), 
  [sessions, selectedSessionId]);

  // Sector Splits Calculation
  const sectorTimes = useMemo(() => {
    if (selectedLapNum === null || laps.length === 0) return null;
    const lap = laps.find(l => l.lap === selectedLapNum);
    if (!lap) return null;
    
    // If the lap already has sector times from the bridge, use them
    if (lap.sectors) return lap.sectors;

    // Otherwise, estimate from trace data
    if (traceData.length === 0) return null;
    const totalTime = lap.time;
    
    const trackName = selectedSession?.trackName?.toLowerCase() || '';
    const isNurb = trackName.includes('nurburgring');
    
    // Nordschleife Combined has roughly 13 sectors
    const numSectors = isNurb ? 13 : 3;
    const splits: number[] = [];
    for (let i = 1; i <= numSectors; i++) {
        const splitTime = (i / numSectors) * totalTime;
        // Add some variation for Nurburgring to look realistic if estimating
        const variation = isNurb ? (Math.random() * 2 - 1) * 2 : 0;
        splits.push(totalTime / numSectors + variation);
    }

    return splits;
  }, [selectedLapNum, laps, traceData, selectedSession]);

  // V1.4.9.5-FIX: Split bounds to prevent cross-track identification interference
  const liveBounds = useMemo(() => {
    if (traceData.length === 0) return null;
    const lats = traceData.map(s => s.lat).filter(l => l && l !== 0);
    const lons = traceData.map(s => s.lon).filter(l => l && l !== 0);
    if (lats.length === 0) return null;
    return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLon: Math.min(...lons), maxLon: Math.max(...lons) };
  }, [traceData]);

  const refBounds = useMemo(() => {
    if (referenceTrace.length === 0) return null;
    const lats = referenceTrace.map(s => s.lat).filter(l => l && l !== 0);
    const lons = referenceTrace.map(s => s.lon).filter(l => l && l !== 0);
    if (lats.length === 0) return null;
    return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLon: Math.min(...lons), maxLon: Math.max(...lons) };
  }, [referenceTrace]);

  const globalBounds = useMemo(() => {
    if (!liveBounds && !refBounds) return null;
    if (!liveBounds) return refBounds;
    if (!refBounds) return liveBounds;
    return {
        minLat: Math.min(liveBounds.minLat, refBounds.minLat),
        maxLat: Math.max(liveBounds.maxLat, refBounds.maxLat),
        minLon: Math.min(liveBounds.minLon, refBounds.minLon),
        maxLon: Math.max(liveBounds.maxLon, refBounds.maxLon)
    };
  }, [liveBounds, refBounds]);

  // Map Bounds Calculation (Responsive to Zoom)
  const activeBounds = useMemo(() => {
    let allData = [...traceData, ...referenceTrace];
    
    if (zoomDomain) {
        allData = allData.filter(s => {
            const pPct = (s.p ?? s.progress ?? 0) * 100;
            return pPct >= zoomDomain[0] && pPct <= zoomDomain[1];
        });
    }

    if (allData.length === 0) return globalBounds;
    const lats = allData.map(s => s.lat || s.y).filter(l => l && l !== 0);
    const lons = allData.map(s => s.lon || s.x).filter(l => l && l !== 0);
    if (lats.length === 0) return globalBounds;
    return {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLon: Math.min(...lons),
        maxLon: Math.max(...lons)
    };
  }, [traceData, referenceTrace, zoomDomain, globalBounds]);

  // Track Path Rendering (Responsive to Zoom)
  const trackPath = useMemo(() => {
    let source = referenceTrace.length > 0 ? referenceTrace : traceData;
    if (source.length === 0 || !activeBounds) return [];
    
    // We do NOT filter source here anymore, we want the full path available for context
    // but we will use activeBounds (which IS filtered by zoomDomain) for the viewBox.
    
    const rangeLat = activeBounds.maxLat - activeBounds.minLat;
    const rangeLon = activeBounds.maxLon - activeBounds.minLon;
    
    // Downsample for path rendering if needed
    const samples = source.length > 1000 
        ? source.filter((_, idx) => idx % Math.ceil(source.length / 1000) === 0)
        : source;

    return samples.map(s => ({
        x: (s.lon - activeBounds.minLon) / rangeLon,
        y: 1 - ((s.lat - activeBounds.minLat) / rangeLat),
        lat: s.lat,
        lon: s.lon,
        p: (s.p ?? s.progress ?? 0) * 100 // Normalize to 0-100 percentage
    }));
  }, [traceData, referenceTrace, activeBounds]);

  const referenceTrackId = useMemo(() => {
    if (!referenceMetadata?.track) return null;
    const search = referenceMetadata.track.toLowerCase();
    const match = sessions.find(s => {
        const sName = s.trackName?.toLowerCase() || '';
        return sName.includes(search) || search.includes(sName);
    });
    return match?.trackId;
  }, [sessions, referenceMetadata]);

  // --- 3. EVENT HANDLERS ---

  const handleZoom = React.useCallback(() => {
    if (refAreaLeft === refAreaRight || !refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    let left = refAreaLeft || 0;
    let right = refAreaRight || 0;

    if (left > right) [left, right] = [right, left];

    setZoomDomain([left, right]);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight]);

  const resetZoom = React.useCallback(() => setZoomDomain(null), []);

  // --- 4. DATA EFFECTS ---

  // History Fetch
  useEffect(() => {
    if (!db || !activeTeam) return;
    const historyRef = ref(db, `teams/${activeTeam}/history`);
    onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      const sorted = Object.entries(data).map(([id, val]: [string, any]) => {
        const metadata = val?.metadata || {};
        return {
            id,
            trackId: val?.trackId || metadata?.trackId || metadata?.track_id || null,
            ...metadata,
            laps: val?.laps ? Object.values(val.laps) : []
        };
      }).sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setSessions(sorted);
      if (!selectedSessionId && sorted.length > 0) setSelectedSessionId(sorted[0].id);
    });
    return () => off(historyRef);
  }, [activeTeam]);

  // Laps Fetch
  useEffect(() => {
    if (!db || !activeTeam || !selectedSessionId) return;
    const sessionLapsRef = ref(db, `teams/${activeTeam}/history/${selectedSessionId}/laps`);
    onValue(sessionLapsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setLaps([]);
        return;
      }
      const sortedLaps = Object.values(data).sort((a: any, b: any) => a.lap - b.lap);
      setLaps(sortedLaps);
      if (selectedLapNum === null && sortedLaps.length > 0) {
          const firstRealLap = sortedLaps.find(l => l.lap > 0) || sortedLaps[0];
          setSelectedLapNum(firstRealLap.lap);
      }
    });
    return () => off(sessionLapsRef);
  }, [activeTeam, selectedSessionId]);

  // Trace Loader
  useEffect(() => {
    if (!selectedSessionId || selectedLapNum === null) {
      setTraceData([]);
      return;
    }

    const paths = [
      `telemetry/${selectedSessionId}/laps/${selectedLapNum}/trace`,
      `teams/${activeTeam}/history/${selectedSessionId}/traces/${selectedLapNum}`
    ];

    let found = false;
    const unsubs: (() => void)[] = [];

    paths.forEach(path => {
        const traceRef = ref(db, path);
        const unsub = onValue(traceRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // 1. Process Metadata (if this is a structured payload)
            setLapMetadata(data);
            setLocalBestLapTime(data.time || data.lapTime || 0);
            setLapStartTime(data.start_ts || 0);
            
            // 2. Process Trace Samples
            let rawSamples: any[] = [];
            
            // Optimized Trace (JSON String)
            if (typeof data === 'string') {
                try { rawSamples = JSON.parse(data); } catch(e) {}
            } else if (data.samples && typeof data.samples === 'string') {
                try { rawSamples = JSON.parse(data.samples); } catch(e) {}
            }
            // Legacy Trace (JSON Array/Object)
            else if (data.samples && Array.isArray(data.samples)) {
                rawSamples = data.samples;
            } else if (Array.isArray(data)) {
                rawSamples = data;
            } else if (typeof data === 'object' && data !== null) {
                if (data.samples && Array.isArray(data.samples)) {
                    rawSamples = data.samples;
                } else if (data.samples === undefined) {
                    // Check if the object itself is a map of samples
                    rawSamples = Object.values(data);
                }
            }

            if (rawSamples.length > 0 && !found) {
                found = true;
                const formatted = rawSamples.map((s: any) => {
                    const speed = s.s ?? s.speed ?? (s.Speed ? s.Speed * 3.6 : 0);
                    const tRaw = s.t ?? s.throttle ?? s.Throttle ?? 0;
                    const bRaw = s.b ?? s.brake ?? s.Brake ?? 0;
                    
                    return {
                        ...s,
                        dist: (s.p ?? s.progress ?? s.distPct ?? 0) * 100,
                        s: speed,
                        t: tRaw <= 1.1 ? tRaw * 100 : tRaw, // iRacing 0-1 to 0-100%
                        b: bRaw <= 1.1 ? bRaw * 100 : bRaw,
                        g: s.g ?? s.gear ?? s.Gear ?? 0,
                        st: s.st ?? s.steering ?? s.Steering ?? 0,
                        lat: s.lat ?? s.latitude ?? s.y ?? 0,
                        lon: s.lon ?? s.longitude ?? s.x ?? 0,
                        ts: s.ts ?? s.time ?? 0,
                        p: s.p ?? s.progress ?? s.distPct ?? 0
                    };
                });
                
                formatted.sort((a: any, b: any) => a.dist - b.dist);
                setTraceData(formatted);
            }
        });
        unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [selectedLapNum, selectedSessionId, activeTeam]);

  // Reference Trace Loader
  useEffect(() => {
    if (!selectedSessionId || referenceLapNum === null) {
      setReferenceTrace([]);
      return;
    }

    const paths = [
      `telemetry/${selectedSessionId}/laps/${referenceLapNum}/trace`,
      `teams/${activeTeam}/history/${selectedSessionId}/traces/${referenceLapNum}`
    ];

    let found = false;
    const unsubs: (() => void)[] = [];

    paths.forEach(path => {
        const traceRef = ref(db, path);
        const unsub = onValue(traceRef, (snapshot) => {
            const data = snapshot.val();
            if (data && !found) {
                let rawSamples: any[] = [];
                
                // V1.4.9-FIX: Added support for optimized JSON string traces in reference loader
                if (data && typeof data === 'string') {
                    try { rawSamples = JSON.parse(data); } catch(e) {}
                } else if (data.samples && typeof data.samples === 'string') {
                    try { rawSamples = JSON.parse(data.samples); } catch(e) {}
                }
                else if (data.samples && Array.isArray(data.samples)) {
                    rawSamples = data.samples;
                } else if (Array.isArray(data)) {
                    rawSamples = data;
                } else if (typeof data === 'object' && data !== null) {
                    if (data.samples && Array.isArray(data.samples)) {
                        rawSamples = data.samples;
                    } else {
                        rawSamples = Object.values(data);
                    }
                }

                if (rawSamples.length > 0) {
                    found = true;
                    const formatted = rawSamples.map((s: any) => {
                        const speed = s.s ?? s.speed ?? (s.Speed ? s.Speed * 3.6 : 0);
                        const throttle = s.t ?? s.throttle ?? s.Throttle ?? 0;
                        const brake = s.b ?? s.brake ?? s.Brake ?? 0;
                        const steering = s.st ?? s.steering ?? s.Steering ?? 0;
                        const gear = s.g ?? s.gear ?? s.Gear ?? 0;
                        const dist = (s.p ?? s.progress ?? s.distPct ?? 0) * 100;

                        return {
                            ...s,
                            dist,
                            s: speed,
                            t: throttle,
                            b: brake,
                            g: gear,
                            st: steering,
                            p: s.p ?? s.progress ?? s.distPct ?? 0
                        };
                    });
                    
                    // V1.4.9-FIX: Explicitly sort reference by distance
                    formatted.sort((a: any, b: any) => a.dist - b.dist);
                    setReferenceTrace(formatted);
                }
            }
        });
        unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [referenceLapNum, selectedSessionId, activeTeam]);

  // --- 5. VISUALIZATION LOGIC ---

  const chartData = useMemo(() => {
    if (traceData.length === 0 && referenceTrace.length === 0) return [];
    
    // V1.4.9-ULTRA-SYNC: Optimized 500-point grid (0.2% steps) for smoother scrubbing
    const points = [];
    let lastLiveIdx = 0;
    let lastRefIdx = 0;

    for (let i = 0; i <= 500; i++) {
        const targetDist = (i / 500) * 100; // 0 to 100 scale for charts
        const targetP = (i / 500);          // 0 to 1 scale for map cursor
        
        // Find match in Live Trace
        let liveMatch = null;
        if (traceData.length > 0) {
            while (lastLiveIdx < traceData.length - 1 && Math.abs(traceData[lastLiveIdx + 1].dist - targetDist) < Math.abs(traceData[lastLiveIdx].dist - targetDist)) {
                lastLiveIdx++;
            }
            liveMatch = traceData[lastLiveIdx];
            // V1.4.9-FIX: Increased tolerance to 3.0% for very long tracks (Nurburgring)
            if (Math.abs(liveMatch.dist - targetDist) > 3.0) liveMatch = null; 
        }

        // Find match in Reference Trace
        let refMatch = null;
        if (referenceTrace.length > 0) {
            while (lastRefIdx < referenceTrace.length - 1 && Math.abs((referenceTrace[lastRefIdx + 1].dist || referenceTrace[lastRefIdx + 1].p * 100) - targetDist) < Math.abs((referenceTrace[lastRefIdx].dist || referenceTrace[lastRefIdx].p * 100) - targetDist)) {
                lastRefIdx++;
            }
            refMatch = referenceTrace[lastRefIdx];
            if (Math.abs((refMatch.dist || refMatch.p * 100) - targetDist) > 2.0) refMatch = null;
        }

        if (liveMatch || refMatch) {
            points.push({
                dist: targetDist,
                p: targetP,
                s: liveMatch?.s || 0,
                t: liveMatch?.t || 0,
                b: liveMatch?.b || 0,
                g: liveMatch?.g || 0,
                st: liveMatch?.st || 0,
                refS: refMatch?.s || 0,
                refT: refMatch?.t || 0,
                refB: refMatch?.b || 0,
                refG: refMatch?.g || 0,
                refST: refMatch?.st || 0,
                lat: liveMatch?.lat || refMatch?.lat || 0,
                lon: liveMatch?.lon || refMatch?.lon || 0,
                ts: liveMatch?.ts || 0,
                refTs: refMatch?.ts || 0,
                d: (liveMatch?.s || 0) - (refMatch?.s || 0) // Speed Delta
            });
        }
    }
    return points;
  }, [traceData, referenceTrace, session]);

  // Playback
  useEffect(() => {
    if (!isPlaying || chartData.length === 0) return;
    const interval = setInterval(() => {
        setHoveredIdx(prev => {
            if (prev === null || prev >= chartData.length - 1) return 0;
            return prev + playbackSpeed;
        });
    }, 30);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, chartData]);

  const handleGarage61Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      try {
        const rows = text.split(/\r?\n/).filter(r => r.trim());
        const delimiter = [',', ';', '\t'].find(d => rows[0].includes(d)) || ',';
        const headers = rows[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/["']/g, ''));
        
        const findIdx = (keywords: string[]) => {
            // V1.4.9-ULTRA-HARDENED: Multi-pass matching to prevent 't' matching 'distance'
            // Pass 1: Exact Match
            let idx = headers.findIndex(h => keywords.some(k => h === k));
            if (idx !== -1) return idx;
            
            // Pass 2: Cleaned Match (removing underscores/spaces)
            idx = headers.findIndex(h => {
                const cleanH = h.replace(/[_ \t\-\(\)]/g, '');
                return keywords.some(k => cleanH === k);
            });
            if (idx !== -1) return idx;

            // Pass 3: Contains (restricted to keywords > 2 chars to avoid 't', 'g', 'st' collisions)
            return headers.findIndex(h => keywords.some(k => k.length > 2 && h.includes(k)));
        };
        
        // Expanded header discovery with priority aliases
        const idxP = findIdx(['distancepercent', 'progress', 'distpct', 'distance', 'dist', 'pos', 'lapdist']);
        const idxS = findIdx(['speed', 'velocity', 'vm/s', 'vkm/h', 'vel', 'spd', 'gpsspeed', 'groundspeed']);
        const idxT = findIdx(['throttle', 'throttlepct', 'throttlepos', 'accel', 'gas', 'pedal', 'acc', 'thr']);
        const idxB = findIdx(['brake', 'brakepct', 'brakepos', 'brk', 'press', 'brakepressure']);
        const idxLat = findIdx(['latitude', 'lat']);
        const idxLon = findIdx(['longitude', 'lon']);
        const idxSteer = findIdx(['steering', 'steeringwheelangle', 'steer', 'stwheel', 'str', 'wheel']);
        const idxG = findIdx(['gear', 'ngear', 'currentgear', 'g']);
        const idxT_ = findIdx(['time', 'ts', 'seconds']);

        let rawSamples = rows.slice(1).map(r => {
            const cols = r.split(delimiter);
            let throttle = parseFloat(cols[idxT]) || 0;
            let brake = parseFloat(cols[idxB]) || 0;
            
            // Smart Scaling: If max values are <= 1.1, assume 0-1 range and convert to 0-100
            // We check a sample to see if it needs scaling
            return {
                p: parseFloat(cols[idxP]) || 0,
                s: parseFloat(cols[idxS]) || 0,
                t: throttle,
                b: brake,
                st: parseFloat(cols[idxSteer]) || 0,
                g: parseInt(cols[idxG]) || 0,
                lat: parseFloat(cols[idxLat]) || 0,
                lon: parseFloat(cols[idxLon]) || 0,
                ts: parseFloat(cols[idxT_]) || 0
            };
        });

        // Apply scaling pass if needed
        const maxT = Math.max(...rawSamples.map(s => s.t));
        const maxB = Math.max(...rawSamples.map(s => s.b));
        if (maxT <= 1.1) rawSamples = rawSamples.map(s => ({ ...s, t: s.t * 100 }));
        if (maxB <= 1.1) rawSamples = rawSamples.map(s => ({ ...s, b: s.b * 100 }));

        // Smart Scaling: Standardize to 0-1 range for 'p' and 0-100 for 'dist'

        // Smart Scaling: Standardize to 0-1 range for 'p' and 0-100 for 'dist'
        const maxDist = Math.max(...rawSamples.map(s => s.p));
        if (maxDist > 1.1) {
            // Data is in meters or 0-100 range
            rawSamples = rawSamples.map(s => {
                const p = s.p / maxDist;
                return { ...s, p, dist: p * 100 };
            });
        } else {
            // Data is in decimal (0-1) range (Garage 61 default)
            rawSamples = rawSamples.map(s => ({ ...s, dist: s.p * 100 }));
        }

        // Smart Speed Conversion: Detect m/s and convert to km/h if needed
        const maxS = Math.max(...rawSamples.map(s => s.s));
        if (maxS < 120) { // If max speed is low, it's almost certainly m/s (120 m/s = 432 km/h)
            rawSamples = rawSamples.map(s => ({ ...s, s: s.s * 3.6 }));
        }

        // Smart Steering Conversion: Detect radians and convert to degrees
        const maxSt = Math.max(...rawSamples.map(s => Math.abs(s.st)));
        if (maxSt > 0 && maxSt < 10) { // If max steering is very small, it's in radians
            rawSamples = rawSamples.map(s => ({ ...s, st: s.st * (180 / Math.PI) }));
        }
        
        // Explicit Sort by Progress
        rawSamples.sort((a, b) => a.p - b.p);

        // High-Fidelity Downsampling (Max 2000 points for browser performance)
        let finalSamples = rawSamples;
        if (rawSamples.length > 2000) {
            const step = Math.max(1, Math.floor(rawSamples.length / 2000));
            finalSamples = rawSamples.filter((_, idx) => idx % step === 0);
        }
        
        setReferenceTrace(finalSamples);
        setZoomDomain(null); 
        const fileName = file.name.toLowerCase();
        let trackName = 'Ref';
        let carName = 'Ref';
        let driverName = file.name;
        
        if (fileName.includes(' - ')) {
            const parts = file.name.split(' - ');
            driverName = parts[1] || driverName;
            carName = parts[2] || 'Ref';
            trackName = parts[3] || 'Ref';
        } else {
            // Backup parsing for non-standard Garage 61 filenames
            const commonTracks = ['spa', 'monza', 'nurb', 'silverstone', 'suzuka', 'daytona', 'sebring', 'le mans', 'zandvoort', 'watkins', 'oulton', 'brands', 'donington', 'snetterton', 'road atlanta', 'laguna', 'interlagos', 'imola'];
            const match = commonTracks.find(t => fileName.includes(t));
            if (match) trackName = match;
        }

        setReferenceMetadata({ name: driverName, car: carName, track: trackName, laptime: 'Ref' });
      } catch (err) { console.error(err); }
    };
    reader.readAsText(file);
  };

  const lastSyncTime = React.useRef(0);
  const handleMouseMove = React.useCallback((state: any) => {
    const now = Date.now();
    if (now - lastSyncTime.current < 16) return; // 60Hz (16ms) for maximum reactivity

    if (state && state.activeLabel !== undefined) {
        const label = parseFloat(state.activeLabel as string);
        const idx = chartData.findIndex(p => p.dist >= label);
        if (idx !== -1) {
            setHoveredIdx(idx);
            lastSyncTime.current = now;
        }
    } else if (state && state.activeTooltipIndex !== undefined) {
        setHoveredIdx(state.activeTooltipIndex);
        lastSyncTime.current = now;
    } else {
        setHoveredIdx(null);
    }
  }, [chartData]);

  const handleWheelNative = React.useCallback((e: WheelEvent) => {
    if (hoveredIdx === null) return;
    
    // V1.4.9-FIX: Block page scroll only when active on a graph
    e.preventDefault();
    e.stopPropagation();

    const data = chartData[hoveredIdx];
    if (!data) return;

    const mouseDist = data.dist;
    const currentDomain = zoomDomain || [0, 100];
    const range = currentDomain[1] - currentDomain[0];
    
    // Zoom factor: 10% per notch for a snappier, more responsive feel
    const zoomFactor = e.deltaY > 0 ? 1.10 : 0.90;
    const newRange = Math.max(0.5, Math.min(100, range * zoomFactor));
    
    const distRatio = (mouseDist - currentDomain[0]) / range;
    let newStart = mouseDist - (newRange * distRatio);
    let newEnd = newStart + newRange;

    if (newStart < 0) {
        newStart = 0;
        newEnd = newRange;
    }
    if (newEnd > 100) {
        newEnd = 100;
        newStart = 100 - newRange;
    }

    setZoomDomain([newStart, newEnd]);
  }, [hoveredIdx, chartData, zoomDomain]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chartContainerRef.current;
    if (el) {
        // Must use native listener with passive: false to allow preventDefault()
        el.addEventListener('wheel', handleWheelNative, { passive: false });
        return () => el.removeEventListener('wheel', handleWheelNative);
    }
  }, [handleWheelNative]);

  const SyncTooltip = React.memo(({ idx, type }: { idx: number, type: string }) => {
    const data = chartData[idx];
    if (!data) return null;
    
    const getMetricConfig = () => {
        switch(type) {
            case 'speed': return { label: 'VELOCITY', val: data.s, ref: data.refS, unit: 'km/h', color: 'text-blue-400' };
            case 'throttle': return { label: 'THROTTLE', val: data.t, ref: data.refT, unit: '%', color: 'text-status-success' };
            case 'brake': return { label: 'BRAKE', val: data.b, ref: data.refB, unit: '%', color: 'text-status-error' };
            case 'steering': return { label: 'STEERING', val: data.st, ref: data.refST, unit: '°', color: 'text-purple-400' };
            case 'gear': return { label: 'GEAR', val: data.g, ref: data.refG, unit: '', color: 'text-yellow-400' };
            case 'delta': return { label: 'DELTA', val: data.d, ref: null, unit: 's', color: 'text-purple-400' };
            default: return { label: 'DATA', val: 0, ref: null, unit: '', color: 'text-white' };
        }
    };
    const config = getMetricConfig();
    const formatVal = (v: number) => {
        if (type === 'steering') {
            const num = Math.round(v);
            if (num === 0) return <>0<span className="text-[7px] ml-1">°</span></>;
            return <>{Math.abs(num)}<span className="text-[7px] ml-1">° {num > 0 ? 'L' : 'R'}</span></>;
        }
        return <>{Math.round(v)}<span className="text-[7px] ml-1">{config.unit}</span></>;
    };

    return (
      <div className="bg-black/95 backdrop-blur-2xl border border-white/20 p-2 rounded shadow-2xl min-w-[110px] pointer-events-none">
        <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1">
            <span className="text-[7px] font-black text-gray-500 uppercase">Dist</span>
            <span className="text-[9px] font-black text-white">{data.dist.toFixed(1)}%</span>
        </div>
        <div className="space-y-0.5">
            <div className="flex justify-between items-center gap-2">
                <span className={`text-[8px] font-bold ${config.color}`}>{config.label}</span>
                <span className="text-[9px] font-black text-white">{formatVal(config.val)}</span>
            </div>
            {config.ref !== null && referenceTrace.length > 0 && (
                <div className="flex justify-between items-center pt-0.5 border-t border-white/5">
                    <span className="text-[8px] font-bold text-[#ffb000]">REF</span>
                    <span className="text-[9px] font-black text-white">{formatVal(config.ref)}</span>
                </div>
            )}
        </div>
      </div>
    );
  });

  const hoveredData = hoveredIdx !== null ? chartData[hoveredIdx] : null;

  const lastSeekTime = React.useRef(0);

  useEffect(() => {
    if (hoveredData && (lapStartTime > 0 || hoveredData.ts > 0)) {
       // V1.4.9-ULTRA-SYNC: Precise time-based video seeking
       let targetTime = 0;
       if (hoveredData.ts > 0 && lapStartTime > 0) {
           targetTime = hoveredData.ts - lapStartTime;
       } else {
           // Fallback to progress scaling if timestamps are missing (older recordings)
           targetTime = hoveredData.p * (localBestLapTime || bestLapTime || 0);
       }
       
       const now = Date.now();
       if (now - lastSeekTime.current < 100) return;

       if (videoRef.current && Math.abs(videoRef.current.currentTime - targetTime) > 0.1) {
           videoRef.current.currentTime = targetTime;
           lastSeekTime.current = now;
       }
       
       if (maximizedVideoRef.current && Math.abs(maximizedVideoRef.current.currentTime - targetTime) > 0.1) {
           maximizedVideoRef.current.currentTime = targetTime;
           lastSeekTime.current = now;
       }
    }
  }, [hoveredData, bestLapTime]);

  // V1.4.9.7-PROJECTION: Centralized projection for map rendering and click-sync
  const mapProjection = useMemo(() => {
    if (!activeBounds || trackPath.length === 0) return null;
    
    const avgLat = (activeBounds.minLat + activeBounds.maxLat) / 2;
    const lonScale = Math.cos(avgLat * (Math.PI / 180));
    
    const allPoints = trackPath.map(p => ({
        x: (p.lon - activeBounds.minLon) * lonScale,
        y: (activeBounds.maxLat - p.lat),
        p: p.p,
        lon: p.lon,
        lat: p.lat
    }));

    let focusPoints = allPoints;
    if (zoomDomain) {
        const [zStart, zEnd] = zoomDomain;
        focusPoints = allPoints.filter(p => p.p >= zStart && p.p <= zEnd);
        if (focusPoints.length < 2) focusPoints = allPoints;
    }

    const minX = Math.min(...focusPoints.map(p => p.x));
    const maxX = Math.max(...focusPoints.map(p => p.x));
    const minY = Math.min(...focusPoints.map(p => p.y));
    const maxY = Math.max(...focusPoints.map(p => p.y));
    
    const rawRangeX = maxX - minX;
    const rawRangeY = maxY - minY;
    const maxRange = Math.max(rawRangeX, rawRangeY) * 1.2 || 0.0001;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const getNx = (x: number) => 0.5 + (x - centerX) / maxRange;
    const getNy = (y: number) => 0.5 + (y - centerY) / maxRange;

    return { allPoints, focusPoints, getNx, getNy, lonScale };
  }, [trackPath, activeBounds, zoomDomain]);

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!mapProjection) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    // Find nearest point in allPoints
    let minDist = Infinity;
    let nearestIdx = 0;

    mapProjection.allPoints.forEach((pt, idx) => {
        const nx = mapProjection.getNx(pt.x);
        const ny = mapProjection.getNy(pt.y);
        const d = Math.sqrt(Math.pow(nx - clickX, 2) + Math.pow(ny - clickY, 2));
        if (d < minDist) {
            minDist = d;
            nearestIdx = idx;
        }
    });

    if (minDist < 0.1) { // Only sync if reasonably close to the track
        const nearestPt = mapProjection.allPoints[nearestIdx];
        const pPct = nearestPt.p; // Already 0-100 scale from useMemo
        
        // Map the percentage progress back to the chartData index (which is fixed 0-500)
        const chartIdx = Math.round((pPct / 100) * (chartData.length - 1));
        if (chartData[chartIdx]) {
            setHoveredIdx(chartIdx);
        }

        // V1.4.9.8-FOCUS: Auto-zoom into the clicked section
        const windowSize = 10; // 10% zoom window
        let start = pPct - (windowSize / 2);
        let end = pPct + (windowSize / 2);

        // Clamp to 0-100
        if (start < 0) {
            start = 0;
            end = windowSize;
        }
        if (end > 100) {
            end = 100;
            start = 100 - windowSize;
        }
        
        setZoomDomain([start, end]);
    }
  };

  const TelemetryCharts = useMemo(() => {
    if (chartData.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-reveal relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
                <Activity size={64} className="text-gray-800 mb-6" />
                <h3 className="text-xl font-black italic tracking-widest uppercase text-white/50 mb-4">No Telemetry Recorded</h3>
                <p className="max-w-md text-xs text-gray-500 font-bold uppercase tracking-widest leading-loose">
                    {session?.is_live === false 
                        ? "This lap was recorded in Simulation Mode. High-fidelity telemetry traces are only captured during live iRacing sessions."
                        : "No telemetry samples were found for this lap. Please ensure your bridge is connected and iRacing is active during your laps."}
                </p>
                <div className="mt-8 px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Reference Source: {referenceLapNum ? `Lap ${referenceLapNum}` : 'Local Upload'}
                </div>
            </div>
        );
    }

    const commonZoomEvents = {
      onMouseDown: (e: any) => e?.activeLabel !== undefined && setRefAreaLeft(parseFloat(e.activeLabel as string)),
      onMouseMove: (e: any) => { 
        handleMouseMove(e); 
        if (refAreaLeft !== null && e?.activeLabel !== undefined) {
          setRefAreaRight(parseFloat(e.activeLabel as string)); 
        }
      },
      onMouseUp: handleZoom,
      onMouseLeave: () => setHoveredIdx(null)
    };

    const renderReferenceArea = () => {
      if (refAreaLeft !== null && refAreaRight !== null) {
        return <ReferenceArea x1={refAreaLeft} x2={refAreaRight} fill="rgba(255,255,255,0.1)" />;
      }
      return null;
    };

    return (
        <div ref={chartContainerRef} className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar pb-20">
            <div className="h-64 bg-panel/40 border border-white/5 rounded-2xl p-4 relative">
              <div className="absolute top-2 left-4 text-[9px] font-black uppercase text-white/20 tracking-widest z-20">Velocity</div>
              <div className="absolute top-2 right-4 flex items-center gap-3 z-20">
                {zoomDomain && <button onClick={resetZoom} className="px-3 py-1 bg-accent/20 border border-accent/30 rounded-full text-[9px] font-black uppercase text-accent">Reset Zoom</button>}
                <div className="flex bg-black/40 rounded-full p-1 border border-white/5">
                    <button onClick={() => setIsPlaying(!isPlaying)} className={`p-1.5 rounded-full ${isPlaying ? 'bg-status-success text-black' : 'text-gray-400'}`}><Timer size={12} /></button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} syncId="telemetry" syncMethod="value" {...commonZoomEvents}>
                  <XAxis dataKey="dist" hide type="number" domain={zoomDomain || ['auto', 'auto']} allowDataOverflow />
                  <YAxis domain={[0, 'auto']} hide />
                  <Area type="linear" dataKey="s" stroke="#3b82f6" fillOpacity={0.1} fill="#3b82f6" connectNulls isAnimationActive={false} />
                  {referenceTrace.length > 0 && <Line type="linear" dataKey="refS" stroke="#ffb000" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />}
                  {renderReferenceArea()}
                  {hoveredIdx !== null && <ReferenceLine x={chartData[hoveredIdx]?.dist} stroke="#fff" strokeWidth={1} strokeDasharray="3 3" isFront />}
                </AreaChart>
                {hoveredIdx !== null && (
                    <div 
                        className="absolute top-12 bottom-4 pointer-events-none z-50"
                        style={{ 
                            left: `${(((chartData[hoveredIdx]?.dist || 0) - (zoomDomain?.[0] || 0)) / ((zoomDomain?.[1] || 100) - (zoomDomain?.[0] || 0))) * 100}%`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        <SyncTooltip idx={hoveredIdx} type="speed" />
                    </div>
                )}
              </ResponsiveContainer>
            </div>
            <div className="h-48 bg-panel/40 border border-white/5 rounded-2xl p-4 relative">
              <div className="absolute top-2 left-4 text-[9px] font-black uppercase text-white/20 tracking-widest z-20">Throttle</div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} syncId="telemetry" syncMethod="value" {...commonZoomEvents}>
                  <XAxis dataKey="dist" hide type="number" domain={zoomDomain || ['auto', 'auto']} allowDataOverflow />
                  <YAxis domain={[0, 100]} hide />
                  <Area type="linear" dataKey="t" stroke="#10b981" fillOpacity={0.1} fill="#10b981" connectNulls isAnimationActive={false} />
                  {referenceTrace.length > 0 && <Line type="linear" dataKey="refT" stroke="#ffb000" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
                  {renderReferenceArea()}
                  {hoveredIdx !== null && <ReferenceLine x={chartData[hoveredIdx]?.dist} stroke="#fff" strokeWidth={1} strokeDasharray="3 3" isFront />}
                </AreaChart>
                {hoveredIdx !== null && (
                    <div 
                        className="absolute top-12 bottom-4 pointer-events-none z-50"
                        style={{ 
                            left: `${(((chartData[hoveredIdx]?.dist || 0) - (zoomDomain?.[0] || 0)) / ((zoomDomain?.[1] || 100) - (zoomDomain?.[0] || 0))) * 100}%`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        <SyncTooltip idx={hoveredIdx} type="throttle" />
                    </div>
                )}
              </ResponsiveContainer>
            </div>
            <div className="h-48 bg-panel/40 border border-white/5 rounded-2xl p-4 relative">
              <div className="absolute top-2 left-4 text-[9px] font-black uppercase text-white/20 tracking-widest z-20">Brake</div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} syncId="telemetry" syncMethod="value" {...commonZoomEvents}>
                  <XAxis dataKey="dist" hide type="number" domain={zoomDomain || ['auto', 'auto']} allowDataOverflow />
                  <YAxis domain={[0, 100]} hide />
                  <Area type="linear" dataKey="b" stroke="#ef4444" fillOpacity={0.1} fill="#ef4444" connectNulls isAnimationActive={false} />
                  {referenceTrace.length > 0 && <Line type="linear" dataKey="refB" stroke="#ffb000" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />}
                  {renderReferenceArea()}
                  {hoveredIdx !== null && <ReferenceLine x={chartData[hoveredIdx]?.dist} stroke="#fff" strokeWidth={1} strokeDasharray="3 3" isFront />}
                </AreaChart>
                {hoveredIdx !== null && (
                    <div 
                        className="absolute top-12 bottom-4 pointer-events-none z-50"
                        style={{ 
                            left: `${(((chartData[hoveredIdx]?.dist || 0) - (zoomDomain?.[0] || 0)) / ((zoomDomain?.[1] || 100) - (zoomDomain?.[0] || 0))) * 100}%`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        <SyncTooltip idx={hoveredIdx} type="brake" />
                    </div>
                )}
              </ResponsiveContainer>
            </div>

            <div className="h-32 bg-panel/40 border border-white/5 rounded-2xl p-4 relative">
              <div className="absolute top-2 left-4 text-[9px] font-black uppercase text-white/20 tracking-widest z-20">Gear</div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} syncId="telemetry" syncMethod="value" {...commonZoomEvents}>
                  <XAxis dataKey="dist" hide type="number" domain={zoomDomain || ['auto', 'auto']} allowDataOverflow />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Area type="stepAfter" dataKey="g" stroke="#eab308" fillOpacity={0.1} fill="#eab308" connectNulls isAnimationActive={false} />
                  {referenceTrace.length > 0 && <Line type="stepAfter" dataKey="refG" stroke="#ffb000" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />}
                  {renderReferenceArea()}
                  {hoveredIdx !== null && <ReferenceLine x={chartData[hoveredIdx]?.dist} stroke="#fff" strokeWidth={1} strokeDasharray="3 3" isFront />}
                </AreaChart>
                {hoveredIdx !== null && (
                    <div 
                        className="absolute top-12 bottom-4 pointer-events-none z-50"
                        style={{ 
                            left: `${((chartData[hoveredIdx].dist - (zoomDomain?.[0] || 0)) / ((zoomDomain?.[1] || 100) - (zoomDomain?.[0] || 0))) * 100}%`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        <SyncTooltip idx={hoveredIdx} type="gear" />
                    </div>
                )}
              </ResponsiveContainer>
            </div>

            <div className="h-64 bg-panel/40 border border-white/5 rounded-2xl p-4 relative">
              <div className="absolute top-2 left-4 text-[9px] font-black uppercase text-white/20 tracking-widest z-20">Steering Angle</div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} syncId="telemetry" syncMethod="value" {...commonZoomEvents}>
                  <XAxis dataKey="dist" hide type="number" domain={zoomDomain || ['auto', 'auto']} allowDataOverflow />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Area type="linear" dataKey="st" stroke="#a855f7" fillOpacity={0.1} fill="#a855f7" connectNulls isAnimationActive={false} />
                  {referenceTrace.length > 0 && <Line type="linear" dataKey="refST" stroke="#ffb000" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />}
                  {renderReferenceArea()}
                  {hoveredIdx !== null && <ReferenceLine x={chartData[hoveredIdx]?.dist} stroke="#fff" strokeWidth={1} strokeDasharray="3 3" isFront />}
                </AreaChart>
                {hoveredIdx !== null && (
                    <div 
                        className="absolute top-12 bottom-4 pointer-events-none z-50"
                        style={{ 
                            left: `${((chartData[hoveredIdx].dist - (zoomDomain?.[0] || 0)) / ((zoomDomain?.[1] || 100) - (zoomDomain?.[0] || 0))) * 100}%`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        <SyncTooltip idx={hoveredIdx} type="steering" />
                    </div>
                )}
              </ResponsiveContainer>
            </div>
        </div>
    );
  }, [chartData, zoomDomain, referenceTrace, isPlaying, playbackSpeed, refAreaLeft, refAreaRight, handleZoom, handleMouseMove, hoveredIdx]);

  const correctedTrackId = useMemo(() => {
    // V1.4.9.8-ULTRA-SYNC: Archive-First Priority Identification
    const archiveTrackName = selectedSession?.trackName || "";
    const liveTrackName = session?.trackName || "";
    const refName = referenceMetadata?.track || "";
    
    const checkSignature = (bounds: any) => {
        if (!bounds) return null;
        const { minLat, maxLat, minLon, maxLon } = bounds;
        if (minLat > 50.3 && maxLat < 50.4 && minLon > 6.9 && maxLon < 7.1) return 264; // Nurb
        if (minLat > 50.4 && maxLat < 50.5 && minLon > 5.8 && maxLon < 6.1) return 1;   // Spa
        if (minLat > 45.6 && maxLat < 45.7 && minLon > 9.2 && maxLon < 9.3) return 137; // Monza
        if (minLat > 47.8 && maxLat < 47.95 && minLon > 0.2 && maxLon < 0.25) return 160; // Le Mans
        if (minLat > 42.3 && maxLat < 42.4 && minLon < -76.9 && maxLon > -77.1) return 147; // Watkins
        if (minLat > 53.17 && maxLat < 53.20 && minLon > -2.63 && maxLon < -2.60) return 162; // Oulton
        if (minLat > 51.35 && maxLat < 51.37 && minLon > 0.25 && maxLon < 0.27) return 159; // Brands
        if (minLat > 52.82 && maxLat < 52.84 && minLon > -1.39 && maxLon < -1.36) return 164; // Donington
        if (minLat > 34.14 && maxLat < 34.16 && minLon > -83.83 && maxLon < -83.80) return 157; // Road Atlanta
        return null;
    };

    const checkName = (name: string) => {
        if (!name) return null;
        const n = name.toLowerCase().replace(/[\-_]/g, ' ');
        if (n.includes('nurb') || n.includes('nord') || n.includes('nords')) return 264;
        if (n.includes('spa')) return 1;
        if (n.includes('monza')) return 137;
        if (n.includes('zandvoort') || n.includes('circuit park') || n.includes('circuit zandvoort')) return 485;
        if (n.includes('sebring')) return 156;
        if (n.includes('silverstone')) return 15;
        if (n.includes('suzuka')) return 23;
        if (n.includes('interlagos')) return 146;
        if (n.includes('imola')) return 163;
        if (n.includes('daytona')) return 145;
        if (n.includes('watkins')) return 147;
        if (n.includes('bathurst') || n.includes('panorama')) return 161;
        if (n.includes('le mans') || n.includes('sarthe')) return 160;
        if (n.includes('zolder')) return 138;
        if (n.includes('road america')) return 142;
        if (n.includes('red bull') || n.includes('spielberg')) return 165;
        if (n.includes('laguna') || n.includes('seca')) return 139;
        if (n.includes('oulton')) return 162;
        if (n.includes('brands')) return 159;
        if (n.includes('donington')) return 164;
        if (n.includes('snetterton')) return 166;
        if (n.includes('road atlanta')) return 157;
        if (n.includes('skidpad')) return 0;
        return null;
    };

    // --- MANUAL OVERRIDE (MAX PRIORITY) ---
    if (manualTrackId !== null) return manualTrackId;

    // --- ARCHIVE MODE (If session selected or searched) ---
    if (selectedSessionId) {
        if (selectedSession?.trackId && selectedSession.trackId > 0) return selectedSession.trackId;
        const archiveNameMatch = checkName(selectedSession?.trackName);
        if (archiveNameMatch) return archiveNameMatch;
        return null; // DO NOT fall back to live if an archive is selected
    }

    // --- REFERENCE MODE (If CSV uploaded) ---
    const refMatch = checkName(referenceMetadata?.track);
    if (refMatch) return refMatch;
    const refSig = checkSignature(refBounds);
    if (refSig) return refSig;

    // --- SEARCH MODE ---
    const searchMatch = checkName(searchTerm);
    if (searchMatch) return searchMatch;

    // --- LIVE FALLBACK (Only if NO archive is selected) ---
    if (session?.trackId && session.trackId > 0) return session.trackId;
    const liveSig = checkSignature(liveBounds);
    if (liveSig) return liveSig;
    const liveNameMatch = checkName(liveTrackName);
    if (liveNameMatch) return liveNameMatch;

    return null;
  }, [session, selectedSession, selectedSessionId, referenceMetadata, liveBounds, refBounds, searchTerm, manualTrackId]);

  const mapDrivers = useMemo(() => (!hoveredData ? {} : { 'cursor': { progress: hoveredData.p, isPlayer: true, className: 'Telemetry', carNum: '' } }), [hoveredData]);
  
  const handleClearAll = async () => {
    if (!db || !activeTeam) return;
    if (window.confirm("CRITICAL: This will permanently delete ALL session history and telemetry for this team. Are you absolutely sure?")) {
        try {
            // 1. Wipe Cloud Data
            await remove(ref(db, `teams/${activeTeam}/history`));
            await remove(ref(db, `telemetry`)); 
            
            // 2. Wipe Local UI State Immediately
            setSessions([]);
            setLaps([]);
            setTraceData([]);
            setReferenceTrace([]);
            setReferenceMetadata(null);
            setReferencePath([]);
            setSelectedSessionId(null);
            setSelectedLapNum(null);
            setHoveredIdx(null);
            setZoomDomain(null);
            
            console.log("Database and Local UI wiped successfully.");
        } catch (e) {
            console.error("Failed to clear database", e);
        }
    }
  };

  return (
    <div className="flex h-full bg-background/50 overflow-hidden">
      <div className="w-72 border-r border-white/5 flex flex-col bg-panel/30 backdrop-blur-xl">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase font-black tracking-[0.3em] text-gray-500">Historical Archive</h2>
            <button onClick={handleClearAll} className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all cursor-pointer group" title="Nuke All Data">
                <Trash2 size={12} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
          <div className="relative mb-4">
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sessions..." 
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-xs font-bold outline-none focus:border-accent/40 transition-all placeholder:text-gray-700"
            />
          </div>
          <select value={selectedSessionId || ''} onChange={(e) => setSelectedSessionId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-xs font-bold appearance-none outline-none">
            <option value="" className="bg-[#1a1a1a]">Select Session...</option>
            {sessions
              .filter(s => !searchTerm || (s.trackName || '').toLowerCase().includes(searchTerm.toLowerCase()))
              .map(s => <option key={s.id} value={s.id} className="bg-[#1a1a1a]">{s.trackName || 'Session'}</option>)
            }
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {laps.map((lap) => (
            <div key={lap.lap} onClick={() => setSelectedLapNum(lap.lap)} className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedLapNum === lap.lap ? 'bg-accent/15 border-accent/40' : 'bg-white/2 border-white/5'}`}>
              <div className="flex justify-between text-[10px] font-black uppercase text-gray-500"><span>Lap {lap.lap}</span><span>{lap.valid ? 'Verified' : 'Invalid'}</span></div>
              <div className="flex justify-between items-end mt-2">
                <div className="text-2xl font-black italic text-white">{new Date(lap.time * 1000).toISOString().substr(14, 9)}</div>
                <button onClick={(e) => { e.stopPropagation(); setReferenceLapNum(referenceLapNum === lap.lap ? null : lap.lap); }} className={`px-3 py-1 rounded text-[8px] font-black uppercase ${referenceLapNum === lap.lap ? 'bg-purple-500 text-white' : 'bg-white/5'}`}>{referenceLapNum === lap.lap ? 'Comparing' : 'Compare'}</button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/5 bg-black/20">
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleGarage61Upload} />
            <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-accent/10 border border-accent/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-accent flex items-center justify-center gap-2"><UploadCloud size={14} /> Upload Ref</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-black/20 relative">
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-panel/20">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest text-white">Telemetry Analysis</h1>
              <div className="flex items-center gap-2">
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">High-Fidelity V1.4.9.9-ULTRA-SYNC</p>
                  <div className="h-1 w-1 rounded-full bg-white/20" />
                  <p className="text-[8px] text-white/40 font-black uppercase tracking-tighter">
                      ID: {correctedTrackId || 'NULL'} // {((selectedSession?.trackName || referenceMetadata?.track || session?.trackName || "UNKNOWN")).toUpperCase()}
                  </p>
              </div>
            </div>
            
            {/* Manual Track Selector */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 ml-auto">
                <MapIcon size={12} className="text-accent" />
                <select 
                    value={manualTrackId || ''} 
                    onChange={(e) => setManualTrackId(e.target.value ? parseInt(e.target.value) : null)}
                    className="bg-transparent text-[10px] font-black uppercase tracking-widest text-white/60 outline-none cursor-pointer hover:text-white transition-colors"
                >
                    <option value="">Auto-Detect</option>
                    {TRACK_MAPS.map(t => (
                        <option key={t.id} value={t.id} className="bg-[#1a1a1a]">{t.name}</option>
                    ))}
                </select>
                {manualTrackId && (
                    <button 
                        onClick={() => setManualTrackId(null)}
                        className="p-1 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white"
                        title="Reset to Auto"
                    >
                        <Trash2 size={10} />
                    </button>
                )}
            </div>
          </div>
        </div>
        {(selectedLapNum === null && referenceTrace.length === 0) ? <div className="flex-1 flex items-center justify-center text-white/20 uppercase font-black tracking-widest">Select Lap</div> : TelemetryCharts}
      </div>

      <div className="w-80 border-l border-white/5 flex flex-col bg-panel/30 backdrop-blur-xl p-6 space-y-6 overflow-y-auto custom-scrollbar">
        {videoUrl ? (
          <div 
            className="rounded-2xl border border-white/5 overflow-hidden bg-black/40 shadow-xl relative group cursor-pointer"
            onClick={() => setIsMaximizedVideo(true)}
          >
            <video 
               src={videoUrl} 
               className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-110"
               ref={videoRef}
               muted
               playsInline
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                <div className="p-3 rounded-full bg-white/10 border border-white/20 text-white transform scale-50 group-hover:scale-100 transition-all duration-300">
                    <Maximize2 size={20} />
                </div>
            </div>
            <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest text-white border border-white/10 shadow-lg pointer-events-none">
               Fastest Lap: {bestLapTime?.toFixed(3)}s
            </div>
            <div className="absolute top-2 right-2 bg-status-success/20 px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest text-status-success border border-status-success/30 animate-pulse pointer-events-none">
               Synced
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-panel/20 p-8 flex flex-col items-center justify-center text-center space-y-4">
            <BarChart3 className="text-white/10" size={48} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Video Unavailable</p>
              <p className="text-[8px] font-bold text-gray-600 mt-1 uppercase">Archived Laps (Pre-V1.3.3) do not have persistent video data.</p>
            </div>
          </div>
        )}
        <div className="h-72 relative rounded-2xl border border-white/5 overflow-hidden bg-black/40">
            {/* V1.5.0-MANUAL-OVERRIDE: Track Selection Header */}
            <div className="absolute top-3 left-4 right-4 flex justify-between items-center z-50">
                <div className="flex items-center gap-2 px-2 py-1 bg-black/60 rounded-lg border border-white/10 backdrop-blur-md">
                    <MapIcon size={12} className="text-accent" />
                    <select 
                        value={correctedTrackId}
                        onChange={(e) => setManualTrackId(parseInt(e.target.value))}
                        className="bg-transparent text-[10px] font-black uppercase text-white outline-none cursor-pointer pr-1"
                    >
                        <option value={0}>Auto-Detect Track</option>
                        {TRACK_MAPS.map(t => (
                            <option key={t.id} value={t.id} className="bg-[#111]">{t.name}</option>
                        ))}
                    </select>
                </div>
                {(!correctedTrackId || correctedTrackId === 0) && (
                    <div className="px-2 py-1 bg-status-warning/20 border border-status-warning/40 rounded text-[8px] font-black uppercase text-status-warning animate-pulse">
                        Using Reconstructed Map
                    </div>
                )}
            </div>

            {/* V1.4.9.6-ULTRA-SYNC: High-Fidelity GPS Map Prioritization */}
            {(correctedTrackId && correctedTrackId > 0 && !refBounds) ? (
                <div className="w-full h-full relative">
                    <TrackCanvas 
                        key={`data-hub-map-${correctedTrackId}-${selectedSessionId || 'live'}`}
                        trackId={correctedTrackId} 
                        drivers={mapDrivers} 
                        hiddenClasses={new Set()} 
                        zoomDomain={zoomDomain} 
                        drivingPath={traceData}
                    />
                </div>
            ) : trackPath.length > 0 ? (
                <div className="w-full h-full p-8 relative">
                    <svg 
                        viewBox={`0 0 1 1`} 
                        className="w-full h-full"
                        preserveAspectRatio="xMidYMid meet"
                        onClick={handleMapClick}
                    >
                        {(() => {
                            if (!mapProjection) return null;
                            const { allPoints, focusPoints, getNx, getNy } = mapProjection;

                            const fullPoly = allPoints.map(p => `${getNx(p.x)},${getNy(p.y)}`).join(' ');
                            const focusPoly = focusPoints.map(p => `${getNx(p.x)},${getNy(p.y)}`).join(' ');

                            let cursor = null;
                            if (hoveredData && activeBounds) {
                                const cx = getNx((hoveredData.lon - activeBounds.minLon) * mapProjection.lonScale);
                                const cy = getNy(activeBounds.maxLat - hoveredData.lat);
                                cursor = (
                                    <g>
                                        <circle cx={cx} cy={cy} r="0.04" fill="rgba(0, 229, 255, 0.2)" className="animate-pulse" />
                                        <circle cx={cx} cy={cy} r="0.015" fill="#00e5ff" stroke="white" strokeWidth="0.005" />
                                    </g>
                                );
                            }

                            return (
                                <>
                                    {/* Global Background Track (Asphalt Surface) */}
                                    <polyline points={fullPoly} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points={fullPoly} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.15" strokeLinecap="round" strokeLinejoin="round" />
                                    
                                    {/* Precise Driving Line */}
                                    <polyline points={focusPoly} fill="none" stroke="rgba(255,45,85,0.2)" strokeWidth="0.06" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points={focusPoly} fill="none" stroke="#ff2d55" strokeWidth="0.02" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points={focusPoly} fill="none" stroke="#ffffff" strokeWidth="0.005" strokeLinecap="round" strokeLinejoin="round" />
                                    
                                    {cursor}
                                </>
                            );
                        })()}
                    </svg>
                </div>
            ) : correctedTrackId === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-accent/5 backdrop-blur-sm">
                    <div className="w-32 h-32 rounded-full border-4 border-dashed border-accent/20 flex items-center justify-center animate-[spin_20s_linear_infinite]">
                        <div className="w-24 h-24 rounded-full border-2 border-accent/40 flex items-center justify-center">
                            <Compass className="text-accent/60" size={32} />
                        </div>
                    </div>
                    <p className="mt-4 text-[10px] font-black uppercase text-accent tracking-[0.3em] opacity-80">Skidpad / Testing Area</p>
                    <p className="text-[8px] font-bold text-gray-500 mt-1 uppercase tracking-widest">No Fixed Track Geometry</p>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <MapIcon className="text-white/10 mb-2" size={24} />
                    <p className="text-[9px] font-black uppercase text-white/20 tracking-widest">No Map Reference</p>
                </div>
            )}
        </div>
        
        {/* V1.4.9.9-CLEAN: Track Map Info Footer (Moved from overlay to prevent blocking map) */}
        <div className="px-2 pt-1 border-l-2 border-accent/40 ml-1">
            <h3 className="text-[11px] font-black uppercase text-white tracking-widest leading-tight">
                {referenceMetadata?.track || "GPS Signature Reconstruction"}
            </h3>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[7px] font-bold text-gray-500 uppercase tracking-tighter">
                    {zoomDomain ? `Focused Analysis (${Math.round(zoomDomain[1] - zoomDomain[0])}%)` : "Full Circuit Overview"}
                </span>
                {zoomDomain && <div className="h-1 w-1 rounded-full bg-accent animate-pulse" />}
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/2 p-5 rounded-2xl border border-white/5 text-center">
                <span className="text-[9px] font-bold text-gray-500 uppercase">Velocity</span>
                <div className="text-2xl font-black text-blue-400">{Math.round(hoveredData?.s || 0)} <span className="text-[8px] text-gray-600">km/h</span></div>
                {referenceTrace.length > 0 && <div className="text-[10px] font-black text-[#ffb000] mt-1">REF: {Math.round(hoveredData?.refS || 0)} <span className="text-[7px]">km/h</span></div>}
            </div>
            <div className="bg-white/2 p-5 rounded-2xl border border-white/5 text-center">
                <span className="text-[9px] font-bold text-gray-500 uppercase">Gear</span>
                <div className="text-2xl font-black text-accent">{(() => { const raw = hoveredData?.g; return raw === -1 ? 'R' : (raw === 0 || raw === undefined ? 'N' : raw); })()}</div>
                {referenceTrace.length > 0 && <div className="text-[10px] font-black text-[#ffb000] mt-1">REF: {(() => { const raw = hoveredData?.refG; return raw === -1 ? 'R' : (raw === 0 || raw === undefined ? 'N' : raw); })()}</div>}
            </div>
        </div>
        {sectorTimes && (
            <div className="bg-white/2 p-4 rounded-2xl border border-white/5 flex flex-col min-h-0">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4 shrink-0">Sector Analysis</span>
                <div className="space-y-1.5 overflow-y-auto pr-2 custom-scrollbar max-h-[280px]">
                    {sectorTimes.map((t, i) => (
                        <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/[0.02] last:border-0">
                            <span className="text-[8px] font-black text-gray-500 uppercase">Sector {i+1}</span>
                            <span className="text-xs font-black italic text-white tracking-tighter">{formatTime(t)}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
      {isMaximizedVideo && videoUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-20 animate-reveal">
            <div className="relative w-full max-w-6xl aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.8)] bg-black">
                <video 
                    src={videoUrl}
                    className="w-full h-full object-contain"
                    ref={maximizedVideoRef}
                    muted
                    playsInline
                    autoPlay
                    loop
                />
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsMaximizedVideo(false); }}
                    className="absolute top-6 right-6 p-4 bg-black/60 hover:bg-black/80 rounded-2xl text-white transition-all border border-white/10 backdrop-blur-md group"
                >
                    <Plus className="rotate-45 transition-transform group-hover:scale-110" size={24} />
                </button>
                <div className="absolute bottom-8 left-8 bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Driver Onboard // Telemetry-Synced Playback</span>
                    <span className="text-[10px] font-bold text-gray-500 border-l border-white/10 pl-4">LAP TIME: {bestLapTime?.toFixed(3)}s</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default DataHub;
