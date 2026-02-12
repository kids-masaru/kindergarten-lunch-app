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
    base_menus, allergy_menus, special_menus = parse_sheet(xl, base_sheet_name, year, month)
    table.base_menus = base_menus
    table.allergy_menus = allergy_menus
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
                    k_menus, k_allergy, k_special = parse_sheet(xl, sheet_name, year, month)
                    
                    if k_name not in table.kindergarten_sheets:
                        table.kindergarten_sheets[k_name] = {}
                    
                    # Store normal menus found in this sheet as overrides
                    table.kindergarten_sheets[k_name].update(k_menus)
                    
                    # Also merging special menus if any specific ones found here?
                    # For now, let's just stick to daily menus.
        except Exception as e:
            print(f"Error checking sheet {sheet_name}: {e}")

    return table

def parse_sheet(xl: pd.ExcelFile, sheet_name: str, year: int, month: int) -> Tuple[Dict[datetime.date, DailyMenu], Dict[datetime.date, DailyMenu], Dict[str, DailyMenu]]:
    """
    Parses a single sheet to extract Normal Menus, Allergy Menus, and Named Special Menus.
    Returns (normal_menus, allergy_menus, special_menus)
    """
    try:
        df = pd.read_excel(xl, sheet_name=sheet_name, header=None)
    except Exception as e:
        print(f"Error reading sheet {sheet_name}: {e}")
        return {}, {}, {}
    
    normal_menus = {}
    allergy_menus = {}
    special_menus = {}
    
    start_row = 4 
    block_size = 6
    
    for block_start in range(start_row, len(df), block_size):
        block = df.iloc[block_start : block_start + block_size]
        if len(block) < block_size: break
        
        # --- Identify Block Trigger (Col A) ---
        date_val = None
        trigger_name = None
        
        for r_idx in range(6):
            val = str(block.iloc[r_idx, 0]).strip()
            if not val or val.lower() == 'nan': continue
            
            try:
                # Try parsing as day number
                day_num = int(float(val))
                if 1 <= day_num <= 31:
                    date_val = datetime.date(year, month, day_num)
                    break
            except:
                # If not a number, it might be a trigger name (like "カレー")
                # Usually triggers are in the first row of the block for that specific dish
                if r_idx == 0: 
                    trigger_name = val
                elif not trigger_name:
                    trigger_name = val
        
        # Helper to extract a 6-row block from specific columns
        def extract_dishes(col_start_idx):
            dishes = []
            for r_idx in range(6):
                name_val = str(block.iloc[r_idx, col_start_idx]).strip()
                name = name_val if name_val.lower() != 'nan' else ""
                
                dish = MenuDish(
                    dish_name=name,
                    ingredients_red=str(block.iloc[r_idx, col_start_idx+1]).strip() if str(block.iloc[r_idx, col_start_idx+1]).strip() != 'nan' else None,
                    ingredients_yellow=str(block.iloc[r_idx, col_start_idx+2]).strip() if str(block.iloc[r_idx, col_start_idx+2]).strip() != 'nan' else None,
                    ingredients_green=str(block.iloc[r_idx, col_start_idx+3]).strip() if str(block.iloc[r_idx, col_start_idx+3]).strip() != 'nan' else None,
                    seasoning=str(block.iloc[r_idx, col_start_idx+4]).strip() if str(block.iloc[r_idx, col_start_idx+4]).strip() != 'nan' else None,
                    remarks=str(block.iloc[r_idx, col_start_idx+6]).strip() if str(block.iloc[r_idx, col_start_idx+6]).strip() != 'nan' else None
                )
                dishes.append(dish)
            return dishes

        def get_nut(col_idx):
            try:
                # En, Pro, Lip at rows 1, 3, 5
                e = float(str(block.iloc[1, col_idx]).strip())
                p = float(str(block.iloc[3, col_idx]).strip())
                l = float(str(block.iloc[5, col_idx]).strip())
                return e, p, l
            except: return None, None, None

        # Process Normal/Special block based on Trigger in Col A
        if date_val or trigger_name:
            e, p, l = get_nut(6)
            dishes = extract_dishes(1)
            
            menu = DailyMenu(
                date=date_val, 
                meal_type=trigger_name or "通常",
                dishes=dishes,
                total_energy=e,
                total_protein=p,
                total_lipid=l
            )
            
            if date_val:
                normal_menus[date_val] = menu
            if trigger_name:
                special_menus[trigger_name] = menu

        # --- Allergy Menu (Cols J-Q) ---
        # Logic remains similar but uses extract_dishes refactor maybe?
        # Actually Allergy usually has its own date in Col J (idx 9).
        a_date_val = None
        for r_idx in range(6):
            v = str(block.iloc[r_idx, 9]).strip()
            try:
                d = int(float(v))
                if 1 <= d <= 31:
                    a_date_val = datetime.date(year, month, d)
                    break
            except: pass

        if a_date_val:
            e_a = None
            try: e_a = float(str(block.iloc[1, 15]).strip())
            except: pass
            
            a_dishes = extract_dishes(10) # K starts at 10
            allergy_menus[a_date_val] = DailyMenu(
                date=a_date_val,
                meal_type="Allergy",
                dishes=a_dishes,
                total_energy=e_a
            )

    return normal_menus, allergy_menus, special_menus
