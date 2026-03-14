"use client";

import { useState, useEffect, useRef } from 'react';
import { X, Check, Loader2, Calendar as CalendarIcon, ArrowRight, ArrowLeft, Users, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { LoginUser, ClassMaster, Order } from '@/types';
import { createOrdersBulk, updateKindergartenClasses, updateAdminKindergarten } from '@/lib/api';

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
    const userRef = useRef(user);
    userRef.current = user;
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [days, setDays] = useState<{ day: number, dateStr: string, mealType: string, studentCount: number, allergyCount: number, teacherCount: number }[]>([]);
    const [editableClasses, setEditableClasses] = useState<ClassMaster[]>([]);
    const [memo, setMemo] = useState('');
    const [submittedBy, setSubmittedBy] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('submitted_by_name') || '' : ''
    );
    const [classlessDefaults, setClasslessDefaults] = useState({
        student: user.classless_student_count ?? 0,
        allergy: user.classless_allergy_count ?? 0,
        teacher: user.classless_teacher_count ?? 0,
    });

    useEffect(() => {
        if (isOpen) {
            const u = userRef.current;
            setEditableClasses(initialClasses.map(c => ({ ...c })));
            setClasslessDefaults({
                student: u.classless_student_count ?? 0,
                allergy: u.classless_allergy_count ?? 0,
                teacher: u.classless_teacher_count ?? 0,
            });
        } else {
            setStep(1);
            setMemo('');
        }
    }, [isOpen, initialClasses]);

    useEffect(() => {
        if (!isOpen) return;

        const u = userRef.current;
        const daysInMonth = new Date(year, month, 0).getDate();
        const serviceDays = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month - 1, d);
            const dayOfWeek = date.getDay();
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            let isServiceDay = true;
            if (u && u.settings) {
                const s = u.settings as any;
                const mapping: any = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
                isServiceDay = s[`service_${mapping[dayOfWeek]}`] !== false;
            }

            if (isServiceDay) {
                serviceDays.push({
                    day: d,
                    dateStr,
                    mealType: '通常',
                    studentCount: 0,
                    allergyCount: 0,
                    teacherCount: 0
                });
            }
        }
        setDays(serviceDays);
    }, [isOpen, year, month]);

    if (!isOpen) return null;

    const handleClassFieldChange = (index: number, field: string, value: any) => {
        const newClasses = [...editableClasses];
        newClasses[index] = { ...newClasses[index], [field]: value };
        setEditableClasses(newClasses);
    };

    const addClass = () => {
        setEditableClasses([...editableClasses, { class_name: '新クラス', grade: '年少', default_student_count: 0, default_allergy_count: 0, default_teacher_count: 0 }]);
    };

    const removeClass = (index: number) => {
        setEditableClasses(editableClasses.filter((_, i) => i !== index));
    };

    const mealTypeOptions = user.services && user.services.length > 0
        ? user.services
        : ['通常'];

    const handleMealTypeChange = (dateStr: string, newType: string) => {
        setDays(prev => prev.map(d => d.dateStr === dateStr ? { ...d, mealType: newType } : d));
    };

    const handleDayCountChange = (dateStr: string, field: 'studentCount' | 'allergyCount' | 'teacherCount', value: number) => {
        setDays(prev => prev.map(d => d.dateStr === dateStr ? { ...d, [field]: value } : d));
    };

    const goToStep = (nextStep: number) => {
        // When moving from Step 1 to Step 2 in classless mode, apply defaults to all days
        if (step === 1 && nextStep === 2 && editableClasses.length === 0) {
            setDays(prev => prev.map(d => ({
                ...d,
                studentCount: classlessDefaults.student,
                allergyCount: classlessDefaults.allergy,
                teacherCount: classlessDefaults.teacher
            })));
        }
        setStep(nextStep);
    };

    const handleSubmit = async () => {
        localStorage.setItem('submitted_by_name', submittedBy);
        setSubmitting(true);
        try {
            // クラスなし園（editableClasses=[]）の場合はクラス情報を更新しない
            // （空配列を渡すとクラスシートの全行が削除されてしまうため）
            if (editableClasses.length > 0) {
                await updateKindergartenClasses(user.kindergarten_id, editableClasses, true);
            } else {
                // クラスなしの場合、基本人数をkindergartens masterシートにも保存して管理側と同期
                await updateAdminKindergarten(user.kindergarten_id, {
                    classless_student_count: classlessDefaults.student,
                    classless_allergy_count: classlessDefaults.allergy,
                    classless_teacher_count: classlessDefaults.teacher,
                });
            }

            const allOrders: Order[] = [];

            // Check for Class-less Mode
            const targetClasses = editableClasses.length > 0
                ? editableClasses
                : [{ class_name: '共通', default_student_count: classlessDefaults.student, default_allergy_count: classlessDefaults.allergy, default_teacher_count: classlessDefaults.teacher } as ClassMaster];

            days.forEach(dayInfo => {
                if (dayInfo.mealType === '') return;
                const isClassless = editableClasses.length === 0;
                targetClasses.forEach(cls => {
                    allOrders.push({
                        kindergarten_id: user.kindergarten_id,
                        date: dayInfo.dateStr,
                        class_name: cls.class_name,
                        meal_type: dayInfo.mealType,
                        // For classless mode, use per-day counts from Step 2 calendar
                        student_count: isClassless ? dayInfo.studentCount : cls.default_student_count,
                        allergy_count: isClassless ? dayInfo.allergyCount : (cls.default_allergy_count || 0),
                        teacher_count: isClassless ? dayInfo.teacherCount : cls.default_teacher_count,
                        memo: memo,
                        submitted_by: submittedBy,
                    });
                });
            });

            if (allOrders.length > 0) {
                await createOrdersBulk(allOrders);
            }

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
            <div className="bg-white w-full max-w-4xl h-full sm:h-auto sm:max-h-[95vh] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="p-6 sm:px-8 sm:py-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-orange-50 to-white shrink-0">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${step === 3 ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                                STEP {step} / 3
                            </span>
                            <h2 className="font-black text-xl sm:text-2xl text-gray-800 tracking-tight">
                                {year}年{month}月の注文申請
                            </h2>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-gray-400">
                            {step === 1 ? "クラス名・基本人数の設定" : step === 2 ? "メニュー（通常・誕生日会など）の選択" : "最終確認と備考入力"}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white rounded-2xl text-gray-400 hover:text-gray-600 shadow-sm border border-gray-100 transition-all hover:rotate-90">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-100 shrink-0">
                    <div
                        className="h-full bg-orange-500 transition-all duration-500"
                        style={{ width: `${(step / 3) * 100}%` }}
                    />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                    {step === 1 ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 rounded-xl">
                                        <Users className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <h3 className="font-black text-gray-800">クラス別 基本設定</h3>
                                </div>
                                <button onClick={addClass} className="flex items-center gap-1 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-black border border-orange-100 hover:bg-orange-100 transition-colors">
                                    <Plus className="w-4 h-4" /> クラス追加
                                </button>
                            </div>

                            {editableClasses.length === 0 && (
                                <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-xl">
                                            <Users className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-black text-gray-800">基本人数の設定</p>
                                            <p className="text-xs text-gray-400">クラス分けなし。園全体の基本人数を入力してください。</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 text-center">園児数</label>
                                            <input
                                                type="number"
                                                value={classlessDefaults.student}
                                                onChange={(e) => setClasslessDefaults({ ...classlessDefaults, student: parseInt(e.target.value) || 0 })}
                                                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-black text-center text-lg focus:ring-2 focus:ring-blue-400 outline-none"
                                            />
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                            <label className="text-[10px] font-black text-red-400 uppercase block mb-2 text-center">アレルギー</label>
                                            <input
                                                type="number"
                                                value={classlessDefaults.allergy}
                                                onChange={(e) => setClasslessDefaults({ ...classlessDefaults, allergy: parseInt(e.target.value) || 0 })}
                                                className="w-full p-3 bg-gray-50 rounded-xl border border-red-100 font-black text-center text-lg focus:ring-2 focus:ring-red-300 outline-none text-red-600"
                                            />
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 text-center">先生数</label>
                                            <input
                                                type="number"
                                                value={classlessDefaults.teacher}
                                                onChange={(e) => setClasslessDefaults({ ...classlessDefaults, teacher: parseInt(e.target.value) || 0 })}
                                                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-black text-center text-lg focus:ring-2 focus:ring-blue-400 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 text-center">💡 この人数が全日に適用されます。日ごとの変更はカレンダーから可能です。</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4">
                                {editableClasses.map((cls, idx) => (
                                    <div key={idx} className="relative p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col sm:flex-row gap-4 items-center animate-in fade-in slide-in-from-top-2">
                                        <button
                                            onClick={() => removeClass(idx)}
                                            className="absolute -top-2 -right-2 p-2 bg-white border border-red-100 text-red-500 rounded-xl shadow-md hover:bg-red-50 transition-all active:scale-90 z-10"
                                            title="クラスを削除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">クラス名</label>
                                                <input
                                                    value={cls.class_name}
                                                    onChange={(e) => handleClassFieldChange(idx, 'class_name', e.target.value)}
                                                    className="w-full p-2 bg-white rounded-xl border border-gray-200 font-bold text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">学年</label>
                                                <input
                                                    value={cls.grade}
                                                    onChange={(e) => handleClassFieldChange(idx, 'grade', e.target.value)}
                                                    className="w-full p-2 bg-white rounded-xl border border-gray-200 font-bold text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                                    placeholder="例: 年少"
                                                />
                                            </div>
                                            <div className="flex gap-2 col-span-2 sm:col-span-2">
                                                <div className="flex-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1 text-center">園児</label>
                                                    <input
                                                        type="number"
                                                        value={cls.default_student_count}
                                                        onChange={(e) => handleClassFieldChange(idx, 'default_student_count', parseInt(e.target.value) || 0)}
                                                        className="w-full p-2 bg-white rounded-xl border border-gray-200 font-bold text-center focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1 text-center">先生</label>
                                                    <input
                                                        type="number"
                                                        value={cls.default_teacher_count}
                                                        onChange={(e) => handleClassFieldChange(idx, 'default_teacher_count', parseInt(e.target.value) || 0)}
                                                        className="w-full p-2 bg-white rounded-xl border border-gray-200 font-bold text-center focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1 text-center text-red-400">アレルギー</label>
                                                    <input
                                                        type="number"
                                                        value={cls.default_allergy_count}
                                                        onChange={(e) => handleClassFieldChange(idx, 'default_allergy_count', parseInt(e.target.value) || 0)}
                                                        className="w-full p-2 bg-white rounded-xl border border-gray-200 font-bold text-center focus:ring-2 focus:ring-orange-500 outline-none text-sm border-red-50"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : step === 2 ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-2 ml-1">
                                <div className="p-2 bg-orange-50 rounded-xl">
                                    <CalendarIcon className="w-5 h-5 text-orange-500" />
                                </div>
                                <h3 className="font-black text-gray-800">{editableClasses.length === 0 ? 'カレンダー設定（メニュー・人数）' : '特別メニューの選択'}</h3>
                            </div>

                            <div className={`grid grid-cols-7 gap-1 max-w-2xl mx-auto`}>
                                {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                                    <div key={d} className={`text-center text-[10px] font-black mb-1 p-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-300'}`}>{d}</div>
                                ))}

                                {Array(new Date(year, month - 1, 1).getDay()).fill(null).map((_, i) => <div key={`empty-${i}`} />)}

                                {Array(new Date(year, month, 0).getDate()).fill(null).map((_, i) => {
                                    const d = i + 1;
                                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                    const dayInfo = days.find(day => day.dateStr === dateStr);
                                    const isServiceDay = !!dayInfo;
                                    const isClassless = editableClasses.length === 0;

                                    if (!isServiceDay) {
                                        return (
                                            <div key={d} className={`${isClassless ? '' : 'aspect-square'} rounded-xl bg-gray-50/50 border border-transparent opacity-30 p-1`}>
                                                <span className="text-[10px] font-black text-gray-300">{d}</span>
                                            </div>
                                        );
                                    }

                                    // Classless mode: show meal type + count inputs
                                    if (isClassless) {
                                        return (
                                            <div key={d} className="rounded-xl border border-gray-100 bg-white p-1.5 flex flex-col gap-0.5">
                                                <div className="flex justify-between items-center gap-0.5">
                                                    <span className="text-[10px] font-black text-gray-400 flex-shrink-0">{d}</span>
                                                    <select
                                                        value={dayInfo.mealType}
                                                        onChange={(e) => handleMealTypeChange(dateStr, e.target.value)}
                                                        className={`text-[8px] font-black rounded border outline-none px-0.5 py-0.5 w-full
                                                            ${dayInfo.mealType === '通常'
                                                                ? 'border-gray-200 text-gray-400 bg-white'
                                                                : 'border-orange-400 bg-orange-50 text-orange-600'
                                                            }`}
                                                    >
                                                        {mealTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                    <span className="text-[8px] text-gray-300 font-bold shrink-0">児</span>
                                                    <input
                                                        type="number"
                                                        value={dayInfo.studentCount}
                                                        onChange={(e) => handleDayCountChange(dateStr, 'studentCount', parseInt(e.target.value) || 0)}
                                                        className="w-full text-right text-[11px] font-bold bg-transparent border-b border-gray-100 focus:border-orange-400 outline-none p-0 text-gray-700"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                    <span className="text-[8px] text-red-300 font-bold shrink-0">ア</span>
                                                    <input
                                                        type="number"
                                                        value={dayInfo.allergyCount}
                                                        onChange={(e) => handleDayCountChange(dateStr, 'allergyCount', parseInt(e.target.value) || 0)}
                                                        className={`w-full text-right text-[11px] font-bold bg-transparent border-b border-gray-100 focus:border-orange-400 outline-none p-0 ${dayInfo.allergyCount > 0 ? 'text-red-500' : 'text-gray-700'}`}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                    <span className="text-[8px] text-gray-300 font-bold shrink-0">師</span>
                                                    <input
                                                        type="number"
                                                        value={dayInfo.teacherCount}
                                                        onChange={(e) => handleDayCountChange(dateStr, 'teacherCount', parseInt(e.target.value) || 0)}
                                                        className="w-full text-right text-[11px] font-bold bg-transparent border-b border-gray-100 focus:border-orange-400 outline-none p-0 text-gray-700"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Standard mode: meal type select
                                    return (
                                        <div
                                            key={d}
                                            className="aspect-square rounded-xl flex flex-col items-start border bg-white border-gray-100 hover:border-orange-200 overflow-hidden"
                                        >
                                            <span className="px-1.5 pt-1 text-[10px] font-black text-gray-400">{d}</span>
                                            <div className="flex-1 flex items-center justify-center w-full px-1 pb-1">
                                                <select
                                                    value={dayInfo.mealType}
                                                    onChange={(e) => handleMealTypeChange(dateStr, e.target.value)}
                                                    className={`w-full text-[9px] font-black rounded border outline-none px-1 py-1 text-center cursor-pointer
                                                        ${dayInfo.mealType === '通常'
                                                            ? 'border-gray-200 text-gray-400 bg-white'
                                                            : 'border-orange-400 bg-orange-50 text-orange-600'
                                                        }`}
                                                >
                                                    {mealTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-3 mb-2 ml-1">
                                <div className="p-2 bg-green-50 rounded-xl">
                                    <ClipboardList className="w-5 h-5 text-green-500" />
                                </div>
                                <h3 className="font-black text-gray-800">最終確認と備考</h3>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 ml-1">管理者への備考・お伝え事項（任意）</label>
                                <textarea
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder="急な欠席予定や、特定の日の人数変更など、何かあればご記入ください。"
                                    className="w-full h-40 p-5 bg-white rounded-2xl border border-gray-200 font-bold text-gray-700 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-300"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 ml-1">担当者名（任意）</label>
                                <input
                                    type="text"
                                    value={submittedBy}
                                    onChange={(e) => setSubmittedBy(e.target.value)}
                                    placeholder="申請を行う担当者のお名前"
                                    className="w-full p-4 bg-white rounded-2xl border border-gray-200 font-bold text-gray-700 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-300"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 sm:px-8 sm:py-6 border-t border-gray-100 bg-gray-50 flex gap-4 shrink-0">
                    {step > 1 && (
                        <button
                            onClick={() => goToStep(step - 1)}
                            className="px-6 py-4 bg-white border border-gray-200 text-gray-400 rounded-2xl font-black hover:text-gray-600 shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" /> 戻る
                        </button>
                    )}

                    <button
                        onClick={step < 3 ? () => goToStep(step + 1) : handleSubmit}
                        disabled={submitting}
                        className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-black text-lg sm:text-xl hover:bg-orange-600 flex items-center justify-center gap-3 shadow-xl shadow-orange-100 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {submitting ? (
                            <><Loader2 className="w-6 h-6 animate-spin" /> 送信中...</>
                        ) : step < 3 ? (
                            <><ArrowRight className="w-6 h-6" /> {step === 1 ? "メニュー選択へ" : "最終確認へ"}</>
                        ) : (
                            <><Check className="w-7 h-7" /> この内容で申請を完了する</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
