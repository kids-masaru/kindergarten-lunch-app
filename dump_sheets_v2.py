import sys
import os
sys.path.append(os.getcwd())

from backend.sheets import get_db_connection

def dump_sheet(wb, name, log_file):
    log_file.write(f"\n--- SHEET: {name} ---\n")
    try:
        ws = wb.worksheet(name)
        rows = ws.get_all_values()
        for i, row in enumerate(rows[:10]):
            log_file.write(f"Row {i+1}: {row}\n")
    except Exception as e:
        log_file.write(f"Error reading {name}: {e}\n")

try:
    wb = get_db_connection()
    with open('utf8_dump.txt', 'w', encoding='utf-8') as f:
        if wb:
            dump_sheet(wb, "kindergartens", f)
            dump_sheet(wb, "classes", f)
            dump_sheet(wb, "orders", f)
        else:
            f.write("FAILED TO CONNECT\n")
    print("Dump completed to utf8_dump.txt")
except Exception as e:
    print(f"ERROR: {e}")
