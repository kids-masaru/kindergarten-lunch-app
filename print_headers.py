import sys
import os
sys.path.append(os.getcwd())

from backend.sheets import get_db_connection
try:
    wb = get_db_connection()
    if wb:
        ws = wb.worksheet("kindergartens")
        print("HEADERS:")
        print(ws.row_values(1))
        print("FIRST ROW:")
        print(ws.row_values(2))
    else:
        print("FAILED TO CONNECT")
except Exception as e:
    print(f"ERROR: {e}")
