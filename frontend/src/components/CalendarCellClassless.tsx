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
            // Defaults if no order exists yet
            setMealType('通常');
            setStudentCount(0);
            setAllergyCount(0);
            setTeacherCount(0);
        }
    }, [existingOrder]);

    const handleSave = async (updates: Partial<OrderData>) => {
        if (!isServiceDay || isLocked) return;

        // Construct full order object
        const order: OrderData = {
            order_id: existingOrder?.order_id,
            kindergarten_id: kindergartenId,
            date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            class_name: '共通', // Virtual Class Name
            meal_type: updates.meal_type ?? mealType,
            student_count: updates.student_count ?? studentCount,
            allergy_count: updates.allergy_count ?? allergyCount,
            teacher_count: updates.teacher_count ?? teacherCount,
            memo: existingOrder?.memo || ''
        };

        setIsSaving(true);
        try {
            await onSave(order);
            // Update local state to match (in case parent doesn't re-render immediately)
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

        const types = ['通常', '飯なし', 'カレー']; // Rotate
        const nextIndex = (types.indexOf(mealType) + 1) % types.length;
        const nextType = types[nextIndex];
        await handleSave({ meal_type: nextType });
    };

    const handleCountChange = async (field: 'student' | 'allergy' | 'teacher', val: string) => {
        if (isLocked) return;
        if (isGraceLocked) {
            // For simplicity in direct input, we might warn on blur or focus? 
            // Let's just allow it but maybe indicate it visually? 
            // Or verify on every change? That's annoying. 
            // Let's rely on the user knowing the rule or blocking it if strictly needed.
            // Actually, for consistency, let's allow editing but maybe show a warning icon?
            // For now, allow direct edit.
        }

        const num = parseInt(val) || 0;
        if (field === 'student') {
            setStudentCount(num); // Optimistic update
            // Debounce or save on blur? 
            // Saving on every keystroke might be too much API call. 
            // Let's save on BLUR for text inputs.
        } else if (field === 'allergy') {
            setAllergyCount(num);
        } else if (field === 'teacher') {
            setTeacherCount(num);
        }
    };

    const handleBlur = (field: 'student_count' | 'allergy_count' | 'teacher_count') => {
        if (isLocked) return;
        // Trigger save with current state values
        // We need to pass the specific value because state might not be updated in the closure?
        // Actually state `studentCount` etc are in closure.

        handleSave({}); // Just save current state
    };

    // Render Helpers
    const getMealColor = () => {
        if (!isServiceDay) return 'bg-gray-100 text-gray-300 border-transparent';
        switch (mealType) {
            case '通常': return 'bg-white border-gray-200 text-gray-600';
            case '飯なし': return 'bg-gray-50 border-gray-200 text-gray-400';
            case 'カレー': return 'bg-orange-50 border-orange-200 text-orange-600 font-bold';
            default: return 'bg-white border-gray-100';
        }
    };

    if (!isServiceDay) {
        return (
            <div className="aspect-square rounded-[1.25rem] bg-gray-50/50 border border-transparent p-2 flex flex-col items-center justify-center text-gray-300 opacity-50 relative">
                <span className="text-xl font-black mb-1">{day}</span>
                <span className="text-[10px]">-</span>
            </div>
        );
    }

    return (
        <div className={`aspect-square rounded-[1.25rem] p-2 flex flex-col relative border transition-all shadow-sm group
            ${isLocked ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-white border-gray-100 hover:border-orange-200'}
        `}>
            {/* Header: Date & Meal Type Badge */}
            <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-black leading-none ${new Date().getDate() === day && new Date().getMonth() + 1 === month ? 'text-orange-500' : 'text-gray-400'}`}>
                    {day}
                </span>

                <button
                    onClick={toggleMealType}
                    disabled={isLocked || isSaving}
                    className={`px-1.5 py-0.5 rounded-md border text-[10px] items-center transition-all ${getMealColor()} ${isSaving ? 'animate-pulse' : ''}`}
                >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : mealType}
                </button>
            </div>

            {/* Inputs */}
            <div className="flex-1 flex flex-col justify-center gap-1">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-300 font-bold">園児</span>
                    <input
                        type="number"
                        value={studentCount}
                        onChange={(e) => handleCountChange('student', e.target.value)}
                        onBlur={() => handleBlur('student_count')}
                        disabled={isLocked}
                        className="w-10 text-right text-sm font-bold bg-transparent border-b border-gray-100 focus:border-orange-400 outline-none p-0 text-gray-700"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-300 font-bold">アレルギー</span>
                    <input
                        type="number"
                        value={allergyCount}
                        onChange={(e) => handleCountChange('allergy', e.target.value)}
                        onBlur={() => handleBlur('allergy_count')}
                        disabled={isLocked}
                        className={`w-10 text-right text-sm font-bold bg-transparent border-b border-gray-100 focus:border-orange-400 outline-none p-0 ${allergyCount > 0 ? 'text-red-500' : 'text-gray-700'}`}
                    />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-300 font-bold">先生</span>
                    <input
                        type="number"
                        value={teacherCount}
                        onChange={(e) => handleCountChange('teacher', e.target.value)}
                        onBlur={() => handleBlur('teacher_count')}
                        disabled={isLocked}
                        className="w-10 text-right text-sm font-bold bg-transparent border-b border-gray-100 focus:border-orange-400 outline-none p-0 text-gray-700"
                    />
                </div>
            </div>

            {isLocked && (
                <div className="absolute inset-0 bg-gray-100/10 pointer-events-none flex items-center justify-center">
                    {/* Optional Lock Icon override or pattern */}
                </div>
            )}
        </div>
    );
}
