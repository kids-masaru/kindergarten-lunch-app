import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import json
from dotenv import load_dotenv
from typing import List, Dict, Optional, Any
from backend.models import KindergartenMaster, ClassMaster, OrderData, normalize_key

load_dotenv()

# Spreadsheet ID should be in .env
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
CREDENTIALS_FILE = "lunch-order-app-484107-7b748f233fe2.json"

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

# --- Helper: Robust Header Mapping ---
def find_col_index(headers: List[str], target_keys: List[str]) -> Optional[int]:
    """
    Find 1-based column index given a list of possible header names.
    normalize_key is used to ignore spaces and '#'.
    """
    cleaned_headers = [normalize_key(h) for h in headers]
    for key in target_keys:
        clean_key = normalize_key(key)
        if clean_key in cleaned_headers:
            return cleaned_headers.index(clean_key) + 1
    return None

def records_to_models(records: List[Dict], ModelClass) -> List[Any]:
    """Convert gspread records to Pydantic models, filtering invalid ones."""
    models = []
    for r in records:
        try:
            # Pydantic's alias matching handles the key mapping if defined in Model
            # We assume gspread returns dicts with keys matching the Sheet Headers
            # The Model should have aliases corresponding to actual Sheet Headers
            
            # Since we allowed extra fields and populate_by_name, this usually works well.
            # However, standard get_all_records uses exact string matching.
            # If sheet has "幼稚園ID" and model expects "kindergarten_id" (alias="幼稚園ID"), it works.
            
            # To be extra robust against "ID" vs "幼稚園ID", we might need to normalize keys first?
            # For now, let's rely on Pydantic's alias feature.
            # We might need to map "Japanese Keys" to "English Keys" if the Model expects English.
            # But here we defined Aliases in the Model to match English (internal) to English (sheet)?
            # Wait, the current sheet likely has Japanese headers or mixed.
            # Let's inspect what the API currently expects. The API uses English keys.
            # So the Sheet likely has English keys OR the code was mapping them previously.
            # The previous code had fuzzy logic: get_val(c, ['kindergarten_id', '幼稚園ID', 'id'])
            # So the sheet could have ANY of these.
            
            # Strategy: Pre-process record keys to match Model fields (English)
            # This is complex. For now, let's trust get_all_records returns what represents the row,
            # and we try to parse it.
            
            # To support the aliases we defined in models.py (which are 1:1 currently), 
            # we need to ensure the incoming dict keys match either the field name OR the alias.
            # The previous fuzzy logic suggests we need to support multiple aliases per field.
            # Pydantic V2 supports validation_alias which can be a list of choices.
            # But we are likely on V1 or simple usage.
            
            # Simplified approach:
            # Check all keys in the record. If any match a known alias, map it to the standard key.
            # But for now, let's just pass the dict to Pydantic and let it try.
            # IMPORTANT: The current models.py uses `alias='kindergarten_id'` which expects exact match.
            # To support '幼稚園ID', we need to manually map or use advanced Pydantic features.
            
            # Let's do a manual map approach for maximum robustness here.
            
            normalized_data = {}
            row_keys_cleaned = {normalize_key(k): v for k, v in r.items()}
            
            # Map for KindergartenMaster
            if ModelClass == KindergartenMaster:
                # Map specific Japanese/Variations to standard keys
                if '幼稚園ID' in r: normalized_data['kindergarten_id'] = r['幼稚園ID']
                elif 'kindergarten_id' in r: normalized_data['kindergarten_id'] = r['kindergarten_id']
                elif 'id' in r: normalized_data['kindergarten_id'] = r['id']
                
                # ... repeat for other fields? Or just let Pydantic handle the English ones if present.
                # If we just merge `r` into `normalized_data`, Pydantic takes what it knows.
                normalized_data.update(r)
                
                # Handle fuzzy keys for critical fields if strictly needed
                def fuzzy_get(keys):
                    for k in keys:
                        nk = normalize_key(k)
                        if nk in row_keys_cleaned: return row_keys_cleaned[nk]
                    return None
                    
                kad = fuzzy_get(['kindergarten_id', '幼稚園ID', 'id'])
                if kad: normalized_data['kindergarten_id'] = kad
                
                nm = fuzzy_get(['name', '幼稚園名', '名称'])
                if nm: normalized_data['name'] = nm
                
                lid = fuzzy_get(['login_id', 'ログインID'])
                if lid: normalized_data['login_id'] = lid
                
                pw = fuzzy_get(['password', 'パスワード', 'pass'])
                if pw: normalized_data['password'] = pw

            elif ModelClass == ClassMaster:
                def fuzzy_get(keys):
                    for k in keys:
                        nk = normalize_key(k)
                        if nk in row_keys_cleaned: return row_keys_cleaned[nk]
                    return None
                
                kid = fuzzy_get(['kindergarten_id', '幼稚園ID'])
                if kid: normalized_data['kindergarten_id'] = kid
                
                cn = fuzzy_get(['class_name', 'クラス名', 'クラス'])
                if cn: normalized_data['class_name'] = cn
                
                gr = fuzzy_get(['grade', '学年'])
                if gr: normalized_data['grade'] = gr
                
                sc = fuzzy_get(['default_student_count', '園児数', '標準園児数'])
                if sc: normalized_data['default_student_count'] = sc

                ac = fuzzy_get(['default_allergy_count', 'アレルギー数', '標準アレルギー数'])
                if ac: normalized_data['default_allergy_count'] = ac

                tc = fuzzy_get(['default_teacher_count', '先生数', '標準先生数'])
                if tc: normalized_data['default_teacher_count'] = tc

                # Merge original to keep others
                # But prioritizing our found values
                base = r.copy()
                base.update(normalized_data)
                normalized_data = base
            
            else:
                 # OrderData (usually standard English keys based on save_order)
                 normalized_data = r

            m = ModelClass(**normalized_data)
            models.append(m)
        except Exception as e:
            # print(f"Skipping invalid row: {e}")
            continue
    return models

# --- Data Access ---

def get_kindergarten_master() -> List[KindergartenMaster]:
    """Fetch Kindergarten_Master sheet data."""
    try:
        wb = get_db_connection()
        if not wb: return []
        sheet = wb.worksheet("Kindergarten_Master")
        records = sheet.get_all_records()
        return records_to_models(records, KindergartenMaster)
    except Exception as e:
        print(f"Error fetching Kindergarten_Master: {e}")
        return []

def get_class_master() -> List[ClassMaster]:
    """Fetch Class_Master sheet data."""
    try:
        wb = get_db_connection()
        if not wb: return []
        sheet = wb.worksheet("Class_Master")
        records = sheet.get_all_records()
        return records_to_models(records, ClassMaster)
    except Exception as e:
        print(f"Error fetching Class_Master: {e}")
        return []

def get_order_data(month_prefix=None) -> List[OrderData]:
    """Fetch Order_Data."""
    wb = get_db_connection()
    if not wb: return []
    try:
        sheet = wb.worksheet("Order_Data")
        records = sheet.get_all_records()
        return records_to_models(records, OrderData)
    except Exception as e:
        print(f"Error fetching Order_Data: {e}")
        return []

def save_order(order_row: Dict) -> bool:
    """Save or Update an order row using Robust Column Mapping."""
    wb = get_db_connection()
    if not wb: return False
    try:
        sheet = wb.worksheet("Order_Data")
        
        # 1. Get Headers to find column indices dynamically
        headers = sheet.row_values(1)
        
        # Define mapping: Model Field -> List of Possible Headers
        # OrderData is newly created by us so we largely control headers, 
        # but to be safe we check common names.
        col_map = {
            'order_id': ['order_id'],
            'kindergarten_id': ['kindergarten_id'],
            'date': ['date'],
            'class_name': ['class_name'],
            'meal_type': ['meal_type'],
            'student_count': ['student_count'],
            'allergy_count': ['allergy_count'],
            'teacher_count': ['teacher_count'],
            'memo': ['memo'],
            'updated_at': ['updated_at']
        }
        
        # Calculate target indices once
        # dict: field_name -> col_index (1-based)
        target_cols = {}
        for field, possibilities in col_map.items():
            idx = find_col_index(headers, possibilities)
            if idx:
                target_cols[field] = idx
            else:
                # If a critical column is missing, we might need to error out or append?
                # For now, if missing, we just won't write to it (safest for updates)
                pass

        # 2. Find Row Index
        # We need to find the row by order_id.
        # We need the column index for 'order_id' first.
        order_id_col = target_cols.get('order_id')
        if not order_id_col:
            print("Error: 'order_id' column not found in Order_Data.")
            return False

        order_ids = sheet.col_values(order_id_col)
        # remove header from search usually, but col_values includes it.
        # order_ids[0] is header.
        
        target_id = order_row.get('order_id')
        row_index = -1
        
        if target_id and target_id in order_ids:
            # Existing Row
            row_index = order_ids.index(target_id) + 1
        else:
            # New Row
            row_index = len(order_ids) + 1
            # If new row, we need to append. 
            # Appending a list is safer than cell updates for new rows because it handles all cols.
            # But constructing the list requires knowing the order of headers.
            
            # Construct row based on current headers
            new_row_list = []
            for h in headers:
                # Find which field this header maps to
                found_field = None
                normalized_h = normalize_key(h)
                
                for field, possibilities in col_map.items():
                    if normalized_h in [normalize_key(p) for p in possibilities]:
                        found_field = field
                        break
                
                if found_field:
                    new_row_list.append(order_row.get(found_field, ""))
                else:
                    new_row_list.append("") # Unknown column, leave empty
            
            sheet.append_row(new_row_list)
            return True

        # 3. Update Cells (For existing row)
        # Using batch_update is better, but update_cell loop is fine for single row update
        cells_to_update = []
        for field, val in order_row.items():
            if field in target_cols:
                col = target_cols[field]
                # gspread update_cell is slow one by one. 
                # Better: Construct a list of Cell objects and update_cells?
                # Or just update_cell for now as it's not frequent.
                sheet.update_cell(row_index, col, val)
        
        return True

    except Exception as e:
        print(f"Error saving order: {e}")
        import traceback
        traceback.print_exc()
        return False

def update_class_master(kindergarten_id, class_name, data):
    """Update class master using robust column finding."""
    try:
        wb = get_db_connection()
        if not wb: return False
        sheet = wb.worksheet("Class_Master")
        
        all_records = sheet.get_all_records()
        headers = sheet.row_values(1)
        
        # 1. Find Row
        # Filter logic similar to models conversion not needed for finding usage, 
        # effectively we just scan.
        row_index = -1
        
        # Helper to check record match robustly
        def record_matches(r):
            # Check ID
            r_kid = str(r.get('kindergarten_id') or r.get('幼稚園ID') or '').strip()
            # Check Class Name
            r_cname = str(r.get('class_name') or r.get('クラス名') or '').strip()
            
            return r_kid == str(kindergarten_id).strip() and r_cname == str(class_name).strip()

        for i, record in enumerate(all_records):
            if record_matches(record):
                row_index = i + 2
                break
        
        if row_index == -1:
            return False
            
        # 2. Update Cells
        # Map data keys to potential headers
        field_header_map = {
            'default_student_count': ['default_student_count', '園児数', '標準園児数'],
            'default_allergy_count': ['default_allergy_count', 'アレルギー数', '標準アレルギー数'],
            'default_teacher_count': ['default_teacher_count', '先生数', '標準先生数']
        }
        
        for key, value in data.items():
            if key in field_header_map:
                col_idx = find_col_index(headers, field_header_map[key])
                if col_idx:
                    sheet.update_cell(row_index, col_idx, value)
                else:
                    print(f"Warning: Column for {key} not found in Class_Master")
                    
        return True
    except Exception as e:
        print(f"Error updating class master: {e}")
        return False

def update_kindergarten_master(kindergarten_id, data):
    """Update kindergarten master using robust column finding."""
    try:
        wb = get_db_connection()
        if not wb: return False
        sheet = wb.worksheet("Kindergarten_Master")
        
        all_records = sheet.get_all_records()
        headers = sheet.row_values(1)
        
        # 1. Find Row
        row_index = -1
        for i, record in enumerate(all_records):
            r_id = str(record.get('kindergarten_id') or record.get('幼稚園ID') or '').strip()
            if r_id == str(kindergarten_id).strip():
                row_index = i + 2
                break
        
        if row_index == -1:
            print(f"Kindergarten ID {kindergarten_id} not found")
            return False
            
        # 2. Update Fields
        # Data keys are from our Internal Model (English).
        # We need to find corresponding Sheet Column (English or Japanese).
        
        # We assume data keys match what we want to find, but we need aliases.
        
        for key, value in data.items():
            # Create a list of candidates. 
            # 1. The key itself (e.g. 'service_mon')
            # 2. Maybe common aliases if strict match fails?
            # For now, let's assume the key itself is enough if using the English template.
            # If Japanese headers used, we need a map.
            
            candidates = [key]
            # Add ad-hoc aliases if known likely
            if key == 'name': candidates.append('幼稚園名')
            
            col_idx = find_col_index(headers, candidates)
            
            if col_idx:
                # If value is a list or dict, serialize to JSON string for the sheet
                if isinstance(value, (list, dict)):
                    value = json.dumps(value, ensure_ascii=False)
                sheet.update_cell(row_index, col_idx, value)
            else:
                print(f"Warning: Column {key} not found in Kindergarten_Master")
                
        return True
    except Exception as e:
        print(f"Error updating kindergarten master: {e}")
        return False

def update_all_classes_for_kindergarten(kindergarten_id, new_classes):
    """
    Replace all classes for a specific kindergarten.
    Robust implementation preserves other columns even if we don't know them.
    """
    print(f"[DEBUG_SHEET] update_all_classes called for {kindergarten_id}")
    try:
        wb = get_db_connection()
        if not wb: return False
        sheet = wb.worksheet("Class_Master")
        
        all_records = sheet.get_all_records()
        headers = sheet.row_values(1)
        
        # 1. Separate records
        target_id_str = str(kindergarten_id).strip()
        kept_records = []
        
        # Helper to checking ID
        def get_id(r):
            return str(r.get('kindergarten_id') or r.get('幼稚園ID') or '').strip()
            
        for r in all_records:
            if get_id(r) != target_id_str:
                kept_records.append(r)
        
        # 2. Convert new_classes (dicts) to match Schema
        # We need to map `new_classes` keys to `headers` structure.
        
        new_rows_data = [] # List of dicts matching header structure
        
        # Define mappings for new class data
        field_map = {
            'kindergarten_id': ['kindergarten_id', '幼稚園ID'],
            'class_name': ['class_name', 'クラス名', 'クラス'],
            'grade': ['grade', '学年'],
            'floor': ['floor', '階'],
            'default_student_count': ['default_student_count', '園児数'],
            'default_allergy_count': ['default_allergy_count', 'アレルギー数'],
            'default_teacher_count': ['default_teacher_count', '先生数']
        }
        
        for cls in new_classes:
            # We want to create a row dict that has keys matching the *actual headers*
            row_data = {}
            
            # Determine which header corresponds to which field
            for field, value in cls.items():
                # Special handling for kindergarten_id injection if missing
                if field == 'kindergarten_id' and not value: value = kindergarten_id
                
                # Find the header for this field
                candidates = field_map.get(field, [field])
                
                # Search headers for match
                matched_header = None
                for h in headers:
                    if normalize_key(h) in [normalize_key(c) for c in candidates]:
                        matched_header = h
                        break
                
                if matched_header:
                    row_data[matched_header] = value
            
            # Ensure kindergarten_id is set
            if not any(k in row_data for k in ['kindergarten_id', '幼稚園ID', 'id']):
                 # Find header for ID
                 for h in headers:
                     if normalize_key(h) in ['kindergarten_id', '幼稚園id', 'id']:
                         row_data[h] = kindergarten_id
                         break
            
            new_rows_data.append(row_data)
            
        # 3. Write ALL records back
        # We execute a full rewrite of the sheet to ensure consistency
        # Combine kept + new
        final_list = kept_records + new_rows_data
        
        rows_to_write = [headers]
        for r in final_list:
            row_vec = []
            for h in headers:
                row_vec.append(r.get(h, ""))
            rows_to_write.append(row_vec)
            
        sheet.clear()
        sheet.update('A1', rows_to_write)
        print("[DEBUG_SHEET] Update successful")
        return True
        
    except Exception as e:
        print(f"[ERROR_SHEET] Exception in update_all_classes: {e}")
        import traceback
        traceback.print_exc()
        return False
