"use client";

import { useState, useEffect } from 'react';
import { X, Check, Loader2, Calendar as CalendarIcon, Save } from 'lucide-react';
import { LoginUser, ClassMaster, Order } from '@/types';
import { saveOrder } from '@/lib/api';

interface MonthlySetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: LoginUser;
    classes: ClassMaster[];
    year: number;
    month: number;
    onComplete: () => void;
}

export default function MonthlySetupModal({ isOpen, onClose, user, classes, year, month, onComplete }: MonthlySetupModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const [days, setDays] = useState<{ day: number, dateStr: string, mealType: string }[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        // Generate service days for the month
        const daysInMonth = new Date(year, month, 0).getDate();
        const serviceDays = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month - 1, d);
            const dayOfWeek = date.getDay();
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            let isServiceDay = true;
            if (user && user.settings) {
                const s = user.settings as any;
                const mapping: any = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
                isServiceDay = s[`service_${mapping[dayOfWeek]}`] !== false;
            }

            if (isServiceDay) {
                serviceDays.push({
                    day: d,
                    dateStr,
                    mealType: '通常' // Default
                });
            }
        }
        setDays(serviceDays);
    }, [isOpen, year, month, user]);

    if (!isOpen) return null;

    const handleMealTypeChange = (dateStr: string, type: string) => {
        setDays(prev => prev.map(d => d.dateStr === dateStr ? { ...d, mealType: type } : d));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const allPromises: any[] = [];

            days.forEach(dayInfo => {
                classes.forEach(cls => {
                    const orderData: Order = {
                        kindergarten_id: user.kindergarten_id,
                        date: dayInfo.dateStr,
                        class_name: cls.class_name,
                        meal_type: dayInfo.mealType,
                        student_count: cls.default_student_count,
                        allergy_count: cls.default_allergy_count || 0,
                        teacher_count: cls.default_teacher_count,
                        memo: ""
                    };
                    allPromises.push(saveOrder(orderData));
                });
            });

            await Promise.all(allPromises);
            alert(`${year}年${month}月の基本注文を登録しました。`);
            onComplete();
            onClose();
        } catch (e) {
            console.error(e);
            alert('登録に失敗しました。');
        } finally {
            setSubmitting(false);
        }
    };

    const mealOptions = [
        ...(user.services || []).map(s => ({ value: s, label: s })),
        { value: '飯なし', label: 'なし' }
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-orange-50/50">
                    <div>
                        <h2 className="font-black text-2xl text-gray-800 tracking-tight flex items-center gap-3">
                            <CalendarIcon className="w-8 h-8 text-orange-500" />
                            {year}年{month}月の新規申請
                        </h2>
                        <p className="text-sm font-bold text-orange-400 mt-1 uppercase tracking-widest">Monthly Initial Submission</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white rounded-2xl text-gray-400 hover:text-gray-600 shadow-sm border border-gray-100 transition-all hover:scale-105 active:scale-95">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1 space-y-6">
                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl">
                        <p className="text-sm font-bold text-blue-800 leading-relaxed">
                            💡 各日程のお弁当の種類（通常、カレーなど）を選択してください。<br />
                            人数は各クラスの基本設定値が反映されます。
                        </p>
                    </div>

                    <div className="space-y-3">
                        {days.map(d => (
                            <div key={d.dateStr} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 group hover:border-orange-100 transition-colors">
                                <div className="flex items-center gap-3 mb-3 sm:mb-0">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-black text-gray-300 leading-none">DAY</span>
                                        <span className="text-lg font-black text-gray-800 leading-none">{d.day}</span>
                                    </div>
                                    <span className="font-bold text-gray-500 text-sm">
                                        {new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(new Date(d.dateStr))}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                                    {mealOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleMealTypeChange(d.dateStr, opt.value)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${d.mealType === opt.value
                                                ? 'bg-orange-500 text-white border-orange-600 shadow-md scale-105'
                                                : 'bg-white text-gray-400 border-gray-100 hover:border-orange-200 hover:text-orange-400'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-100 bg-gray-50/30">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full bg-orange-500 text-white py-5 rounded-[1.5rem] font-black text-xl hover:bg-orange-600 flex items-center justify-center gap-3 shadow-xl shadow-orange-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
                    >
                        {submitting ? (
                            <><Loader2 className="w-6 h-6 animate-spin" /> 送信中...</>
                        ) : (
                            <><Check className="w-7 h-7" /> この内容で一括申請する</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
