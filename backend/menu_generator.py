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

def generate_kondate_excel(kindergarten_id: str, year: int, month: int, options: Dict) -> str:
    """
    Generates the Kondate Excel for a specific kindergarten.
    Returns the path to the generated file.
    """
    # 1. Load Master
    master = load_menu_master(year, month)
    if not master:
        raise ValueError(f"Menu Master not found for {year}-{month}")

    # 2. Logic to determine Menu per Day
    # This involves:
    # - Getting Kindergarten Settings (Service days, Bread days, etc.) -> From API/Sheets
    # - Getting Kindergarten Orders (Event Names) -> From API/Sheets
    # - Resolving: Base Menu vs Special Menu vs Kindergarten-Specific Sheet
    
    # Placeholder for logic
    daily_schedule = resolve_daily_menus(master, kindergarten_id, options)
    
    # 3. Create DataFrame
    # Columns: Date, Day, Menu Name, Ingredients..., Nutrition
    rows = []
    
    sorted_dates = sorted(daily_schedule.keys())
    for d in sorted_dates:
        menu = daily_schedule[d]
        # Flatten dishes? Or concatenated string?
        # Usually one row per dish or one row per meal with multiline text?
        # Let's try one row per Dish for now (easier to read)
        # Or one row per Day with joined strings.
        
        main_dish_names = []
        ingredients = []
        energy = menu.total_energy or 0
        
        for dish in menu.dishes:
            main_dish_names.append(dish.dish_name)
            if dish.ingredients:
                ingredients.append(dish.ingredients)
                
        # Simple Join
        row = {
            "Date": d,
            "Day": d.strftime("%a"),
            "Menu": "\n".join(main_dish_names),
            "Ingredients": "\n".join(ingredients),
            "Energy (kcal)": energy
        }
        rows.append(row)
        
    df = pd.DataFrame(rows)
    
    # 4. Save to Excel
    output_filename = f"kondate_{kindergarten_id}_{year}_{month}.xlsx"
    output_path = os.path.join(DATA_DIR, output_filename)
    
    df.to_excel(output_path, index=False)
    
    return output_path

def resolve_daily_menus(master: MenuTable, kindergarten_id: str, options: Dict) -> Dict[datetime.date, DailyMenu]:
    """
    Core Logic: Merges Base + Special + Options to produce final daily menus.
    """
    schedule = {}
    
    # Iterate all days in the month
    # (Simplified: just use days present in Base Menu)
    for date, base_menu in master.base_menus.items():
        # Default to Base Menu
        final_menu = base_menu
        
        # Check for Kindergarten Specific Overrides (e.g. "ふたば" sheet in Excel)
        # Need to know the Kindergarten Name matching the Sheet Name!
        # This requires a mapping: ID -> Name.
        k_name = options.get('kindergarten_name', '')
        if k_name in master.kindergarten_sheets:
            if date in master.kindergarten_sheets[k_name]:
                final_menu = master.kindergarten_sheets[k_name][date]
                
        # Check for Special Events (e.g. Birthday)
        # If options has "events": {date: "Birthday Party"}
        # And master.special_menus has "Birthday Party"
        # Then override.
        events = options.get('events', {})
        event_name = events.get(str(date)) # JSON keys are strings
        if event_name:
            # Normalize key?
            # master.special_menus keys are raw strings from Excel
            # Try exact match first
            if event_name in master.special_menus:
                 final_menu = master.special_menus[event_name]
                 final_menu.date = date # Assign date to special menu instance
            else:
                 # Fallback: Fuzzy match or log warning?
                 pass

        schedule[date] = final_menu
        
    return schedule
