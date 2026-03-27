import datetime
import jpholiday
from apscheduler.schedulers.asyncio import AsyncIOScheduler


def get_monthly_reminder_date(year: int, month: int) -> datetime.date:
    """25日、または土日・祝日の場合は次の平日を返す。"""
    target = datetime.date(year, month, 25)
    while target.weekday() >= 5 or jpholiday.is_holiday(target):
        target += datetime.timedelta(days=1)
    return target


def run_monthly_reminder():
    """当日がリマインダー送信日であれば、未入力の園にメールを送信する。"""
    from backend.sheets import get_kindergartens, get_orders_for_month
    from backend.notifications import _send_email

    now = datetime.datetime.now()
    today = now.date()
    reminder_date = get_monthly_reminder_date(now.year, now.month)

    if today != reminder_date:
        print(f"[SCHEDULER] 本日({today})はリマインダー送信日({reminder_date})ではないためスキップします。")
        return

    print(f"[SCHEDULER] {now.year}年{now.month}月分のリマインダーメールを送信します...")

    kindergartens = get_kindergartens()
    sent_count = 0

    for k in kindergartens:
        orders = get_orders_for_month(k.kindergarten_id, now.year, now.month)
        if not orders:
            subject = f"【ママミレ】{now.month}月分のご注文入力のお願い"
            body = f"""{k.name} {k.contact_name or 'ご担当者'} 様

いつも「ママミレ (MamaMiRe)」をご利用いただきありがとうございます。

{now.month}月分のご注文がまだ入力されていないようです。
締め切りは毎月25日となっております。

お早めにシステムよりご入力いただけますよう、よろしくお願いいたします。

---
ママミレ (MamaMiRe) システム
"""
            if k.contact_email:
                _send_email(k.contact_email, subject, body)
                sent_count += 1
                print(f"[SCHEDULER] リマインダー送信: {k.name} <{k.contact_email}>")
            else:
                print(f"[SCHEDULER] メールアドレス未設定のためスキップ: {k.name}")

    print(f"[SCHEDULER] 完了。{sent_count}件送信しました。")


def create_scheduler() -> AsyncIOScheduler:
    """毎朝8時に月次リマインダーを実行するスケジューラーを作成して返す。"""
    scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")
    scheduler.add_job(
        run_monthly_reminder,
        trigger='cron',
        hour=8,
        minute=0,
        id='monthly_reminder',
        name='月次リマインダーメール（毎朝8時）',
        replace_existing=True,
    )
    return scheduler
