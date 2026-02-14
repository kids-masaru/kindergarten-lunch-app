import sys
import os
sys.path.append(os.getcwd())

from backend.sheets import get_classes_for_kindergarten, get_db_connection

def verify_migration():
    print("--- Verifying Migration ---")
    try:
        wb = get_db_connection()
        ws = wb.worksheet("classes")
        headers = ws.row_values(1)
        print(f"Current Headers: {headers}")
        if "effective_from" in headers:
            print("SUCCESS: effective_from header found.")
        else:
            print("FAILURE: effective_from header NOT found.")
            
        print("\n--- Verifying Fetching Logic ---")
        classes = get_classes_for_kindergarten("K001", "2026-03-15")
        print(f"Fetched {len(classes)} classes for 2026-03-15")
        for c in classes:
            print(f"- {c.class_name}: {c.default_student_count} (Effective: {c.effective_from})")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_migration()
