import sys
import os
import datetime
import traceback

# Add project root to path
# We are in tests/, so .. is root
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

print(f"Project root added to path: {project_root}")

try:
    from backend.menu_parser import parse_menu_excel
    print("Successfully imported parse_menu_excel")
except ImportError as e:
    print(f"ImportError: {e}")
    traceback.print_exc()
    sys.exit(1)
except Exception as e:
    print(f"Error during import: {e}")
    traceback.print_exc()
    sys.exit(1)

def test_parser():
    file_path = "メニュー表2026.2 -2.xlsx"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    print(f"Testing parser on: {file_path}")
    try:
        table = parse_menu_excel(file_path, 2026, 2)
        
        print("\n--- Base Menus Sample ---")
        for date, menu in list(table.base_menus.items())[:3]:
            print(f"Date: {date}")
            for dish in menu.dishes:
                print(f"  - {dish.dish_name} ({dish.nutrition_energy} kcal)")
                
        print("\n--- Special Menus Sample ---")
        for name, menu in list(table.special_menus.items())[:5]:
            print(f"Name: {name}")
            for dish in menu.dishes:
                print(f"  - {dish.dish_name}")

        print("\n--- Kindergarten Sheets ---")
        for k_name, menus in table.kindergarten_sheets.items():
            print(f"Kindergarten: {k_name} ({len(menus)} menus)")
            
    except Exception as e:
        print(f"Error during execution: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    test_parser()
