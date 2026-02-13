import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import json
import time
from datetime import datetime
from dotenv import load_dotenv
from typing import List, Dict, Optional, Any
from backend.models import KindergartenMaster, ClassMaster, OrderData, normalize_key

load_dotenv(override=True)

def get_db_connection():
    """Connect to Google Sheets and return the workbook object."""
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds = None
    
    # Reload env just in case
    load_dotenv()
    spreadsheet_id = os.getenv("SPREADSHEET_ID")
    print(f"DEBUG: Using spreadsheet_id=[{spreadsheet_id}]")
    credentials_file = "lunch-order-app-484107-7b748f233fe2.json"

    # 1. Try environment variable (for Railway/Cloud)
    json_creds = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if json_creds:
        try:
            creds_dict = json.loads(json_creds)
            creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        except Exception as e:
            print(f"Error loading credentials from env: {e}")

    # 2. Try local file (for development)
    if not creds and os.path.exists(credentials_file):
        creds = ServiceAccountCredentials.from_json_keyfile_name(credentials_file, scope)
    
    if not creds:
        print("Warning: No Google Credentials found.")
        return None

    client = gspread.authorize(creds)
    if not spreadsheet_id:
        print("Warning: SPREADSHEET_ID not set in .env")
        return None
        
    try:
        return client.open_by_key(spreadsheet_id)
    except Exception as e:
        print(f"Error connecting to spreadsheet {spreadsheet_id}: {e}")
        return None

# --- New Optimized Data Access ---

def get_kindergartens() -> List[KindergartenMaster]:
    """Fetch all kindergartens from the flat 'kindergartens' sheet."""
    try:
        wb = get_db_connection()
        if not wb: return []
        ws = wb.worksheet("kindergartens")
        records = ws.get_all_records()
        
        results = []
        for r in records:
            # Map common variants if needed
            data = {
                "kindergarten_id": r.get("kindergarten_id"),
                "name": r.get("name"),
                "login_id": r.get("login_id"),
                "password": r.get("password"),
                "service_mon": bool(r.get("mon", 1)),
                "service_tue": bool(r.get("tue", 1)),
                "service_wed": bool(r.get("wed", 1)),
                "service_thu": bool(r.get("thu", 1)),
                "service_fri": bool(r.get("fri", 1)),
                "service_sat": bool(r.get("sat", 0)),
                "service_sun": bool(r.get("sun", 0)),
                "services": [s.strip() for s in str(r.get("services", "")).split(",") if s.strip()]
            }
            results.append(KindergartenMaster(**data))
        return results
    except Exception as e:
        print(f"Error in get_kindergartens: {e}")
        return []

def get_classes_for_kindergarten(kindergarten_id: str) -> List[ClassMaster]:
    """Fetch classes for a specific kindergarten from the flat 'classes' sheet."""
    try:
        wb = get_db_connection()
        if not wb: return []
        ws = wb.worksheet("classes")
        records = ws.get_all_records()
        
        # Filter by kindergarten_id
        filtered = [r for r in records if str(r.get("kindergarten_id")) == str(kindergarten_id)]
        return [ClassMaster(**r) for r in filtered]
    except Exception as e:
        print(f"Error in get_classes_for_kindergarten: {e}")
        return []

def get_orders_for_month(kindergarten_id: str, year: int, month: int) -> List[OrderData]:
    """Fetch orders for a specific kindergarten and month from the flat 'orders' sheet."""
    try:
        wb = get_db_connection()
        if not wb: return []
        ws = wb.worksheet("orders")
        records = ws.get_all_records()
        
        # Filter by kindergarten_id and month
        month_prefix = f"{year}-{month:02d}"
        results = []
        for r in records:
            if str(r.get("kindergarten_id")) == str(kindergarten_id):
                order_date = str(r.get("date", ""))
                if order_date.startswith(month_prefix):
                    results.append(OrderData(**r))
        return results
    except Exception as e:
        print(f"Error in get_orders_for_month: {e}")
        return []

def batch_save_orders(orders: List[Dict]) -> bool:
    """
    Save multiple orders efficiently.
    If order_id exists, update. If not, append.
    """
    try:
        wb = get_db_connection()
        if not wb: return False
        ws = wb.worksheet("orders")
        
        all_rows = ws.get_all_values()
        headers = all_rows[0]
        id_col = headers.index("order_id") + 1
        
        # Map existing IDs to row indices
        existing_ids = {row[id_col-1]: i+1 for i, row in enumerate(all_rows) if i > 0}
        
        updates = []
        new_rows = []
        
        for order in orders:
            # Add updated_at
            order["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Construct row list
            row_vals = []
            for h in headers:
                row_vals.append(order.get(h, ""))
            
            oid = order.get("order_id")
            if oid in existing_ids:
                row_idx = existing_ids[oid]
                # Update entire row
                range_label = f"A{row_idx}:{gspread.utils.rowcol_to_a1(row_idx, len(headers))}"
                updates.append({'range': range_label, 'values': [row_vals]})
            else:
                new_rows.append(row_vals)
                
        # Perform updates in batch
        if updates:
            ws.batch_update(updates)
            
        # Append new rows in one go
        if new_rows:
            ws.append_rows(new_rows)
            
        return True
    except Exception as e:
        print(f"Error in batch_save_orders: {e}")
        return False

def update_kindergarten_classes(kindergarten_id: str, classes: List[Dict]) -> bool:
    """Batch update or replace classes for a kindergarten."""
    try:
        wb = get_db_connection()
        if not wb: return False
        ws = wb.worksheet("classes")
        all_rows = ws.get_all_values()
        headers = all_rows[0]
        
        # 1. Identify which rows belong to this kindergarten
        # We'll just collect all rows and keep/replace them
        new_all_rows = [headers]
        
        # Keep other kindergartens' classes
        for i, row in enumerate(all_rows):
            if i == 0: continue
            # Find kindergarten_id column
            kid_idx = headers.index("kindergarten_id")
            if str(row[kid_idx]) != str(kindergarten_id):
                new_all_rows.append(row)
        
        # 2. Add the new/updated classes for THIS kindergarten
        for c in classes:
            row_vals = []
            for h in headers:
                val = c.get(h, "")
                if h == "kindergarten_id": val = kindergarten_id
                row_vals.append(val)
            new_all_rows.append(row_vals)
            
        # 3. Overwrite the sheet
        ws.clear()
        ws.update("A1", new_all_rows)
        return True
    except Exception as e:
        print(f"Error in update_kindergarten_classes: {e}")
        return False

def update_class_counts(kindergarten_id: str, class_name: str, counts: Dict) -> bool:
    """Update base class counts in the 'classes' sheet."""
    try:
        wb = get_db_connection()
        if not wb: return False
        ws = wb.worksheet("classes")
        
        records = ws.get_all_records()
        headers = ws.row_values(1)
        
        # Find row
        row_idx = -1
        for i, r in enumerate(records):
            if str(r.get("kindergarten_id")) == str(kindergarten_id) and r.get("class_name") == class_name:
                row_idx = i + 2
                break
        
        if row_idx == -1: return False
        
        # Update cells
        updates = []
        for key, val in counts.items():
            if key in headers:
                col_idx = headers.index(key) + 1
                updates.append({
                    'range': gspread.utils.rowcol_to_a1(row_idx, col_idx),
                    'values': [[val]]
                })
        
        if updates:
            ws.batch_update(updates)
        return True
    except Exception as e:
        print(f"Error in update_class_counts: {e}")
        return False

def update_kindergarten_master(data: Dict) -> bool:
    """Update kindergarten master settings (e.g., service days)."""
    try:
        wb = get_db_connection()
        if not wb: return False
        ws = wb.worksheet("kindergartens")
        
        records = ws.get_all_records()
        headers = ws.row_values(1)
        
        kid = data.get("kindergarten_id")
        if not kid: return False
        
        # Find row
        row_idx = -1
        for i, r in enumerate(records):
            if str(r.get("kindergarten_id")) == str(kid):
                row_idx = i + 2
                break
        
        if row_idx == -1: return False
        
        mapping = {
            "service_mon": "mon", "service_tue": "tue", "service_wed": "wed",
            "service_thu": "thu", "service_fri": "fri", "service_sat": "sat", "service_sun": "sun",
            "has_soup": "has_soup", "curry_trigger": "curry_trigger"
        }
        
        updates = []
        for api_key, sheet_key in mapping.items():
            if api_key in data and sheet_key in headers:
                col_idx = headers.index(sheet_key) + 1
                val = data[api_key]
                # Special handling for booleans saved as 1/0 if needed, 
                # but if the user wants true/false as strings or booleans, let's keep it consistent.
                # Usually we use 1/0 for service days.
                if isinstance(val, bool):
                    val = 1 if val else 0
                
                updates.append({
                    'range': gspread.utils.rowcol_to_a1(row_idx, col_idx),
                    'values': [[val]]
                })
        
        # Handle "services" (comma separated)
        if "services" in data and "services" in headers:
            col_idx = headers.index("services") + 1
            services_val = ",".join(data["services"])
            updates.append({
                'range': gspread.utils.rowcol_to_a1(row_idx, col_idx),
                'values': [[services_val]]
            })

        if updates:
            ws.batch_update(updates)
        return True
    except Exception as e:
        print(f"Error in update_kindergarten_master: {e}")
        return False

# --- Legacy Compatibility / Wrappers ---
# We keep these for now to avoid breaking main.py immediately

def save_order(order: Dict) -> bool:
    return batch_save_orders([order])

def update_class_master(kindergarten_id, class_name, data):
    return update_class_counts(kindergarten_id, class_name, data)

def get_kindergarten_master() -> List[KindergartenMaster]:
    return get_kindergartens()

def get_class_master() -> List[ClassMaster]:
    # This might need to be filtered in calling code or rewritten
    wb = get_db_connection()
    if not wb: return []
    ws = wb.worksheet("classes")
    return [ClassMaster(**r) for r in ws.get_all_records()]
