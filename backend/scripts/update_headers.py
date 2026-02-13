import os
import sys
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.sheets import get_db_connection

def update_headers():
    wb = get_db_connection()
    if not wb:
        print("Failed to connect to spreadsheet")
        return
    
    ws = wb.worksheet('kindergartens')
    headers = ws.row_values(1)
    new_headers = headers.copy()
    
    dirty = False
    if 'has_soup' not in new_headers:
        new_headers.append('has_soup')
        dirty = True
    if 'curry_trigger' not in new_headers:
        new_headers.append('curry_trigger')
        dirty = True
        
    if dirty:
        ws.update('A1', [new_headers])
        print(f"Updated headers: {new_headers}")
    else:
        print("Headers already up to date")

if __name__ == "__main__":
    update_headers()
