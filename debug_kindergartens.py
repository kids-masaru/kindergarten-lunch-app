import sys
import os
sys.path.append(os.getcwd())

try:
    from backend.sheets import get_kindergartens
    print("Executing get_kindergartens()...")
    results = get_kindergartens()
    print(f"Results count: {len(results)}")
    for k in results:
        print(f" - {k.name} ({k.kindergarten_id})")
except Exception as e:
    import traceback
    print("CRITICAL ERROR:")
    traceback.print_exc()

# Also try raw access to see header
try:
    from backend.sheets import get_db_connection
    wb = get_db_connection()
    if wb:
        ws = wb.worksheet("kindergartens")
        print("\nKindergartens Sheet Headers:")
        print(ws.row_values(1))
        print("\nFirst row of data:")
        print(ws.row_values(2))
except Exception as e:
    print(f"Raw access error: {e}")
