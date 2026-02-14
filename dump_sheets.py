import sys
import os
sys.path.append(os.getcwd())

from backend.sheets import get_db_connection

def dump_sheet(wb, name):
    print(f"\n--- SHEET: {name} ---")
    try:
        ws = wb.worksheet(name)
        rows = ws.get_all_values()
        for i, row in enumerate(rows[:5]):
            print(f"Row {i+1}: {row}")
    except Exception as e:
        print(f"Error reading {name}: {e}")

try:
    wb = get_db_connection()
    if wb:
        dump_sheet(wb, "kindergartens")
        dump_sheet(wb, "classes")
        dump_sheet(wb, "orders")
    else:
        print("FAILED TO CONNECT")
except Exception as e:
    print(f"ERROR: {e}")
