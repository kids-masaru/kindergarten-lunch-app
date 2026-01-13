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
    
    try:
        # Upsert Logic with Explicit Row Calculation
        wb = get_db_connection()
        if not wb: return False
        sheet = wb.worksheet("Order_Data")

        # Get all Order IDs (Column A)
        # This is our source of truth for row positions
        order_ids = sheet.col_values(1) 
        
        target_id = order_row.get('order_id')
        row_index = -1
        
        if target_id and target_id in order_ids:
            # UPDATE: ID exists
            print(f"[DEBUG] Found existing ID {target_id} at index {order_ids.index(target_id) + 1}")
            row_index = order_ids.index(target_id) + 1 # 1-based index
        else:
            # INSERT: ID not found, append to end
            # +1 because 1-based, +1 for next empty row
            row_index = len(order_ids) + 1
            print(f"[DEBUG] New ID {target_id}. Appending to row {row_index}")

        # Update the row explicitly
        # Range A{row}:J{row}
        cell_range = f"A{row_index}:J{row_index}"
        sheet.update(cell_range, [row_values])
            
        return True
    except Exception as e:
        print(f"Error saving order: {e}")
        return False

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

def update_kindergarten_master(kindergarten_id, data):
    """
    Update Kindergarten_Master sheet data.
    data: dict containing keys to update (e.g. {'service_mon': True})
    """
    try:
        wb = get_db_connection()
        if not wb: return False
        sheet = wb.worksheet("Kindergarten_Master")
        
        all_records = sheet.get_all_records()
        headers = sheet.row_values(1)
        
        # Find row index
        row_index = -1
        for i, record in enumerate(all_records):
            if str(record.get('kindergarten_id')) == kindergarten_id:
                row_index = i + 2 # +1 for 0-index, +1 for header
                break
        
        if row_index == -1:
            print(f"Kindergarten ID {kindergarten_id} not found")
            return False
            
        # Update each field
        for key, value in data.items():
            if key in headers:
                col_index = headers.index(key) + 1
                # Convert booleans to TRUE/FALSE strings for Sheets if needed, or let gspread handle it
                # gspread handles python types well usually
                sheet.update_cell(row_index, col_index, value)
            else:
                print(f"Warning: Column {key} not found in Kindergarten_Master")
                
        return True
    except Exception as e:
        print(f"Error updating kindergarten master: {e}")
        return False

def update_all_classes_for_kindergarten(kindergarten_id, new_classes):
    """
    Replace all classes for a specific kindergarten with the new list.
    new_classes: List of dicts [{'class_name': '...', 'grade': '...', ...}]
    """
    print(f"[DEBUG_SHEET] update_all_classes called for {kindergarten_id}")
    try:
        wb = get_db_connection()
        if not wb: 
            print("[ERROR_SHEET] No DB connection")
            return False
        sheet = wb.worksheet("Class_Master")
        
        # 1. Get current data
        all_records = sheet.get_all_records()
        headers = sheet.row_values(1)
        print(f"[DEBUG_SHEET] Headers found: {headers}")
        print(f"[DEBUG_SHEET] Total records before update: {len(all_records)}")
        
        # Helper for fuzzy key access
        def get_fuzzy_val(db_record, possible_clean_keys):
            for k, v in db_record.items():
                clean_k = str(k).replace('#', '').strip()
                if clean_k in possible_clean_keys:
                    return v
            return None

        # 2. Filter out classes belonging to this kindergarten
        target_id_str = str(kindergarten_id).strip()
        kept_records = []
        
        for r in all_records:
            # Check ID using fuzzy match
            r_id = str(get_fuzzy_val(r, ['kindergarten_id', '幼稚園ID']) or '').strip()
            if r_id != target_id_str:
                kept_records.append(r)
                
        print(f"[DEBUG_SHEET] Records kept (other kindergartens): {len(kept_records)}")
        
        # 3. Prepare new rows
        new_rows_dicts = []
        for cls in new_classes:
            row_dict = {
                'kindergarten_id': kindergarten_id,
                'class_name': cls.get('class_name'),
                'floor': cls.get('floor', ''), 
                'grade': cls.get('grade'),
                'default_student_count': cls.get('default_student_count', 0),
                'default_allergy_count': cls.get('default_allergy_count', 0),
                'default_teacher_count': cls.get('default_teacher_count', 0)
            }
            new_rows_dicts.append(row_dict)
        print(f"[DEBUG_SHEET] New records to append: {len(new_rows_dicts)}")
            
        # Combine kept records and new records
        final_records = kept_records + new_rows_dicts
        
        # 4. Convert back to list of lists for writing
        rows_to_write = [headers] # First row is header
        
        for record in final_records:
            row = []
            for h in headers:
                # Determine what this header 'h' maps to in our clean keys
                clean_h = str(h).replace('#', '').strip()
                
                # If record is a NEW row (from row_dict), it has clean keys
                # If record is a KEPT row (from gspread), it has original dirty keys
                
                # Try to find value for this header
                val = ""
                # Case A: Record has the exact header key (KEPT rows)
                if h in record:
                    val = record[h]
                # Case B: Record has the clean key (NEW rows)
                elif clean_h in record:
                    val = record[clean_h]
                
                row.append(val)
            
            rows_to_write.append(row)
            
        print(f"[DEBUG_SHEET] Total rows to write: {len(rows_to_write)}")

        # 5. Write to sheet
        sheet.clear()
        sheet.update('A1', rows_to_write)
        print("[DEBUG_SHEET] Update successful")
        
        return True
    except Exception as e:
        print(f"[ERROR_SHEET] Exception in update_all_classes: {e}")
        import traceback
        traceback.print_exc()
        return False
