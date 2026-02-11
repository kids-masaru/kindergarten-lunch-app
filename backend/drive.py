import os
import json
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
from oauth2client.service_account import ServiceAccountCredentials
from typing import Optional
import io

# Load Environment Variables
from dotenv import load_dotenv
load_dotenv()

SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
# We reuse the same credentials file as Sheets
CREDENTIALS_FILE = "service_account.json"
TARGET_FOLDER_NAME = "Mamameal_Data"

def get_drive_service():
    """Authenticates and returns the Drive API service."""
    scope = ["https://www.googleapis.com/auth/drive"]
    creds = None
    
    # 1. Env Var (Railway)
    json_creds = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if json_creds:
        try:
            creds_dict = json.loads(json_creds)
            creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        except Exception as e:
            print(f"Error loading creds from env: {e}")

    # 2. Local File
    if not creds and os.path.exists(CREDENTIALS_FILE):
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
        
    if not creds:
        print("No Google Credentials found.")
        return None
        
    return build('drive', 'v3', credentials=creds)

def get_or_create_folder(folder_name: str) -> Optional[str]:
    """Finds a folder by name or creates it locally (Logic for root). Returns Folder ID."""
    service = get_drive_service()
    if not service: return None
    
    query = f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and trashed=false"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    files = results.get('files', [])
    
    if files:
        return files[0]['id']
    else:
        # Create
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        file = service.files().create(body=file_metadata, fields='id').execute()
        return file.get('id')

def upload_file_to_drive(file_path: str, filename: str, mime_type: str = '*/*') -> Optional[str]:
    """Uploads a local file to the Target Folder in Drive. Returns File ID."""
    service = get_drive_service()
    if not service: return None
    
    folder_id = get_or_create_folder(TARGET_FOLDER_NAME)
    if not folder_id: return None
    
    # Check if file exists to update? Or just create new?
    # Simple: Create new
    media = MediaFileUpload(file_path, mimetype=mime_type)
    file_metadata = {
        'name': filename,
        'parents': [folder_id]
    }
    
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    print(f"File ID: {file.get('id')}")
    return file.get('id')

def download_file_from_drive(filename: str, local_path: str) -> bool:
    """Downloads a file by name from the Target Folder."""
    service = get_drive_service()
    if not service: return False
    
    folder_id = get_or_create_folder(TARGET_FOLDER_NAME)
    if not folder_id: return False
    
    # Find file ID
    query = f"name='{filename}' and '{folder_id}' in parents and trashed=false"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    files = results.get('files', [])
    
    if not files:
        print(f"File {filename} not found in Drive.")
        return False
        
    file_id = files[0]['id']
    request = service.files().get_media(fileId=file_id)
    fh = io.FileIO(local_path, 'wb')
    downloader = MediaIoBaseDownload(fh, request)
    
    done = False
    while done is False:
        status, done = downloader.next_chunk()
        # print(f"Download {int(status.progress() * 100)}%.")
        
    return True

def list_files_in_drive() -> List[str]:
    """List filenames in data folder."""
    service = get_drive_service()
    if not service: return []
    
    folder_id = get_or_create_folder(TARGET_FOLDER_NAME)
    if not folder_id: return []
    
    query = f"'{folder_id}' in parents and trashed=false"
    results = service.files().list(q=query, fields="files(name)").execute()
    return [f['name'] for f in results.get('files', [])]
