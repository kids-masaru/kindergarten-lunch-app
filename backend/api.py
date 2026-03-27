from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
import threading
from datetime import datetime, timedelta
from backend.sheets import (
    get_kindergartens,
    get_kindergarten_master,
    get_classes_for_kindergarten,
    get_class_master,
    get_orders_for_month,
    batch_save_orders,
    update_class_counts,
    update_kindergarten_master,
    update_kindergarten_classes as update_sheets_classes,
    get_pending_class_snapshots,
    delete_pending_class_snapshot,
    backup_orders_for_class_change,
    restore_orders_from_class_change,
    delete_orders_backup,
    get_system_settings,
    update_system_settings
)
from fastapi import File, UploadFile
from fastapi.responses import FileResponse
import shutil
import os
from backend.menu_parser import parse_menu_excel
from backend.menu_generator import save_menu_master, generate_kondate_excel


router = APIRouter()

# --- Models (API Request/Response) ---
# We keep these separate from Backend Models to decouple API from internal representation if needed.
# But effectively they map closely.

class LoginRequest(BaseModel):
    login_id: str
    password: str

class OrderItem(BaseModel):
    order_id: Optional[str] = None
    kindergarten_id: str
    date: str
    class_name: str
    meal_type: str
    student_count: int
    allergy_count: int
    teacher_count: int
    memo: Optional[str] = ""
    prev_student_count: Optional[int] = None
    prev_allergy_count: Optional[int] = None
    prev_teacher_count: Optional[int] = None

class MonthRequest(BaseModel):
    year: int
    month: int
    kindergarten_id: str

class ClassUpdateRequest(BaseModel):
    kindergarten_id: str
    class_name: str
    default_student_count: int
    default_allergy_count: int
    default_teacher_count: int

class ClassUpdateItem(BaseModel):
    class_name: str
    grade: str
    floor: Optional[str] = ""
    default_student_count: int
    default_allergy_count: int
    default_teacher_count: int
    effective_from: Optional[str] = None

class ClassListUpdateRequest(BaseModel):
    classes: List[ClassUpdateItem]
    skip_notify: bool = False  # True when called from monthly setup

class KindergartenUpdateRequest(BaseModel):
    kindergarten_id: str
    name: Optional[str] = None
    service_mon: Optional[bool] = None
    service_tue: Optional[bool] = None
    service_wed: Optional[bool] = None
    service_thu: Optional[bool] = None
    service_fri: Optional[bool] = None
    service_sat: Optional[bool] = None
    service_sun: Optional[bool] = None

# --- Endpoints ---

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.post("/login")
def login(creds: LoginRequest):
    print(f"[DEBUG] Login attempt for: {creds.login_id}")
    try:
        # Always allow mock login for development
        if creds.login_id == "admin" and creds.password == "pass":
            return {
                "kindergarten_id": "K001",
                "name": "テスト幼稚園",
                "settings": {"has_bread_day": True, "has_curry_day": True}
            }

        kindergartens = get_kindergartens()
        if not kindergartens:
            print("[ERROR] No kindergartens returned from Sheet")
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        print(f"[DEBUG] Fetched {len(kindergartens)} rows from kindergartens sheet")

        input_login_id = str(creds.login_id).strip()
        input_password = str(creds.password).strip()
        
        user = None
        for u in kindergartens:
            if u.login_id == input_login_id:
                user = u
                break
        
        if not user:
            print(f"[DEBUG] User {input_login_id} not found")
            raise HTTPException(status_code=401, detail="Invalid credentials (User not found)")
            
        # Check Password
        if user.password == input_password:
            print(f"[DEBUG] Login successful for {input_login_id}")
            return {
                "kindergarten_id": user.kindergarten_id,
                "name": user.name,
                "services": user.services,
                "contact_name": user.contact_name,
                "contact_email": user.contact_email,
                "classless_student_count": user.classless_student_count,
                "classless_allergy_count": user.classless_allergy_count,
                "classless_teacher_count": user.classless_teacher_count,
                "settings": {
                    # Service Days
                    "service_mon": user.service_mon,
                    "service_tue": user.service_tue,
                    "service_wed": user.service_wed,
                    "service_thu": user.service_thu,
                    "service_fri": user.service_fri,
                    "service_sat": user.service_sat,
                    "service_sun": user.service_sun,
                }
            }
            
        print(f"[DEBUG] Password mismatch for {input_login_id}")
        raise HTTPException(status_code=401, detail="Invalid credentials (Password mismatch)")
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        print(f"[ERROR] Login Exception: {e}")
        traceback.print_exc()
        return {"error": str(e), "traceback": traceback.format_exc()}

@router.get("/masters/{kindergarten_id}")
def get_masters(kindergarten_id: str, date: Optional[str] = None):
    my_classes = get_classes_for_kindergarten(kindergarten_id, date)
    print(f"[DEBUG] Found {len(my_classes)} classes for {kindergarten_id} on {date}")
    # Also return fresh services so client always has the latest meal type options
    kindergartens = get_kindergartens()
    kg = next((k for k in kindergartens if k.kindergarten_id == kindergarten_id), None)
    return {
        "classes": [c.model_dump() for c in my_classes],
        "services": kg.services if kg else [],
        "classless_student_count": kg.classless_student_count if kg else 0,
        "classless_allergy_count": kg.classless_allergy_count if kg else 0,
        "classless_teacher_count": kg.classless_teacher_count if kg else 0,
    }

@router.post("/masters/class")
def update_class(req: ClassUpdateRequest):
    success = update_class_counts(
        req.kindergarten_id,
        req.class_name,
        {
            "default_student_count": req.default_student_count,
            "default_allergy_count": req.default_allergy_count,
            "default_teacher_count": req.default_teacher_count
        }
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update class master")
    return {"status": "success"}

@router.put("/masters/classes/{kindergarten_id}")
def update_kindergarten_classes(kindergarten_id: str, request: ClassListUpdateRequest):
    print(f"[DEBUG] Received class update for {kindergarten_id}")
    try:
        data_to_save = [c.model_dump() for c in request.classes]

        # Detect scheduled_date: if ALL classes have the same effective_from, use it.
        scheduled_date = None
        effective_dates = set(c.effective_from for c in request.classes if c.effective_from)
        if len(effective_dates) == 1:
            candidate = effective_dates.pop()
            today = datetime.now().strftime("%Y-%m-%d")
            if candidate > today:
                scheduled_date = candidate
                print(f"[DEBUG] Scheduled mode: effective_from={scheduled_date}")

        success = update_sheets_classes(kindergarten_id, data_to_save, scheduled_date=scheduled_date)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update classes in sheet")

        # If scheduled (future date), also update existing orders and backup for undo
        if scheduled_date:
            new_class_counts = {
                c.class_name: {
                    "student_count": c.default_student_count,
                    "allergy_count": c.default_allergy_count,
                    "teacher_count": c.default_teacher_count,
                }
                for c in request.classes
            }
            # Fetch existing orders from scheduled_date onwards (3 months)
            from_dt = datetime.strptime(scheduled_date, "%Y-%m-%d")
            affected_orders = []
            for i in range(3):
                yr = from_dt.year + ((from_dt.month - 1 + i) // 12)
                mo = ((from_dt.month - 1 + i) % 12) + 1
                month_orders = get_orders_for_month(kindergarten_id, yr, mo)
                affected_orders += [o for o in month_orders if o.date >= scheduled_date]

            if affected_orders:
                # Backup before overwriting
                backup_orders_for_class_change(
                    kindergarten_id, scheduled_date,
                    [o.model_dump() for o in affected_orders],
                    new_class_counts,
                )
                # Update orders with new counts
                updated = []
                for order in affected_orders:
                    if order.class_name in new_class_counts:
                        d = order.model_dump()
                        d.update(new_class_counts[order.class_name])
                        updated.append(d)
                if updated:
                    batch_save_orders(updated)

        # Send notification in background thread (skip if called from monthly setup)
        if request.skip_notify:
            return {"status": "success", "message": "Classes updated", "scheduled_date": scheduled_date}

        classes_snapshot = list(request.classes)
        _scheduled = scheduled_date

        def _notify_classes():
            try:
                from backend.notifications import send_change_notification
                kindergartens = get_kindergartens()
                kg = next((k for k in kindergartens if k.kindergarten_id == kindergarten_id), None)
                lines = [
                    f"{c.class_name}: 園児 {c.default_student_count}名 / "
                    f"アレルギー {c.default_allergy_count}名 / "
                    f"先生 {c.default_teacher_count}名"
                    for c in classes_snapshot
                ]
                details = "\n".join(lines)
                if _scheduled:
                    details += f"\n（適用日: {_scheduled}）"
                send_change_notification(
                    action="クラスマスター変更",
                    kindergarten_name=kg.name if kg else kindergarten_id,
                    kindergarten_id=kindergarten_id,
                    class_name="(全クラス)",
                    target_date=_scheduled or datetime.now().strftime("%Y-%m-%d"),
                    details=details,
                    contact_name=kg.contact_name if kg else "",
                    contact_email=kg.contact_email if kg else "",
                )
            except Exception as e:
                print(f"[WARNING] Notification failed: {e}")

        threading.Thread(target=_notify_classes, daemon=True).start()

        return {"status": "success", "message": "Classes updated", "scheduled_date": scheduled_date}
    except Exception as e:
        print(f"[CRITICAL ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

@router.put("/masters/kindergarten")
def update_settings(data: Dict):
    """Updates settings for a kindergarten."""
    kid = data.get('kindergarten_id')
    if not kid:
        raise HTTPException(status_code=400, detail="Missing kindergarten_id")
    
    # We pass the dict directly to update_kindergarten_master
    # It will filter keys and map to correct columns
    data['kindergarten_id'] = kid
    success = update_kindergarten_master(data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update Google Sheets")
        
    return {"status": "success"}

@router.get("/calendar")
def get_calendar(kindergarten_id: str, year: int, month: int):
    # Optimized fetch for specific month and kindergarten
    orders = get_orders_for_month(kindergarten_id, year, month)
    return {"orders": [o.model_dump() for o in orders]}

def is_order_locked(order_date_str: str) -> bool:
    """Check if the order date is past the strict deadline (15:00 day before)."""
    try:
        order_date = datetime.strptime(order_date_str, "%Y-%m-%d").date()
        now = datetime.now()
        # Deadline is 15:00 the day before
        lock_deadline = datetime.combine(order_date, datetime.min.time()).replace(hour=15) - timedelta(days=1)
        return now > lock_deadline
    except Exception:
        return False

@router.post("/orders")
def create_order(order: OrderItem):
    if is_order_locked(order.date):
        raise HTTPException(status_code=400, detail="Deadline passed (15:00 day before). Changes are not allowed.")

    if not order.order_id:
        order.order_id = f"{order.date}_{order.kindergarten_id}_{order.class_name}"

    success = batch_save_orders([order.model_dump()])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save order")

    # Queue notification (batched per kindergarten+date within 5 seconds)
    order_snapshot = order.model_dump()
    def _notify():
        try:
            from backend.notifications import queue_order_notification
            kindergartens = get_kindergartens()
            kg = next((k for k in kindergartens if k.kindergarten_id == order_snapshot["kindergarten_id"]), None)

            def _fmt_change(label: str, prev, curr: int) -> str:
                if prev is not None and prev != curr:
                    return f"{label}: {prev}名 → {curr}名"
                return f"{label}: {curr}名"

            details = "\n".join([
                _fmt_change("園児数", order_snapshot.get("prev_student_count"), order_snapshot["student_count"]),
                _fmt_change("アレルギー", order_snapshot.get("prev_allergy_count"), order_snapshot["allergy_count"]),
                _fmt_change("先生", order_snapshot.get("prev_teacher_count"), order_snapshot["teacher_count"]),
            ])
            if order_snapshot.get("memo"):
                details += f"\nメモ: {order_snapshot['memo']}"
            if order_snapshot.get("submitted_by"):
                details += f"\n担当者: {order_snapshot['submitted_by']}"

            contact_email = kg.contact_email if kg else ""
            print(f"[NOTIFY] class={order_snapshot['class_name']} contact_email={contact_email!r}")
            queue_order_notification(
                kindergarten_id=order_snapshot["kindergarten_id"],
                kg_name=kg.name if kg else order_snapshot["kindergarten_id"],
                class_name=order_snapshot["class_name"],
                target_date=order_snapshot["date"],
                details=details,
                contact_name=kg.contact_name if kg else "",
                contact_email=contact_email,
            )
        except Exception as e:
            print(f"[WARNING] Notification failed: {e}")

    threading.Thread(target=_notify, daemon=True).start()

    return {"status": "success", "order_id": order.order_id}

@router.post("/orders/bulk")
def create_orders_bulk(orders: List[OrderItem]):
    """Bulk create orders, used for monthly initialization."""
    data = []
    for o in orders:
        if is_order_locked(o.date):
            continue
        if not o.order_id:
            o.order_id = f"{o.date}_{o.kindergarten_id}_{o.class_name}"
        data.append(o.model_dump())

    success = batch_save_orders(data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save bulk orders")

    # Send single monthly summary notification
    if data:
        first = data[0]
        date_obj = datetime.strptime(first["date"], "%Y-%m-%d")
        def _notify_bulk():
            try:
                from backend.notifications import send_change_notification
                kindergartens = get_kindergartens()
                kg = next((k for k in kindergartens if k.kindergarten_id == first["kindergarten_id"]), None)
                send_change_notification(
                    action=f"{date_obj.year}年{date_obj.month}月分 月次申請",
                    kindergarten_name=kg.name if kg else first["kindergarten_id"],
                    kindergarten_id=first["kindergarten_id"],
                    class_name="(月次申請)",
                    target_date=f"{date_obj.year}-{date_obj.month:02d}",
                    details=f"{date_obj.year}年{date_obj.month}月分の申請が完了しました。\n対象件数: {len(data)}件",
                    contact_name=kg.contact_name if kg else "",
                    contact_email=kg.contact_email if kg else "",
                )
            except Exception as e:
                print(f"[WARNING] Bulk notification failed: {e}")
        threading.Thread(target=_notify_bulk, daemon=True).start()

    return {"status": "success", "count": len(orders)}


class ClasslessDefaultUpdateRequest(BaseModel):
    kindergarten_id: str
    from_date: str
    student_count: int
    allergy_count: int
    teacher_count: int

@router.put("/orders/update-defaults")
def update_order_defaults(request: ClasslessDefaultUpdateRequest):
    """Update all 共通 orders for a classless kindergarten from a given date."""
    try:
        from_date_obj = datetime.strptime(request.from_date, "%Y-%m-%d")

        # Fetch orders for the month of from_date (and next month)
        all_orders = get_orders_for_month(request.kindergarten_id, from_date_obj.year, from_date_obj.month)
        next_month = from_date_obj.month % 12 + 1
        next_year = from_date_obj.year + (1 if from_date_obj.month == 12 else 0)
        all_orders += get_orders_for_month(request.kindergarten_id, next_year, next_month)

        # Filter 共通 orders from from_date onwards
        to_update = [
            o for o in all_orders
            if o.class_name == '共通' and o.date >= request.from_date
        ]

        if not to_update:
            return {"status": "success", "updated": 0, "message": "対象の注文がありませんでした"}

        updated_data = []
        for o in to_update:
            d = o.model_dump()
            d['student_count'] = request.student_count
            d['allergy_count'] = request.allergy_count
            d['teacher_count'] = request.teacher_count
            updated_data.append(d)

        success = batch_save_orders(updated_data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update orders")

        # Send notification in background
        kid_id = request.kindergarten_id
        snap = {
            "from_date": request.from_date,
            "student_count": request.student_count,
            "allergy_count": request.allergy_count,
            "teacher_count": request.teacher_count,
            "updated": len(to_update),
        }
        def _notify_defaults():
            try:
                from backend.notifications import send_change_notification
                kindergartens = get_kindergartens()
                kg = next((k for k in kindergartens if k.kindergarten_id == kid_id), None)
                details = (
                    f"{snap['from_date']} 以降の基本人数を変更しました\n"
                    f"園児数: {snap['student_count']}名\n"
                    f"アレルギー: {snap['allergy_count']}名\n"
                    f"先生: {snap['teacher_count']}名\n"
                    f"（対象: {snap['updated']}件の注文を更新）"
                )
                send_change_notification(
                    action="基本人数変更",
                    kindergarten_name=kg.name if kg else kid_id,
                    kindergarten_id=kid_id,
                    class_name="共通",
                    target_date=snap["from_date"],
                    details=details,
                    contact_name=kg.contact_name if kg else "",
                    contact_email=kg.contact_email if kg else "",
                )
            except Exception as e:
                print(f"[WARNING] Defaults notification failed: {e}")
        threading.Thread(target=_notify_defaults, daemon=True).start()

        return {"status": "success", "updated": len(to_update)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-icon")
async def upload_icon(file: UploadFile = File(...)):
    """
    Uploads an icon image to Google Drive and returns a public URL.
    Fallback: If Drive upload fails (e.g. Quota), returns a resized Base64 Data URI.
    """
    try:
        from backend.drive import upload_icon_file
        
        # Validate content type
        if file.content_type not in ["image/png", "image/jpeg", "image/svg+xml", "image/gif"]:
            raise HTTPException(status_code=400, detail="Invalid image format. Use PNG, JPG, or SVG.")
            
        # Read file into memory
        contents = await file.read()
        file_obj = io.BytesIO(contents)
        
        filename = f"icon_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
        
        # Try Drive Upload first
        public_url = None
        try:
            public_url = upload_icon_file(file_obj, filename)
        except Exception as drive_error:
            print(f"[WARNING] Drive Upload Failed: {drive_error}")
            public_url = None

        if public_url:
             return {"status": "success", "url": public_url}
        
        # Fallback: Resize & Base64
        print("[INFO] Falling back to Base64 Data URI")
        try:
            from PIL import Image
            import base64
            
            # Reset pointer for PIL
            file_obj.seek(0)
            img = Image.open(file_obj)
            
            # Convert to RGB if needed (for PNG -> JPG)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
                
            # Resize Max 200x200
            img.thumbnail((200, 200))
            
            # Save to Bytes
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=80)
            img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
            
            # Data URI
            data_uri = f"data:image/jpeg;base64,{img_str}"
            
            # Check length (Sheet cell limit approx 50k chars)
            if len(data_uri) > 49000:
                print(f"[WARNING] Base64 string length {len(data_uri)} approaches Sheet limit.")
            
            return {"status": "success", "url": data_uri}
            
        except Exception as e:
            print(f"[ERROR] Fallback failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to process image (Fallback)")

    except Exception as e:
        print(f"Error uploading icon: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Menu Generation Endpoints ---

@router.post("/menus/upload")
async def upload_menu_excel(year: int, month: int, file: UploadFile = File(...)):
    """
    Uploads the Menu Excel, parses it, and saves the Menu Master.
    """
    try:
        # Save uploaded file temporarily
        temp_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"upload_menu_{year}_{month}.xlsx")
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Drive Backup
        # Drive Backup
        try:
             from backend.drive import upload_file_to_drive
             upload_filename = f"Raw_Menu_{year}_{month}.xlsx"
             print(f"Uploading raw menu to Drive: {upload_filename}")
             upload_file_to_drive(temp_path, upload_filename, mime_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        except Exception as e:
             print(f"[WARNING] Drive Upload Failed (Quota?): {e}")

        # Parse
        print(f"Parsing uploaded file: {temp_path}")
        menu_table = parse_menu_excel(temp_path, year, month)
        
        # Save Master JSON
        saved_path = save_menu_master(menu_table)
        
        return {
            "status": "success",
            "message": "Menu parsed and saved.",
            "base_menus": len(menu_table.base_menus),
            "special_menus": len(menu_table.special_menus),
            "sheets_found": list(menu_table.kindergarten_sheets.keys())
        }
    except Exception as e:
        print(f"Error processing upload: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class MenuGenerationRequest(BaseModel):
    kindergarten_id: str
    year: int
    month: int
    options: Optional[dict] = {}

@router.post("/menus/generate")
def generate_menu_file(req: MenuGenerationRequest):
    """
    Generates the specific Kondate for a Kindergarten.
    """
    try:
        masters = get_kindergarten_master()
        kindergarten = None
        if masters:
            for k in masters:
                if k.kindergarten_id == req.kindergarten_id:
                     kindergarten = k
                     break
        
        if not kindergarten:
            raise HTTPException(status_code=404, detail="Kindergarten not found")

        # Inject details into options for generator
        if 'kindergarten_name' not in req.options:
            req.options['kindergarten_name'] = kindergarten.name
        
        # Inject settings (Managed via triggers)
        req.options['settings'] = {}
            
        # 2. Generate Excel (Sync for now)
        file_path = generate_kondate_excel(req.kindergarten_id, req.year, req.month, req.options)
        
        # 3. Upload to Drive (Backup)
        # 3. Upload to Drive (Backup)
        filename = os.path.basename(file_path)
        try:
             from backend.drive import upload_file_to_drive
             upload_file_to_drive(file_path, filename, mime_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        except Exception as e:
             print(f"[WARNING] Drive Upload Failed (Quota?): {e}")

        # 3. Return File
        filename = os.path.basename(file_path)
        return FileResponse(
            path=file_path, 
            filename=filename, 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    except Exception as e:
        print(f"Error generating menu: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/kindergartens")
def list_kindergartens():
    """List all kindergartens for Admin Console."""
    masters = get_kindergarten_master()
    print(f"[DEBUG] Admin list_kindergartens found {len(masters)} masters")
    return {"kindergartens": [k.model_dump() for k in masters]}

@router.post("/admin/kindergartens/{kindergarten_id}/update")
def update_kindergarten(kindergarten_id: str, data: dict):
    """Update general kindergarten master data."""
    from backend.sheets import update_kindergarten_master
    data['kindergarten_id'] = kindergarten_id
    success = update_kindergarten_master(data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update kindergarten")
    return {"status": "success"}

@router.get("/admin/kindergartens/{kindergarten_id}/classes")
def list_kindergarten_classes(kindergarten_id: str):
    """List classes for a specific kindergarten."""
    # Use the optimized function that returns only the latest unique classes
    classes = get_classes_for_kindergarten(kindergarten_id)
    return {"classes": [c.model_dump() for c in classes]}

@router.post("/admin/kindergartens/{kindergarten_id}/classes")
def update_kindergarten_classes(kindergarten_id: str, new_classes: List[dict]):
    """Batch update/replace classes for a specific kindergarten."""
    success = update_sheets_classes(kindergarten_id, new_classes)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update classes")
    return {"status": "success"}

@router.get("/masters/classes/{kindergarten_id}/pending")
def get_pending_changes(kindergarten_id: str):
    """Get future-dated class snapshots (scheduled but not yet active)."""
    snapshots = get_pending_class_snapshots(kindergarten_id)
    return {"pending_snapshots": snapshots}

@router.delete("/masters/classes/{kindergarten_id}/pending/{date}")
def delete_pending_change(kindergarten_id: str, date: str):
    """Delete a scheduled class snapshot and smart-restore orders to pre-change state."""
    # 1. Smart restore: revert only orders not manually changed since the class change
    restore_orders_from_class_change(kindergarten_id, date)
    # 2. Delete the class snapshot
    success = delete_pending_class_snapshot(kindergarten_id, date)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete pending snapshot")
    # 3. Clean up backup
    delete_orders_backup(kindergarten_id, date)
    return {"status": "success"}

@router.get("/admin/orders/{year}/{month}")
def get_admin_orders(year: int, month: int):
    """Get orders + classes for all kindergartens for a given month (admin view)."""
    kindergartens = get_kindergarten_master()
    result = []
    for k in kindergartens:
        orders = get_orders_for_month(k.kindergarten_id, year, month)
        classes = get_classes_for_kindergarten(k.kindergarten_id)
        result.append({
            "kindergarten_id": k.kindergarten_id,
            "name": k.name,
            "classes": [c.model_dump() for c in classes],
            "orders": [o.model_dump() for o in orders],
            "classless_student_count": k.classless_student_count,
            "classless_allergy_count": k.classless_allergy_count,
            "classless_teacher_count": k.classless_teacher_count,
        })
    return {"data": result}

@router.get("/admin/daily-orders/{date}")
def get_daily_orders(date: str):
    """Get all kindergartens' orders for a specific date (YYYY-MM-DD)."""
    try:
        year, month, _ = date.split("-")
        year, month = int(year), int(month)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    all_k = get_kindergarten_master()
    result = []
    grand_total = 0

    for k in all_k:
        month_orders = get_orders_for_month(k.kindergarten_id, year, month)
        day_orders = [o for o in month_orders if o.date == date]

        total_student = sum(o.student_count for o in day_orders)
        total_allergy = sum(o.allergy_count for o in day_orders)
        total_teacher = sum(o.teacher_count for o in day_orders)
        grand = total_student + total_allergy + total_teacher

        grand_total += grand
        result.append({
            "kindergarten_id": k.kindergarten_id,
            "name": k.name,
            "area": k.area,
            "address": k.address,
            "has_orders": len(day_orders) > 0,
            "orders": [
                {
                    "class_name": o.class_name,
                    "meal_type": o.meal_type,
                    "student_count": o.student_count,
                    "allergy_count": o.allergy_count,
                    "teacher_count": o.teacher_count,
                    "memo": o.memo,
                }
                for o in day_orders
            ],
            "totals": {
                "student": total_student,
                "allergy": total_allergy,
                "teacher": total_teacher,
                "grand_total": grand,
            },
        })

    return {"date": date, "kindergartens": result, "grand_total": grand_total}

@router.get("/admin/kindergartens/{kindergarten_id}/print/{year}/{month}")
def get_kindergarten_print_data(kindergarten_id: str, year: int, month: int):
    """Get orders + classes + basic counts for a single kindergarten (for single-kinder print view)."""
    all_k = get_kindergarten_master()
    k = next((kg for kg in all_k if kg.kindergarten_id == kindergarten_id), None)
    if not k:
        raise HTTPException(status_code=404, detail="Kindergarten not found")
    orders = get_orders_for_month(kindergarten_id, year, month)
    classes = get_classes_for_kindergarten(kindergarten_id)
    return {
        "kindergarten_id": k.kindergarten_id,
        "name": k.name,
        "classes": [c.model_dump() for c in classes],
        "orders": [o.model_dump() for o in orders],
        "classless_student_count": k.classless_student_count,
        "classless_allergy_count": k.classless_allergy_count,
        "classless_teacher_count": k.classless_teacher_count,
    }

@router.get("/admin/system-info")
def get_system_info():
    """Returns system config info including Service Account Email."""
    email = "Unknown"
    folder_status = "Not Configured"
    
    try:
        from backend.drive import get_drive_service, DRIVE_FOLDER_ID
        service = get_drive_service()
        if service:
            try:
                about = service.about().get(fields="user").execute()
                email = about['user']['emailAddress']
            except:
                email = "Error fetching email"
        
            folder_status = f"Configured ({DRIVE_FOLDER_ID[:4]}...)"
            
    except Exception as e:
        print(f"Error getting system info: {e}")
        
    # Merge with Admin settings
    settings = get_system_settings() or {}

    from backend.notifications import (
        DEFAULT_ADMIN_TEMPLATE_SUBJECT, DEFAULT_ADMIN_TEMPLATE_BODY,
        DEFAULT_CUSTOMER_TEMPLATE_SUBJECT, DEFAULT_CUSTOMER_TEMPLATE_BODY,
    )

    return {
        "service_account_email": email,
        "drive_folder_config": folder_status,
        "admin_emails": settings.get("admin_emails", ""),
        "reminder_days": settings.get("reminder_days", "5,3"),
        "email_template_admin_subject": settings.get("email_template_admin_subject", DEFAULT_ADMIN_TEMPLATE_SUBJECT),
        "email_template_admin_body": settings.get("email_template_admin_body", DEFAULT_ADMIN_TEMPLATE_BODY),
        "email_template_customer_subject": settings.get("email_template_customer_subject", DEFAULT_CUSTOMER_TEMPLATE_SUBJECT),
        "email_template_customer_body": settings.get("email_template_customer_body", DEFAULT_CUSTOMER_TEMPLATE_BODY),
        "monthly_common_item": settings.get("monthly_common_item", ""),
        "monthly_common_year_month": settings.get("monthly_common_year_month", ""),
    }

@router.get("/admin/monthly-common")
def get_monthly_common():
    """Get all monthly common items as a list."""
    from backend.sheets import get_monthly_common_items
    return {"items": get_monthly_common_items()}

@router.post("/admin/monthly-common")
def update_monthly_common(data: Dict):
    """Upsert monthly common item for a specific year_month."""
    from backend.sheets import update_monthly_common_item
    item = data.get("item", "")
    year_month = data.get("year_month", "")
    success = update_monthly_common_item(item, year_month)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update monthly common item")
    return {"status": "success"}

@router.delete("/admin/monthly-common/{year_month}")
def delete_monthly_common(year_month: str):
    """Delete monthly common item for a specific year_month."""
    from backend.sheets import delete_monthly_common_item
    success = delete_monthly_common_item(year_month)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete monthly common item")
    return {"status": "success"}

@router.post("/admin/system-settings")
def update_admin_settings(data: Dict):
    """Updates global system settings."""
    success = update_system_settings(data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update system settings")
    return {"status": "success"}
@router.post("/admin/test-email")
def test_email(data: Dict):
    """Send a test email directly — no Sheets access, SMTP only."""
    import os
    to = data.get("to", "")
    if not to:
        raise HTTPException(status_code=400, detail="'to' email address required")

    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_configured = bool(smtp_host and smtp_user)

    try:
        from backend.notifications import _send_email
        _send_email(
            to=to,
            subject="【ママミレ】テストメール",
            body=f"これはテストメールです。\n送信日時: {datetime.now().strftime('%Y/%m/%d %H:%M:%S')}\n\n---\nママミレ (MamaMiRe) システム",
        )
        mode = "SMTP" if smtp_configured else "LOG(SMTP未設定)"
        return {"status": "success", "message": f"Test email processed via {mode} to {to}", "smtp_configured": smtp_configured}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/run-reminders")
def run_reminders_check():
    """Manually triggers the reminder check."""
    try:
        from backend.notifications import check_and_send_reminders
        check_and_send_reminders()
        return {"status": "success", "message": "Check completed. See notifications.log for results."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
