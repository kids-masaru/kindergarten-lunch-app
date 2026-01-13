import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import json
from dotenv import load_dotenv

load_dotenv()

# Spreadsheet ID should be in .env
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
CREDENTIALS_FILE = "service_account.json"

def get_db_connection():
    """Connect to Google Sheets and return the workbook object."""
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    
    creds = None
    
    # 1. Try environment variable (for Railway/Cloud)
    json_creds = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if json_creds:
        try:
            creds_dict = json.loads(json_creds)
            creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        except Exception as e:
            print(f"Error loading credentials from env: {e}")

    # 2. Try local file (for development)
    if not creds and os.path.exists(CREDENTIALS_FILE):
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
    
    if not creds:
        # Fallback for when no credentials found
        print("Warning: No Google Credentials found (Env or File).")
        return None

    client = gspread.authorize(creds)
    
    if not SPREADSHEET_ID:
        print("Warning: SPREADSHEET_ID not set in .env")
        return None
        
    try:
        return client.open_by_key(SPREADSHEET_ID)
    except Exception as e:
        print(f"Error connecting to spreadsheet: {e}")
        return None

def get_kindergarten_master():
    """Fetch Kindergarten_Master sheet data."""
    try:
        wb = get_db_connection()
        if not wb: return []
        sheet = wb.worksheet("Kindergarten_Master")
        return sheet.get_all_records()
    except Exception as e:
        print(f"Error fetching Kindergarten_Master: {e}")
        return []

def get_class_master():
    """Fetch Class_Master sheet data."""
    try:
        wb = get_db_connection()
        if not wb: return []
        sheet = wb.worksheet("Class_Master")
        return sheet.get_all_records()
    except Exception as e:
        print(f"Error fetching Class_Master: {e}")
        return []

def get_order_data(month_prefix=None):
    """
    Fetch Order_Data. 
    Optional: filter by month (simple client-side filter here for simplicity DB-side).
    Realistically simpler to fetch all and filter, or query if data grows large.
    """
    wb = get_db_connection()
    if not wb: return []
    try:
        sheet = wb.worksheet("Order_Data")
        return sheet.get_all_records()
    except Exception as e:
        print(f"Error fetching Order_Data: {e}")
        return []

def save_order(order_row):
    """
    Save or Update an order row.
    order_row: dict
    """
    wb = get_db_connection()
    if not wb: return False
    sheet = wb.worksheet("Order_Data")
    
    # Check if exists (simple check by ID)
    # This is a naive implementation; for production, bulk updates or row-finding is better
    # For now, append new row.
    
    # Format values as list based on headers
    # Headers: order_id, kindergarten_id, date, class_name, meal_type, student_count, allergy_count, teacher_count, memo, updated_at
    
    row_values = [
        order_row.get('order_id'),
        order_row.get('kindergarten_id'),
        order_row.get('date'),
        order_row.get('class_name'),
        order_row.get('meal_type'),
        order_row.get('student_count'),
        order_row.get('allergy_count'),
        order_row.get('teacher_count'),
        order_row.get('memo'),
        order_row.get('updated_at')
    ]
    
    # TODO: Implement update logic if order_id exists
    # For MVP, we'll just append. Real app should update.
    sheet.append_row(row_values)
    return True

def update_class_master(kindergarten_id, class_name, data):
    """
    Update a specific class's master data.
    data: dict containing default_student_count, etc.
    """
    try:
        wb = get_db_connection()
        if not wb: return False
        sheet = wb.worksheet("Class_Master")
        
        # 1. Fetch all data to find the row index
        # This is expensive for large sheets but fine for this scale
        all_records = sheet.get_all_records()
        
        # 2. Find row index (1-based, +1 for header)
        row_index = -1
        for i, record in enumerate(all_records):
            if str(record.get('kindergarten_id')) == kindergarten_id and \
               str(record.get('class_name')) == class_name:
                row_index = i + 2 # +1 for 0-index, +1 for header
                break
        
        if row_index == -1:
            return False
            
        # 3. Update cells
        # Assumes headers: kindergarten_id, class_name, floor, grade, default_student_count, default_allergy_count, default_teacher_count
        # We need to map data keys to column indices or use update_cell logic
        
        # Finding column indices from headers
        headers = sheet.row_values(1)
        
        updates = []
        if 'default_student_count' in data:
            col = headers.index('default_student_count') + 1
            sheet.update_cell(row_index, col, data['default_student_count'])
            
        if 'default_allergy_count' in data:
            col = headers.index('default_allergy_count') + 1
            sheet.update_cell(row_index, col, data['default_allergy_count'])
            
        if 'default_teacher_count' in data:
            col = headers.index('default_teacher_count') + 1
            sheet.update_cell(row_index, col, data['default_teacher_count'])
            
        return True
    except Exception as e:
        print(f"Error updating class master: {e}")
        return False
