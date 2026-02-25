"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCalendar, getMasters, generateMenu, saveOrder } from '@/lib/api';
import { LoginUser, Order, ClassMaster } from '@/types';
import OrderModal from '@/components/OrderModal';
import ClassReportPanel from '@/components/ClassReportPanel';
import MonthlySetupModal from '@/components/MonthlySetupModal';
import ClassChangeRequestModal from '@/components/ClassChangeRequestModal';
import { CalendarIcon, ChevronLeft, ChevronRight, LogOut, Loader2, ClipboardList, Send, AlertCircle, Check, Download, AlertTriangle, Clock, Phone, Edit3, Settings as SettingsIcon, X, Save, Edit, Users } from 'lucide-react';
import CalendarCellClassless from '@/components/CalendarCellClassless';

// Version: UI Layout V3 (Split & Tabs)

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'report'>('calendar');
  const [loading, setLoading] = useState(true);
  const [isMonthlySetupOpen, setIsMonthlySetupOpen] = useState(false);
  const [isChangeRequestOpen, setIsChangeRequestOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleMonthlySetupComplete = () => {
    setIsSubmitted(true);
    fetchOrders(user!.kindergarten_id, year, month);
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
      // Fetch masters for the specific month (effective as of 1st day)
      const dateStr = `${y}-${String(m).padStart(2, '0')}-01`;
      const data = await getMasters(kid, dateStr);
      setClasses(data.classes);
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


  const handleDateClick = (date: number) => {
    if (!user) return;
    const d = new Date(year, month - 1, date);
    setSelectedDate(d);
    setIsModalOpen(true);
  };

  const getOrdersForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return orders.filter(o => o.date === dateStr);
  };

  const getDayIcon = (dayOrders: Order[]) => {
    if (dayOrders.length === 0) return null;
    const type = dayOrders[0].meal_type;
    // Special case for "No Meal" explicitly
    if (type === '飯なし') return '❌';

    // For ALL other types (Curry, Bread, Rice, Birthday, etc.), show generic Circle
    return '⭕️';
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0 is Sunday

  if (loading || !user) return <div className="flex h-screen items-center justify-center text-orange-500"><Loader2 className="animate-spin w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10 z-[30]">
        {/* Top Bar */}
        <div className="flex justify-between items-center p-3 border-b border-gray-100 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <img src="/icon-mamamire.png" className="w-12 h-12 pointer-events-none" alt="" />
            <div className="flex flex-col">
              <h1 className="font-bold text-gray-800 text-lg leading-tight">
                {user.name} <span className="text-gray-400 font-medium ml-1">{user.contact_name ? `${user.contact_name} 様` : ''}</span>
              </h1>
              {user.settings && (
                <div className="flex gap-1 mt-0.5">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day, idx) => {
                    const labels: any = { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日' };
                    const isActive = (user.settings as any)?.[`service_${day}`];
                    if (!isActive) return null;
                    return (
                      <span key={day} className="text-[9px] font-black bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded border border-orange-100 uppercase leading-none">
                        {labels[day]}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors" title="設定">
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button onClick={() => { localStorage.removeItem('user'); router.push('/login'); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Month Navigation */}
        <div className="bg-white/50 backdrop-blur-sm border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-2 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMonth(m => {
                  if (m === 1) { setYear(y => y - 1); return 12; }
                  return m - 1;
                })}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-black text-gray-800 tracking-tight">{year}年 {month}月</h2>
              <button
                onClick={() => setMonth(m => {
                  if (m === 12) { setYear(y => y + 1); return 1; }
                  return m + 1;
                })}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
            {isSubmitted && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-green-600 uppercase">申請済み</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-2 sm:p-6">
        {/* Conditional View: Not Submitted vs Submitted */}
        {!isSubmitted ? (
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-12 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mx-auto w-24 h-24 bg-orange-50 rounded-[2rem] flex items-center justify-center border-4 border-white shadow-lg">
              <CalendarIcon className="w-12 h-12 text-orange-500" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-800 tracking-tight">{year}年 {month}月 の<br />注文申請が未完了です</h2>
            </div>

            <button
              onClick={() => setIsMonthlySetupOpen(true)}
              className="mx-auto bg-orange-500 text-white px-10 py-6 rounded-[2rem] font-black text-2xl hover:bg-orange-600 transition-all shadow-2xl shadow-orange-200 active:scale-95 flex items-center gap-4 group"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-12">
                <Send className="w-6 h-6 text-white" />
              </div>
              今月の申請を開始する
            </button>
          </div>
        ) : (
          /* Desktop Split View: Always show both side-by-side (responsively stacked on mobile) */
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">

            {/* Calendar Section */}
            <div className="flex-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                    <div key={d} className={`text-center text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 auto-rows-fr">
                  {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array(daysInMonth).fill(null).map((_, i) => {
                    const day = i + 1;
                    const dayOrders = getOrdersForDay(day);
                    const dObj = new Date(year, month - 1, day);
                    const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;

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

                    // 1. Strict Lock (Day before 15:00)
                    const lockDeadline = new Date(year, month - 1, day - 1, 15, 0, 0);
                    const isStrictLocked = now > lockDeadline;

                    // 2. Grace Period Lock (3 days before 18:00)
                    const graceDeadline = new Date(year, month - 1, day - 3, 18, 0, 0);
                    const isGraceLocked = now > graceDeadline;

                    // --- Class-less Mode Logic ---
                    const isClasslessMode = classes.length === 0;

                    if (isClasslessMode) {
                      const existingOrder = dayOrders.find(o => o.class_name === '共通');

                      return (
                        <div key={day} className="relative">
                          <CalendarCellClassless
                            day={day}
                            year={year}
                            month={month}
                            kindergartenId={user?.kindergarten_id || ''}
                            existingOrder={existingOrder}
                            isServiceDay={isServiceDay}
                            isLocked={isStrictLocked}
                            isGraceLocked={isGraceLocked}
                            onSave={async (order) => {
                              // Save single order
                              await saveOrder(order);
                              fetchOrders(user!.kindergarten_id, year, month);
                            }}
                          />
                        </div>
                      );
                    }

                    // --- Standard Mode (Classes Exist) ---
                    let displayLabel = null;
                    if (!isServiceDay) {
                      displayLabel = <span className="text-xs text-gray-300">－</span>;
                    } else if (dayOrders.length > 0) {
                      const type = dayOrders[0].meal_type;
                      displayLabel = (
                        <div className={`px-2 py-1.5 rounded-xl border-2 text-[10px] sm:text-[11px] font-black leading-none transition-all
                          ${type === '通常'
                            ? 'border-gray-100 text-gray-400'
                            : type === '飯なし'
                              ? 'border-gray-200 bg-gray-50 text-gray-400'
                              : 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm shadow-orange-100'
                          }`}>
                          {type}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={day}
                        onClick={() => {
                          if (!isServiceDay) return;
                          if (isStrictLocked) {
                            alert("前日15:00を過ぎたため、システムからは変更できません。お電話にてご連絡ください。");
                            return;
                          }
                          if (isGraceLocked) {
                            if (confirm("3日前を過ぎた変更や緊急の場合は、お電話（0120-XXX-XXX）にて直接ご連絡いただく必要があります。このまま入力を続けますか？")) {
                              handleDateClick(day);
                            }
                            return;
                          }
                          handleDateClick(day);
                        }}
                        disabled={!isServiceDay}
                        className={`aspect-square rounded-[1.25rem] flex flex-col items-center justify-start pt-1.5 relative border transition-all 
                          ${!isServiceDay
                            ? 'bg-gray-50/50 border-transparent text-gray-300 cursor-not-allowed opacity-50'
                            : isStrictLocked
                              ? 'bg-gray-100 border-gray-200 opacity-40 grayscale cursor-not-allowed'
                              : isGraceLocked
                                ? 'bg-gray-50 border-gray-200 opacity-80'
                                : isToday
                                  ? 'bg-orange-50 border-orange-300 active:scale-95 shadow-sm hover:border-orange-200'
                                  : 'bg-white border-gray-100 active:scale-95 shadow-sm hover:border-orange-200'
                          }`}
                      >
                        <span className={`text-[10px] font-black leading-none mb-1 ${!isServiceDay ? 'text-gray-300' : isToday ? 'text-orange-600' : 'text-gray-400'}`}>{day}</span>
                        <div className="flex-1 flex items-center justify-center w-full p-1">
                          {displayLabel}
                        </div>
                        {isStrictLocked && isServiceDay && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-1/2 h-[2px] bg-gray-300 rotate-45"></div>
                          </div>
                        )}
                      </button>
                    );
                  })}
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
                  onOpenChangeRequest={() => setIsChangeRequestOpen(true)}
                />
              </div>
            ) : (
              /* Classless Mode: Show summary panel with defaults from 共通 orders */
              (() => {
                // Get first available order to show current defaults
                const firstOrder = orders.find(o => o.class_name === '共通');
                return (
                  <div className="w-full lg:w-96">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 rounded-xl">
                          <Users className="w-5 h-5 text-blue-500" />
                        </div>
                        <h3 className="font-black text-gray-800 text-sm">基本人数</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">園児</p>
                          <p className="text-2xl font-black text-gray-800">{firstOrder?.student_count ?? '-'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                          <p className="text-[10px] font-black text-red-400 uppercase mb-1">アレルギー</p>
                          <p className={`text-2xl font-black ${(firstOrder?.allergy_count ?? 0) > 0 ? 'text-red-500' : 'text-gray-800'}`}>{firstOrder?.allergy_count ?? '-'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">先生</p>
                          <p className="text-2xl font-black text-gray-800">{firstOrder?.teacher_count ?? '-'}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 text-center">💡 日ごとの変更はカレンダーから直接入力できます</p>
                    </div>
                  </div>
                );
              })()
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

      {/* Modal */}
      {
        selectedDate && (
          <OrderModal
            date={selectedDate}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            user={user}
            classes={classes}
            existingOrders={getOrdersForDay(selectedDate.getDate())}
            onSave={() => fetchOrders(user.kindergarten_id, year, month)}
          />
        )
      }

      <MonthlySetupModal
        isOpen={isMonthlySetupOpen}
        onClose={() => setIsMonthlySetupOpen(false)}
        user={user}
        classes={classes}
        year={year}
        month={month}
        onComplete={handleMonthlySetupComplete}
      />

      <ClassChangeRequestModal
        isOpen={isChangeRequestOpen}
        onClose={() => setIsChangeRequestOpen(false)}
        user={user}
        currentClasses={classes}
        onSaved={() => fetchMasters(user.kindergarten_id, year, month)}
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
