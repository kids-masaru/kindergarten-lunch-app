import os
import datetime
from typing import List, Optional
from backend.sheets import get_system_settings, get_kindergartens, get_orders_for_month

LOG_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'notifications.log')

def _log_email(to: str, subject: str, body: str):
    """Mocks sending an email by logging it to a file."""
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] TO: {to}\n")
        f.write(f"SUBJECT: {subject}\n")
        f.write(f"BODY:\n{body}\n")
        f.write("-" * 40 + "\n")
    print(f"[NOTIFICATION] Email logged to {LOG_FILE}: {subject}")

def send_admin_notification(action_type: str, kindergarten_name: str, details: str):
    """Sends an immediate notification to all registered admins."""
    settings = get_system_settings()
    admin_emails = settings.get("admin_emails", "").split(",")
    admin_emails = [e.strip() for e in admin_emails if e.strip()]
    
    if not admin_emails:
        print("[WARNING] No admin emails configured for notifications.")
        return

    subject = f"【ママミレ通知】{kindergarten_name}: {action_type}"
    body = f"""通知内容: {action_type}
幼稚園名: {kindergarten_name}
発生日時: {datetime.datetime.now().strftime("%Y/%m/%d %H:%M")}

詳細:
{details}

---
ママミレ (MamaMiRe) システム
"""
    
    for email in admin_emails:
        _log_email(email, subject, body)

def check_and_send_reminders():
    """Checks all kindergartens and sends reminders for monthly submissions."""
    settings = get_system_settings()
    reminder_days_str = settings.get("reminder_days", "5,3")
    try:
        reminder_days = [int(d.strip()) for d in reminder_days_str.split(",") if d.strip()]
    except:
        reminder_days = [5, 3]

    now = datetime.datetime.now()
    target_year = now.year
    target_month = now.month
    
    # Next month's deadline is 25th of current month? 
    # Or current month's deadline is 25th of previous month?
    # Context suggests: 25th of PREVIOUS month for NEXT month's orders.
    # If today is Feb 20, we are aiming for March orders, deadline Feb 25.
    
    deadline_day = 25
    deadline_date = datetime.datetime(target_year, target_month, deadline_day)
    
    days_until_deadline = (deadline_date - now).days + 1
    
    if days_until_deadline not in reminder_days:
        print(f"[REMIDER] No reminder scheduled for today ({days_until_deadline} days until deadline).")
        return

    # Fetch all kindergartens
    kindergartens = get_kindergartens()
    for k in kindergartens:
        # Check if they have submitted for NEXT month
        next_month = (target_month % 12) + 1
        next_year = target_year if next_month > target_month else target_year + 1
        
        orders = get_orders_for_month(k.kindergarten_id, next_year, next_month)
        if not orders:
            # Send Reminder
            subject = f"【ママミレリマインド】{next_month}月分のご注文が未完了です"
            body = f"""{k.name} {k.contact_name} 様

いつも「ママミレ (MamaMiRe)」をご利用いただきありがとうございます。
{next_month}月分のご注文内容の登録がまだ完了しておりません。

締め切り日: {target_month}月25日（残り{days_until_deadline}日）

お早めにシステムよりマンスリー申請のお手続きをお願いいたします。

---
ママミレ (MamaMiRe) システム
"""
            if k.contact_email:
                _log_email(k.contact_email, subject, body)
            else:
                print(f"[WARNING] No email for {k.name}, skipping reminder.")
