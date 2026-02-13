import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import time
from datetime import datetime

# Setup
CREDENTIALS_FILE = "lunch-order-app-484107-7b748f233fe2.json"
SCOPE = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
EXISTING_ID = "1HUihz5FQMUgJ97p9SnzLzMfiZ4XRidummqpLNFvF74o"

def restructure_existing_database():
    print(f"🚀 Restructuring Existing Database: {EXISTING_ID}")
    
    # Auth
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, SCOPE)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(EXISTING_ID)

    # 1. Create a dummy sheet to allow deleting others
    print("Preparing restructuring...")
    temp = spreadsheet.add_worksheet(title="RESTRUCTURING_IN_PROGRESS", rows=1, cols=1)
    
    # 2. Delete all existing sheets
    for ws in spreadsheet.worksheets():
        if ws.title != "RESTRUCTURING_IN_PROGRESS":
            print(f"Deleting sheet: {ws.title}")
            spreadsheet.del_worksheet(ws)
            time.sleep(1)

    # 3. Setup New Tabs
    print("Creating new tabs...")

    # Kindergartens Tab
    print("- Creating 'kindergartens'...")
    ws_k = spreadsheet.add_worksheet(title="kindergartens", rows=100, cols=20)
    headers_k = ["kindergarten_id", "name", "mon", "tue", "wed", "thu", "fri", "sat", "sun", "services", "login_id", "password"]
    mock_k = [
        ["K001", "ひまわり幼稚園", 1, 1, 1, 1, 1, 0, 0, "通常, カレー, 誕生日会", "hmw123", "pass123"],
        ["K002", "さくら保育園", 1, 1, 1, 1, 1, 1, 0, "通常, スープつき", "skr456", "pass456"]
    ]
    ws_k.update('A1', [headers_k] + mock_k)
    time.sleep(2)

    # Classes Tab
    print("- Creating 'classes'...")
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
    print("- Creating 'orders'...")
    ws_o = spreadsheet.add_worksheet(title="orders", rows=2000, cols=20)
    headers_o = ["order_id", "date", "kindergarten_id", "class_name", "meal_type", "student_count", "allergy_count", "teacher_count", "memo", "updated_at"]
    today = datetime.now().strftime('%Y-%m-%d')
    mock_o = [
         [f"{today}_K001_ひばり組", today, "K001", "ひばり組", "通常", 25, 2, 2, "Fresh Rebuild", datetime.now().strftime('%Y-%m-%d %H:%M:%S')]
    ]
    ws_o.update('A1', [headers_o] + mock_o)
    time.sleep(2)

    # Masters Tab
    print("- Creating 'masters'...")
    ws_m = spreadsheet.add_worksheet(title="masters", rows=100, cols=20)
    headers_m = ["master_key", "value", "description"]
    mock_m = [
        ["meal_types", "通常, カレー, 誕生日会, スープつき, 飯なし", "利用可能なメニュー種別一覧"]
    ]
    ws_m.update('A1', [headers_m] + mock_m)
    time.sleep(2)

    # 4. Cleanup temp sheet
    print("Cleaning up...")
    spreadsheet.del_worksheet(temp)

    print("\n" + "="*50)
    print("FINISHED SUCCESSFULLY!")
    print(f"DATABASE_RESTRUCTURED={EXISTING_ID}")
    print("="*50)

if __name__ == "__main__":
    restructure_existing_database()
