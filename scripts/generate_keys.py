import os
import random
import string
import firebase_admin
from firebase_admin import credentials, db
import json
import sys

# Format: GU-XXXX-XXXX-XXXX
def generate_key():
    parts = ['GU']
    for _ in range(3):
        parts.append(''.join(random.choices(string.ascii_uppercase + string.digits, k=4)))
    return '-'.join(parts)

def main():
    # 1. Config
    key_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../bridge/serviceAccountKey.json')
    db_url = 'https://grid-up-racedash-default-rtdb.europe-west1.firebasedatabase.app'

    if not os.path.exists(key_path):
        print(f"Error: Credentials not found at {key_path}")
        return

    # 2. Init Firebase
    try:
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred, {'databaseURL': db_url})
    except Exception as e:
        print(f"Failed to init Firebase: {e}")
        return

    # 3. Handle Command
    num_to_gen = 5
    if len(sys.argv) > 1:
        try:
            num_to_gen = int(sys.argv[1])
        except:
            pass

    print(f"--- GRiD UP License Porter ---")
    print(f"Generating {num_to_gen} new master keys...")

    ref = db.reference('license_keys')
    new_keys = []

    for _ in range(num_to_gen):
        key = generate_key()
        ref.child(key).set({
            'status': 'active',
            'machineId': '',
            'owner': 'unassigned',
            'generatedAt': {'.sv': 'timestamp'}
        })
        new_keys.append(key)
        print(f"[CREATED] {key}")

    print("\n--- Summary ---")
    print(f"Successfully pushed {len(new_keys)} keys to the database.")
    print("Drivers can now activate the app using these keys.")

if __name__ == "__main__":
    main()
