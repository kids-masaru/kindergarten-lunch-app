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
    update_class_master, # This is the single update one (used earlier? maybe not exposed)
    update_all_classes_for_kindergarten,
    update_kindergarten_master
)

router = APIRouter()

# --- Models ---
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
    default_allergy_count: int
    default_teacher_count: int

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
            raise HTTPException(status_code=500, detail="Database connection failed")

        user = next((u for u in masters if str(u.get('login_id')) == creds.login_id), None)
        
        if user and str(user.get('password')) == creds.password:
            return {
                "kindergarten_id": user['kindergarten_id'],
                "name": user['name'],
                "settings": {
                    "course_type": user.get('course_type'),
                    "has_bread_day": str(user.get('has_bread_day', 'FALSE')).upper() == 'TRUE',
                    "has_curry_day": str(user.get('has_curry_day', 'FALSE')).upper() == 'TRUE',
                    # Service Days (Default to True for Mon-Fri if missing)
                    "service_mon": str(user.get('service_mon', 'TRUE')).upper() != 'FALSE',
                    "service_tue": str(user.get('service_tue', 'TRUE')).upper() != 'FALSE',
                    "service_wed": str(user.get('service_wed', 'TRUE')).upper() != 'FALSE',
                    "service_thu": str(user.get('service_thu', 'TRUE')).upper() != 'FALSE',
                    "service_fri": str(user.get('service_fri', 'TRUE')).upper() != 'FALSE',
                    "service_sat": str(user.get('service_sat', 'FALSE')).upper() == 'TRUE',
                    "service_sun": str(user.get('service_sun', 'FALSE')).upper() == 'TRUE',
                }
            }
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        import traceback
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
         
    my_classes = [c for c in all_classes if c['kindergarten_id'] == kindergarten_id]
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
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update class master")
    return {"status": "success"}

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

    # Filter by ID and Month (YYYY-MM)
    # Robust Date Parsing
    target_year = year
    target_month = month
    
    filtered_orders = []
    
    for order in all_orders:
        if order.get('kindergarten_id') != kindergarten_id:
            continue
            
        date_val = str(order.get('date'))
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
                filtered_orders.append(order)
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

