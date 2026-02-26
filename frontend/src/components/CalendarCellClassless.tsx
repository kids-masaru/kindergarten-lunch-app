import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface OrderData {
    order_id?: string;
    kindergarten_id: string;
    date: string;
    class_name: string;
    meal_type: string;
    student_count: number;
    allergy_count: number;
    teacher_count: number;
    memo?: string;
}

interface CalendarCellClasslessProps {
    day: number;
    year: number;
    month: number;
    kindergartenId: string;
    existingOrder?: OrderData;
    isServiceDay: boolean;
    isLocked: boolean; // Strict lock
    isGraceLocked: boolean; // 3-day lock (requires confirmation)
    onSave: (order: OrderData) => Promise<void>;
}

export default function CalendarCellClassless({
    day, year, month, kindergartenId, existingOrder, isServiceDay, isLocked, isGraceLocked, onSave
}: CalendarCellClasslessProps) {
    // Default State
    const [mealType, setMealType] = useState('通常');
    const [studentCount, setStudentCount] = useState(0);
    const [allergyCount, setAllergyCount] = useState(0);
    const [teacherCount, setTeacherCount] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    // Load existing order
    useEffect(() => {
        if (existingOrder) {
            setMealType(existingOrder.meal_type);
            setStudentCount(existingOrder.student_count);
            setAllergyCount(existingOrder.allergy_count);
            setTeacherCount(existingOrder.teacher_count);
        } else {
            setMealType('通常');
            setStudentCount(0);
            setAllergyCount(0);
            setTeacherCount(0);
        }
    }, [existingOrder]);

    const handleSave = async (updates: Partial<OrderData>) => {
        if (!isServiceDay || isLocked) return;

        const order: OrderData = {
            order_id: existingOrder?.order_id,
            kindergarten_id: kindergartenId,
            date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            class_name: '共通',
            meal_type: updates.meal_type ?? mealType,
            student_count: updates.student_count ?? studentCount,
            allergy_count: updates.allergy_count ?? allergyCount,
            teacher_count: updates.teacher_count ?? teacherCount,
            memo: existingOrder?.memo || ''
        };

        setIsSaving(true);
        try {
            await onSave(order);
            if (updates.meal_type !== undefined) setMealType(updates.meal_type);
            if (updates.student_count !== undefined) setStudentCount(updates.student_count);
            if (updates.allergy_count !== undefined) setAllergyCount(updates.allergy_count);
            if (updates.teacher_count !== undefined) setTeacherCount(updates.teacher_count);
        } catch (e) {
            console.error("Auto-save failed", e);
            alert("保存に失敗しました");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleMealType = async () => {
        if (isLocked) {
            alert("締切を過ぎているため変更できません。");
            return;
        }
        if (isGraceLocked) {
            if (!confirm("3日前を過ぎた変更です。電話連絡が必要です。続けますか？")) return;
        }

        const types = ['通常', '飯なし', 'カレー'];
        const nextIndex = (types.indexOf(mealType) + 1) % types.length;
        const nextType = types[nextIndex];
        await handleSave({ meal_type: nextType });
    };

    const handleCountChange = async (field: 'student' | 'allergy' | 'teacher', val: string) => {
        if (isLocked) return;
        const num = parseInt(val) || 0;
        if (field === 'student') {
            setStudentCount(num);
        } else if (field === 'allergy') {
            setAllergyCount(num);
        } else if (field === 'teacher') {
            setTeacherCount(num);
        }
    };

    const handleBlur = (field: 'student_count' | 'allergy_count' | 'teacher_count') => {
        if (isLocked) return;
        handleSave({});
    };

    // Meal type badge styles
    const getMealBadge = () => {
        if (!isServiceDay) return { bg: 'bg-gray-100', text: 'text-gray-300', border: 'border-transparent', label: '-' };
        switch (mealType) {
            case '通常': return { bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200', label: '通常' };
            case '飯なし': return { bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-300', label: '飯なし' };
            case 'カレー': return { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-300', label: 'カレー' };
            default: return { bg: 'bg-white', text: 'text-gray-400', border: 'border-gray-100', label: mealType };
        }
    };

    const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;
    const meal = getMealBadge();

    // Non-service day: minimal cell
    if (!isServiceDay) {
        return (
            <div className="rounded-xl sm:rounded-[1.25rem] bg-gray-50/50 border border-transparent p-2 sm:p-2 flex items-center justify-center text-gray-300 opacity-50 min-h-[4rem] sm:min-h-[5rem]">
                <span className="text-lg sm:text-xl font-black">{day}</span>
            </div>
        );
    }

    return (
        <div className={`rounded-xl sm:rounded-[1.25rem] p-2 flex flex-col relative border transition-all shadow-sm
            ${isLocked ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-white border-gray-100 hover:border-orange-200'}
        `}>
            {/* Header: Date + Meal Badge */}
            <div className="flex justify-between items-center mb-1.5 sm:mb-1">
                <span className={`text-sm sm:text-sm font-black leading-none ${isToday ? 'text-orange-500' : 'text-gray-400'}`}>
                    {day}
                </span>
                <button
                    onClick={toggleMealType}
                    disabled={isLocked || isSaving}
                    className={`px-1.5 py-1 rounded-md border text-[10px] font-black transition-all leading-none
                        ${meal.bg} ${meal.text} ${meal.border} ${isSaving ? 'animate-pulse' : ''}`}
                >
                    {isSaving ? <Loader2 className="w-2 h-2 sm:w-3 sm:h-3 animate-spin" /> : meal.label}
                </button>
            </div>

            {/* Count Rows — compact on mobile */}
            <div className="flex flex-col gap-1.5 sm:gap-1 flex-1 justify-center mt-1">
                {/* Student */}
                <div className="flex items-center gap-1">
                    <span className="text-[11px] sm:text-[10px] text-gray-300 font-bold w-4 sm:w-auto shrink-0 sm:hidden">児</span>
                    <span className="text-[10px] sm:text-[10px] text-gray-300 font-bold hidden sm:inline">園児</span>
                    <input
                        type="number"
                        value={studentCount}
                        onChange={(e) => handleCountChange('student', e.target.value)}
                        onBlur={() => handleBlur('student_count')}
                        disabled={isLocked}
                        className="w-full text-right text-base sm:text-sm font-black bg-transparent border-b-2 border-gray-100 focus:border-orange-400 outline-none p-0 text-gray-700 min-w-0"
                    />
                </div>
                {/* Allergy */}
                <div className="flex items-center gap-1">
                    <span className="text-[11px] sm:text-[10px] text-red-300 font-bold w-4 sm:w-auto shrink-0 sm:hidden">ア</span>
                    <span className="text-[10px] sm:text-[10px] text-red-300 font-bold hidden sm:inline">アレルギー</span>
                    <input
                        type="number"
                        value={allergyCount}
                        onChange={(e) => handleCountChange('allergy', e.target.value)}
                        onBlur={() => handleBlur('allergy_count')}
                        disabled={isLocked}
                        className={`w-full text-right text-base sm:text-sm font-black bg-transparent border-b-2 border-gray-100 focus:border-orange-400 outline-none p-0 min-w-0 ${allergyCount > 0 ? 'text-red-500' : 'text-gray-700'}`}
                    />
                </div>
                {/* Teacher */}
                <div className="flex items-center gap-1">
                    <span className="text-[11px] sm:text-[10px] text-gray-300 font-bold w-4 sm:w-auto shrink-0 sm:hidden">先</span>
                    <span className="text-[10px] sm:text-[10px] text-gray-300 font-bold hidden sm:inline">先生</span>
                    <input
                        type="number"
                        value={teacherCount}
                        onChange={(e) => handleCountChange('teacher', e.target.value)}
                        onBlur={() => handleBlur('teacher_count')}
                        disabled={isLocked}
                        className="w-full text-right text-base sm:text-sm font-black bg-transparent border-b-2 border-gray-100 focus:border-orange-400 outline-none p-0 text-gray-700 min-w-0"
                    />
                </div>
            </div>

            {isLocked && (
                <div className="absolute inset-0 bg-gray-100/10 pointer-events-none" />
            )}
        </div>
    );
}
