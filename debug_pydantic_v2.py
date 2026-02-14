import sys
import os
import json
import traceback
sys.path.append(os.getcwd())

with open('pydantic_debug.txt', 'w', encoding='utf-8') as f:
    try:
        from backend.sheets import get_db_connection
        from backend.models import KindergartenMaster
        
        f.write("Connecting to spreadsheet...\n")
        wb = get_db_connection()
        ws = wb.worksheet("kindergartens")
        records = ws.get_all_records()
        
        f.write(f"Found {len(records)} records.\n")
        
        for i, r in enumerate(records):
            f.write(f"\nProcessing record {i+1}:\n")
            f.write(json.dumps(r, indent=2, ensure_ascii=False) + "\n")
            
            data = {
                "kindergarten_id": r.get("kindergarten_id"),
                "name": r.get("name"),
                "login_id": r.get("login_id"),
                "password": r.get("password"),
                "service_mon": bool(r.get("mon", 1)),
                "service_tue": bool(r.get("tue", 1)),
                "service_wed": bool(r.get("wed", 1)),
                "service_thu": bool(r.get("thu", 1)),
                "service_fri": bool(r.get("fri", 1)),
                "service_sat": bool(r.get("sat", 0)),
                "service_sun": bool(r.get("sun", 0)),
                "services": [s.strip() for s in str(r.get("services", "")).split(",") if s.strip()],
                "has_soup": bool(r.get("has_soup", False)),
                "curry_trigger": str(r.get("curry_trigger", ""))
            }
            
            f.write("Constructed data dict:\n")
            f.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
            
            try:
                k = KindergartenMaster(**data)
                f.write(f"SUCCESS: Created {k.name}\n")
            except Exception as ve:
                f.write(f"VALIDATION ERROR on record {i+1}:\n")
                f.write(str(ve) + "\n")
                
    except Exception as e:
        f.write("CRITICAL ERROR during script execution:\n")
        traceback.print_exc(file=f)

print("Debug finished. Check pydantic_debug.txt")
