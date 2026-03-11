"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCalendar, getMasters, saveOrder, updateOrderDefaults, createOrdersBulk } from '@/lib/api';
import { LoginUser, Order, ClassMaster } from '@/types';
import ClassReportPanel from '@/components/ClassReportPanel';
import MonthlySetupModal from '@/components/MonthlySetupModal';
import { CalendarIcon, ChevronLeft, ChevronRight, LogOut, Loader2, Send, Settings as SettingsIcon, X, Save, Users, Minus, Plus, Calendar } from 'lucide-react';
import CalendarCellClassless from '@/components/CalendarCellClassless';
import CalendarCellWithClasses from '@/components/CalendarCellWithClasses';

// Version: UI Layout V3 (Split & Tabs)

// --- Classless Default Panel ---
function ClasslessPanel({ user, orders, onRefresh }: { user: LoginUser, orders: Order[], onRefresh: () => void }) {
  const firstOrder = orders.find(o => o.class_name === '共通');
  const [student, setStudent] = useState(firstOrder?.student_count ?? 0);
  const [allergy, setAllergy] = useState(firstOrder?.allergy_count ?? 0);
  const [teacher, setTeacher] = useState(firstOrder?.teacher_count ?? 0);
  const [fromDate, setFromDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (firstOrder) {
      setStudent(firstOrder.student_count);
      setAllergy(firstOrder.allergy_count);
      setTeacher(firstOrder.teacher_count);
    }
  }, [orders]);

  const handleSave = async () => {
    if (!fromDate) { alert("変更開始日を選択してください"); return; }
    setSaving(true);
    try {
      await updateOrderDefaults({
        kindergarten_id: user.kindergarten_id,
        from_date: fromDate,
        student_count: student,
        allergy_count: allergy,
        teacher_count: teacher,
      });
      alert(`${fromDate} 以降の基本人数を変更しました`);
      setFromDate('');
      onRefresh();
    } catch (e) {
      alert('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const adj = (setter: React.Dispatch<React.SetStateAction<number>>, d: number) =>
    setter(v => Math.max(0, v + d));

  return (
    <div className="w-full lg:w-96">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" /> 基本人数
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">※ 全日に適用される基本人数（日ごとの変更はカレンダーから）</p>
        </div>
        <div className="p-4 space-y-3">
          {/* Current defaults display */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '園児', value: student, set: setStudent, color: 'text-gray-800' },
              { label: 'アレルギー', value: allergy, set: setAllergy, color: 'text-red-500' },
              { label: '先生', value: teacher, set: setTeacher, color: 'text-gray-800' },
            ].map(({ label, value, set, color }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                <p className={`text-[9px] font-black uppercase text-center mb-1 ${label === 'アレルギー' ? 'text-red-400' : 'text-gray-400'}`}>{label}</p>
                <div className="flex items-center justify-between gap-1">
                  <button onClick={() => adj(set, -1)} className="p-1 text-gray-400 hover:text-orange-500 rounded"><Minus className="w-3 h-3" /></button>
                  <span className={`font-black text-lg ${color}`}>{value}</span>
                  <button onClick={() => adj(set, 1)} className="p-1 text-gray-400 hover:text-orange-500 rounded"><Plus className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Date picker */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> 変更の適用開始日
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm font-bold focus:ring-2 focus:ring-orange-100 outline-none"
            />
            <p className="text-[9px] text-gray-400 mt-1">
              {fromDate ? `${fromDate} 以降の注文に反映されます` : '開始日を選択してください'}
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !fromDate}
            className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold text-base hover:bg-orange-600 flex items-center justify-center gap-2 shadow-lg ring-4 ring-orange-100 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> 変更を申請する</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Settings Modal ---
function SettingsModal({ kindergarten, onClose, onSave }: { kindergarten: any, onClose: () => void, onSave: (data: any) => void }) {
  const [formData, setFormData] = useState({
    contact_name: kindergarten.contact_name || '',
    contact_email: kindergarten.contact_email || '',
    icon_url: kindergarten.icon_url || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden scale-in">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-orange-50/30">
          <h2 className="text-xl font-black text-gray-800">園情報設定</h2>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
        </div>
        <div className="p-8 space-y-6">
          <div>
            <label className="text-xs font-black text-gray-400 uppercase block mb-2">担当者名</label>
            <input
              type="text"
              value={formData.contact_name}
              onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
              placeholder="例: 山田 太郎"
            />
          </div>
          <div>
            <label className="text-xs font-black text-gray-400 uppercase block mb-2">連絡先メールアドレス</label>
            <input
              type="email"
              value={formData.contact_email}
              onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
              placeholder="example@mail.com"
            />
          </div>
        </div>
        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 px-6 rounded-2xl font-bold text-gray-400 hover:bg-gray-200 transition-all">キャンセル</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 px-6 rounded-2xl bg-orange-500 text-white font-black shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all flex items-center justify-center gap-2">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> 保存する</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState<LoginUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [classes, setClasses] = useState<ClassMaster[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'calendar' | 'report'>('calendar');
  const [loading, setLoading] = useState(true);
  const [isMonthlySetupOpen, setIsMonthlySetupOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, any[]>>(new Map());
  const [isSubmittingPending, setIsSubmittingPending] = useState(false);

  const handleMonthlySetupComplete = () => {
    setIsSubmitted(true);
    setPendingChanges(new Map());
    fetchOrders(user!.kindergarten_id, year, month);
  };

  const submitPendingChanges = async () => {
    if (pendingChanges.size === 0) return;
    setIsSubmittingPending(true);
    try {
      const allOrders = Array.from(pendingChanges.values()).flat();
      await createOrdersBulk(allOrders);
      setPendingChanges(new Map());
      await fetchOrders(user!.kindergarten_id, year, month);
    } catch (e) {
      alert('送信に失敗しました');
    } finally {
      setIsSubmittingPending(false);
    }
  };

  const [showSettings, setShowSettings] = useState(false);

  // Initial Login Check
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const u = JSON.parse(userData);
    setUser(u);

    setLoading(false);
    fetchOrders(u.kindergarten_id, year, month);
  }, [router, year, month]);

  const handleUpdateSettings = async (data: any) => {
    try {
      if (!user) return;
      // Import dynamically to avoid build issues if new
      const { updateAdminKindergarten } = await import('@/lib/api');

      // Re-using admin API might be risky if it requires different auth/permissions context, 
      // but currently our auth is simple. 
      // However, updateAdminKindergarten calls `/api/admin/kindergartens/{id}/update`. 
      // Let's use a new wrapper or the same one.

      await updateAdminKindergarten(user.kindergarten_id, data);

      // Update Local State
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
      alert("設定を保存しました");
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    }
  };

  const fetchMasters = useCallback(async (kid: string, y: number, m: number) => {
    try {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-01`;
      const data = await getMasters(kid, dateStr);
      setClasses(data.classes);
      // Always refresh services from backend so meal type options are up to date
      if (data.services && data.services.length > 0) {
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, services: data.services };
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      console.error('Failed to fetch masters:', e);
    }
  }, []);

  // Removed duplicate useEffect

  useEffect(() => {
    if (user) {
      fetchMasters(user.kindergarten_id, year, month);
    }
  }, [user, year, month, fetchMasters]);

  const fetchOrders = async (kid: string, y: number, m: number) => {
    try {
      const res = await getCalendar(kid, y, m);
      setOrders(res.orders);
      setIsSubmitted(res.orders.length > 0);
    } catch (e) {
      console.error(e);
    }
  };


  const getOrdersForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return pendingChanges.get(dateStr) ?? orders.filter(o => o.date === dateStr);
  };

  const isDayPending = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return pendingChanges.has(dateStr);
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  // 月〜金のみ表示（土日除外）
  const weekdays: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) weekdays.push(d);
  }
  // 月〜金グリッドの先頭オフセット（月=0, 火=1, ...金=4）
  const firstWeekdayDow = weekdays.length > 0 ? new Date(year, month - 1, weekdays[0]).getDay() : 1;
  const weekdayOffset = firstWeekdayDow - 1;

  if (loading || !user) return <div className="flex h-screen items-center justify-center text-orange-500"><Loader2 className="animate-spin w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header：1行にまとめてコンパクトに */}
      <div className="bg-white shadow-sm sticky top-0 z-[30] border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center gap-2">
          {/* ロゴ */}
          <img src="/icon-mamamire.png" className="w-9 h-9 shrink-0 pointer-events-none" alt="" />
          {/* 園名 */}
          <span className="font-bold text-gray-800 text-base leading-tight truncate flex-1 min-w-0">
            {user.name}
          </span>
          {/* 月ナビ */}
          <button
            onClick={() => { setPendingChanges(new Map()); setMonth(m => { if (m === 1) { setYear(y => y - 1); return 12; } return m - 1; }); }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-black text-gray-800 whitespace-nowrap">{year}年 {month}月</h2>
          <button
            onClick={() => { setPendingChanges(new Map()); setMonth(m => { if (m === 12) { setYear(y => y + 1); return 1; } return m + 1; }); }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {/* 申請済みバッジ */}
          {isSubmitted && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-full border border-green-100 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-green-600">申請済み</span>
            </div>
          )}
          {/* 設定・ログアウト */}
          <button onClick={() => setShowSettings(true)} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors shrink-0">
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button onClick={() => { localStorage.removeItem('user'); router.push('/login'); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shrink-0">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-2 sm:p-6">
        {/* Conditional View: Not Submitted vs Submitted */}
        {!isSubmitted ? (
          <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center flex-shrink-0 border border-orange-100">
                <CalendarIcon className="w-6 h-6 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-black text-gray-800 text-base">{year}年 {month}月の注文申請が未完了です</h2>
                <p className="text-xs text-gray-400 mt-0.5">毎月25日までに翌月分の申請を完了してください</p>
              </div>
              <button
                onClick={() => setIsMonthlySetupOpen(true)}
                className="bg-orange-500 text-white px-4 py-3 rounded-xl font-black text-sm hover:bg-orange-600 transition-all shadow-md shadow-orange-100 active:scale-95 flex items-center gap-2 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
                申請を開始
              </button>
            </div>
          </div>
        ) : (
          /* Desktop Split View: Always show both side-by-side (responsively stacked on mobile) */
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">

            {/* Calendar Section */}
            <div className="flex-1">
              {/* 未送信の変更がある場合の申請ボタン */}
              {pendingChanges.size > 0 && (
                <div className="mb-3">
                  <button
                    onClick={submitPendingChanges}
                    disabled={isSubmittingPending}
                    className="w-full bg-orange-500 text-white py-4 rounded-xl font-black text-lg hover:bg-orange-600 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                  >
                    {isSubmittingPending
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <><Send className="w-5 h-5" />{pendingChanges.size}日分の変更を申請する</>
                    }
                  </button>
                  <p className="text-center text-sm text-orange-600 font-bold mt-1">※ 上のボタンを押すまで変更は送信されません</p>
                </div>
              )}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 overflow-x-auto">
                {/* Calendar Grid（月〜金の5列） */}
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-5 gap-1 mb-2">
                    {['月', '火', '水', '木', '金'].map(d => (
                      <div key={d} className="text-center text-base font-black text-gray-500">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-1 auto-rows-[8rem]">
                    {Array(weekdayOffset).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
                    {weekdays.map(day => {
                      const dayOrders = getOrdersForDay(day);
                      const dObj = new Date(year, month - 1, day);
                      const pending = isDayPending(day);

                      // Service Day Check
                      let isServiceDay = true;
                      if (user && user.settings) {
                        const dayOfWeek = dObj.getDay();
                        const s = user.settings as any;
                        const mapping: any = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
                        isServiceDay = s[`service_${mapping[dayOfWeek]}`] !== false;
                      }

                      // Deadline Logic
                      const now = new Date();
                      const lockDeadline = new Date(year, month - 1, day - 1, 15, 0, 0);
                      const isStrictLocked = now > lockDeadline;
                      const graceDeadline = new Date(year, month - 1, day - 3, 18, 0, 0);
                      const isGraceLocked = now > graceDeadline;

                      const isClasslessMode = classes.length === 0;

                      if (isClasslessMode) {
                        const existingOrder = dayOrders.find(o => o.class_name === '共通');
                        return (
                          <div key={day} className="h-[8rem]">
                            <CalendarCellClassless
                              day={day}
                              year={year}
                              month={month}
                              kindergartenId={user?.kindergarten_id || ''}
                              existingOrder={existingOrder}
                              isServiceDay={isServiceDay}
                              isLocked={isStrictLocked}
                              isGraceLocked={isGraceLocked}
                              mealOptions={user?.services || []}
                              isPending={pending}
                              onSave={async (order) => {
                                setPendingChanges(prev => new Map(prev).set(order.date, [order]));
                              }}
                            />
                          </div>
                        );
                      }

                      return (
                        <div key={day} className="h-[8rem]">
                          <CalendarCellWithClasses
                            day={day}
                            year={year}
                            month={month}
                            kindergartenId={user?.kindergarten_id || ''}
                            classes={classes}
                            existingOrders={dayOrders}
                            isServiceDay={isServiceDay}
                            isLocked={isStrictLocked}
                            isGraceLocked={isGraceLocked}
                            mealOptions={user?.services || []}
                            isPending={pending}
                            onSave={async (orders) => {
                              if (orders[0]?.date) {
                                setPendingChanges(prev => new Map(prev).set(orders[0].date, orders));
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Class Report Section */}
            {classes.length > 0 ? (
              <div className="w-full lg:w-96">
                <ClassReportPanel
                  user={user}
                  classes={classes}
                  onSaved={() => fetchMasters(user.kindergarten_id, year, month)}
                />
              </div>
            ) : (
              /* Classless Mode: Editable defaults panel */
              <ClasslessPanel
                user={user}
                orders={orders}
                onRefresh={() => fetchOrders(user.kindergarten_id, year, month)}
              />
            )}

          </div>
        )}

        {/* Footer Notes */}
        {/* Instructions */}
        <div className="mt-8 p-6 text-xs text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm leading-relaxed">
          <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">⚠️ ご注文に関する注意点</h3>
          <div className="space-y-2">
            <p className="font-bold text-gray-800">注文の締め切りは、<span className="text-red-500">前日の15:00まで</span>となっております。必ず期限内にお願いいたします。</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>「今月の申請（基本設定）」は、毎月25日までに翌月分の送信を完了させてください。</li>
              <li>人数やメニューの急な変更は、こちらのカレンダーから修正後「内容を送信する」を押してください。</li>
              <li><span className="text-orange-600 font-bold">3日前の18:00</span>を過ぎた変更は警告が表示されます。<span className="text-red-500 font-bold">前日15:00</span>を過ぎるとシステムからの変更はできません。</li>
              <li>緊急の場合は、お電話（0120-XXX-XXX）にて直接ご連絡ください。</li>
              <li>システムに関するお問い合わせは、担当：山田（平日 9:00-17:00）まで。</li>
            </ul>
          </div>
        </div>
      </div>

      <MonthlySetupModal
        isOpen={isMonthlySetupOpen}
        onClose={() => setIsMonthlySetupOpen(false)}
        user={user}
        classes={classes}
        year={year}
        month={month}
        onComplete={handleMonthlySetupComplete}
      />

      {showSettings && user && (
        <SettingsModal
          kindergarten={user}
          onClose={() => setShowSettings(false)}
          onSave={handleUpdateSettings}
        />
      )}
    </div >
  );
}
