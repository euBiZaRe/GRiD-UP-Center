import React, { useState, useRef } from 'react';
import { Settings as SettingsIcon, Wrench, Upload, HardDrive, Download, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { db } from '../hooks/useFirebase';

const IRACING_TRACKS = [
    "Algarve International Circuit",
    "Aragon - Grand Prix",
    "Autodromo Internazionale Enzo e Dino Ferrari (Imola)",
    "Autodromo Internazionale del Mugello",
    "Autodromo José Carlos Pace (Interlagos)",
    "Autodromo Nazionale Monza",
    "Barber Motorsports Park",
    "Brands Hatch - Grand Prix",
    "Circuit de Barcelona-Catalunya",
    "Circuit de la Sarthe (Le Mans)",
    "Circuit de Nevers Magny-Cours",
    "Circuit de Spa-Francorchamps",
    "Circuit de Zolder",
    "Circuit des 24 Heures du Mans",
    "Circuit Gilles Villeneuve (Montreal)",
    "Circuit of the Americas",
    "Circuit Park Zandvoort",
    "Circuit Zandvoort",
    "Daytona International Speedway - Road Course",
    "Donington Park Racing Circuit",
    "Fuji Speedway",
    "Hockenheimring Baden-Württemberg",
    "Hungaroring Circuit",
    "Indianapolis Motor Speedway - Road Course",
    "Interlagos - Grand Prix",
    "Knockhill Racing Circuit",
    "Kyalami Grand Prix Circuit",
    "Laguna Seca",
    "Lime Rock Park",
    "Long Beach Street Circuit",
    "Mid-Ohio Sports Car Course",
    "Misano World Circuit Marco Simoncelli",
    "Monza - Grand Prix",
    "Mount Panorama Circuit (Bathurst)",
    "Nürburgring Combined",
    "Nürburgring Grand-Prix-Strecke",
    "Nürburgring Nordschleife",
    "Okayama International Circuit",
    "Oulton Park Circuit",
    "Phillip Island Circuit",
    "Portimão",
    "Red Bull Ring",
    "Road America",
    "Road Atlanta",
    "Rudskogen Motorsenter",
    "Sandown International Motor Raceway",
    "Sebring International Raceway",
    "Silverstone Circuit",
    "Snetterton Circuit",
    "Sonoma Raceway",
    "Summit Point Raceway",
    "Suzuka International Racing Course",
    "Tsukuba Circuit",
    "Twin Ring Motegi",
    "Virginia International Raceway",
    "Watkins Glen International",
    "WeatherTech Raceway at Laguna Seca",
    "Winton Motor Raceway",
    "Zolder"
].sort();

const IRACING_CARS = [
    { id: "ferrari296gt3", name: "Ferrari 296 GT3" },
    { id: "porsche911gt3r2", name: "Porsche 911 GT3 R (992)" },
    { id: "mercedesamggt32020", name: "Mercedes-AMG GT3 2020" },
    { id: "bmwm4gt3", name: "BMW M4 GT3" },
    { id: "lamborghinievogt3", name: "Lamborghini Huracán GT3 EVO" },
    { id: "audi r8 lms gt3", name: "Audi R8 LMS GT3 EVO II" },
    { id: "mclarenmp412cgt3", name: "McLaren MP4-12C GT3" },
    { id: "fordgt_gt3", name: "Ford GT GT3" },
    { id: "dallarap217", name: "Dallara P217 (LMP2)" },
    { id: "cadillacvseriesr", name: "Cadillac V-Series.R (GTP)" },
    { id: "porsche963", name: "Porsche 963 (GTP)" },
    { id: "acuraxar06", name: "Acura ARX-06 (GTP)" },
    { id: "bmwmhybridv8", name: "BMW M Hybrid V8 (GTP)" },
    { id: "mazdamx5", name: "Global Mazda MX-5 Cup" },
    { id: "toyota86", name: "Toyota GR86" },
    { id: "formula4", name: "FIA Formula 4" },
    { id: "formula3", name: "Dallara F3" },
    { id: "formula2", name: "Super Formula SF23" },
    { id: "dallarair01", name: "Dallara iR-01" },
    { id: "formulavee", name: "Formula Vee" },
    { id: "ff1600", name: "Ray FF1600" }
].sort((a,b) => a.name.localeCompare(b.name));

interface SetupCenterProps {
  setups: any[];
  activeTeam: string;
  session: any;
  telemetry: any;
}

const SetupCenter: React.FC<SetupCenterProps> = ({ setups, activeTeam, session, telemetry }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [injectedSetupId, setInjectedSetupId] = useState<string | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTrackValue, setEditTrackValue] = useState('');
  const [manualCarId, setManualCarId] = useState<string | null>(null);
  const [carSearchQuery, setCarSearchQuery] = useState('');
  const [showCarPicker, setShowCarPicker] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived properties from active telemetry session
  const activeCarPath = telemetry?.drivers?.[telemetry?.playerIdx || '']?.carPath 
      || Object.values(telemetry?.drivers || {}).find((d: any) => d.isPlayer)?.carPath 
      || '';
      
  const getPlayerName = () => {
      const p = Object.values(telemetry?.drivers || {}).find((d: any) => d.isPlayer);
      return (p as any)?.name || 'Local Driver';
  };

  const getTargetCarId = () => {
      if (manualCarId) return manualCarId;
      return telemetry?.drivers?.[telemetry?.playerIdx || '']?.carPath 
          || Object.values(telemetry?.drivers || {}).find((d: any) => d.isPlayer)?.carPath 
          || '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Safety check - we only permit .sto iRacing setups
    if (!file.name.toLowerCase().endsWith('.sto')) {
        alert("Only iRacing (.sto) setup files are supported.");
        return;
    }

    setUploadStatus('uploading');

    const reader = new FileReader();
    reader.onload = async (ev) => {
        const base64Data = ev.target?.result as string;
        if (!base64Data) {
            alert("File read failed: Empty payload.");
            setUploadStatus('idle');
            return;
        }
        if (!activeTeam || activeTeam === 'solo') {
            alert("Upload Disabled: You cannot sync setups into the Cloud vault while in Solo mode or completely disconnected from a Team.");
            setUploadStatus('idle');
            return;
        }

        try {
            if (window.electron && window.electron.sendCommand) {
                window.electron.sendCommand({
                    action: 'upload_setup',
                    fileName: file.name,
                    author: getPlayerName(),
                    size: file.size,
                    targetTrack: session?.trackName || 'Generic Track',
                    targetCar: getTargetCarId(),
                    base64: base64Data
                });
                
                setUploadStatus('success');
                setTimeout(() => setUploadStatus('idle'), 3000);
            } else {
                alert("Fatal Error: IPC hardware bridge is offline.");
                setUploadStatus('idle');
            }
            
        } catch (error: any) {
            console.error("Firebase Upload Error:", error);
            alert(`Cloud Upload Failed: ${error.message || 'Check your database permissions or network.'}`);
            setUploadStatus('idle');
        }
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const attemptInjection = (setup: any) => {
      // Hardware injection command utilizing Electron Bridge Native access
      if (window.electron && window.electron.sendCommand) {
          
          let targetCar = activeCarPath;
          
          // If telemetry is entirely dead/offline, request the path manually.
          if (!targetCar) {
            targetCar = prompt("iRacing is disconnected. Please enter the precise car folder name manually (e.g. 'ferrari296gt3'):", "");
            if (!targetCar) return;
          }

          window.electron.sendCommand({
              action: 'install_setup',
              base64: setup.base64,
              carPath: targetCar,
              fileName: setup.fileName
          });
          
          setInjectedSetupId(setup.id);
          setTimeout(() => setInjectedSetupId(null), 3000);
      } else {
          alert('Fatal Error: IPC hardware bridge is offline.');
      }
  };

  const deleteSetup = (id: string) => {
      if (!window.confirm("Are you sure you want to permanently delete this setup from the global database?")) return;
      if (window.electron && window.electron.sendCommand) {
          window.electron.sendCommand({ action: 'delete_setup', setupId: id });
      }
  };

  const handleTrackEdit = (setup: any) => {
      setEditingTrackId(setup.id);
      setEditTrackValue(setup.targetTrack);
  };

  const saveTrackEdit = (id: string, value?: string) => {
      const finalValue = value ?? editTrackValue;
      if (!finalValue.trim()) return;
      if (window.electron && window.electron.sendCommand) {
          window.electron.sendCommand({ action: 'edit_setup', setupId: id, targetTrack: finalValue });
      }
      setEditingTrackId(null);
  };

  return (
    <div className="p-8 h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-end shrink-0 mb-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none text-white/90">
            Setup Center
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Global Telemetry Asset Synchronization</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: Uploader */}
        <div className="flex-[0.4] min-w-[320px] flex flex-col gap-4">
            <div 
                className={`card flex-1 min-h-[300px] border-2 border-dashed flex flex-col items-center justify-center p-8 text-center transition-all cursor-pointer relative overflow-hidden group
                    ${isHovering ? 'border-accent bg-accent/5' : 'border-white/10 bg-panel/30 hover:border-white/30'}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
                onDragLeave={() => setIsHovering(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsHovering(false);
                    if (e.dataTransfer.files?.[0]) {
                        // Creating a synthetic event object
                        handleFileUpload({ target: { files: e.dataTransfer.files } } as any);
                    }
                }}
                onClick={() => fileInputRef.current?.click()}
            >
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".sto"
                    onChange={handleFileUpload} 
                />

                <div className={`p-4 rounded-full mb-6 transition-colors ${uploadStatus === 'success' ? 'bg-status-success/20 text-status-success' : 'bg-black/40 text-accent group-hover:bg-accent group-hover:text-black'}`}>
                    {uploadStatus === 'success' ? <CheckCircle size={32} /> : <Upload size={32} />}
                </div>

                <h3 className="text-lg font-black uppercase tracking-widest text-white/90 mb-2">
                    {uploadStatus === 'uploading' ? 'Encrypting Payload...' : uploadStatus === 'success' ? 'Upload Secured' : 'Deploy Setup File'}
                </h3>
                
                <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 max-w-[80%]">
                    Drag and drop your iRacing <span className="text-accent">.sto</span> file here or click to browse. It will be globally instantly synchronized to Team Cloud.
                </p>
            </div>

            {/* Target Car Configuration (Moved Outside to prevent click conflicts) */}
            <div className="bg-panel/40 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Target Car Configuration</span>
                    <button 
                        onClick={() => { setManualCarId(null); setCarSearchQuery(''); }}
                        className={`text-[8px] font-black uppercase px-2 py-0.5 rounded transition-all ${!manualCarId ? 'bg-accent/20 text-accent' : 'bg-white/5 text-gray-600 hover:text-white'}`}
                    >
                        Auto-Link
                    </button>
                </div>

                <div className="relative">
                    <input 
                        type="text"
                        placeholder={manualCarId ? IRACING_CARS.find(c => c.id === manualCarId)?.name : "Search for target car..."}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white outline-none focus:border-accent/50 transition-all"
                        value={carSearchQuery}
                        onChange={(e) => {
                            setCarSearchQuery(e.target.value);
                            setShowCarPicker(true);
                        }}
                        onFocus={() => setShowCarPicker(true)}
                    />
                    
                    {showCarPicker && carSearchQuery && (
                        <div className="absolute bottom-full left-0 w-full mb-2 bg-panel border border-white/10 rounded-lg overflow-hidden shadow-2xl z-50">
                            {IRACING_CARS.filter(c => c.name.toLowerCase().includes(carSearchQuery.toLowerCase())).map(car => (
                                <div 
                                    key={car.id}
                                    onClick={() => {
                                        setManualCarId(car.id);
                                        setCarSearchQuery(car.name);
                                        setShowCarPicker(false);
                                    }}
                                    className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-accent/20 cursor-pointer"
                                >
                                    {car.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 px-1">
                    <HardDrive size={12} className="text-gray-600" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Active Path:</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-accent truncate max-w-[120px]">
                        {getTargetCarId() || "None Detected"}
                    </span>
                </div>
            </div>

            {!activeCarPath && !manualCarId && (
                 <div 
                    className="bg-status-warning/10 border border-status-warning/30 p-4 rounded-xl flex items-center gap-3 animate-pulse"
                    onClick={(e) => e.stopPropagation()}
                 >
                    <AlertTriangle size={16} className="text-status-warning shrink-0" />
                    <p className="text-[9px] font-bold uppercase tracking-widest text-status-warning/90 mt-0.5">
                       Simulator Disconnected. Setup target unknown. Please manually select a car above to enable deployment.
                    </p>
                 </div>
            )}
        </div>

        {/* Right Column: Repository Array */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div className="card bg-panel/30 border-white/5 p-6 flex flex-col min-h-[400px]">
                <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4">
                  <SettingsIcon size={16} className="text-accent" />
                  <h2 className="text-xs font-black italic tracking-widest uppercase text-white/70">Global Setup Repository</h2>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {setups.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-600 italic">Vault is empty...</span>
                        </div>
                    ) : (
                        setups.sort((a,b) => b.timestamp - a.timestamp).map(setup => (
                            <div key={setup.id} className="group p-4 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/10 rounded-lg flex items-center justify-between transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-black/60 rounded">
                                        <Wrench size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black uppercase text-white/90 tracking-wider mb-1">{setup.fileName}</h4>
                                        <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                                            <span>Author: <span className="text-[#ffb000]">{setup.author}</span></span>
                                            <span>•</span>
                                            <span className="text-blue-400">{setup.targetCar || 'Generic Car'}</span>
                                            <span>•</span>
                                            <span 
                                                className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors min-h-[24px]"
                                                onClick={() => { if (editingTrackId !== setup.id) handleTrackEdit(setup); }}
                                                title="Click to edit track name"
                                            >
                                                Track: 
                                                {editingTrackId === setup.id ? (
                                                    <div className="relative flex flex-col">
                                                        <input 
                                                            autoFocus
                                                            type="text" 
                                                            className="bg-black/50 border border-accent text-accent px-1.5 py-0.5 rounded outline-none min-w-[140px]"
                                                            value={editTrackValue}
                                                            onChange={(e) => setEditTrackValue(e.target.value)}
                                                            onBlur={() => {
                                                                // Slight delay allows the dropdown onMouseDown to fire first
                                                                setTimeout(() => {
                                                                    if (editingTrackId === setup.id) saveTrackEdit(setup.id);
                                                                }, 200);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') saveTrackEdit(setup.id);
                                                                if (e.key === 'Escape') setEditingTrackId(null);
                                                            }}
                                                        />
                                                        {editTrackValue && (
                                                            <div className="absolute top-full left-0 mt-1 w-[200px] bg-panel border border-white/10 rounded overflow-hidden shadow-2xl z-50">
                                                                {IRACING_TRACKS.filter(t => t.toLowerCase().includes(editTrackValue.toLowerCase())).slice(0, 5).map(track => (
                                                                    <div 
                                                                        key={track}
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault(); // Prevent onBlur from firing first
                                                                            if (window.electron && window.electron.sendCommand) {
                                                                                window.electron.sendCommand({ action: 'edit_setup', setupId: setup.id, targetTrack: track });
                                                                            }
                                                                            setEditingTrackId(null);
                                                                        }}
                                                                        className="px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-accent/20 cursor-pointer"
                                                                    >
                                                                        {track}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-accent hover:underline decoration-white/20 border-b border-transparent hover:border-accent">{setup.targetTrack}</span>
                                                )}
                                            </span>
                                            <span>•</span>
                                            <span>{new Date(setup.timestamp).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => deleteSetup(setup.id)}
                                        className="p-2.5 rounded transition-all text-gray-500 hover:bg-status-error/10 hover:text-status-error border border-transparent hover:border-status-error/30"
                                        title="Delete Setup permanently"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    
                                    <button 
                                        onClick={() => attemptInjection(setup)}
                                        disabled={injectedSetupId === setup.id}
                                        className={`px-6 py-2.5 rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2
                                            ${injectedSetupId === setup.id 
                                                ? 'bg-status-success text-black' 
                                                : 'bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-black hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                                            }
                                        `}
                                    >
                                        {injectedSetupId === setup.id ? (
                                            <>
                                                <CheckCircle size={12} strokeWidth={3} />
                                                Active
                                            </>
                                        ) : (
                                            <>
                                                <Download size={12} strokeWidth={3} />
                                                Apply To Car
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default SetupCenter;
