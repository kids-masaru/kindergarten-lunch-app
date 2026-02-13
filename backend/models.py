from pydantic import BaseModel, Field, field_validator, ConfigDict
import datetime
from typing import Optional, Any, Dict, List

# --- Helper for dynamic column mapping ---
def normalize_key(key: str) -> str:
    """Normalize header key by removing spaces and #."""
    return str(key).replace('#', '').strip()

# --- Base Models ---

class KindergartenMaster(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra='ignore')

    kindergarten_id: str
    name: str
    login_id: str
    password: str
    
    # Custom services
    services: List[str] = Field(default_factory=list)
    settings: Dict = Field(default_factory=dict)
    classes: List['ClassMaster'] = Field(default_factory=list)
    
    # Service Days
    service_mon: bool = True
    service_tue: bool = True
    service_wed: bool = True
    service_thu: bool = True
    service_fri: bool = True
    service_sat: bool = False
    service_sun: bool = False

    @field_validator('*', mode='before')
    def handle_sheet_values(cls, v):
        # Handle the specialized JSON list for services
        if isinstance(v, str) and (v.startswith('[') or v.startswith('{')):
            try:
                import json
                return json.loads(v)
            except:
                return v

        # Google Sheets might return empty strings for missing bools
        if v == "": return None
        if isinstance(v, str) and v.upper() == 'TRUE': return True
        if isinstance(v, str) and v.upper() == 'FALSE': return False
        return v

class ClassMaster(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra='ignore')

    kindergarten_id: str
    class_name: str
    grade: str = ""
    floor: str = ""
    
    default_student_count: int = 0
    default_allergy_count: int = 0
    default_teacher_count: int = 0

    @field_validator('default_student_count', 'default_allergy_count', 'default_teacher_count', mode='before')
    def parse_int(cls, v):
        if v == "": return 0
        try:
            return int(v)
        except:
            return 0

class OrderData(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra='ignore')

    order_id: str
    kindergarten_id: str
    date: str # YYYY-MM-DD
    class_name: str
    meal_type: str = "通常"
    
    student_count: int = 0
    allergy_count: int = 0
    teacher_count: int = 0
    memo: str = ""
    updated_at: str = ""

    @field_validator('student_count', 'allergy_count', 'teacher_count', mode='before')
    def parse_int(cls, v):
        if v == "": return 0
        try:
            return int(v)
        except:
            return 0


# --- Menu Generation Models ---
from typing import List, Dict
import datetime

class MenuDish(BaseModel):
    dish_name: str
    ingredients_red: Optional[str] = None
    ingredients_yellow: Optional[str] = None
    ingredients_green: Optional[str] = None
    # Source Columns G (Normal) or P (Allergy)
    nutrition_energy: Optional[float] = None
    nutrition_protein: Optional[float] = None
    nutrition_lipid: Optional[float] = None
    # Others
    seasoning: Optional[str] = None
    remarks: Optional[str] = None

class DailyMenu(BaseModel):
    date: Optional[datetime.date] = None # Can be None for Special Menus
    meal_type: str = "Normal" # "Normal", "Allergy"
    
    # A block MUST have 6 rows to maintain structure
    dishes: List[MenuDish] = Field(default_factory=lambda: [MenuDish(dish_name="") for _ in range(6)])
    
    # Nutrition total (from G6, G8, G10 etc)
    total_energy: Optional[float] = None
    total_protein: Optional[float] = None
    total_lipid: Optional[float] = None
    
    remarks: Optional[str] = None

class SpecialMenu(BaseModel):
    event_name: str # e.g. "お誕生日会", "カレーの日"
    menu_content: DailyMenu

class MenuTable(BaseModel):
    """Represents the parsed content of the Menu Excel file."""
    year: int
    month: int
    base_menus: Dict[datetime.date, DailyMenu] = {}
    allergy_menus: Dict[datetime.date, DailyMenu] = {}
    special_menus: Dict[str, DailyMenu] = {}  # Key: Event Name (e.g. "Birthday")
    kindergarten_sheets: Dict[str, Dict[datetime.date, DailyMenu]] = {} 

