import sys
import os
import datetime

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.menu_parser import parse_menu_excel
from backend.menu_generator import save_menu_master, load_menu_master, generate_kondate_excel

def test_flow():
    print("1. Parsing Excel...")
    file_path = "メニュー表2026.2 -2.xlsx"
    if not os.path.exists(file_path):
        print("File not found")
        return

    table = parse_menu_excel(file_path, 2026, 2)
    print(f"Parsed {len(table.base_menus)} base menus.")
    
    print("2. Saving Master...")
    json_path = save_menu_master(table)
    print(f"Saved to {json_path}")
    
    print("3. Loading Master...")
    loaded_table = load_menu_master(2026, 2)
    if loaded_table:
        print(f"Loaded successfully. Base menus: {len(loaded_table.base_menus)}")
    else:
        print("Failed to load.")
        return

    print("4. Generating Excel for 'Test Kindergarten'...")
    # Mock Options
    options = {
        "kindergarten_name": "ふたば", # Should match sheet name to test override
        "events": {
             # Test Special Menu Override
             "2026-02-10": "お誕生日会" # Assuming this key exists in special menus
        }
    }
    
    output_path = generate_kondate_excel("K001", 2026, 2, options)
    print(f"Generated Excel at: {output_path}")
    
    if os.path.exists(output_path):
        print("SUCCESS: Output file exists.")
    else:
        print("FAILURE: Output file missing.")

if __name__ == "__main__":
    test_flow()
