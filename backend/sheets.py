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
