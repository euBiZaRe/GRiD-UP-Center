# --- Grid Up Telemetry Bridge ---
# Version: 1.4.9-EXPERIMENTAL
# Target: iRacing High-Fidelity Sync

import sys
import json
import time
import os
import random
import time
import json
import socket
import threading
import ctypes, os

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except:
        return False

BRIDGE_VERSION = "1.4.10"
import re
import queue
import irsdk
import subprocess
import firebase_admin
from firebase_admin import credentials, db
try:
    import winreg
except ImportError:
    winreg = None

# Robust pathing for service account key (PyInstaller compatibility)
if getattr(sys, 'frozen', False):
    base_path = os.path.dirname(sys.executable)
else:
    base_path = os.path.dirname(os.path.abspath(__file__))
    
key_path = os.path.join(base_path, 'serviceAccountKey.json')

try:
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://grid-up-racedash-default-rtdb.europe-west1.firebasedatabase.app'
    })
    HAS_FIREBASE = True
except Exception as e:
    print(f"Firebase not initialised: {e}")
    HAS_FIREBASE = False

# Initialize iRacing SDK
ir = irsdk.IRSDK()

def check_iracing():
    if ir.is_connected:
        return True
    # ID Normalization to Uppercase (Registry Standard)
    return ir.startup()

def get_safe(key, default_val=0):
    """Safe extraction helper for optional iRacing parameters."""
    try:
        if key in ir.var_headers_names:
            val = ir[key]
            return val if val is not None else default_val
    except:
        pass
    return default_val

def get_telemetry_data(consume=False):
    """Pulls data from iRacing SDK if connected, else returns None."""
    if not check_iracing():
        return None
        
    try:
        # Calculate Relative Gaps
        f2_times = get_safe('CarIdxF2Time', [])
        my_idx = ir['PlayerCarIdx']
        gap_ahead = "--"
        gap_behind = "--"
        
        if type(f2_times) is tuple and len(f2_times) > 0:
            ahead = [t for i, t in enumerate(f2_times) if t > 0 and i != my_idx]
            behind = [t for i, t in enumerate(f2_times) if t < 0 and i != my_idx]
            
            if ahead:
                gap_ahead = f"+{round(min(ahead), 1)}"
            if behind:
                gap_behind = f"{round(max(behind), 1)}"

        # Full field driver data
        drivers = {}
        driver_info = ir['DriverInfo']
        if driver_info and 'Drivers' in driver_info:
            for d in driver_info['Drivers']:
                idx = d['CarIdx']
                dist = ir['CarIdxLapDistPct'][idx]
                surface = get_safe('CarIdxTrackSurface', -1)[idx] if type(get_safe('CarIdxTrackSurface', [])) is tuple else -1
                
                # Only include cars that are actually on track/driving
                if dist >= 0:
                    drivers[str(idx)] = {
                        'name': d['UserName'],
                        'carNum': d['CarNumber'],
                        'classId': d['CarClassID'],
                        'className': d.get('CarClassShortName', str(d['CarClassID'])),
                        'classColor': hex(d['CarClassColor'])[2:].zfill(6),
                        'carPath': d.get('CarPath', ''),
                        'progress': dist,
                        'surface': surface,
                        'isPlayer': idx == ir['PlayerCarIdx']
                    }

        # Session Info (Extremely Robust YAML parsing)
        ir.freeze_var_buffer_latest()  # CRITICAL: Refresh SDK data buffer each cycle
        weekend_info = ir['WeekendInfo']
        track_id = 1
        track_name = 'iRacing UI (Initialising)'
        
        # Detect Session ID FIRST before using it
        sid = get_safe('SessionUniqueID', -1)
        if not hasattr(get_telemetry_data, 'last_sid'):
            get_telemetry_data.last_sid = sid
        
        if weekend_info:
            # Try dictionary access first
            track_id = weekend_info.get('TrackID') or weekend_info.get('trackID') or 1
            track_name = weekend_info.get('TrackName') or weekend_info.get('trackName') or 'iRacing UI (Initialising)'
            
            # If track_id is still 1 or suspicious, try regex on raw YAML string
            if track_id == 1 or not str(track_id).isdigit():
                try:
                    raw_yaml = ir.session_info
                    match = re.search(r'TrackID:\s*(\d+)', raw_yaml)
                    if match:
                        track_id = int(match.group(1))
                except: pass

        track_id = int(track_id) if str(track_id).isdigit() else 1
        track_id = max(1, track_id)
        
        # Diagnostic Log (Once per session change)
        if sid != get_telemetry_data.last_sid:
            print(f">>> SESSION START: {track_name} (ID: {track_id})", flush=True)
            get_telemetry_data.last_sid = sid
        
        # Extract Player Car Name from DriverInfo
        player_car_name = "Unknown Vehicle"
        player_idx = ir['PlayerCarIdx']
        if driver_info and 'Drivers' in driver_info:
            for d in driver_info['Drivers']:
                if d['CarIdx'] == player_idx:
                    player_car_name = d.get('CarScreenName', d.get('CarPath', 'Unknown')).upper()
                    break

        if sid != get_telemetry_data.last_sid:
            print(f"[Session Sync] Transition: {get_telemetry_data.last_sid} -> {sid} | Track: {track_name} | Car: {player_car_name}", flush=True)
            get_telemetry_data.last_sid = sid

        # Extract Track Length in Meters
        track_len_str = weekend_info.get('TrackLength', '4000').split(' ')[0] if weekend_info else '4000'
        track_len_unit = weekend_info.get('TrackLength', 'km').split(' ')[1] if weekend_info else 'km'
        try:
            track_len = float(track_len_str)
            if 'km' in track_len_unit.lower():
                track_len *= 1000
            elif 'mi' in track_len_unit.lower():
                track_len *= 1609.34
        except:
            track_len = 4000

        # --- Fuel Strategy Overhaul ---
        fuel_current = get_safe('FuelLevel', 0)
        
        # Initialize rolling average state if needed
        if not hasattr(get_telemetry_data, 'fuel_history'):
            get_telemetry_data.fuel_history = []
            get_telemetry_data.last_fuel_level = fuel_current
            get_telemetry_data.last_lap_num = -1
        
        current_lap_num = get_safe('Lap', 0)
        
        # Detect lap crossing to record consumption
        if current_lap_num > get_telemetry_data.last_lap_num and get_telemetry_data.last_lap_num != -1:
            consumption = get_telemetry_data.last_fuel_level - fuel_current
            if 0 < consumption < 20: # Sanity check (no refueling or errors)
                get_telemetry_data.fuel_history.append(consumption)
                if len(get_telemetry_data.fuel_history) > 3:
                    get_telemetry_data.fuel_history.pop(0)
            
            get_telemetry_data.last_fuel_level = fuel_current
            get_telemetry_data.last_lap_num = current_lap_num
        elif get_telemetry_data.last_lap_num == -1:
            get_telemetry_data.last_lap_num = current_lap_num
            get_telemetry_data.last_fuel_level = fuel_current

        # Calculate Laps Remaining based on average
        if len(get_telemetry_data.fuel_history) > 0:
            avg_cons = sum(get_telemetry_data.fuel_history) / len(get_telemetry_data.fuel_history)
            laps_rem = int(fuel_current / max(avg_cons, 0.1))
        else:
            # Fallback for first 3 laps (GT3 average)
            laps_rem = int(fuel_current / 3.0)

        session = {
            'active': True,
            'sid': sid,
            'trackId': track_id,
            'trackName': track_name,
            'trackLength': track_len,
            'carName': player_car_name,
            'weather': weekend_info.get('TrackWeatherType', 'Clear') if weekend_info else 'Clear',
            'fuel_level': fuel_current,
            'laps_remaining': laps_rem,
            'is_live': True # Explicit live flag
        }

        # Detect ABS Intervention
        is_abs = False
        try:
            if 'BrakeABSactive' in ir.var_headers_names:
                is_abs = bool(ir['BrakeABSactive'])
            else:
                brake_raw = ir['BrakeRaw']
                brake_actual = ir['Brake']
                # If the driver is pushing harder than the car allows, ABS is intervening
                if brake_raw is not None and brake_actual is not None:
                    if brake_raw > (brake_actual + 0.05) and brake_actual > 0.1:
                        is_abs = True
        except:
            pass

        # Primary Player Telemetry
        global accum_throttle, accum_brake
        with accum_lock:
            if accum_throttle:
                current_throttle = sum(accum_throttle) / len(accum_throttle)
                current_brake = sum(accum_brake) / len(accum_brake)
                # Reset ONLY if we are actually pushing this packet to the cloud
                if consume:
                    accum_throttle = []
                    accum_brake = []
            else:
                current_throttle = get_safe('Throttle', 0.0)
                current_brake = get_safe('BrakeRaw', 0.0) or get_safe('Brake', 0.0)

        data = {
            'speed': get_safe('Speed', 0),
            'rpm': int(get_safe('RPM', 0)),
            'gear': get_safe('Gear', 0),
            'throttle': int(current_throttle * 100),
            'brake': int(current_brake * 100),
            'brake_applied': int(get_safe('Brake', 0) * 100),
            'fuel': round(get_safe('FuelLevel', 0), 2),
            'lap': get_safe('Lap', 0),
            'position': get_safe('CarIdxClassPosition', [0])[get_safe('PlayerCarIdx', 0)] or get_safe('PlayerCarPosition', 0),
            'track_temp': round(get_safe('TrackTemp', 0), 1),
            'air_temp': round(get_safe('AirTemp', 0), 1),
            'timestamp': time.time(),
            'abs': is_abs,
            'gap_ahead': gap_ahead,
            'gap_behind': gap_behind,
            'incidents': get_safe('PlayerCarMyIncidents', 0) or get_safe('PlayerCarTeamIncidents', 0),
            'incidents_all': get_safe('CarIdxIncidentK', [0]),
            'steering': round(get_safe('SteeringWheelAngle', 0), 3),
            'delta': round(get_safe('LapDeltaToBestLap', 0), 3),
            'progress': round(get_safe('LapDistPct', 0), 5),
            # GPS Data
            'lat': get_safe('Lat', 0) or get_safe('PlayerCarLat', 0),
            'lon': get_safe('Lon', 0) or get_safe('PlayerCarLon', 0),
            'x': get_safe('PlayerCarX', 0),
            'y': get_safe('PlayerCarY', 0),
            'health': {
                'oilTemp': round(get_safe('OilTemp', 0), 1),
                'waterTemp': round(get_safe('WaterTemp', 0), 1),
                'oilPress': round(get_safe('OilPress', 0), 2),
                'tyres': {
                    'LF': { 'p': round(get_safe('LFcoldPressure', 0), 1), 't': round(get_safe('LFtempCM', 0), 1) },
                    'RF': { 'p': round(get_safe('RFcoldPressure', 0), 1), 't': round(get_safe('RFtempCM', 0), 1) },
                    'LR': { 'p': round(get_safe('LRcoldPressure', 0), 1), 't': round(get_safe('LRtempCM', 0), 1) },
                    'RR': { 'p': round(get_safe('RRcoldPressure', 0), 1), 't': round(get_safe('RRtempCM', 0), 1) }
                }
            },
            'incidents': get_safe('PlayerCarTeamIncidentCount', 0),
            'session_time': round(get_safe('SessionTime', 0.0), 3),
            'drivers': drivers, # Full field positions
            'is_live': True,
            'v': BRIDGE_VERSION
        }
        
        return data, session
    except Exception as e:
        import traceback
        print(f"[BRIDGE ERROR] get_telemetry_data failed: {e}", flush=True)
        print(traceback.format_exc(), flush=True)
        return None

def simulate_telemetry():
    """Generates realistic racing telemetry data for fallback."""
    # ... (Keeping simplified for brevity in this tool call, but ensuring it maintains structure)
    data = {
        'speed': random.randint(100, 250),
        'rpm': random.randint(3000, 7000),
        'gear': 4,
        'throttle': 10,
        'brake': 85,
        'fuel': 55.5,
        'lap': 12,
        'position': 5,
        'gap_ahead': '+1.2',
        'gap_behind': '-0.8',
        'track_temp': 28.5,
        'air_temp': 22.0,
        'timestamp': time.time(),
        'abs': False, # Disabled random mock ABS firing
        'drivers': {
            "0": {"name": "Sim Driver 1", "progress": 0.1, "isPlayer": True, "classId": 1, "className": "GT3", "classColor": "00e5ff"},
            "1": {"name": "Sim Driver 2", "progress": 0.15, "isPlayer": False, "classId": 1, "className": "GT3", "classColor": "ffffff"}
        },
        'is_live': False,
        'v': BRIDGE_VERSION
    }
    session = {
        'active': True,
        'trackId': 0,
        'trackName': 'Simulation Circuit',
        'weather': 'Clear',
        'laps_remaining': 83,
        'is_live': False, # Simulation flag
        'diag': {
            'status': 'WAITING',
            'msg': 'Waiting for iRacing SDK...',
            'admin': is_admin(),
            'error': ''
        }
    }
    return data, session

def get_machine_id():
    """Identifies the unique hardware ID to match Electron's fingerprinting (36-char UUID)."""
    try:
        if os.name == 'nt' and winreg:
            registry = winreg.ConnectRegistry(None, winreg.HKEY_LOCAL_MACHINE)
            key = winreg.OpenKey(registry, r"SOFTWARE\Microsoft\Cryptography")
            value, regtype = winreg.QueryValueEx(key, "MachineGuid")
            return str(value).strip('{}').upper()
        return "fallback-python-id"
    except:
        return "fallback-python-id"

# Global state for persistence and history
active_team = None
machine_id = get_machine_id()
last_session_id = -1
current_lap_history = []
last_processed_lap = -1
last_lap_time = 0.0
is_on_track = False
stint_lap_count = 0
stint_start_time = 0.0
current_lap_trace = []
last_sample_time = 0
custom_driver_name = None

# Telemetry Accumulator (Ensures smooth averages and captured blips)
accum_throttle = []
accum_brake = []
accum_lock = threading.Lock()

def run_bridge():
    """Main bridge loop running at 60Hz."""
    print("--- BRIDGE STARTING V1.0.4 ---", flush=True)
    print(f"Grid Up iRacing Bridge Started (60Hz Target) [Python {sys.version}]", flush=True)

    # stdin queue for commands from Electron
    command_queue = queue.Queue()
    def stdin_reader():
        import builtins
        for line in sys.stdin:
            try:
                cmd = json.loads(line.strip())
                command_queue.put(cmd)
            except:
                pass

    threading.Thread(target=stdin_reader, daemon=True).start()
    
    # High-Speed Sampler Thread (Runs at 100Hz)
    def telemetry_sampler():
        global accum_throttle, accum_brake
        while True:
            if ir.is_connected:
                try:
                    with accum_lock:
                        thr = get_safe('Throttle', 0.0)
                        brk = get_safe('BrakeRaw', 0.0) or get_safe('Brake', 0.0)
                        accum_throttle.append(float(thr))
                        accum_brake.append(float(brk))
                        # Keep buffer reasonable
                        if len(accum_throttle) > 100:
                            accum_throttle.pop(0)
                            accum_brake.pop(0)
                except: pass
            time.sleep(0.01) # 100Hz
    
    threading.Thread(target=telemetry_sampler, daemon=True).start()

    # Initial startup attempt
    try:
        if ir.startup():
            print("iRacing SDK Initialized Successfully", flush=True)
        else:
            print("iRacing SDK Initialization Failed - Waiting for iRacing...", flush=True)
    except Exception as e:
        print(f"CRITICAL: iRacing SDK Startup Exception: {e}", flush=True)
    
    last_fb_update = 0
    last_presence_update = 0
    fb_update_interval_idle = 1.0   # Heartbeat (1Hz)
    fb_update_interval_racing = 0.2 # Smooth Observation (5Hz)
    last_fb_update = 0
    last_conn_status = False
    sim_logged = False
    
    global last_session_id, current_lap_history, last_processed_lap, last_lap_time, is_on_track, stint_lap_count, stint_start_time, current_lap_trace, last_sample_time
    
    stop_timer = time.time()  # Initialized once — used to detect sustained full stop
    
    while True:
        loop_start = time.time()
        
        # Monitor connection status change
        curr_conn = ir.is_connected
        if curr_conn != last_conn_status:
            if curr_conn:
                print(">>> iRacing Connected! Pulling Live Telemetry.", flush=True)
            else:
                print(">>> iRacing Disconnected. Purging Session Cache.", flush=True)
                # V1.4.9.11-STABILITY: Purge session state on disconnect to prevent track ghosting
                last_session_id = -1
                last_processed_lap = -1
                is_on_track = False
                current_lap_trace = []
                if hasattr(get_telemetry_data, 'last_sid'):
                    delattr(get_telemetry_data, 'last_sid')
                
            last_conn_status = curr_conn

        # Process UI Commands
        while not command_queue.empty():
            cmd = command_queue.get()
            if cmd.get('action') == 'spectator_jump' and 'carNum' in cmd:
                if ir.is_connected:
                    car_num = int(cmd['carNum'])
                    session_time = cmd.get('sessionTime', None)
                    
                    # Try to rewind replay (only works in replay mode, not live race)
                    if session_time is not None:
                        try:
                            rewind_time = max(0, float(session_time) - 3.0)
                            ir.replay_search_session_time(0, rewind_time)
                            print(f"Replay rewound to T={rewind_time}s", flush=True)
                        except Exception:
                            pass  # Silently skip — we're in a live session
                    
                    # Always switch camera to the car (works both live AND replay)
                    try:
                        ir.cam_switch_num(car_num, 1, 1)
                        print(f"Camera switched to Car #{car_num}", flush=True)
                    except Exception as e:
                        print(f"Cam switch error: {e}", flush=True)
            elif cmd.get('action') == 'set_mid' and 'mid' in cmd:
                global machine_id
                machine_id = str(cmd['mid']).upper()
                print(f"Bridge Hardware ID Locked: {machine_id}", flush=True)
            elif cmd.get('action') == 'set_team' and 'teamId' in cmd:
                global active_team
                active_team = str(cmd['teamId']) # Keep team IDs as defined in TEAMS constant
                print(f"Bridge Target Team Locked: {active_team}", flush=True)
            elif cmd.get('action') == 'write_presence' and 'teamId' in cmd:
                try:
                    team_id = cmd.get('teamId')
                    mid = str(cmd.get('mid', 'unknown_machine')).upper()
                    name = cmd.get('name', 'Unknown Driver')
                    if HAS_FIREBASE and team_id and team_id not in ('solo', 'gridUp_practice'):
                        global custom_driver_name
                        custom_driver_name = name
                        db.reference(f'teams/{team_id}/drivers/{mid}').update({
                            'name': name,
                            'status': 'online',
                            'lastActive': int(time.time() * 1000),
                            'protocol': 'v2',
                            'className': 'Unknown Class',
                            'carNum': '-'
                        })
                        print(f"Presence written for ID {mid}: {name} [V2-PROTOCOL]", flush=True)
                except Exception as e:
                    print(f"Presence Write Error: {e}", flush=True)
            elif cmd.get('action') == 'leave_team' and 'teamId' in cmd:
                try:
                    team_id = cmd.get('teamId')
                    mid = str(cmd.get('mid', 'unknown_machine')).upper()
                    if HAS_FIREBASE and team_id and team_id not in ('solo', 'gridUp_practice'):
                        db.reference(f'teams/{team_id}/drivers/{mid}').update({
                            'status': 'offline',
                            'lastActive': int(time.time() * 1000)
                        })
                        print(f"Presence cleared for ID {mid}", flush=True)
                except Exception as e:
                    print(f"Leave Team Error: {e}", flush=True)
            elif cmd.get('action') == 'install_setup':
                try:
                    import base64
                    import os
                    car_path = cmd.get('carPath', 'unknown_car')
                    file_name = cmd.get('fileName', 'team_setup.sto')
                    b64_data = cmd.get('base64', '')
                    
                    if b64_data.startswith('data:'):
                        b64_data = b64_data.split(',')[1]
                        
                    raw_bytes = base64.b64decode(b64_data)
                    docs_path = os.path.join(os.path.expanduser('~'), 'Documents', 'iRacing', 'setups', car_path)
                    os.makedirs(docs_path, exist_ok=True)
                    
                    target_file = os.path.join(docs_path, file_name)
                    with open(target_file, 'wb') as f:
                        f.write(raw_bytes)
                        
                    print(f"Setup Installed Successfully to: {target_file}", flush=True)
                except Exception as e:
                    print(f"Failed to install setup: {e}", flush=True)
            elif cmd.get('action') == 'upload_setup':
                print(f"DEBUG: Received upload_setup request. Firebase: {HAS_FIREBASE}, Team: {active_team}", flush=True)
                if HAS_FIREBASE and active_team and active_team != 'solo':
                    try:
                        print(f"DEBUG: Pushing setup to teams/{active_team}/setups", flush=True)
                        setupRef = db.reference(f'teams/{active_team}/setups').push()
                        setupRef.set({
                            'id': setupRef.key,
                            'fileName': cmd.get('fileName', 'setup.sto'),
                            'author': cmd.get('author', 'Local Driver'),
                            'size': cmd.get('size', 0),
                            'targetTrack': cmd.get('targetTrack', 'Generic Track'),
                            'targetCar': cmd.get('targetCar', 'unknown_car'),
                            'base64': cmd.get('base64', ''),
                            'timestamp': int(time.time() * 1000)
                        })
                        print(f"Setup {setupRef.key} successfully uploaded to Cloud.", flush=True)
                    except Exception as e:
                        print(f"CRITICAL: Setup Upload Error: {e}", flush=True)
                else:
                    print(f"DEBUG: Upload skipped. Reason: {'No Firebase' if not HAS_FIREBASE else 'Solo Mode' if active_team == 'solo' else 'No Active Team'}", flush=True)
            elif cmd.get('action') == 'delete_setup':
                if HAS_FIREBASE and active_team and active_team != 'solo':
                    try:
                        setup_id = cmd.get('setupId')
                        if setup_id:
                            db.reference(f'teams/{active_team}/setups/{setup_id}').delete()
                            print(f"Setup {setup_id} deleted by Admin SDK.", flush=True)
                    except Exception as e:
                        print(f"Admin SDK Firebase Delete Error: {e}", flush=True)
            elif cmd.get('action') == 'edit_setup':
                if HAS_FIREBASE and active_team and active_team != 'solo':
                    try:
                        setup_id = cmd.get('setupId')
                        new_track = cmd.get('targetTrack')
                        if setup_id and new_track:
                            db.reference(f'teams/{active_team}/setups/{setup_id}').update({'targetTrack': new_track})
                            print(f"Setup {setup_id} Track renamed to {new_track} by Admin SDK.", flush=True)
                    except Exception as e:
                        print(f"Admin SDK Firebase Edit Error: {e}", flush=True)

        sid = -1
        current_interval = fb_update_interval_racing if ir.is_connected else fb_update_interval_idle
        
        # Only consume (reset) the accumulator if we are actually pushing to cloud this frame
        should_consume = (loop_start - last_fb_update) >= current_interval
        result = get_telemetry_data(consume=should_consume)
        
        if result:
            telemetry, session = result
            
            # 1. Detect Session Transitions
            raw_sid = get_safe('SessionUniqueID', -1)
            
            # Fallback for Offline Test Drive Mode
            if raw_sid == -1 or raw_sid == 0:
                if last_session_id == -1:
                    sid = int(time.time() * 1000)
                else:
                    sid = last_session_id
            else:
                sid = raw_sid

            if sid != last_session_id and sid != -1:
                last_session_id = sid
                current_lap_history = [] # Reset rolling history for new session
                last_processed_lap = -1
                
                # Push session metadata to Firebase Archive if Team is active
                if HAS_FIREBASE and active_team and active_team != 'solo':
                    try:
                        db.reference(f'teams/{active_team}/history/{sid}/metadata').set({
                            'trackName': session.get('trackName', 'Unknown'),
                            'carName': player_car_name,
                            'startTime': int(time.time() * 1000),
                            'sessionId': sid,
                            'is_live': session.get('is_live', False)
                        })
                    except: pass

            # 2. Detect Lap Completions (with Startup Shield)
            curr_lap = telemetry.get('lap', -1)
            
            # Initialise counter on first connection without triggering a 'save'
            if last_processed_lap == -1 and curr_lap != -1:
                last_processed_lap = curr_lap
                print(f">>> Bridge Synchronized: Starting recording at Lap {curr_lap}", flush=True)

            if curr_lap > last_processed_lap:
                # Capture the time of the JUST completed lap
                l_time = get_safe('LapLastLapTime', 0.0)
                if l_time > 0:
                    lap_record = {
                        'lap': last_processed_lap,
                        'time': round(l_time, 3),
                        'start_ts': round(get_safe('SessionTime', 0) - l_time, 2), # Calculate S/F crossing time for video sync
                        'valid': l_time < 600, # Basic safety check
                        'timestamp': int(time.time() * 1000)
                    }
                    
                    # Update local rolling buffer (max 20)
                    current_lap_history.insert(0, lap_record)
                    current_lap_history = current_lap_history[:20]
                    
                    # Push permanent record to Firebase Archive
                    if HAS_FIREBASE and active_team and active_team != 'solo' and last_session_id != -1:
                        try:
                            # 1. Save Lap Summary (Both locations for compatibility)
                            db.reference(f'teams/{active_team}/history/{last_session_id}/laps/{last_processed_lap}').set(lap_record)
                            db.reference(f'telemetry/{last_session_id}/laps/{last_processed_lap}/metadata').set(lap_record)
                            
                            # 2. Save High-Res Telemetry Trace (Optimized Single-Node Sync)
                            if len(current_lap_trace) > 0:
                                # Convert to JSON string to avoid Firebase 10,000 node limits
                                compressed_trace = json.dumps(current_lap_trace)
                                trace_payload = {
                                    'driver': custom_driver_name or "GRiD UP Driver",
                                    'lapTime': round(l_time, 3),
                                    'samples': compressed_trace,
                                    'is_compressed': True
                                }
                                # Path 1: Global Telemetry Archive
                                db.reference(f'telemetry/{last_session_id}/laps/{last_processed_lap}/trace').set(compressed_trace)
                                # Path 2: Team History Archive
                                db.reference(f'teams/{active_team}/history/{last_session_id}/traces/{last_processed_lap}').set(trace_payload)
                                
                                print(f">>> Lap {last_processed_lap} COMPLETED: {len(current_lap_trace)} samples synced.", flush=True)
                        except Exception as e:
                            print(f"History Save Error: {e}", flush=True)
                    
                    # Reset trace for the new lap
                    # current_lap_trace = [] (Moved to save block)
                    if l_time <= 0:
                        current_lap_trace = []
            
            # 3. Smart Motion Stint Management (Reliable Detection)
            on_pit = bool(get_safe('OnPitRoad', 1))
            velocity = telemetry.get('speed', 0)
            
            # Detect Stint Start: Moving > 1km/h (very lenient — catches pit exit)
            if not is_on_track and velocity > 1:
                is_on_track = True
                stint_lap_count = 0
                stint_start_time = time.time()
                stop_timer = time.time()  # Reset stop timer when we start moving
                print(">>> Recording ARMED: Car in motion.", flush=True)
                
            # Detect Full Stop (Stint End) - Be very lenient to keep recording through pits
            # Only end if stopped for > 5 seconds to prevent flicker
            if is_on_track and velocity < 0.5:
                if time.time() - stop_timer > 5:
                    is_on_track = False
                    print(">>> Recording IDLE: Full stop detected.", flush=True)
                    
                    # Archive stint on completion
                    if stint_lap_count > 0:
                        try:
                            # Grab Driver Meta
                            driver_name = "Unknown Driver"
                            p_idx = ir['PlayerCarIdx']
                            d_info = ir['DriverInfo']['Drivers']
                            for d in d_info:
                                if d['CarIdx'] == p_idx:
                                    driver_name = d['UserName']
                                    break
                            
                            stint_record = {
                                'driver': driver_name,
                                'laps': stint_lap_count,
                                'duration': int(time.time() - stint_start_time),
                                'timestamp': int(time.time() * 1000)
                            }
                            
                            if HAS_FIREBASE and active_team and active_team != 'solo' and last_session_id != -1:
                                db.reference(f'teams/{active_team}/history/{last_session_id}/stints').push(stint_record)
                                print(f">>> Stint Archived: {stint_lap_count} laps by {driver_name}", flush=True)
                                stint_lap_count = 0 # Reset after archival
                        except Exception as e:
                            print(f"Stint Archive Error: {e}", flush=True)
            else:
                stop_timer = time.time()

            # Increment stint laps on line crossing (if not on pit road)
            if is_on_track and curr_lap > last_processed_lap and last_processed_lap != -1:
                stint_lap_count += 1

            # Update processed lap marker AFTER all lap-increment checks
            last_processed_lap = curr_lap

            # Inject stint data into telemetry packet
            telemetry['lap_history'] = current_lap_history
            telemetry['stint_laps'] = stint_lap_count
            telemetry['sid'] = sid

            # 4. Telemetry Recording (10Hz Sampling)
            if is_on_track:
                now_ts = time.time()
                if (now_ts - last_sample_time) >= 0.1: # 10Hz
                    sample = {
                        'p': telemetry.get('progress', 0),
                        's': telemetry.get('speed', 0),
                        't': telemetry.get('throttle', 0),
                        'b': telemetry.get('brake', 0),
                        'g': telemetry.get('gear', 0),
                        'st': telemetry.get('steering', 0),
                        'd': telemetry.get('delta', 0),
                        'lat': telemetry.get('lat', 0),
                        'lon': telemetry.get('lon', 0),
                        'ts': telemetry.get('session_time', 0)
                    }
                    current_lap_trace.append(sample)
                    last_sample_time = now_ts
                    
                    # Periodic log for verification (every 100 samples)
                    if len(current_lap_trace) % 100 == 0:
                        print(f"Recording Active: {len(current_lap_trace)} samples in buffer.", flush=True)

        else:
            # iRacing not available - use simulation but DO NOT reset is_on_track
            # Brief disconnections should not interrupt an active recording session
            if not sim_logged:
                print(f">>> iRacing NOT DETECTED - Initialising Simulation Mode (V{BRIDGE_VERSION})", flush=True)
                sim_logged = True
            telemetry, session = simulate_telemetry()
            telemetry['lap_history'] = []
        
        # Reset sim_logged if iRacing connects
        if result: sim_logged = False
        
        # Output to stdout for local Electron UI
        try:
            print(json.dumps({
                'telemetry': telemetry, 
                'session': session, 
                'is_live': session.get('is_live', False),
                'v': BRIDGE_VERSION
            }), flush=True)
        except (OSError, BrokenPipeError):
            # The pipe was closed (UI closed). Shutdown and exit cleanly.
            ir.shutdown()
            sys.exit(0)

        # Dynamic update interval: 5Hz (0.2s) if on track/moving, 1Hz (1s) otherwise
        current_interval = fb_update_interval_racing if (ir.is_connected and is_on_track) else fb_update_interval_idle

        # Identity Guard: Establish ID before anything else
        if not machine_id or machine_id == "initialising":
            machine_id = get_machine_id()
            if not machine_id: 
                time.sleep(1)
                continue
            print(f"Bridge Identity established: {machine_id}", flush=True)

        loop_start = time.time()
        
        # 1. Update Driver Presence (Every 5 seconds, regardless of iRacing status)
        if HAS_FIREBASE and active_team and active_team != 'solo':
            if (loop_start - last_presence_update) >= 5.0:
                try:
                    base_path = f"teams/{active_team}"
                    drivers_ref = db.reference(f"{base_path}/drivers/{machine_id}")
                    
                    # Presence Sync (Safety)
                    if not hasattr(run_bridge, 'presence_bound'):
                        setattr(run_bridge, 'presence_bound', True)

                    # Dynamic Presence Object
                    import os
                    presence = {
                        'name': custom_driver_name or os.getenv('USERNAME', 'GRiD UP Driver'), 
                        'status': 'online',
                        'lastActive': time.time() * 1000,
                        'protocol': 'v2'
                    }

                    # IF iRacing is connected, enrich with session data
                    if ir.is_connected:
                        try:
                            # SAFE PLAYER LOOKUP: Use PlayerCarIdx to find YOUR name
                            p_idx = ir['PlayerCarIdx']
                            drivers_info = ir['DriverInfo']['Drivers']
                            player_entry = next((d for d in drivers_info if d['CarIdx'] == p_idx), None)
                            if player_entry:
                                presence['name'] = player_entry['UserName']
                                presence['carNum'] = player_entry['CarNumber']
                                presence['className'] = player_entry['CarClassShortName']
                        except: pass

                    # ATOMIC OVERWRITE: Force identity and protocol, wipe legacy ghosts
                    drivers_ref.set(presence)
                    last_presence_update = loop_start
                    
                    if not hasattr(run_bridge, 'logged_v2'):
                         print(f"[Protocol Status] >>> LOCKED: V2-ULTRA-HARDENED", flush=True)
                         print(f"[Payload Trace]   >>> {json.dumps(presence, indent=2)}", flush=True)
                         setattr(run_bridge, 'logged_v2', True)
                except Exception as e:
                    print(f"Presence Sync Error: {e}")

        # 2. Update Live Telemetry (Frequent, only when iRacing active)
        if ir.is_connected and HAS_FIREBASE:
            try:
                # Frequency logic
                current_interval = fb_update_interval_racing if is_on_track else fb_update_interval_idle
                
                if (loop_start - last_fb_update) < current_interval:
                    time.sleep(0.01)
                    continue

                base_path = f"teams/{active_team}"
                stream_path = f"{base_path}/streams/{machine_id}"
                
                # Consolidate heartbeat with high-precision timestamp
                heartbeat = {
                    'telemetry': telemetry,
                    'session': session,
                    'timestamp': time.time(),
                    'is_live': session.get('is_live', False),
                    'v': BRIDGE_VERSION,
                    'diag': {
                        'status': 'OK' if session.get('is_live', False) else 'SIM',
                        'msg': 'Telemetry Streaming' if session.get('is_live', False) else 'Simulation Active',
                        'admin': is_admin()
                    }
                }
                
                # Pulse indicator logic
                if not hasattr(run_bridge, 'pulse'):
                    run_bridge.pulse = 0
                run_bridge.pulse += 1

                if not hasattr(run_bridge, 'logged_path'):
                     print(f"Cloud Heartbeat Active: {stream_path}", flush=True)
                     setattr(run_bridge, 'logged_path', stream_path)

                if run_bridge.pulse % 5 == 0:
                    print(f"[Cloud Sync] >>> Pushing Pulse #{run_bridge.pulse} | Buffer: {len(current_lap_trace)} samples", flush=True)

                db.reference(stream_path).set(heartbeat)
                
                last_fb_update = loop_start
            except Exception as e:
                print(f"Telemetry Sync Error: {e}")

        elapsed = time.time() - loop_start
        sleep_time = max(0, (1.0 / 60.0) - elapsed)
        time.sleep(sleep_time)

if __name__ == "__main__":
    try:
        run_bridge()
    except KeyboardInterrupt:
        print("Bridge Stopped")
        ir.shutdown()
