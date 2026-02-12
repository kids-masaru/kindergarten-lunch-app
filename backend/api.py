from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime
from backend.sheets import (
    get_kindergarten_master, 
    get_class_master, 
    get_order_data, 
    save_order, 
    update_class_master, 
    update_all_classes_for_kindergarten,
    update_kindergarten_master
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

        masters = get_kindergarten_master()
        if not masters:
            print("[ERROR] No masters returned from Sheet")
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        print(f"[DEBUG] Fetched {len(masters)} rows from Kindergarten_Master")

        input_login_id = str(creds.login_id).strip()
        input_password = str(creds.password).strip()
        
        user = None
        for u in masters:
            # u is now a Pydantic Model (Keys are English/Standardized)
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
                    "course_type": user.course_type,
                    "has_bread_day": user.has_bread_day,
                    "has_curry_day": user.has_curry_day,
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
def get_masters(kindergarten_id: str):
    all_classes = get_class_master()
    if not all_classes:
         # Mock data
         return {
             "classes": [
                 {"class_name": "ふじ", "grade": "年長", "default_student_count": 25, "default_teacher_count": 1},
                 {"class_name": "さくら", "grade": "年中", "default_student_count": 20, "default_teacher_count": 1}
             ]
         }
         
    # Debug logging
    print(f"[DEBUG] Fetching masters for ID: {kindergarten_id}")
    # all_classes is list of ClassMaster models
        
    target_id = str(kindergarten_id).strip()
    my_classes = []
    
    for c in all_classes:
        # c is Pydantic Model
        if c.kindergarten_id == target_id:
            mapped_class = {
                "class_name": c.class_name,
                "grade": c.grade,
                "default_student_count": c.default_student_count,
                "default_allergy_count": c.default_allergy_count,
                "default_teacher_count": c.default_teacher_count,
                "floor": c.floor,
            }
            my_classes.append(mapped_class)
            
    print(f"[DEBUG] Found {len(my_classes)} classes for {target_id}")
    return {"classes": my_classes}

@router.post("/masters/class")
def update_class(req: ClassUpdateRequest):
    success = update_class_master(
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
    print(f"[DEBUG] Validating {len(request.classes)} classes")
    try:
        data_to_save = [c.dict() for c in request.classes]
        print(f"[DEBUG] Payload sample: {data_to_save[0] if data_to_save else 'Empty'}")
        
        success = update_all_classes_for_kindergarten(kindergarten_id, data_to_save)
        
        if not success:
            print(f"[ERROR] update_all_classes_for_kindergarten returned False")
            raise HTTPException(status_code=500, detail="Failed to update classes in sheet")
            
        print(f"[DEBUG] Successfully updated classes for {kindergarten_id}")
        return {"status": "success", "message": "Classes updated"}
    except Exception as e:
        print(f"[CRITICAL ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

@router.put("/masters/kindergarten")
def update_kindergarten(req: KindergartenUpdateRequest):
    # Filter out None values to only update sent fields
    data = {k: v for k, v in req.dict().items() if k != 'kindergarten_id' and v is not None}
    
    success = update_kindergarten_master(req.kindergarten_id, data)
    
    if not success:
        # It might fail if columns don't exist in sheet yet, but we'll return 500
        raise HTTPException(status_code=500, detail="Failed to update kindergarten master")
    return {"status": "success"}

@router.get("/calendar")
def get_calendar(kindergarten_id: str, year: int, month: int):
    # Fetch orders for the specific month
    all_orders = get_order_data()
    # Mock return if DB fails or is empty and we are testing
    if not all_orders and kindergarten_id == "K001":
        return {"orders": []}

    if not all_orders:
         return {"orders": []}

    target_year = year
    target_month = month
    
    filtered_orders = []
    
    for order in all_orders:
        if order.kindergarten_id != kindergarten_id:
            continue
            
        date_val = order.date
        try:
            # Handle standard formats: YYYY-MM-DD, YYYY/MM/DD
            d = None
            if '-' in date_val:
                parts = date_val.split('-')
                if len(parts) >= 2:
                     d = (int(parts[0]), int(parts[1]))
            elif '/' in date_val:
                parts = date_val.split('/')
                if len(parts) >= 2:
                     d = (int(parts[0]), int(parts[1]))
            
            if d and d[0] == target_year and d[1] == target_month:
                filtered_orders.append(order.dict()) # Convert model to dict for response
        except:
            continue

    # Dedup: Keep only the latest order for each (date, class_name)
    # Sort by updated_at (assuming ISO format strings sort correctly)
    filtered_orders.sort(key=lambda x: x.get('updated_at', ''), reverse=False)

    latest_orders_map = {}
    for order in filtered_orders:
        key = (order.get('date'), order.get('class_name'))
        latest_orders_map[key] = order
    
    # Normalize Date Format for Frontend (YYYY-MM-DD)
    final_orders = []
    for order in latest_orders_map.values():
        try:
            date_val = str(order.get('date'))
            # Parse again to standardize
            d = None
            if '-' in date_val:
                parts = date_val.split('-')
                if len(parts) >= 3:
                     # Re-format to ensure padding (e.g. 2026-1-7 -> 2026-01-07)
                     d = f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"
            elif '/' in date_val:
                parts = date_val.split('/')
                if len(parts) >= 3:
                     d = f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"
            
            if d:
                order['date'] = d
            
            final_orders.append(order)
        except:
            final_orders.append(order)

    return {"orders": final_orders}

@router.post("/orders")
def create_order(order: OrderItem):
    # If no ID, generate one
    if not order.order_id:
        order.order_id = str(uuid.uuid4())
    
    row_data = order.dict()
    row_data['updated_at'] = datetime.now().isoformat()
    
    success = save_order(row_data)
    
    # Mock success if DB save fails (for testing without creds)
    if not success:
        return {"status": "success", "order_id": order.order_id, "mock": True}
        
    return {"status": "success", "order_id": order.order_id}


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
        try:
             from backend.drive import upload_file_to_drive
             upload_filename = f"Raw_Menu_{year}_{month}.xlsx"
             print(f"Uploading raw menu to Drive: {upload_filename}")
             upload_file_to_drive(temp_path, upload_filename, mime_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        except Exception as e:
             print(f"Drive Upload Failed (Non-critical): {e}")

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
        k_name = "Unknown"
        if masters:
            for k in masters:
                if k.kindergarten_id == req.kindergarten_id:
                     k_name = k.name
                     break
        
        # Inject name into options for generator
        if 'kindergarten_name' not in req.options:
            req.options['kindergarten_name'] = k_name
            
        # 2. Generate Excel (Sync for now)
        file_path = generate_kondate_excel(req.kindergarten_id, req.year, req.month, req.options)
        
        # 3. Upload to Drive (Backup)
        filename = os.path.basename(file_path)
        try:
             from backend.drive import upload_file_to_drive
             upload_file_to_drive(file_path, filename, mime_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        except Exception as e:
             print(f"Drive Upload Failed (Non-critical): {e}")

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
    return {"kindergartens": [k.dict() for k in masters]}
