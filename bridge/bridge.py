import time
import random
import json
import os
import sys
import threading
import queue
import irsdk
import firebase_admin
from firebase_admin import credentials, db

# Robust pathing for service account key
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

def get_telemetry_data():
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

        # Session Info
        weekend_info = ir['WeekendInfo']
        session = {
            'active': True,
            'trackId': weekend_info.get('TrackID', 0) if weekend_info else 0,
            'trackName': weekend_info.get('TrackName', 'Unknown') if weekend_info else 'Unknown',
            'weather': weekend_info.get('TrackWeatherType', 'Clear') if weekend_info else 'Clear',
            'laps_remaining': int(ir['FuelLevel'] / 2.5) if ir['FuelLevel'] > 0 else 0
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
        data = {
            'speed': int(ir['Speed'] * 3.6),
            'rpm': int(ir['RPM']),
            'gear': ir['Gear'],
            'throttle': int(ir['Throttle'] * 100),
            'brake': int(ir['Brake'] * 100),
            'fuel': round(ir['FuelLevel'], 2),
            'lap': ir['Lap'],
            'position': ir['PlayerCarPosition'],
            'track_temp': round(ir['TrackTemp'], 1),
            'air_temp': round(ir['AirTemp'], 1),
            'timestamp': time.time(),
            'abs': is_abs,
            'gap_ahead': gap_ahead,
            'gap_behind': gap_behind,
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
            'drivers': drivers # Full field positions
        }
        
        return data, session
    except Exception as e:
        print(f"Error reading iRacing data: {e}")
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
        }
    }
    session = {
        'active': True,
        'trackId': 1,
        'trackName': 'Spa-Francorchamps (Sim)',
        'weather': 'Clear',
        'laps_remaining': 83
    }
    return data, session

# Global state for persistence and history
active_team = None
last_session_id = -1
current_lap_history = []
last_processed_lap = -1
last_lap_time = 0.0
is_on_track = False
stint_lap_count = 0
stint_start_time = 0.0

def run_bridge():
    """Main bridge loop running at 60Hz."""
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
    
    # Initial startup attempt
    try:
        if ir.startup():
            print("iRacing SDK Initialized Successfully", flush=True)
        else:
            print("iRacing SDK Initialization Failed - Waiting for iRacing to start...", flush=True)
    except Exception as e:
        print(f"CRITICAL: iRacing SDK Startup Exception: {e}", flush=True)
    
    last_fb_update = 0
    fb_update_interval = 0.05
    last_conn_status = False
    
    global last_session_id, current_lap_history, last_processed_lap, last_lap_time, is_on_track, stint_lap_count, stint_start_time
    
    while True:
        loop_start = time.time()
        
        # Monitor connection status change
        curr_conn = ir.is_connected
        if curr_conn != last_conn_status:
            if curr_conn:
                print(">>> iRacing Connected! Pulling Live Telemetry.", flush=True)
            else:
                print(">>> iRacing Disconnected. Switching to Simulation Fallback.", flush=True)
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
            elif cmd.get('action') == 'set_team' and 'teamId' in cmd:
                global active_team
                active_team = cmd['teamId']
                print(f"Bridge Target Team Locked: {active_team}", flush=True)
            elif cmd.get('action') == 'write_presence' and 'teamId' in cmd:
                try:
                    team_id = cmd.get('teamId')
                    name = cmd.get('name', 'Unknown Driver')
                    safe_name = ''.join(c for c in name if c not in '.#$[]')
                    if HAS_FIREBASE and team_id and team_id not in ('solo', 'gridUp_practice'):
                        db.reference(f'teams/{team_id}/drivers/{safe_name}').set({
                            'name': name,
                            'status': 'online',
                            'lastActive': int(time.time() * 1000),
                            'className': 'Unknown Class',
                            'carNum': '-'
                        })
                        print(f"Presence written: {name} -> {team_id}", flush=True)
                except Exception as e:
                    print(f"Presence Write Error: {e}", flush=True)
            elif cmd.get('action') == 'leave_team' and 'teamId' in cmd:
                try:
                    team_id = cmd.get('teamId')
                    name = cmd.get('name', 'Unknown Driver')
                    safe_name = ''.join(c for c in name if c not in '.#$[]')
                    if HAS_FIREBASE and team_id and team_id not in ('solo', 'gridUp_practice'):
                        db.reference(f'teams/{team_id}/drivers/{safe_name}').update({
                            'status': 'offline',
                            'lastActive': int(time.time() * 1000)
                        })
                        print(f"Presence cleared: {name} left {team_id}", flush=True)
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
                if HAS_FIREBASE and active_team and active_team != 'solo':
                    try:
                        setupRef = db.reference(f'teams/{active_team}/setups').push()
                        setupRef.set({
                            'id': setupRef.key,
                            'fileName': cmd.get('fileName', 'setup.sto'),
                            'author': cmd.get('author', 'Local Driver'),
                            'size': cmd.get('size', 0),
                            'targetTrack': cmd.get('targetTrack', 'Generic Track'),
                            'base64': cmd.get('base64', ''),
                            'timestamp': int(time.time() * 1000)
                        })
                        print(f"Setup {setupRef.key} forcefully injected into Cloud Firewall by Admin SDK.", flush=True)
                    except Exception as e:
                        print(f"Admin SDK Firebase Upload Error: {e}", flush=True)
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

        result = get_telemetry_data()
        if result:
            telemetry, session = result
            
            # 1. Detect Session Transitions
            sid = get_safe('SessionUniqueID', -1)
            if sid != last_session_id and sid != -1:
                last_session_id = sid
                current_lap_history = [] # Reset rolling history for new session
                last_processed_lap = -1
                
                # Push session metadata to Firebase Archive if Team is active
                if HAS_FIREBASE and active_team and active_team != 'solo':
                    try:
                        db.reference(f'teams/{active_team}/history/{sid}/metadata').set({
                            'trackName': session.get('trackName', 'Unknown'),
                            'carName': 'Active Vehicle', # IRSDK doesn't give CarName easily without deep lookup
                            'startTime': int(time.time() * 1000),
                            'sessionId': sid
                        })
                    except: pass

            # 2. Detect Lap Completions
            curr_lap = telemetry.get('lap', -1)
            if curr_lap > last_processed_lap and last_processed_lap != -1:
                # Capture the time of the JUST completed lap
                l_time = get_safe('LapLastLapTime', 0.0)
                if l_time > 0:
                    lap_record = {
                        'lap': last_processed_lap,
                        'time': round(l_time, 3),
                        'valid': l_time < 600, # Basic safety check
                        'timestamp': int(time.time() * 1000)
                    }
                    
                    # Update local rolling buffer (max 20)
                    current_lap_history.insert(0, lap_record)
                    current_lap_history = current_lap_history[:20]
                    
                    # Push permanent record to Firebase Archive
                    if HAS_FIREBASE and active_team and active_team != 'solo' and last_session_id != -1:
                        try:
                            db.reference(f'teams/{active_team}/history/{last_session_id}/laps/{last_processed_lap}').set(lap_record)
                        except: pass
            
            last_processed_lap = curr_lap
            
            # 3. Stint Management (Pit Road Boundaries)
            on_pit = bool(get_safe('OnPitRoad', 1)) # Default to 1 (in pits) if unknown
            
            # Detect Pit Exit (Stint Start)
            if is_on_track == False and on_pit == False:
                is_on_track = True
                stint_lap_count = 0
                stint_start_time = time.time()
                print(">>> Stint Started: Car exited pit road.", flush=True)
                
            # Detect Pit Entry (Stint End)
            if is_on_track == True and on_pit == True:
                is_on_track = False
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
                    except Exception as e:
                        print(f"Stint Archive Error: {e}", flush=True)

            # Increment stint laps on line crossing (if not on pit road)
            if is_on_track and curr_lap > last_processed_lap and last_processed_lap != -1:
                stint_lap_count += 1

            # Inject stint data into telemetry packet
            telemetry['lap_history'] = current_lap_history
            telemetry['stint_laps'] = stint_lap_count
            telemetry['sid'] = sid

        else:
            telemetry, session = simulate_telemetry()
            telemetry['lap_history'] = []
        
        # Output to stdout for local Electron UI
        try:
            print(json.dumps({'telemetry': telemetry, 'session': session}), flush=True)
        except (OSError, BrokenPipeError):
            # The pipe was closed (UI closed). Shutdown and exit cleanly.
            ir.shutdown()
            sys.exit(0)

        # Secure Firebase Updates (Only Upload if actual Telemetry is active AND Team is chosen, and it is NOT solo mode)
        if HAS_FIREBASE and active_team and active_team != 'solo' and ir.is_connected and (loop_start - last_fb_update) >= fb_update_interval:
            try:
                base_path = f"teams/{active_team}"
                db.reference(f'{base_path}/telemetry').update(telemetry)
                db.reference(f'{base_path}/session').update(session)
                
                # Update driver's own online status in the team roster dynamically
                player_data = None
                for d in telemetry.get('drivers', {}).values():
                    if d.get('isPlayer'):
                        player_data = d
                        break
                
                if player_data:
                    safe_name = player_data['name'].replace('.', '').replace('#', '').replace('$', '').replace('[', '').replace(']', '')
                    db.reference(f"{base_path}/drivers/{safe_name}").update({
                        'status': 'online',
                        'lastActive': int(time.time() * 1000),
                        'name': player_data['name'],
                        'className': player_data.get('className', 'Unknown Class'),
                        'carNum': player_data.get('carNum', '00')
                    })
                
                last_fb_update = loop_start
            except Exception as e:
                print(f"Firebase Sync Error: {e}")

        elapsed = time.time() - loop_start
        sleep_time = max(0, (1.0 / 60.0) - elapsed)
        time.sleep(sleep_time)

if __name__ == "__main__":
    try:
        run_bridge()
    except KeyboardInterrupt:
        print("Bridge Stopped")
        ir.shutdown()
