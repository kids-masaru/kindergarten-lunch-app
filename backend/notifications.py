import os
import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from backend.sheets import get_system_settings, get_kindergartens, get_orders_for_month

LOG_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'notifications.log')

DEFAULT_ADMIN_TEMPLATE_SUBJECT = "【ママミレ通知】{kindergarten_name}：{action}"
DEFAULT_ADMIN_TEMPLATE_BODY = """\
発生日時：{timestamp}
幼稚園名：{kindergarten_name}
クラス名：{class_name}
対象日付：{date}

変更内容：
{details}

---
ママミレ (MamaMiRe) システム
"""

DEFAULT_CUSTOMER_TEMPLATE_SUBJECT = "【ママミレ】注文内容変更のご確認"
DEFAULT_CUSTOMER_TEMPLATE_BODY = """\
{kindergarten_name} {contact_name} 様

いつも「ママミレ (MamaMiRe)」をご利用いただきありがとうございます。

下記の内容で注文を変更いたしました。

対象日付：{date}
クラス名：{class_name}

変更内容：
{details}

ご不明な点がございましたら、管理者までお問い合わせください。

---
ママミレ (MamaMiRe) システム
"""


def _log_email(to: str, subject: str, body: str):
    """Logs email to file (fallback when SMTP not configured)."""
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] TO: {to}\n")
        f.write(f"SUBJECT: {subject}\n")
        f.write(f"BODY:\n{body}\n")
        f.write("-" * 40 + "\n")
    print(f"[NOTIFICATION] Email logged to {LOG_FILE}: {subject}")


def _send_email(to: str, subject: str, body: str):
    """Sends an email via SMTP if configured, otherwise logs to file."""
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user:
        _log_email(to, subject, body)
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_from
        msg["To"] = to
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [to], msg.as_string())

        print(f"[NOTIFICATION] Email sent to {to}: {subject}")
    except Exception as e:
        print(f"[WARNING] SMTP send failed ({e}), falling back to log.")
        _log_email(to, subject, body)


def _format_template(template: str, variables: dict) -> str:
    """Replace {variable} placeholders in template string."""
    try:
        return template.format(**variables)
    except KeyError:
        # If a key is missing, leave placeholder as-is
        import string
        formatter = string.Formatter()
        result = []
        for literal, field_name, format_spec, conversion in formatter.parse(template):
            result.append(literal)
            if field_name is not None:
                value = variables.get(field_name, "{" + field_name + "}")
                result.append(str(value))
        return "".join(result)


def send_change_notification(
    action: str,
    kindergarten_name: str,
    kindergarten_id: str,
    class_name: str,
    target_date: str,
    details: str,
    contact_name: str = "",
    contact_email: str = "",
):
    """
    Sends change notification to:
    1. All admin emails
    2. The kindergarten's contact email (if available)
    """
    settings = get_system_settings()
    timestamp = datetime.datetime.now().strftime("%Y/%m/%d %H:%M")

    variables = {
        "action": action,
        "kindergarten_name": kindergarten_name,
        "kindergarten_id": kindergarten_id,
        "class_name": class_name,
        "date": target_date,
        "details": details,
        "timestamp": timestamp,
        "contact_name": contact_name or "ご担当者",
    }

    # --- Admin notification ---
    admin_emails_str = settings.get("admin_emails", "")
    admin_emails = [e.strip() for e in admin_emails_str.split(",") if e.strip()]

    admin_subject_tmpl = settings.get("email_template_admin_subject", DEFAULT_ADMIN_TEMPLATE_SUBJECT)
    admin_body_tmpl = settings.get("email_template_admin_body", DEFAULT_ADMIN_TEMPLATE_BODY)

    admin_subject = _format_template(admin_subject_tmpl, variables)
    admin_body = _format_template(admin_body_tmpl, variables)

    for email in admin_emails:
        _send_email(email, admin_subject, admin_body)

    if not admin_emails:
        print("[WARNING] No admin emails configured for notifications.")

    # --- Customer (kindergarten) notification ---
    if contact_email:
        customer_subject_tmpl = settings.get("email_template_customer_subject", DEFAULT_CUSTOMER_TEMPLATE_SUBJECT)
        customer_body_tmpl = settings.get("email_template_customer_body", DEFAULT_CUSTOMER_TEMPLATE_BODY)

        customer_subject = _format_template(customer_subject_tmpl, variables)
        customer_body = _format_template(customer_body_tmpl, variables)

        _send_email(contact_email, customer_subject, customer_body)
    else:
        print(f"[WARNING] No contact email for {kindergarten_name}, skipping customer notification.")


def send_admin_notification(action_type: str, kindergarten_name: str, details: str):
    """Legacy: Sends an immediate notification to all registered admins."""
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
        _send_email(email, subject, body)


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

    deadline_day = 25
    deadline_date = datetime.datetime(target_year, target_month, deadline_day)
    days_until_deadline = (deadline_date - now).days + 1

    if days_until_deadline not in reminder_days:
        print(f"[REMINDER] No reminder scheduled for today ({days_until_deadline} days until deadline).")
        return

    kindergartens = get_kindergartens()
    for k in kindergartens:
        next_month = (target_month % 12) + 1
        next_year = target_year if next_month > target_month else target_year + 1

        orders = get_orders_for_month(k.kindergarten_id, next_year, next_month)
        if not orders:
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
                _send_email(k.contact_email, subject, body)
            else:
                print(f"[WARNING] No email for {k.name}, skipping reminder.")
