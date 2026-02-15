import os
import json
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
from oauth2client.service_account import ServiceAccountCredentials
from typing import Optional, List
import io

# Load Environment Variables
from dotenv import load_dotenv
load_dotenv()

SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
# We reuse the same credentials file as Sheets
CREDENTIALS_FILE = "service_account.json"
TARGET_FOLDER_NAME = "MamaMiRe_Data"

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

# Additional Env Var for Shared Folder
DRIVE_FOLDER_ID = os.getenv("DRIVE_FOLDER_ID")

def verify_folder_access(service, folder_id):
    """Check if we can access the folder."""
    try:
        f = service.files().get(fileId=folder_id, fields="id, name").execute()
        print(f"[DEBUG] Successfully accessed folder: {f.get('name')} ({f.get('id')})")
        return True
    except Exception as e:
        print(f"[ERROR] Cannot access folder {folder_id}. Reason: {e}")
        return False

def get_or_create_folder(folder_name: str) -> Optional[str]:
    """
    Finds a folder by ID (if env set) or name (if not).
    If DRIVE_FOLDER_ID is set, we return it directly.
    """
    service = get_drive_service()
    if not service: return None

    # Debug: Print who we are
    try:
        about = service.about().get(fields="user").execute()
        print(f"[DEBUG] Drive Service Account Email: {about['user']['emailAddress']}")
    except:
        pass

    # 1. Direct ID (Best for Service Accounts with Shared Folders)
    if DRIVE_FOLDER_ID:
        if verify_folder_access(service, DRIVE_FOLDER_ID):
            return DRIVE_FOLDER_ID
        else:
            print(f"[CRITICAL] Configured DRIVE_FOLDER_ID {DRIVE_FOLDER_ID} is not accessible. Falling back to search.")

    # 2. Search by Name (Old Logic - Fails if no storage quota)
    
    query = f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and trashed=false"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    files = results.get('files', [])
    
    if files:
        return files[0]['id']
    else:
        # Create
        try:
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            file = service.files().create(body=file_metadata, fields='id').execute()
            return file.get('id')
        except Exception as e:
            print(f"Failed to create folder (Quota?): {e}")
            return None

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

def upload_icon_file(file_obj, filename: str) -> Optional[str]:
    """
    Uploads an in-memory file object (from FastAPI UploadFile) to the 'Icons' folder in Drive.
    Sets permission to 'anyone with link' and returns the webContentLink.
    """
    service = get_drive_service()
    if not service: return None

    # 1. Get or Create 'Icons' folder inside TARGET_FOLDER
    # First, get root data folder
    root_id = get_or_create_folder(TARGET_FOLDER_NAME)
    if not root_id: return None
    
    # Check for 'Icons' folder inside root
    query = f"mimeType='application/vnd.google-apps.folder' and name='Icons' and '{root_id}' in parents and trashed=false"
    results = service.files().list(q=query, fields="files(id)").execute()
    icons_folder_id = None
    if results.get('files'):
        icons_folder_id = results['files'][0]['id']
    else:
        # Create
        metadata = {
            'name': 'Icons',
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [root_id]
        }
        f = service.files().create(body=metadata, fields='id').execute()
        icons_folder_id = f.get('id')
    
    # 2. Upload File
    # We need MediaIoBaseUpload. Let's import it.
    from googleapiclient.http import MediaIoBaseUpload
    
    # Reset file pointer just in case
    file_obj.seek(0)
    media = MediaIoBaseUpload(file_obj, mimetype='image/png', resumable=True)
    
    file_metadata = {
        'name': filename,
        'parents': [icons_folder_id]
    }
    
    file = service.files().create(body=file_metadata, media_body=media, fields='id, webContentLink, webViewLink, thumbnailLink').execute()
    file_id = file.get('id')
    
    # 3. Make Public
    permission = {
        'type': 'anyone',
        'role': 'reader',
    }
    service.permissions().create(fileId=file_id, body=permission).execute()
    
    # Return a direct-ish link. webContentLink is usually good for download/display if public.
    # thumbnailLink sometimes works better for small embeds, but webContentLink is the standard "raw" link.
    # users often prefer the "uc?id=" hack for true direct embedding.
    # https://drive.google.com/uc?export=view&id={file_id}
    
    return f"https://drive.google.com/uc?export=view&id={file_id}"

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
