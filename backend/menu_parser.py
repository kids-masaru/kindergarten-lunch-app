import pandas as pd
import datetime
from typing import Dict, List, Optional, Tuple
from backend.models import MenuDish, DailyMenu, MenuTable, normalize_key

def parse_menu_excel(file_path: str, year: int, month: int) -> MenuTable:
    """
    Parses the Menu Excel file and returns a structured MenuTable object.
    """
    print(f"Parsing menu file: {file_path}")
    try:
        xl = pd.ExcelFile(file_path)
    except Exception as e:
        print(f"Failed to open Excel file: {e}")
        raise e
    
    table = MenuTable(year=year, month=month)
    
    # 1. Parse '原紙' (Base Menu)
    base_sheet_name = next((s for s in xl.sheet_names if '原紙' in s), None)
    if not base_sheet_name:
        print("Warning: No '原紙' sheet found. Using first sheet.")
        base_sheet_name = xl.sheet_names[0]
    
    print(f"Using '{base_sheet_name}' as Base Sheet")
    base_menus, special_menus = parse_sheet(xl, base_sheet_name, year, month)
    table.base_menus = base_menus
    table.special_menus = special_menus
    
    print(f"Base Menus parsed: {len(base_menus)}")
    print(f"Special Menus parsed: {len(special_menus)}")

    # 2. Parse Kindergarten Specific Sheets
    for sheet_name in xl.sheet_names:
        if sheet_name == base_sheet_name:
            continue
            
        try:
            # Inspection showed that sometimes H1 isn't what we expect or sheet structure varies.
            # But let's try the H1 heuristic.
            df_head = pd.read_excel(xl, sheet_name=sheet_name, header=None, nrows=5)
            if df_head.shape[1] > 7:
                k_name = str(df_head.iloc[0, 7]).strip()
                if k_name and k_name.lower() != 'nan':
                    print(f"Found Kindergarten Sheet: {sheet_name} for {k_name}")
                    k_menus, k_special = parse_sheet(xl, sheet_name, year, month)
                    
                    if k_name not in table.kindergarten_sheets:
                        table.kindergarten_sheets[k_name] = {}
                    
                    # Store normal menus found in this sheet as overrides
                    table.kindergarten_sheets[k_name].update(k_menus)
                    
                    # Also merging special menus if any specific ones found here?
                    # For now, let's just stick to daily menus.
        except Exception as e:
            print(f"Error checking sheet {sheet_name}: {e}")

    return table

def parse_sheet(xl: pd.ExcelFile, sheet_name: str, year: int, month: int) -> Tuple[Dict[datetime.date, DailyMenu], Dict[str, DailyMenu]]:
    """
    Parses a single sheet to extract Dated Menus and Special Menus.
    """
    try:
        df = pd.read_excel(xl, sheet_name=sheet_name, header=None)
    except Exception as e:
        print(f"Error reading sheet {sheet_name}: {e}")
        return {}, {}
    
    base_menus = {}
    special_menus = {}
    
    # 1. Find Header Row
    header_row_idx = -1
    for i, row in df.iterrows():
        # Check first few columns for "日"
        found = False
        for col_idx in [0, 1]: 
            val = str(row[col_idx]).strip()
            if val in ["日", "Day", "日にち", "日付"]:
                header_row_idx = i
                found = True
                break
        if found:
            break
            
    if header_row_idx == -1:
        header_row_idx = 1
        
    # 2. Iterate Data
    data_start_idx = header_row_idx + 1
    
    COL_DATE = 0
    COL_MENU = 1
    COL_ING_RED = 2
    COL_CALORIE = 6 
    
    current_date_val: Optional[datetime.date] = None
    current_special_key: Optional[str] = None
    
    for i in range(data_start_idx, len(df)):
        row = df.iloc[i]
        col0_text = str(row[COL_DATE]).strip()
        col1_text = str(row[COL_MENU]).strip()
        
        if col0_text in ['nan', '', 'None'] and col1_text in ['nan', '', 'None']:
            continue
        
        if col0_text in ['（曜）', '曜']:
            continue
            
        is_new_date = False
        
        try:
            day_num = int(float(col0_text))
            if 1 <= day_num <= 31:
                try:
                    new_date = datetime.date(year, month, day_num)
                    is_new_date = True
                except ValueError: 
                    pass
        except:
            pass
            
        if is_new_date:
            current_date_val = new_date
            current_special_key = None 
        elif col0_text and col0_text not in ['nan', '', 'None']:
            current_special_key = col0_text
            current_date_val = None 
        
        menu_name = col1_text
        if menu_name in ['nan', '', 'None']:
            if current_special_key and not current_date_val:
                 pass # Might be header row for special menu?
            else:
                 continue

        energy = None
        try:
            val = str(row[COL_CALORIE]).strip()
            if val and val.lower() != 'nan':
                 energy = float(val)
        except:
            pass
            
        dish = MenuDish(
            dish_name=menu_name,
            ingredients=str(row[COL_ING_RED]) if str(row[COL_ING_RED]) != 'nan' else "",
            nutrition_energy=energy
        )
        
        if current_date_val:
            if current_date_val not in base_menus:
                 base_menus[current_date_val] = DailyMenu(date=current_date_val, dishes=[], total_energy=0)
            
            base_menus[current_date_val].dishes.append(dish)
            # Update total energy (sum of dishes? or just take the last non-null?)
            # Usually energy is per meal, not per dish in this sheet format if merged.
            # But let's sum if multiple dishes have values, or overwrite.
            if energy:
                base_menus[current_date_val].total_energy = energy 
                
        elif current_special_key:
            if current_special_key not in special_menus:
                special_menus[current_special_key] = DailyMenu(meal_type=current_special_key, dishes=[], total_energy=0)
            
            special_menus[current_special_key].dishes.append(dish)
            if energy:
                 special_menus[current_special_key].total_energy = energy
            
    return base_menus, special_menus
