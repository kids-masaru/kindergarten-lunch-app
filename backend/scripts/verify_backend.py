import os
import json
from dotenv import load_dotenv
from backend.sheets import (
    get_kindergartens,
    get_classes_for_kindergarten,
    get_orders_for_month,
    batch_save_orders
)

load_dotenv()

def verify():
    print("🔍 Starting Backend Verification...")
    
    # 1. Kindergartens
    k_list = get_kindergartens()
    print(f"- Kindergartens found: {len(k_list)}")
    for k in k_list[:2]:
        print(f"  - {k.name} ({k.kindergarten_id})")

    if not k_list:
        print("❌ FAILED: No kindergartens found.")
        return

    kid = k_list[0].kindergarten_id

    # 2. Classes
    c_list = get_classes_for_kindergarten(kid)
    print(f"- Classes for {kid}: {len(c_list)}")
    for c in c_list:
        print(f"  - {c.class_name} (Student: {c.default_student_count})")

    # 3. Orders
    o_list = get_orders_for_month(kid, 2026, 2)
    print(f"- Orders for {kid} in 2026-02: {len(o_list)}")

    # 4. Batch Save Test
    test_order = {
        "order_id": "VERIFY_TEST_999",
        "date": "2026-02-15",
        "kindergarten_id": kid,
        "class_name": c_list[0].class_name if c_list else "TestClass",
        "meal_type": "通常",
        "student_count": 10,
        "allergy_count": 1,
        "teacher_count": 1,
        "memo": "Verification Test"
    }
    print("- Testing batch_save_orders...")
    success = batch_save_orders([test_order])
    print(f"  - Success: {success}")

    if success:
         # Cleanup test order
         # (Actually we can just leave it or manually delete later)
         pass

    print("\n✅ Verification Script Finished.")

if __name__ == "__main__":
    verify()
