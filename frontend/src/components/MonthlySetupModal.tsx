"use client";

import { useState, useEffect } from 'react';
import { X, Check, Loader2, Calendar as CalendarIcon, ArrowRight, ArrowLeft, Users, ClipboardList } from 'lucide-react';
import { LoginUser, ClassMaster, Order } from '@/types';
import { createOrdersBulk, updateKindergartenClasses } from '@/lib/api';

interface MonthlySetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: LoginUser;
    classes: ClassMaster[];
    year: number;
    month: number;
    onComplete: () => void;
}

export default function MonthlySetupModal({ isOpen, onClose, user, classes: initialClasses, year, month, onComplete }: MonthlySetupModalProps) {
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [days, setDays] = useState<{ day: number, dateStr: string, mealType: string }[]>([]);
    const [editableClasses, setEditableClasses] = useState<ClassMaster[]>([]);

    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            return;
        }

        setEditableClasses([...initialClasses]);

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
    }, [isOpen, year, month, user, initialClasses]);

    if (!isOpen) return null;

    const handleClassChange = (className: string, field: string, value: number) => {
        setEditableClasses(prev => prev.map(c =>
            c.class_name === className ? { ...c, [field]: value } : c
        ));
    };

    const handleMealTypeToggle = (dateStr: string) => {
        const mealOptions = (user.services || ['通常']).concat('飯なし');
        setDays(prev => prev.map(d => {
            if (d.dateStr === dateStr) {
                const currentIndex = mealOptions.indexOf(d.mealType);
                const nextIndex = (currentIndex + 1) % mealOptions.length;
                return { ...d, mealType: mealOptions[nextIndex] };
            }
            return d;
        }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            // 1. Update Class Masters first (if changed)
            await updateKindergartenClasses(user.kindergarten_id, editableClasses);

            // 2. Prepare Bulk Orders
            const allOrders: Order[] = [];
            days.forEach(dayInfo => {
                editableClasses.forEach(cls => {
                    allOrders.push({
                        kindergarten_id: user.kindergarten_id,
                        date: dayInfo.dateStr,
                        class_name: cls.class_name,
                        meal_type: dayInfo.mealType,
                        student_count: cls.default_student_count,
                        allergy_count: cls.default_allergy_count || 0,
                        teacher_count: cls.default_teacher_count,
                        memo: ""
                    });
                });
            });

            await createOrdersBulk(allOrders);
            alert(`${year}年${month}月の申請が完了しました。`);
            onComplete();
            onClose();
        } catch (e) {
            console.error(e);
            alert('登録に失敗しました。');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-4xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-orange-50 to-white">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${step === 1 ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'}`}>
                                STEP {step} / 2
                            </span>
                            <h2 className="font-black text-2xl text-gray-800 tracking-tight">
                                {year}年{month}月の新規申請
                            </h2>
                        </div>
                        <p className="text-sm font-bold text-gray-400">
                            {step === 1 ? "基本の人数の確認・変更" : "メニュー（通常・誕生日会など）の選択"}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white rounded-2xl text-gray-400 hover:text-gray-600 shadow-sm border border-gray-100 transition-all hover:rotate-90">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-100">
                    <div
                        className="h-full bg-orange-500 transition-all duration-500"
                        style={{ width: `${(step / 2) * 100}%` }}
                    />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                    {step === 1 ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3">
                                <Users className="w-6 h-6 text-blue-500 shrink-0" />
                                <p className="text-sm font-bold text-blue-800">
                                    この月の基本となる人数を入力してください。<br />
                                    ここで設定した人数が、カレンダーの全日程に反映されます。
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {editableClasses.map(cls => (
                                    <div key={cls.class_name} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="mb-4 sm:mb-0">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{cls.grade}</span>
                                            <h3 className="text-xl font-black text-gray-800 leading-tight">{cls.class_name}</h3>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase">学生</label>
                                                <input
                                                    type="number"
                                                    value={cls.default_student_count}
                                                    onChange={(e) => handleClassChange(cls.class_name, 'default_student_count', parseInt(e.target.value) || 0)}
                                                    className="w-16 p-2 bg-white rounded-xl border border-gray-200 font-bold text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase">先生</label>
                                                <input
                                                    type="number"
                                                    value={cls.default_teacher_count}
                                                    onChange={(e) => handleClassChange(cls.class_name, 'default_teacher_count', parseInt(e.target.value) || 0)}
                                                    className="w-16 p-2 bg-white rounded-xl border border-gray-200 font-bold text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase">アレルギー</label>
                                                <input
                                                    type="number"
                                                    value={cls.default_allergy_count}
                                                    onChange={(e) => handleClassChange(cls.class_name, 'default_allergy_count', parseInt(e.target.value) || 0)}
                                                    className="w-16 p-2 bg-white rounded-xl border border-gray-200 font-bold text-center focus:ring-2 focus:ring-orange-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex gap-3">
                                <ClipboardList className="w-6 h-6 text-orange-500 shrink-0" />
                                <p className="text-sm font-bold text-orange-800">
                                    カレンダーの日付を選択すると、メニューを切り替えられます。<br />
                                    （通常 → 誕生日会 → カレー → なし）
                                </p>
                            </div>

                            {/* Calendar Grid for Selection */}
                            <div className="grid grid-cols-7 gap-1">
                                {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                                    <div key={d} className={`text-center text-[10px] font-black mb-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-300'}`}>{d}</div>
                                ))}

                                {Array(new Date(year, month - 1, 1).getDay()).fill(null).map((_, i) => <div key={`empty-${i}`} />)}

                                {Array(new Date(year, month, 0).getDate()).fill(null).map((_, i) => {
                                    const d = i + 1;
                                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                    const dayInfo = days.find(day => day.dateStr === dateStr);
                                    const isServiceDay = !!dayInfo;

                                    return (
                                        <button
                                            key={d}
                                            disabled={!isServiceDay}
                                            onClick={() => handleMealTypeToggle(dateStr)}
                                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-1 border transition-all active:scale-95
                                                ${!isServiceDay
                                                    ? 'bg-gray-50 border-gray-50 text-gray-200 cursor-not-allowed'
                                                    : dayInfo.mealType === '通常'
                                                        ? 'bg-white border-gray-100 hover:border-orange-200 shadow-sm'
                                                        : dayInfo.mealType === '飯なし'
                                                            ? 'bg-gray-100 border-gray-200 text-gray-400'
                                                            : 'bg-orange-500 border-orange-600 text-white shadow-lg'
                                                }`}
                                        >
                                            <span className="text-[10px] font-black leading-none mb-1 opacity-50">{d}</span>
                                            <span className={`text-[9px] font-black leading-tight text-center ${isServiceDay && dayInfo.mealType !== '通常' ? 'text-white' : ''}`}>
                                                {dayInfo?.mealType || '－'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 sm:p-8 border-t border-gray-100 bg-gray-50 flex gap-4">
                    {step === 2 && (
                        <button
                            onClick={() => setStep(1)}
                            className="p-4 bg-white border border-gray-200 text-gray-400 rounded-2xl font-black hover:text-gray-600 shadow-sm flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-6 h-6" /> 戻る
                        </button>
                    )}

                    <button
                        onClick={step === 1 ? () => setStep(2) : handleSubmit}
                        disabled={submitting}
                        className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-black text-xl hover:bg-orange-600 flex items-center justify-center gap-3 shadow-xl shadow-orange-100 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {submitting ? (
                            <><Loader2 className="w-6 h-6 animate-spin" /> 送信中...</>
                        ) : step === 1 ? (
                            <><ArrowRight className="w-7 h-7" /> メニュー選択へ進む</>
                        ) : (
                            <><Check className="w-7 h-7" /> この内容で申請する</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
