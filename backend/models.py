from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any

# --- Helper for dynamic column mapping ---
def normalize_key(key: str) -> str:
    """Normalize header key by removing spaces and #."""
    return str(key).replace('#', '').strip()

# --- Base Models ---

class KindergartenMaster(BaseModel):
    kindergarten_id: str = Field(alias='kindergarten_id')
    name: str = Field(alias='name')
    login_id: str = Field(alias='login_id')
    password: str = Field(alias='password')
    course_type: Optional[str] = Field(default="通常", alias='course_type')
    
    # Settings (Flags)
    # Using strict=False to allow string parsing ("TRUE"/"FALSE")
    has_bread_day: bool = Field(default=False, alias='has_bread_day')
    has_curry_day: bool = Field(default=False, alias='has_curry_day')
    
    # Service Days
    service_mon: bool = Field(default=True, alias='service_mon')
    service_tue: bool = Field(default=True, alias='service_tue')
    service_wed: bool = Field(default=True, alias='service_wed')
    service_thu: bool = Field(default=True, alias='service_thu')
    service_fri: bool = Field(default=True, alias='service_fri')
    service_sat: bool = Field(default=False, alias='service_sat')
    service_sun: bool = Field(default=False, alias='service_sun')

    class Config:
        populate_by_name = True
        extra = 'ignore' # Allow extra columns in sheet

    @field_validator('*', mode='before')
    def handle_sheet_values(cls, v):
        # Google Sheets might return empty strings for missing bools
        if v == "": return None
        if isinstance(v, str) and v.upper() == 'TRUE': return True
        if isinstance(v, str) and v.upper() == 'FALSE': return False
        return v

class ClassMaster(BaseModel):
    kindergarten_id: str = Field(alias='kindergarten_id')
    class_name: str = Field(alias='class_name')
    grade: str = Field(default="", alias='grade')
    floor: str = Field(default="", alias='floor')
    
    default_student_count: int = Field(default=0, alias='default_student_count')
    default_allergy_count: int = Field(default=0, alias='default_allergy_count')
    default_teacher_count: int = Field(default=0, alias='default_teacher_count')

    class Config:
        populate_by_name = True
        extra = 'ignore'

    @field_validator('default_student_count', 'default_allergy_count', 'default_teacher_count', mode='before')
    def parse_int(cls, v):
        if v == "": return 0
        try:
            return int(v)
        except:
            return 0

class OrderData(BaseModel):
    order_id: str = Field(alias='order_id')
    kindergarten_id: str = Field(alias='kindergarten_id')
    date: str = Field(alias='date') # YYYY-MM-DD
    class_name: str = Field(alias='class_name')
    meal_type: str = Field(default="通常", alias='meal_type')
    
    student_count: int = Field(default=0, alias='student_count')
    allergy_count: int = Field(default=0, alias='allergy_count')
    teacher_count: int = Field(default=0, alias='teacher_count')
    memo: str = Field(default="", alias='memo')
    updated_at: str = Field(default="", alias='updated_at')

    class Config:
        populate_by_name = True
        extra = 'ignore'

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
    ingredients: Optional[str] = None
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
    dishes: List[MenuDish] = []
    
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

