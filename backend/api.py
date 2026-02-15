from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
from datetime import datetime
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

class ClassListUpdateRequest(BaseModel):
    classes: List[ClassUpdateItem]

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
    return {"classes": [c.model_dump() for c in my_classes]}

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
        success = update_sheets_classes(kindergarten_id, data_to_save)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update classes in sheet")
            
        return {"status": "success", "message": "Classes updated"}
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

@router.post("/orders")
def create_order(order: OrderItem):
    # For compatibility, this still handles single order but uses batch_save_orders
    if not order.order_id:
        order.order_id = f"{order.date}_{order.kindergarten_id}_{order.class_name}"
    
    success = batch_save_orders([order.model_dump()])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save order")
    return {"status": "success", "order_id": order.order_id}

@router.post("/orders/bulk")
def create_orders_bulk(orders: List[OrderItem]):
    """Bulk create orders, used for monthly initialization."""
    data = []
    for o in orders:
        if not o.order_id:
            o.order_id = f"{o.date}_{o.kindergarten_id}_{o.class_name}"
        data.append(o.model_dump())
    
    success = batch_save_orders(data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save bulk orders")
    return {"status": "success", "count": len(orders)}


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
    
    return {
        "service_account_email": email,
        "drive_folder_config": folder_status,
        "admin_emails": settings.get("admin_emails", ""),
        "reminder_days": settings.get("reminder_days", "5,3")
    }

@router.post("/admin/system-settings")
def update_admin_settings(data: Dict):
    """Updates global system settings."""
    success = update_system_settings(data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update system settings")
    return {"status": "success"}
@router.get("/admin/run-reminders")
def run_reminders_check():
    """Manually triggers the reminder check."""
    try:
        from backend.notifications import check_and_send_reminders
        check_and_send_reminders()
        return {"status": "success", "message": "Check completed. See notifications.log for results."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
