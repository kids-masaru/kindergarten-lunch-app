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

def parse_sheet(xl: pd.ExcelFile, sheet_name: str, year: int, month: int) -> Tuple[Dict[datetime.date, DailyMenu], Dict[datetime.date, DailyMenu]]:
    """
    Parses a single sheet to extract Normal Menus and Allergy Menus using 6-row blocks.
    Returns (normal_menus, allergy_menus)
    """
    try:
        # We need to read the whole sheet without header to handle the blocks precisely
        df = pd.read_excel(xl, sheet_name=sheet_name, header=None)
    except Exception as e:
        print(f"Error reading sheet {sheet_name}: {e}")
        return {}, {}
    
    normal_menus = {}
    allergy_menus = {}
    
    # 1. Identify Data Start
    # User says B5 starts the menu. So index 4.
    # However, let's find the first row that has a date in Col A.
    # The user said blocks are 5-10, 11-16, etc.
    # Start Row index is typically 4 (Row 5).
    
    start_row = 4 
    block_size = 6
    
    # We iterate through the sheet in blocks of 6
    for block_start in range(start_row, len(df), block_size):
        block = df.iloc[block_start : block_start + block_size]
        if len(block) < block_size: break
        
        # --- Normal Menu (Cols A-H) ---
        # A: Date info usually at block_start + 2 (Row 7) and + 3 (Row 8)
        # But let's check for date in the first column of the block
        date_val = None
        # Try to find day number in block (Col A)
        for r_idx in range(6):
            val = str(block.iloc[r_idx, 0]).strip()
            try:
                # User says A7(idx 2) is date, A8(idx 3) is day
                day_num = int(float(val))
                if 1 <= day_num <= 31:
                    date_val = datetime.date(year, month, day_num)
                    break 
            except:
                continue
        
        if not date_val:
            continue # Skip blocks without a day number
            
        # Extract Normal Menu (Col B-H)
        # B: 献立, C: 赤, D: 黄, E: 緑, F: 調味料, G: 栄養, H: 備考
        
        # Nutrition in Col G (idx 6)
        # G5(idx 0): Energy Label, G6(idx 1): Value
        # G7(idx 2): Protein Label, G8(idx 3): Value
        # G9(idx 4): Lipid Label, G10(idx 5): Value
        def get_nut(row_in_block):
            try:
                v = str(block.iloc[row_in_block, 6]).strip()
                return float(v) if v and v.lower() != 'nan' else None
            except: return None

        energy = get_nut(1)
        protein = get_nut(3)
        lipid = get_nut(5)
        
        # Dishes (Normal)
        # User implies the menu spans 6 rows in B. We'll join them or take the non-empty ones.
        n_dishes = []
        for r_idx in range(6):
            name = str(block.iloc[r_idx, 1]).strip()
            if name and name.lower() != 'nan':
                dish = MenuDish(
                    dish_name=name,
                    ingredients=", ".join(filter(None, [
                        str(block.iloc[r_idx, 2]).strip() if str(block.iloc[r_idx, 2]).strip() != 'nan' else None,
                        str(block.iloc[r_idx, 3]).strip() if str(block.iloc[r_idx, 3]).strip() != 'nan' else None,
                        str(block.iloc[r_idx, 4]).strip() if str(block.iloc[r_idx, 4]).strip() != 'nan' else None
                    ])),
                    seasoning=str(block.iloc[r_idx, 5]).strip() if str(block.iloc[r_idx, 5]).strip() != 'nan' else None,
                    remarks=str(block.iloc[r_idx, 7]).strip() if str(block.iloc[r_idx, 7]).strip() != 'nan' else None
                )
                n_dishes.append(dish)
        
        if n_dishes:
            normal_menus[date_val] = DailyMenu(
                date=date_val, 
                dishes=n_dishes,
                total_energy=energy,
                total_protein=protein,
                total_lipid=lipid
            )

        # --- Allergy Menu (Cols J-Q) ---
        # J: idx 9 (Date), K: idx 10 (Menu) ... P: idx 15 (Nut), Q: idx 16 (Rem)
        a_dishes = []
        # Nutrition in Col P (idx 15)
        energy_a = None
        try:
             v = str(block.iloc[1, 15]).strip()
             energy_a = float(v) if v and v.lower() != 'nan' else None
        except: pass

        for r_idx in range(6):
            name = str(block.iloc[r_idx, 10]).strip()
            if name and name.lower() != 'nan':
                dish = MenuDish(
                    dish_name=name,
                    ingredients=", ".join(filter(None, [
                        str(block.iloc[r_idx, 11]).strip() if str(block.iloc[r_idx, 11]).strip() != 'nan' else None,
                        str(block.iloc[r_idx, 12]).strip() if str(block.iloc[r_idx, 12]).strip() != 'nan' else None,
                        str(block.iloc[r_idx, 13]).strip() if str(block.iloc[r_idx, 13]).strip() != 'nan' else None
                    ])),
                    seasoning=str(block.iloc[r_idx, 14]).strip() if str(block.iloc[r_idx, 14]).strip() != 'nan' else None,
                    remarks=str(block.iloc[r_idx, 16]).strip() if str(block.iloc[r_idx, 16]).strip() != 'nan' else None
                )
                a_dishes.append(dish)
        
        if a_dishes:
            allergy_menus[date_val] = DailyMenu(
                date=date_val,
                meal_type="Allergy",
                dishes=a_dishes,
                total_energy=energy_a
            )

    return normal_menus, allergy_menus
