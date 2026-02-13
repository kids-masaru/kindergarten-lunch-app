"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCalendar, getMasters, generateMenu } from '@/lib/api';
import { LoginUser, Order, ClassMaster } from '@/types';
import OrderModal from '@/components/OrderModal';
import ClassReportPanel from '@/components/ClassReportPanel';
import MonthlySetupModal from '@/components/MonthlySetupModal';
import { CalendarIcon, ChevronLeft, ChevronRight, LogOut, Loader2, ClipboardList, Send, AlertCircle, Check } from 'lucide-react';

// Version: UI Layout V3 (Split & Tabs)
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
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleMonthlySetupComplete = () => {
    setIsSubmitted(true);
    fetchOrders(user!.kindergarten_id, year, month);
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const u = JSON.parse(userData);
    setUser(u);

    // Fetch masters
    getMasters(u.kindergarten_id).then(res => {
      setClasses(res.classes);
    });

    setLoading(false);
    fetchOrders(u.kindergarten_id, year, month);
  }, [router, year, month]);

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
          <div className="flex items-center gap-3">
            <img src="/favicon-bento.ico" className="w-8 h-8 pointer-events-none" alt="" />
            <div className="flex flex-col">
              <h1 className="font-bold text-gray-800 text-lg leading-tight">{user.name} 様</h1>
              {user.settings && (
                <div className="flex gap-1 mt-0.5">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day, idx) => {
                    const labels: any = { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日' };
                    const isActive = (user.settings as any)?.[`service_${day}`];
                    if (!isActive) return null;
                    return (
                      <span key={day} className="text-[9px] font-bold bg-gray-50 text-gray-400 px-1 rounded border border-gray-100 uppercase">
                        {labels[day]}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { localStorage.removeItem('user'); router.push('/login'); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Tabs - Mobile Only (Hidden on Desktop) */}
        <div className="grid grid-cols-2 lg:hidden">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center justify-center p-3 border-b-2 font-bold transition-colors ${activeTab === 'calendar'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-transparent text-gray-500 hover:bg-gray-50'
              }`}
          >
            <span className="text-sm">📅 日々の注文</span>
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex flex-col items-center justify-center p-3 border-b-2 font-bold transition-colors ${activeTab === 'report'
              ? 'border-orange-500 bg-orange-50 text-orange-700'
              : 'border-transparent text-gray-500 hover:bg-gray-50'
              }`}
          >
            <span className="text-sm flex items-center gap-1"><ClipboardList className="w-4 h-4" /> 登録クラス情報</span>
          </button>
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

            <div className="pt-8 grid grid-cols-2 gap-4 max-w-md mx-auto opacity-50 grayscale pointer-events-none">
              <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-200 mb-2"></div>
                <div className="w-12 h-2 bg-gray-200 rounded"></div>
              </div>
              <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex flex-col items-center">
                <div className="w-8 h-8 rounded-lg bg-gray-200 mb-2"></div>
                <div className="w-12 h-2 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ) : (
          /* Desktop Split View: PC shows both side-by-side */
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">

            {/* Calendar Section (Visible if activeTab=calendar OR on Desktop) */}
            <div className={`flex-1 ${activeTab !== 'calendar' ? 'hidden lg:block' : ''}`}>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                {/* Calendar Controls */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMonth(m => m === 1 ? 12 : m - 1)} className="p-2 bg-gray-50 rounded-full border hover:bg-gray-100">
                      <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h2 className="text-xl font-bold text-gray-900">{year}年 {month}月</h2>
                    <button onClick={() => setMonth(m => m === 12 ? 1 : m + 1)} className="p-2 bg-gray-50 rounded-full border hover:bg-gray-100">
                      <ChevronRight className="w-6 h-6 text-gray-600" />
                    </button>
                  </div>
                </div>

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
                    const icon = getDayIcon(dayOrders);
                    const dObj = new Date(year, month - 1, day);
                    const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;

                    // Service Day Check
                    let isServiceDay = true;
                    if (user && user.settings) {
                      const dayOfWeek = dObj.getDay(); // 0:Sun, 1:Mon...
                      const s = user.settings as any;
                      const mapping: any = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
                      isServiceDay = s[`service_${mapping[dayOfWeek]}`] !== false;
                    }

                    // Icon Logic
                    let displayIcon = null;
                    if (!isServiceDay) {
                      displayIcon = <span className="text-xs text-gray-300">－</span>;
                    } else if (dayOrders.length > 0) {
                      // Has Order -> Checkmark (Unified)
                      const type = dayOrders[0].meal_type;
                      if (type === '飯なし') displayIcon = '❌';
                      else displayIcon = '✅';
                    } else {
                      // Service Day but No Order -> Blank (to avoid confusion)
                      displayIcon = null;
                    }

                    return (
                      <button
                        key={day}
                        onClick={() => isServiceDay && handleDateClick(day)}
                        disabled={!isServiceDay}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-start pt-1 relative border transition-all 
                          ${!isServiceDay
                            ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed opacity-50'
                            : isToday
                              ? 'bg-orange-50 border-orange-300 active:scale-95 shadow-sm hover:border-orange-200'
                              : 'bg-white border-gray-200 active:scale-95 shadow-sm hover:border-orange-200'
                          }`}
                      >
                        <span className={`text-sm font-bold ${!isServiceDay ? 'text-gray-300' : isToday ? 'text-orange-600' : 'text-gray-700'}`}>{day}</span>
                        <div className="mt-1 text-2xl lg:text-3xl">
                          {displayIcon}
                        </div>
                        {dayOrders.length > 0 && isServiceDay && (
                          <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-green-500"></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Class Report Section (Visible if activeTab=report OR on Desktop) */}
            <div className={`w-full lg:w-96 ${activeTab !== 'report' ? 'hidden lg:block' : ''}`}>
              <ClassReportPanel
                user={user}
                classes={classes}
                onSaved={() => getMasters(user.kindergarten_id).then(res => setClasses(res.classes))}
              />
            </div>

          </div>
        )}

        {/* Footer Notes */}
        <div className="mt-8 p-6 text-xs text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm leading-relaxed">
          <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">⚠️ ご注文に関する注意点</h3>
          <ul className="list-disc pl-4 space-y-1">
            <li>注文の締め切りは、**前日の14:00まで**となっております。必ず期限内にお願いいたします。</li>
            <li>「今月の申請（基本設定）」は、毎月25日までに翌月分の送信を完了させてください。</li>
            <li>人数やメニューの急な変更は、こちらのカレンダーから修正後「内容を送信する」を押してください。</li>
            <li>3日前を過ぎた変更や緊急の場合は、お電話（0120-XXX-XXX）にて直接ご連絡ください。</li>
            <li>システムに関するお問い合わせは、担当：山田（平日 9:00-17:00）まで。</li>
          </ul>
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
    </div >
  );
}
