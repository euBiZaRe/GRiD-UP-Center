import os
import json
import firebase_admin
from firebase_admin import credentials, db

def wipe_history():
    # Path to the service account key
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    key_path = os.path.join(base_path, 'bridge', 'serviceAccountKey.json')
    
    if not os.path.exists(key_path):
        print(f"Error: Service account key not found at {key_path}")
        return

    try:
        # Initialize Firebase
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred, {
            'databaseURL': 'https://grid-up-racedash-default-rtdb.europe-west1.firebasedatabase.app'
        })

        # Get all teams
        teams_ref = db.reference('teams')
        teams = teams_ref.get()

        if not teams:
            print("No teams found in database.")
            return

        print(f"Found {len(teams)} teams. Wiping history nodes...")

        for team_id in teams:
            # Wipe the history node for each team
            history_ref = db.reference(f'teams/{team_id}/history')
            history_ref.delete()
            print(f"  - Wiped history for team: {team_id}")

        print("\nSuccess: All historical data has been purged. Users will now only see laps recorded with the new telemetry engine.")

    except Exception as e:
        print(f"Failed to wipe history: {e}")

if __name__ == "__main__":
    wipe_history()
