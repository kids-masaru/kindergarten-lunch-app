import sys
import os
import datetime
import json

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.menu_parser import parse_menu_excel
from backend.models import DailyMenu, MenuDish

def serialize_menu(menu: DailyMenu):
    return {
        "date": str(menu.date) if menu.date else None,
        "dishes": [{"name": d.dish_name, "energy": d.nutrition_energy} for d in menu.dishes],
        "total_energy": menu.total_energy
    }

def verify():
    file_path = "メニュー表2026.2 -2.xlsx"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    try:
        table = parse_menu_excel(file_path, 2026, 2)
        
        result = {
            "base_menus_count": len(table.base_menus),
            "special_menus_count": len(table.special_menus),
            "base_menus_sample": [serialize_menu(m) for m in list(table.base_menus.values())[:3]],
            "special_menus_sample": [serialize_menu(m) for m in list(table.special_menus.values())[:3]],
            "kindergarten_sheets": list(table.kindergarten_sheets.keys())
        }
        
        with open("tests/parser_result.json", "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
            
        print("JSON written successfully")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify()
