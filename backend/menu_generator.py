import pandas as pd
import datetime
import os
import json
from typing import Dict, List, Optional
from backend.models import MenuTable, DailyMenu, MenuDish, normalize_key
from backend.drive import upload_file_to_drive, download_file_from_drive

# Directory to store Menu Masters (JSON) and Generated Files
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(DATA_DIR, exist_ok=True)

def save_menu_master(table: MenuTable):
    """Saves the parsed MenuTable to a JSON file and uploads to Drive."""
    filename = f"menu_master_{table.year}_{table.month}.json"
    filepath = os.path.join(DATA_DIR, filename)
    
    # Serialization logic handling Pydantic v1/v2 compatibility
    with open(filepath, 'w', encoding='utf-8') as f:
        # Try Pydantic v2
        if hasattr(table, 'model_dump_json'):
             # v2
             f.write(table.model_dump_json())
        else:
             # v1 - .json() should work, but ensure_ascii might be an issue in some versions?
             # Let's try standard json dumps on .dict() with date handler
             def json_serial(obj):
                if isinstance(obj, (datetime.date, datetime.datetime)):
                    return obj.isoformat()
                raise TypeError (f"Type {type(obj)} not serializable")
                
             json.dump(table.dict(), f, default=json_serial, ensure_ascii=False, indent=2)
             
    # Upload to Drive
    # Upload to Drive
    print(f"Uploading Master to Drive: {filename}")
    try:
        upload_file_to_drive(filepath, filename, mime_type='application/json')
    except Exception as e:
        print(f"[WARNING] Failed to upload Master to Drive (likely quota issue): {e}")
        # Continue execution even if backup fails
             
    return filepath

def load_menu_master(year: int, month: int) -> Optional[MenuTable]:
    """Loads a MenuTable from JSON (Downloads from Drive if needed)."""
    filename = f"menu_master_{year}_{month}.json"
    filepath = os.path.join(DATA_DIR, filename)
    
    if not os.path.exists(filepath):
        # Try to download from Drive
        print(f"Local master not found. Checking Drive for: {filename}")
        success = download_file_from_drive(filename, filepath)
        if not success:
            return None
        
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        return MenuTable(**data)

import openpyxl
from openpyxl.utils import get_column_letter

TEMPLATE_FILE = os.path.join(DATA_DIR, 'template.xlsx')

def generate_kondate_excel(kindergarten_id: str, year: int, month: int, options: Dict) -> str:
    """
    Generates the Kondate Excel for a specific kindergarten using template.xlsx.
    """
    # 1. Load Master
    master = load_menu_master(year, month)
    if not master:
        raise ValueError(f"Menu Master not found for {year}-{month}")

    # 2. Resolve Daily Menus
    daily_schedule = resolve_daily_menus(master, kindergarten_id, options)
    
    # 3. Load Template
    if not os.path.exists(TEMPLATE_FILE):
        # Fallback to simple excel if template missing
        print(f"[WARNING] Template not found at {TEMPLATE_FILE}. Generating simple file.")
        return generate_simple_excel(daily_schedule, kindergarten_id, year, month)

    wb = openpyxl.load_workbook(TEMPLATE_FILE)
    ws = wb.active # Use the first sheet
    
    # 4. Fill Logic
    # Start Left: Row 8. 
    # Wrap after Row 73 -> Move to Col J (index 10), Row 5.
    
    current_row = 8
    current_col_offset = 0 # 0 for A-H, 9 for J-Q (J is index 10, but offset from A is 9)
    
    sorted_dates = sorted(daily_schedule.keys())
    
    for d in sorted_dates:
        menu = daily_schedule[d]
        
        # Check for wrap-around
        if current_row + 5 > 73 and current_col_offset == 0:
            current_row = 5
            current_col_offset = 9 # Moves window from A-H to J-Q (J is 10th col)
        
        # Fill Date (Col A + offset)
        # ws.cell(row=current_row, column=1 + current_col_offset, value=d.day) # Date
        # ws.cell(row=current_row + 1, column=1 + current_col_offset, value=d.strftime("%a")) # Day
        # Actually user said A7 is date, A8 is day in the SOURCE. 
        # For TEMPLATE, let's assume Row 1 of block is date, Row 2 is day.
        ws.cell(row=current_row, column=1 + current_col_offset, value=d.day)
        
        # Fill Dishes (Up to 6)
        for i, dish in enumerate(menu.dishes[:6]):
            r = current_row + i
            # B: Menu (offset 1)
            ws.cell(row=r, column=2 + current_col_offset, value=dish.dish_name)
            # C-E: Ingredients (Handled as one or separate? Let's join for now if not sure)
            ws.cell(row=r, column=3 + current_col_offset, value=dish.ingredients)
            # F: Seasoning
            ws.cell(row=r, column=6 + current_col_offset, value=dish.seasoning)
            # H: Remarks
            ws.cell(row=r, column=8 + current_col_offset, value=dish.remarks)
            
        # Fill Nutrition totals in Col G (offset 6)
        # G1: Energy, G3: Protein, G5: Lipid (within block)
        if menu.total_energy:
            ws.cell(row=current_row + 1, column=7 + current_col_offset, value=menu.total_energy)
        if menu.total_protein:
            ws.cell(row=current_row + 3, column=7 + current_col_offset, value=menu.total_protein)
        if hasattr(menu, 'total_lipid') and menu.total_lipid:
            ws.cell(row=current_row + 5, column=7 + current_col_offset, value=menu.total_lipid)

        current_row += 6 # Next block

    # Update Title (Usually somewhere in the top)
    ws['A1'] = f"{year}年 {month}月 献立表"
    ws['E1'] = options.get('kindergarten_name', '幼稚園')

    # 5. Save
    output_filename = f"kondate_{kindergarten_id}_{year}_{month}.xlsx"
    output_path = os.path.join(DATA_DIR, output_filename)
    wb.save(output_path)
    
    return output_path

def generate_simple_excel(schedule: Dict, kid: str, y: int, m: int) -> str:
    # Existing simple generation as fallback
    rows = []
    for d, menu in schedule.items():
        rows.append({"Date": d, "Menu": ", ".join([dish.dish_name for dish in menu.dishes])})
    df = pd.DataFrame(rows)
    path = os.path.join(DATA_DIR, f"kondate_{kid}_{y}_{m}.xlsx")
    df.to_excel(path, index=False)
    return path

def resolve_daily_menus(master: MenuTable, kindergarten_id: str, options: Dict) -> Dict[datetime.date, DailyMenu]:
    """
    Core Logic: Merges Base + Special + Allergy + Options to produce final daily menus.
    """
    schedule = {}
    
    # 1. Kindergarten Settings
    settings = options.get('settings', {})
    is_catering = settings.get('course_type') == "配膳"
    has_curry = settings.get('has_curry_day', False)
    has_bread = settings.get('has_bread_day', False)
    
    # 2. Iterate days
    for date, base_menu in master.base_menus.items():
        final_menu = base_menu
        
        # Check override for "Catering" (Allergy menu might be used as basis for Catering?)
        # Or maybe it has a separate sheet.
        # For now, let's assume "Allergy" menu is the one used for Catering or Specific needs.
        if is_catering and date in master.allergy_menus:
             final_menu = master.allergy_menus[date]

        # Check for Special Events
        events = options.get('events', {})
        event_name = events.get(str(date))
        if event_name in master.special_menus:
             final_menu = master.special_menus[event_name]
             final_menu.date = date

        schedule[date] = final_menu
        
    return schedule
