import gspread
from oauth2client.service_account import ServiceAccountCredentials
from googleapiclient.discovery import build
import os
import json
import time
from datetime import datetime

# Setup
CREDENTIALS_FILE = "lunch-order-app-484107-7b748f233fe2.json"
SCOPE = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]

def setup_new_database():
    print("🚀 Starting Fresh Database Setup...")
    
    # Auth
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, SCOPE)
    client = gspread.authorize(creds)
    drive_service = build('drive', 'v3', credentials=creds)

    # 1. Create Spreadsheet
    title = f"給食注文システム_新データベース_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    print(f"Creating Spreadsheet: {title}...")
    spreadsheet = client.create(title)
    spreadsheet_id = spreadsheet.id
    print(f"✅ Created! ID: {spreadsheet_id}")
    time.sleep(2)

    # 2. Share
    print("Sharing with anyone with the link as editor...")
    drive_service.permissions().create(
        fileId=spreadsheet_id,
        body={'type': 'anyone', 'role': 'writer'},
        fields='id'
    ).execute()
    print(f"✅ Shared! URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")
    time.sleep(2)

    # 3. Setup Tabs
    print("Setting up tabs and mock data...")

    # Kindergartens Tab
    print("- Setting up 'kindergartens'...")
    ws_k = spreadsheet.get_worksheet(0)
    ws_k.update_title("kindergartens")
    headers_k = ["kindergarten_id", "name", "mon", "tue", "wed", "thu", "fri", "sat", "sun", "services", "login_id", "password"]
    mock_k = [
        ["K001", "ひまわり幼稚園", 1, 1, 1, 1, 1, 0, 0, "通常, カレー, 誕生日会", "hmw123", "pass123"],
        ["K002", "さくら保育園", 1, 1, 1, 1, 1, 1, 0, "通常, スープつき", "skr456", "pass456"]
    ]
    ws_k.update('A1', [headers_k] + mock_k)
    time.sleep(2)

    # Classes Tab
    print("- Setting up 'classes'...")
    ws_c = spreadsheet.add_worksheet(title="classes", rows=100, cols=20)
    headers_c = ["kindergarten_id", "class_name", "grade", "default_student_count", "default_allergy_count", "default_teacher_count"]
    mock_c = [
        ["K001", "ひばり組", "年長", 25, 2, 2],
        ["K001", "つばめ組", "年中", 20, 1, 2],
        ["K002", "ぞう組", "1歳児", 15, 0, 3]
    ]
    ws_c.update('A1', [headers_c] + mock_c)
    time.sleep(2)

    # Orders Tab
    print("- Setting up 'orders'...")
    ws_o = spreadsheet.add_worksheet(title="orders", rows=1000, cols=20)
    headers_o = ["order_id", "date", "kindergarten_id", "class_name", "meal_type", "student_count", "allergy_count", "teacher_count", "memo", "updated_at"]
    today = datetime.now().strftime('%Y-%m-%d')
    mock_o = [
         [f"{today}_K001_ひばり組", today, "K001", "ひばり組", "通常", 25, 2, 2, "Initial Setup Test", datetime.now().strftime('%Y-%m-%d %H:%M:%S')]
    ]
    ws_o.update('A1', [headers_o] + mock_o)
    time.sleep(2)

    # Masters Tab
    print("- Setting up 'masters'...")
    ws_m = spreadsheet.add_worksheet(title="masters", rows=100, cols=20)
    headers_m = ["master_key", "value", "description"]
    mock_m = [
        ["meal_types", "通常, カレー, 誕生日会, スープつき, 飯なし", "利用可能なメニュー種別一覧"]
    ]
    ws_m.update('A1', [headers_m] + mock_m)

    print("\n" + "="*50)
    print("FINISHED SUCCESSFULLY!")
    print(f"NEW_SPREADSHEET_ID={spreadsheet_id}")
    print(f"SPREADSHEET_URL=https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")
    print("="*50)
    
    return spreadsheet_id

if __name__ == "__main__":
    setup_new_database()
