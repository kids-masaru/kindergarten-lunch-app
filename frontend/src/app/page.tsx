"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCalendar, getMasters, generateMenu } from '@/lib/api';
import { LoginUser, Order, ClassMaster } from '@/types';
import { ChevronLeft, ChevronRight, LogOut, Loader2, ClipboardList, FileDown } from 'lucide-react';
import OrderModal from '@/components/OrderModal';
import ClassReportPanel from '@/components/ClassReportPanel';

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
            <h1 className="font-bold text-gray-800 text-lg">{user.name} 様</h1>
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
        {/* Desktop Split View: PC shows both side-by-side */}
        <div className="flex flex-col lg:flex-row gap-8">

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
                    const s = user.settings;
                    switch (dayOfWeek) {
                      case 0: isServiceDay = s.service_sun !== false; break;
                      case 1: isServiceDay = s.service_mon !== false; break;
                      case 2: isServiceDay = s.service_tue !== false; break;
                      case 3: isServiceDay = s.service_wed !== false; break;
                      case 4: isServiceDay = s.service_thu !== false; break;
                      case 5: isServiceDay = s.service_fri !== false; break;
                      case 6: isServiceDay = s.service_sat !== false; break;
                    }
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

        {/* Footer Notes */}
        <div className="mt-8 p-6 text-xs text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm leading-relaxed">
          <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">⚠️ ご注文に関する注意点</h3>
          <ul className="list-disc pl-4 space-y-1">
            <li>入力締切は、**配送前日の14:00まで**となっております。必ず期限内の入力をお願いいたします。</li>
            <li>月次データ設定（クラス人数）は、毎月25日までに翌月分の更新をお願いします。</li>
            <li>アレルギー対応が必要な園児様がいらっしゃる場合は、該当注文の「アレルギー」欄に必ず数をご記入ください。</li>
            <li>急な変更の場合は、お電話（0120-XXX-XXX）にて直接ご連絡ください。</li>
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
    </div >
  );
}
