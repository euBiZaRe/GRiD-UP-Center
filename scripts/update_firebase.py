import os
import json
import firebase_admin
from firebase_admin import credentials, db

def update_firebase():
    # 1. Environment Check
    service_account_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    tag_name = os.environ.get('GITHUB_REF_NAME', 'v1.0.0') # e.g. v1.1.0
    
    if not service_account_json:
        print("Error: FIREBASE_SERVICE_ACCOUNT not found in environment.")
        return

    # 2. Extract Version (strip 'v')
    version = tag_name.lstrip('v')
    
    # 3. Construct Public Download URL
    # Replace 'GRiD-UP-Center' with your PUBLIC releases repository name
    public_repo = "GRiD-UP-Center"
    file_name = "GRiD-UP-Performance-Center.exe"
    download_url = f"https://github.com/euBiZaRe/{public_repo}/releases/download/{tag_name}/{file_name}"

    try:
        # 4. Initialize Firebase
        cred_dict = json.loads(service_account_json)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred, {
            'databaseURL': 'https://grid-up-racedash-default-rtdb.europe-west1.firebasedatabase.app'
        })

        # 5. Push Metadata
        ref = db.reference('system_config')
        ref.update({
            'version': version,
            'updateUrl': download_url,
            'isCritical': False # Can be manually set to True in the console for forced updates
        })

        print(f"Firebase updated successfully to version {version}")
        print(f"Download URL set to: {download_url}")

    except Exception as e:
        print(f"Failed to update Firebase: {e}")

if __name__ == "__main__":
    update_firebase()
