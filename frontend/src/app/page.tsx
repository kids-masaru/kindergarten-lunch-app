"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCalendar, getMasters } from '@/lib/api';
import { LoginUser, Order, ClassMaster } from '@/types';
import { ChevronLeft, ChevronRight, LogOut, Loader2 } from 'lucide-react';
import OrderModal from '@/components/OrderModal';

export default function CalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState<LoginUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [classes, setClasses] = useState<ClassMaster[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    switch (type) {
      case 'カレー': return '🍛';
      case 'パン': return '🥖'; // Changed from 🍞 for visibility?
      case '誕生会': return '🎂';
      case 'ピクニック': return '🍱';
      case '飯なし': return '❌';
      default: return '✅'; // Usually rice
    }
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0 is Sunday

  if (loading || !user) return <div className="flex h-screen items-center justify-center text-orange-500"><Loader2 className="animate-spin w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <h1 className="font-bold text-gray-800">{user.name}</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push('/report')} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-bold hover:bg-blue-100">
            <span>クラス報告</span>
          </button>
          <button onClick={() => { localStorage.removeItem('user'); router.push('/login'); }} className="text-gray-400 hover:text-gray-600 p-2">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="flex justify-between items-center px-6 py-4">
        <button onClick={() => setMonth(m => m === 1 ? 12 : m - 1)} className="p-2 bg-white rounded-full shadow border hover:bg-gray-50">
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-900">{year}年 {month}月</h2>
        <button onClick={() => setMonth(m => m === 12 ? 1 : m + 1)} className="p-2 bg-white rounded-full shadow border hover:bg-gray-50">
          <ChevronRight className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="px-2">
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
            const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;

            return (
              <button
                key={day}
                onClick={() => handleDateClick(day)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-start pt-1 relative border transition-all active:scale-95 ${isToday ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-100'
                  } shadow-sm`}
              >
                <span className={`text-sm font-bold ${isToday ? 'text-orange-600' : 'text-gray-700'}`}>{day}</span>
                <div className="mt-1 text-2xl">
                  {icon || <span className="text-xs text-gray-200 mt-2 block">未</span>}
                </div>
                {dayOrders.length > 0 && (
                  <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-green-500"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {selectedDate && (
        <OrderModal
          date={selectedDate}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          user={user}
          classes={classes}
          existingOrders={getOrdersForDay(selectedDate.getDate())}
          onSave={() => fetchOrders(user.kindergarten_id, year, month)}
        />
      )}
    </div>
  );
}
