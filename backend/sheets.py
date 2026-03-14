import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import json
import time
import threading
from datetime import datetime
from dotenv import load_dotenv
from typing import List, Dict, Optional, Any
from backend.models import KindergartenMaster, ClassMaster, OrderData, normalize_key

load_dotenv(override=True)

# ---------------------------------------------------------------------------
# In-memory TTL cache
# ---------------------------------------------------------------------------
_cache: dict = {}
_cache_lock = threading.Lock()
_DATA_TTL = 300  # 5 minutes

_wb_instance = None
_wb_ts: float = 0.0
_wb_lock = threading.Lock()
_WB_TTL = 1800  # 30 minutes


def _dcache_get(key: str):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry[1]) < _DATA_TTL:
            return entry[0]
        _cache.pop(key, None)
    return None


def _dcache_set(key: str, data):
    with _cache_lock:
        _cache[key] = (data, time.time())


def _dcache_bust(*prefixes: str):
    with _cache_lock:
        to_del = [k for k in list(_cache) if any(k.startswith(p) for p in prefixes)]
        for k in to_del:
            del _cache[k]


def _get_sheet_records(wb, sheet_name: str, cache_key: str) -> list:
    cached = _dcache_get(cache_key)
    if cached is not None:
        return cached
    ws = wb.worksheet(sheet_name)
    records = ws.get_all_records()
    _dcache_set(cache_key, records)
    return records

# ---------------------------------------------------------------------------


def get_db_connection():
    """Connect to Google Sheets and return the workbook object (cached 30 min)."""
    global _wb_instance, _wb_ts
    with _wb_lock:
        if _wb_instance is not None and (time.time() - _wb_ts) < _WB_TTL:
            return _wb_instance

        scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
        creds = None

        # Reload env just in case
        load_dotenv()
        spreadsheet_id = os.getenv("SPREADSHEET_ID")
        print(f"DEBUG: Using spreadsheet_id=[{spreadsheet_id}]")
        credentials_file = "lunch-order-app-484107-7b748f233fe2.json"

        # 1. Try environment variable (for Railway/Cloud)
        json_creds = os.getenv("GOOGLE_CREDENTIALS_JSON")
        if json_creds:
            try:
                creds_dict = json.loads(json_creds)
                creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
            except Exception as e:
                print(f"Error loading credentials from env: {e}")

        # 2. Try local file (for development)
        if not creds and os.path.exists(credentials_file):
            creds = ServiceAccountCredentials.from_json_keyfile_name(credentials_file, scope)

        if not creds:
            print("Warning: No Google Credentials found.")
            return None

        client = gspread.authorize(creds)
        if not spreadsheet_id:
            print("Warning: SPREADSHEET_ID not set in .env")
            return None

        try:
            wb = client.open_by_key(spreadsheet_id)
            _wb_instance = wb
            _wb_ts = time.time()
            return wb
        except Exception as e:
            print(f"Error connecting to spreadsheet {spreadsheet_id}: {e}")
            return None

# --- New Optimized Data Access ---

def get_kindergartens() -> List[KindergartenMaster]:
    """Fetch all kindergartens from the flat 'kindergartens' sheet."""
    try:
        wb = get_db_connection()
        if not wb: return []
        records = _get_sheet_records(wb, "kindergartens", "kg")
        print(f"[DEBUG] get_kindergartens: {len(records)} raw records from sheet")

        results = []
        for i, r in enumerate(records):
            kid_id = str(r.get("kindergarten_id", "")).strip()
            name = str(r.get("name", "")).strip()
            # Skip blank rows
            if not kid_id or not name:
                print(f"[DEBUG] Skipping row {i+2}: kindergarten_id={kid_id!r} name={name!r}")
                continue
            try:
                data = {
                    "kindergarten_id": kid_id,
                    "name": name,
                    "login_id": str(r.get("login_id", "")).strip(),
                    "password": str(r.get("password", "")).strip(),
                    "service_mon": bool(r.get("mon", 1)),
                    "service_tue": bool(r.get("tue", 1)),
                    "service_wed": bool(r.get("wed", 1)),
                    "service_thu": bool(r.get("thu", 1)),
                    "service_fri": bool(r.get("fri", 1)),
                    "service_sat": bool(r.get("sat", 0)),
                    "service_sun": bool(r.get("sun", 0)),
                    "services": [s.strip() for s in str(r.get("services", "")).split(",") if s.strip()],
                    "has_soup": bool(r.get("has_soup", False)),
                    "has_no_rice": bool(r.get("has_no_rice", False)),
                    "curry_trigger": str(r.get("curry_trigger", "")),
                    "contact_name": str(r.get("contact_name", "")),
                    "contact_email": str(r.get("contact_email", "")),
                    "icon_url": str(r.get("icon_url", "")),
                    "classless_student_count": r.get("classless_student_count", 0),
                    "classless_allergy_count": r.get("classless_allergy_count", 0),
                    "classless_teacher_count": r.get("classless_teacher_count", 0)
                }
                results.append(KindergartenMaster(**data))
            except Exception as row_err:
                print(f"[WARNING] Skipping row {i+2} (kindergarten_id={kid_id!r}): {row_err}")
        print(f"[DEBUG] get_kindergartens: returning {len(results)} valid records")
        return results
    except Exception as e:
        print(f"Error in get_kindergartens: {e}")
        import traceback
        traceback.print_exc()
        return []

def get_classes_for_kindergarten(kindergarten_id: str, base_date: Optional[str] = None) -> List[ClassMaster]:
    """Fetch classes for a specific kindergarten from the flat 'classes' sheet."""
    try:
        wb = get_db_connection()
        if not wb: return []
        records = _get_sheet_records(wb, "classes", "cls_raw")

        # Filter by kindergarten_id
        results = []
        for r in records:
            if str(r.get("kindergarten_id")) == str(kindergarten_id):
                results.append(ClassMaster(**r))
        
        if not results: return []

        if not base_date:
            # Return LATEST SNAPSHOT (all classes matching the latest effective_from date)
            # This handles deletions: if a class is removed, it won't be in the new snapshot.
            if not results: return []
            
            latest_date = max(c.effective_from for c in results)
            snapshot_classes = [c for c in results if c.effective_from == latest_date]
            
            # Deduplicate within the snapshot (just in case of duplicate rows)
            grouped = {}
            for c in snapshot_classes:
                grouped[c.class_name] = c
            
            return list(grouped.values())

        # Versioning logic (snapshot-based):
        # Find the latest snapshot date that is <= base_date, then return ALL classes from that snapshot.
        # This respects deletions: if a class was removed in a newer snapshot, it won't appear.
        candidate_dates = set(c.effective_from for c in results if c.effective_from <= base_date)
        if not candidate_dates:
            return []
        
        latest_snapshot_date = max(candidate_dates)
        snapshot_classes = [c for c in results if c.effective_from == latest_snapshot_date]
        
        # Deduplicate within the snapshot (just in case)
        grouped = {}
        for c in snapshot_classes:
            grouped[c.class_name] = c
        
        return list(grouped.values())
    except Exception as e:
        print(f"Error in get_classes_for_kindergarten: {e}")
        return []

def get_pending_class_snapshots(kindergarten_id: str) -> List[Dict]:
    """Get future-dated class snapshots (scheduled changes not yet active)."""
    try:
        wb = get_db_connection()
        if not wb: return []
        records = _get_sheet_records(wb, "classes", "cls_raw")

        today = datetime.now().strftime("%Y-%m-%d")
        
        # Find all classes for this kindergarten with effective_from > today
        future_classes = []
        for r in records:
            if str(r.get("kindergarten_id")) == str(kindergarten_id):
                ef = str(r.get("effective_from", ""))
                if ef > today:
                    future_classes.append(ClassMaster(**r))
        
        if not future_classes:
            return []
        
        # Group by effective_from date
        snapshots = {}
        for c in future_classes:
            if c.effective_from not in snapshots:
                snapshots[c.effective_from] = []
            snapshots[c.effective_from].append(c.model_dump())
        
        # Return as list of {date, classes}
        return [{"date": d, "classes": cls} for d, cls in sorted(snapshots.items())]
    except Exception as e:
        print(f"Error in get_pending_class_snapshots: {e}")
        return []

def delete_pending_class_snapshot(kindergarten_id: str, date: str) -> bool:
    """Delete a specific future-dated class snapshot for a kindergarten."""
    try:
        wb = get_db_connection()
        if not wb: return False
        ws = wb.worksheet("classes")
        all_rows = ws.get_all_values()
        headers = all_rows[0]

        kid_idx = headers.index("kindergarten_id")
        ef_idx = headers.index("effective_from") if "effective_from" in headers else -1

        new_rows = [headers]
        for i, row in enumerate(all_rows):
            if i == 0: continue
            while len(row) < len(headers):
                row.append("")
            is_same_kid = str(row[kid_idx]) == str(kindergarten_id)
            is_same_date = ef_idx >= 0 and str(row[ef_idx]) == date
            if is_same_kid and is_same_date:
                continue  # Remove this row
            new_rows.append(row)

        ws.clear()
        ws.batch_update([{'range': 'A1', 'values': new_rows}])
        _dcache_bust("cls_raw")
        return True
    except Exception as e:
        print(f"Error in delete_pending_class_snapshot: {e}")
        return False

ORDERS_BACKUP_SHEET = "orders_change_backup"
BACKUP_HEADERS = [
    "kindergarten_id", "snapshot_date", "date", "class_name",
    "orig_student", "orig_allergy", "orig_teacher",
    "applied_student", "applied_allergy", "applied_teacher",
]

def backup_orders_for_class_change(
    kindergarten_id: str,
    snapshot_date: str,
    orders_before: List[Dict],
    new_class_counts: Dict,
) -> bool:
    """Save pre-change orders and the auto-applied counts for smart restore later."""
    try:
        wb = get_db_connection()
        if not wb: return False
        try:
            ws = wb.worksheet(ORDERS_BACKUP_SHEET)
        except:
            ws = wb.add_worksheet(title=ORDERS_BACKUP_SHEET, rows=2000, cols=len(BACKUP_HEADERS))
            ws.batch_update([{'range': 'A1', 'values': [BACKUP_HEADERS]}])

        new_rows = []
        for order in orders_before:
            class_name = str(order.get("class_name", ""))
            applied = new_class_counts.get(class_name, {})
            new_rows.append([
                kindergarten_id,
                snapshot_date,
                order.get("date", ""),
                class_name,
                int(order.get("student_count", 0)),
                int(order.get("allergy_count", 0)),
                int(order.get("teacher_count", 0)),
                int(applied.get("student_count", 0)),
                int(applied.get("allergy_count", 0)),
                int(applied.get("teacher_count", 0)),
            ])
        if new_rows:
            ws.append_rows(new_rows)
        return True
    except Exception as e:
        print(f"Error in backup_orders_for_class_change: {e}")
        return False


def restore_orders_from_class_change(kindergarten_id: str, snapshot_date: str) -> bool:
    """Smart restore: only restore orders whose counts still match the auto-applied values.
    Orders manually changed after the class change are left untouched."""
    try:
        wb = get_db_connection()
        if not wb: return False
        try:
            bws = wb.worksheet(ORDERS_BACKUP_SHEET)
        except:
            return True  # No backup sheet — nothing to restore

        backup_records = bws.get_all_records()
        relevant = [
            r for r in backup_records
            if str(r.get("kindergarten_id")) == str(kindergarten_id)
            and str(r.get("snapshot_date")) == str(snapshot_date)
        ]
        if not relevant:
            return True

        # Build (date, class_name) -> backup row
        backup_map = {(str(r["date"]), str(r["class_name"])): r for r in relevant}

        # Fetch current orders for all affected months
        months = set()
        for d in (r["date"] for r in relevant):
            parts = str(d).split("-")
            if len(parts) == 3:
                months.add((int(parts[0]), int(parts[1])))

        current_orders = []
        for (yr, mo) in months:
            current_orders += [o.model_dump() for o in get_orders_for_month(kindergarten_id, yr, mo)]

        orders_to_restore = []
        for order in current_orders:
            key = (str(order["date"]), str(order["class_name"]))
            if key not in backup_map:
                continue
            bk = backup_map[key]
            curr_s = int(order.get("student_count", 0))
            curr_a = int(order.get("allergy_count", 0))
            curr_t = int(order.get("teacher_count", 0))
            appl_s = int(bk.get("applied_student", 0))
            appl_a = int(bk.get("applied_allergy", 0))
            appl_t = int(bk.get("applied_teacher", 0))

            # Only restore if the order hasn't been manually changed
            if curr_s == appl_s and curr_a == appl_a and curr_t == appl_t:
                restored = dict(order)
                restored["student_count"] = int(bk["orig_student"])
                restored["allergy_count"] = int(bk["orig_allergy"])
                restored["teacher_count"] = int(bk["orig_teacher"])
                orders_to_restore.append(restored)

        if orders_to_restore:
            batch_save_orders(orders_to_restore)
        return True
    except Exception as e:
        print(f"Error in restore_orders_from_class_change: {e}")
        return False


def delete_orders_backup(kindergarten_id: str, snapshot_date: str) -> bool:
    """Remove backup rows for a completed or cancelled class change."""
    try:
        wb = get_db_connection()
        if not wb: return False
        try:
            ws = wb.worksheet(ORDERS_BACKUP_SHEET)
        except:
            return True

        all_rows = ws.get_all_values()
        if len(all_rows) < 2:
            return True
        headers = all_rows[0]
        kid_idx = headers.index("kindergarten_id")
        snap_idx = headers.index("snapshot_date")

        new_rows = [headers] + [
            row for row in all_rows[1:]
            if not (str(row[kid_idx]) == str(kindergarten_id) and str(row[snap_idx]) == str(snapshot_date))
        ]
        ws.clear()
        ws.batch_update([{'range': 'A1', 'values': new_rows}])
        return True
    except Exception as e:
        print(f"Error in delete_orders_backup: {e}")
        return False


def get_orders_for_month(kindergarten_id: str, year: int, month: int) -> List[OrderData]:
    """Fetch orders for a specific kindergarten and month from the flat 'orders' sheet."""
    try:
        cache_key = f"ord_{kindergarten_id}_{year}_{month}"
        cached = _dcache_get(cache_key)
        if cached is not None:
            return cached

        wb = get_db_connection()
        if not wb: return []
        records = _get_sheet_records(wb, "orders", "ord_raw")

        # Filter by kindergarten_id and month
        month_prefix = f"{year}-{month:02d}"
        results = []
        for r in records:
            if str(r.get("kindergarten_id")) == str(kindergarten_id):
                order_date = str(r.get("date", ""))
                if order_date.startswith(month_prefix):
                    results.append(OrderData(**r))

        _dcache_set(cache_key, results)
        return results
    except Exception as e:
        print(f"Error in get_orders_for_month: {e}")
        return []

def batch_save_orders(orders: List[Dict]) -> bool:
    """
    Save multiple orders efficiently.
    If order_id exists, update. If not, append.
    """
    try:
        wb = get_db_connection()
        if not wb: return False
        ws = wb.worksheet("orders")
        
        all_rows = ws.get_all_values()
        headers = all_rows[0]
        id_col = headers.index("order_id") + 1
        
        # Map existing IDs to row indices
        existing_ids = {row[id_col-1]: i+1 for i, row in enumerate(all_rows) if i > 0}
        
        updates = []
        new_rows = []
        
        for order in orders:
            # Add updated_at
            order["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Construct row list
            row_vals = []
            for h in headers:
                row_vals.append(order.get(h, ""))
            
            oid = order.get("order_id")
            if oid in existing_ids:
                row_idx = existing_ids[oid]
                # Update entire row
                range_label = f"A{row_idx}:{gspread.utils.rowcol_to_a1(row_idx, len(headers))}"
                updates.append({'range': range_label, 'values': [row_vals]})
            else:
                new_rows.append(row_vals)
                
        # Perform updates in batch
        if updates:
            ws.batch_update(updates)

        # Append new rows in one go
        if new_rows:
            ws.append_rows(new_rows)

        # Bust order cache
        kid_id = orders[0]['kindergarten_id'] if orders else None
        _dcache_bust("ord_raw")
        if kid_id:
            _dcache_bust(f"ord_{kid_id}_")

        # Notification trigger
        try:
            from backend.notifications import send_admin_notification
            kid_id = orders[0]['kindergarten_id']
            # Determine if this is a monthly setup or daily change
            is_bulk = len(orders) > 10
            action = "マンスリー申請" if is_bulk else "日次注文変更"
            
            # Get Name
            all_k = get_kindergartens()
            k_name = next((k.name for k in all_k if k.kindergarten_id == kid_id), kid_id)
            
            details = f"件数: {len(orders)}件\n"
            if not is_bulk:
                 details += f"日付: {orders[0].get('date', '---')}\nクラス: {orders[0].get('class_name', '---')}"
            
            send_admin_notification(action, k_name, details)
        except Exception as ne:
            print(f"[ERROR] Notification failed: {ne}")

        return True
    except Exception as e:
        print(f"Error in batch_save_orders: {e}")
        return False

def update_kindergarten_classes(kindergarten_id: str, classes: List[Dict], scheduled_date: str = None) -> bool:
    """Batch update or replace classes for a kindergarten.
    
    Two modes:
    - Immediate (scheduled_date=None): Full replace with today's date. Used by MonthlySetupModal.
    - Scheduled (scheduled_date="YYYY-MM-DD"): Append a future snapshot, preserving other snapshots. 
      Used by ClassChangeRequestModal for future-dated changes.
    """
    try:
        wb = get_db_connection()
        if not wb: return False
        ws = wb.worksheet("classes")
        all_rows = ws.get_all_values()
        headers = all_rows[0]
        
        # Ensure effective_from header exists if missing (migration)
        if "effective_from" not in headers:
            headers.append("effective_from")
            ws.batch_update([{'range': 'A1', 'values': [headers]}])
            all_rows = ws.get_all_values()
            headers = all_rows[0]

        kid_idx = headers.index("kindergarten_id")
        ef_idx = headers.index("effective_from") if "effective_from" in headers else -1

        if scheduled_date:
            # === SCHEDULED MODE ===
            # Keep all rows EXCEPT this kindergarten's rows with the same effective_from date.
            # This preserves the current snapshot and other scheduled snapshots.
            target_effective_date = scheduled_date
            new_all_rows = [headers]
            
            for i, row in enumerate(all_rows):
                if i == 0: continue
                while len(row) < len(headers):
                    row.append("")
                # Remove only rows matching BOTH this kindergarten AND this effective_from date
                is_same_kid = str(row[kid_idx]) == str(kindergarten_id)
                is_same_date = ef_idx >= 0 and str(row[ef_idx]) == scheduled_date
                if is_same_kid and is_same_date:
                    continue  # Skip — will be replaced
                new_all_rows.append(row)
        else:
            # === IMMEDIATE MODE (existing behavior) ===
            # Remove ALL rows for this kindergarten, use first of current month.
            # Using month-start so the frontend (which queries with month-01) can always find these classes.
            target_effective_date = datetime.now().strftime("%Y-%m-01")
            new_all_rows = [headers]
            
            for i, row in enumerate(all_rows):
                if i == 0: continue
                if str(row[kid_idx]) != str(kindergarten_id):
                    while len(row) < len(headers):
                        row.append("")
                    new_all_rows.append(row)
        
        # Add the new/updated classes for THIS kindergarten and THIS date
        for c in classes:
            row_vals = []
            for h in headers:
                val = c.get(h, "")
                if h == "kindergarten_id": val = kindergarten_id
                if h == "effective_from": val = target_effective_date
                row_vals.append(val)
            new_all_rows.append(row_vals)
            
        # Overwrite the sheet
        ws.clear()
        if new_all_rows:
            ws.batch_update([{'range': 'A1', 'values': new_all_rows}])
        _dcache_bust("cls_raw")
        return True
    except Exception as e:
        print(f"Error in update_kindergarten_classes: {e}")
        return False

def update_class_counts(kindergarten_id: str, class_name: str, counts: Dict) -> bool:
    """Update base class counts in the 'classes' sheet."""
    try:
        wb = get_db_connection()
        if not wb: return False
        ws = wb.worksheet("classes")
        
        records = ws.get_all_records()
        headers = ws.row_values(1)
        
        # Find row
        row_idx = -1
        for i, r in enumerate(records):
            if str(r.get("kindergarten_id")) == str(kindergarten_id) and r.get("class_name") == class_name:
                row_idx = i + 2
                break
        
        if row_idx == -1: return False
        
        # Update cells
        updates = []
        for key, val in counts.items():
            if key in headers:
                col_idx = headers.index(key) + 1
                updates.append({
                    'range': gspread.utils.rowcol_to_a1(row_idx, col_idx),
                    'values': [[val]]
                })
        
        if updates:
            ws.batch_update(updates)
        _dcache_bust("cls_raw")

        # Notification trigger
        try:
            from backend.notifications import send_admin_notification
            all_k = get_kindergartens()
            k_name = next((k.name for k in all_k if k.kindergarten_id == kindergarten_id), kindergarten_id)
            details = f"クラス名: {class_name}\n更新項目: {list(counts.keys())}"
            send_admin_notification("クラス人数更新", k_name, details)
        except Exception as ne:
            print(f"[ERROR] Notification failed: {ne}")

        return True
    except Exception as e:
        print(f"Error in update_class_counts: {e}")
        return False

def update_kindergarten_master(data: Dict) -> bool:
    """Update kindergarten master settings (e.g., service days)."""
    try:
        wb = get_db_connection()
        if not wb: return False
        ws = wb.worksheet("kindergartens")
        
        records = ws.get_all_records()
        headers = ws.row_values(1)
        
        kid = data.get("kindergarten_id")
        if not kid: return False
        
        # Find row
        row_idx = -1
        for i, r in enumerate(records):
            if str(r.get("kindergarten_id")) == str(kid):
                row_idx = i + 2
                break
        
        if row_idx == -1: return False
        
        mapping = {
            "name": "name",
            "login_id": "login_id", "password": "password",
            "service_mon": "mon", "service_tue": "tue", "service_wed": "wed",
            "service_thu": "thu", "service_fri": "fri", "service_sat": "sat", "service_sun": "sun",
            "has_soup": "has_soup", "has_no_rice": "has_no_rice", "curry_trigger": "curry_trigger",
            "plan_type": "plan_type",
            "contact_name": "contact_name", "contact_email": "contact_email",
            "icon_url": "icon_url",
            "classless_student_count": "classless_student_count",
            "classless_allergy_count": "classless_allergy_count",
            "classless_teacher_count": "classless_teacher_count",
        }
        
        updates = []
        for api_key, sheet_key in mapping.items():
            if api_key in data and sheet_key in headers:
                col_idx = headers.index(sheet_key) + 1
                val = data[api_key]
                # Special handling for booleans saved as 1/0 if needed, 
                # but if the user wants true/false as strings or booleans, let's keep it consistent.
                # Usually we use 1/0 for service days.
                if isinstance(val, bool):
                    val = 1 if val else 0
                
                updates.append({
                    'range': gspread.utils.rowcol_to_a1(row_idx, col_idx),
                    'values': [[val]]
                })
        
        # Handle "services" (comma separated)
        if "services" in data and "services" in headers:
            col_idx = headers.index("services") + 1
            services_val = ",".join(data["services"])
            updates.append({
                'range': gspread.utils.rowcol_to_a1(row_idx, col_idx),
                'values': [[services_val]]
            })

        # --- Auto-create missing columns ---
        missing_cols = []
        for key in ["contact_name", "contact_email", "icon_url", "has_no_rice", "plan_type",
                    "classless_student_count", "classless_allergy_count", "classless_teacher_count"]:
            if key not in headers and key in mapping.values():
                missing_cols.append(key)

        if missing_cols:
            print(f"[INFO] Auto-creating missing columns: {missing_cols}")
            # シートの列数を拡張してから書き込む
            ws.resize(cols=len(headers) + len(missing_cols))
            # batch_update でヘッダーとデータを一括書き込み（gspread 5/6 両対応）
            new_col_updates = []
            for i, col_name in enumerate(missing_cols):
                col_idx = len(headers) + i + 1
                # ヘッダー行に列名を追加
                new_col_updates.append({
                    'range': gspread.utils.rowcol_to_a1(1, col_idx),
                    'values': [[col_name]]
                })
                # データ行に値を追加
                api_key = next((k for k, v in mapping.items() if v == col_name), None)
                if api_key and api_key in data:
                    val = data[api_key]
                    if isinstance(val, bool):
                        val = 1 if val else 0
                    new_col_updates.append({
                        'range': gspread.utils.rowcol_to_a1(row_idx, col_idx),
                        'values': [[val]]
                    })
            if new_col_updates:
                ws.batch_update(new_col_updates)
            headers = headers + missing_cols

        if updates:
            ws.batch_update(updates)
        _dcache_bust("kg")

        try:
            from backend.notifications import send_admin_notification
            kid_id = data.get('kindergarten_id')
            all_k = get_kindergartens()
            k_name = next((k.name for k in all_k if k.kindergarten_id == kid_id), kid_id)
            send_admin_notification("園情報・設定更新", k_name, f"更新内容: {list(data.keys())}")
        except Exception as ne:
            print(f"[ERROR] Notification failed: {ne}")
        return True
    except Exception as e:
        print(f"Error in update_kindergarten_master: {e}")
        import traceback
        traceback.print_exc()
        return False

def get_system_settings() -> Dict:
    """Fetch system-wide settings (admin emails, reminder days)."""
    try:
        wb = get_db_connection()
        if not wb: return {}
        try:
            ws = wb.worksheet("admin_settings")
        except:
            # Create if missing
            ws = wb.add_worksheet(title="admin_settings", rows=10, cols=2)
            ws.batch_update([{'range': 'A1', 'values': [["key", "value"], ["admin_emails", "admin@example.com"], ["reminder_days", "5,3"]]}])
            
        records = ws.get_all_records()
        return {r["key"]: r["value"] for r in records}
    except Exception as e:
        print(f"Error in get_system_settings: {e}")
        return {}

MONTHLY_COMMON_PREFIX = "monthly_common_"

def get_monthly_common_items() -> List[Dict]:
    """Return all stored monthly common items as a list sorted by year_month desc."""
    settings = get_system_settings()
    items = []
    for key, val in settings.items():
        if key.startswith(MONTHLY_COMMON_PREFIX):
            ym = key[len(MONTHLY_COMMON_PREFIX):]
            if val:
                items.append({"year_month": ym, "item": str(val)})
    items.sort(key=lambda x: x["year_month"], reverse=True)
    return items

def update_monthly_common_item(item: str, year_month: str) -> bool:
    """Upsert the monthly common item for a specific year_month."""
    try:
        wb = get_db_connection()
        if not wb: return False
        try:
            ws = wb.worksheet("admin_settings")
        except:
            ws = wb.add_worksheet(title="admin_settings", rows=20, cols=2)
            ws.batch_update([{'range': 'A1', 'values': [["key", "value"]]}])

        records = ws.get_all_records()
        settings = {r["key"]: r["value"] for r in records if r.get("key")}
        settings[f"{MONTHLY_COMMON_PREFIX}{year_month}"] = item

        all_rows = [["key", "value"]] + [[k, str(v)] for k, v in settings.items()]
        ws.clear()
        ws.batch_update([{'range': 'A1', 'values': all_rows}])
        return True
    except Exception as e:
        print(f"Error in update_monthly_common_item: {e}")
        return False

def delete_monthly_common_item(year_month: str) -> bool:
    """Delete the monthly common item for a specific year_month."""
    try:
        wb = get_db_connection()
        if not wb: return False
        try:
            ws = wb.worksheet("admin_settings")
        except:
            return True
        records = ws.get_all_records()
        settings = {r["key"]: r["value"] for r in records if r.get("key")}
        settings.pop(f"{MONTHLY_COMMON_PREFIX}{year_month}", None)
        all_rows = [["key", "value"]] + [[k, str(v)] for k, v in settings.items()]
        ws.clear()
        ws.batch_update([{'range': 'A1', 'values': all_rows}])
        return True
    except Exception as e:
        print(f"Error in delete_monthly_common_item: {e}")
        return False

def update_system_settings(data: Dict) -> bool:
    """Update system-wide settings."""
    try:
        wb = get_db_connection()
        if not wb: return False
        ws = wb.worksheet("admin_settings")
        
        all_rows = [["key", "value"]]
        for k, v in data.items():
            all_rows.append([k, str(v)])
            
        ws.clear()
        ws.batch_update([{'range': 'A1', 'values': all_rows}])
        return True
    except Exception as e:
        print(f"Error in update_system_settings: {e}")
        return False

# --- Legacy Compatibility / Wrappers ---
# We keep these for now to avoid breaking main.py immediately

def save_order(order: Dict) -> bool:
    return batch_save_orders([order])

def update_class_master(kindergarten_id, class_name, data):
    return update_class_counts(kindergarten_id, class_name, data)

def get_kindergarten_master() -> List[KindergartenMaster]:
    return get_kindergartens()

def get_class_master() -> List[ClassMaster]:
    # This might need to be filtered in calling code or rewritten
    wb = get_db_connection()
    if not wb: return []
    ws = wb.worksheet("classes")
    return [ClassMaster(**r) for r in ws.get_all_records()]
