"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, Minus, Plus } from 'lucide-react';
import { ClassMaster, Order } from '@/types';

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
    prev_student_count?: number;
    prev_allergy_count?: number;
    prev_teacher_count?: number;
}

interface Props {
    day: number;
    year: number;
    month: number;
    kindergartenId: string;
    classes: ClassMaster[];
    existingOrders: Order[];
    isServiceDay: boolean;
    isLocked: boolean;
    isGraceLocked: boolean;
    mealOptions: string[];
    onSave: (orders: OrderData[]) => Promise<void>;
}

type ClassOrderState = {
    order_id?: string;
    meal_type: string;
    student: number;
    allergy: number;
    teacher: number;
    memo: string;
};

export default function CalendarCellWithClasses({
    day, year, month, kindergartenId, classes, existingOrders,
    isServiceDay, isLocked, isGraceLocked, mealOptions, onSave
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    const buttonRef = useRef<HTMLButtonElement>(null);

    const [classOrders, setClassOrders] = useState<Record<string, ClassOrderState>>({});
    const [prevOrders, setPrevOrders] = useState<Record<string, { student: number; allergy: number; teacher: number } | null>>({});
    const [bulkMealType, setBulkMealType] = useState('通常');
    const [isSaving, setIsSaving] = useState(false);

    const displayOptions = mealOptions.length > 0 ? mealOptions : ['通常'];
    const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    useEffect(() => {
        const initial: Record<string, ClassOrderState> = {};
        const prevInit: Record<string, { student: number; allergy: number; teacher: number } | null> = {};
        const firstOrder = existingOrders[0];
        // 飯なしは先生側に表示しないので通常に戻す
        const firstMealType = firstOrder?.meal_type === '飯なし' ? '通常' : (firstOrder?.meal_type || '通常');
        setBulkMealType(firstMealType);

        classes.forEach(cls => {
            const order = existingOrders.find(o => o.class_name === cls.class_name);
            const storedType = order?.meal_type === '飯なし' ? '通常' : (order?.meal_type || '通常');
            initial[cls.class_name] = {
                order_id: order?.order_id,
                meal_type: storedType,
                student: order?.student_count ?? cls.default_student_count,
                allergy: order?.allergy_count ?? (cls.default_allergy_count || 0),
                teacher: order?.teacher_count ?? cls.default_teacher_count,
                memo: order?.memo || '',
            };
            prevInit[cls.class_name] = order ? {
                student: order.student_count,
                allergy: order.allergy_count,
                teacher: order.teacher_count,
            } : null;
        });
        setClassOrders(initial);
        setPrevOrders(prevInit);
    }, [existingOrders, classes]);

    const handleOpen = () => {
        if (!isServiceDay || isLocked) return;
        if (isGraceLocked) {
            if (!confirm("3日前を過ぎた変更です。電話連絡が必要な場合があります。続けますか？")) return;
        }
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const popoverWidth = 360;
            const estimatedHeight = Math.min(520, 160 + classes.length * 120);
            const margin = 8;

            let left = rect.left + rect.width / 2 - popoverWidth / 2;
            left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

            let top: number;
            if (rect.bottom + estimatedHeight + margin < window.innerHeight) {
                top = rect.bottom + margin;
            } else {
                top = rect.top - estimatedHeight - margin;
            }
            top = Math.max(margin, top);

            setPopoverStyle({ position: 'fixed', top, left, width: popoverWidth, zIndex: 50 });
        }
        setIsOpen(true);
    };

    const applyBulkMealType = (type: string) => {
        setBulkMealType(type);
        setClassOrders(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                next[key] = { ...next[key], meal_type: type };
            });
            return next;
        });
    };

    const updateClassField = (clsName: string, field: 'student' | 'allergy' | 'teacher', diff: number) => {
        setClassOrders(prev => {
            const current = prev[clsName];
            if (!current) return prev;
            return { ...prev, [clsName]: { ...current, [field]: Math.max(0, current[field] + diff) } };
        });
    };

    const updateMealType = (clsName: string, type: string) => {
        setClassOrders(prev => ({ ...prev, [clsName]: { ...prev[clsName], meal_type: type } }));
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            const orders: OrderData[] = classes.map(cls => {
                const data = classOrders[cls.class_name];
                const prev = prevOrders[cls.class_name];
                return {
                    order_id: data?.order_id,
                    kindergarten_id: kindergartenId,
                    date: dateStr,
                    class_name: cls.class_name,
                    meal_type: data?.meal_type || '通常',
                    student_count: data?.student || 0,
                    allergy_count: data?.allergy || 0,
                    teacher_count: data?.teacher || 0,
                    memo: data?.memo || '',
                    ...(prev ? {
                        prev_student_count: prev.student,
                        prev_allergy_count: prev.allergy,
                        prev_teacher_count: prev.teacher,
                    } : {})
                };
            });
            await onSave(orders);
            setIsOpen(false);
        } catch (e) {
            alert('保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isServiceDay) {
        return (
            <div className="h-full rounded-xl bg-gray-50/50 border border-transparent flex items-center justify-center text-gray-300 opacity-40">
                <span className="text-sm font-black">{day}</span>
            </div>
        );
    }

    const firstOrder = existingOrders[0];
    const hasOrder = existingOrders.length > 0;
    const displayType = firstOrder?.meal_type;
    const isSpecialMeal = displayType && displayType !== '通常' && displayType !== '飯なし';

    return (
        <>
            <button
                ref={buttonRef}
                onClick={handleOpen}
                disabled={isLocked}
                className={`h-full w-full rounded-xl sm:rounded-[1rem] flex flex-col items-center justify-start pt-1.5 relative border transition-all
                    ${isLocked
                        ? 'bg-gray-100 border-gray-200 opacity-40 grayscale cursor-not-allowed'
                        : isGraceLocked
                            ? 'bg-amber-50/50 border-amber-100 hover:border-amber-200 shadow-sm active:scale-95'
                            : isToday
                                ? 'bg-orange-50 border-orange-300 hover:border-orange-400 shadow-sm active:scale-95'
                                : 'bg-white border-gray-100 hover:border-orange-200 shadow-sm active:scale-95'
                    }`}
            >
                <span className={`text-[10px] font-black leading-none mb-1 ${isToday ? 'text-orange-600' : 'text-gray-400'}`}>{day}</span>
                <div className="flex-1 flex flex-col items-center justify-center w-full px-0.5 gap-0.5">
                    {hasOrder ? (
                        isSpecialMeal ? (
                            <span className="text-[9px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-1 py-0.5 rounded leading-none">{displayType}</span>
                        ) : (
                            <span className="text-[9px] font-black text-gray-400 leading-none">{displayType === '飯なし' ? '通常' : (displayType || '通常')}</span>
                        )
                    ) : (
                        <span className="text-[8px] text-gray-300 font-bold">未入力</span>
                    )}
                </div>
                {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-1/2 h-[2px] bg-gray-300 rotate-45"></div>
                    </div>
                )}
            </button>

            {isOpen && typeof window !== 'undefined' && createPortal(
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div
                        style={popoverStyle}
                        onClick={e => e.stopPropagation()}
                        className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-orange-50 flex-shrink-0">
                            <h2 className="font-bold text-gray-800 text-sm">{month}月{day}日 の注文</h2>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 bg-white rounded-full text-gray-400 hover:bg-gray-100">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Bulk selector */}
                        <div className="px-3 pt-2.5 pb-2 border-b border-gray-100 flex-shrink-0">
                            <p className="text-[10px] font-black text-gray-400 mb-1.5 uppercase">まとめて設定（全クラス）</p>
                            <div className="flex flex-wrap gap-1.5">
                                {displayOptions.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => applyBulkMealType(opt)}
                                        className={`py-1 px-2.5 text-xs rounded-full border font-medium transition-colors ${bulkMealType === opt
                                            ? 'bg-orange-500 text-white border-orange-600'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Class list (scrollable) */}
                        <div className="overflow-y-auto flex-1 p-2.5 space-y-2" style={{ maxHeight: 340 }}>
                            {classes.map(cls => {
                                const order = classOrders[cls.class_name];
                                if (!order) return null;
                                return (
                                    <div key={cls.class_name} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                                        <div className="flex items-center gap-1 mb-2">
                                            <span className="text-xs font-bold text-gray-700">{cls.class_name}</span>
                                            {cls.grade && <span className="text-[10px] font-normal text-gray-400">（{cls.grade}）</span>}
                                        </div>
                                        {/* Meal type pills */}
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {displayOptions.map(opt => (
                                                <button
                                                    key={opt}
                                                    onClick={() => updateMealType(cls.class_name, opt)}
                                                    className={`py-0.5 px-2 text-[10px] rounded-full border font-medium transition-colors ${order.meal_type === opt
                                                        ? 'bg-orange-500 text-white border-orange-600'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-orange-50'
                                                    }`}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Counters */}
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <MiniCounter label="園児" value={order.student} onChange={d => updateClassField(cls.class_name, 'student', d)} />
                                            <MiniCounter label="アレルギー" value={order.allergy} onChange={d => updateClassField(cls.class_name, 'allergy', d)} color="text-red-600" />
                                            <MiniCounter label="先生" value={order.teacher} onChange={d => updateClassField(cls.class_name, 'teacher', d)} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Save button */}
                        <div className="px-3 pb-3 pt-2 flex-shrink-0 border-t border-gray-50">
                            <button
                                onClick={handleSubmit}
                                disabled={isSaving}
                                className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-orange-600 flex items-center justify-center gap-2 shadow-md ring-4 ring-orange-100 active:scale-95 transition-all"
                            >
                                {isSaving
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <><Send className="w-3.5 h-3.5" /> 変更を申請する</>
                                }
                            </button>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
}

function MiniCounter({ label, value, onChange, color = "text-gray-900" }: {
    label: string; value: number; onChange: (d: number) => void; color?: string;
}) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-[9px] text-gray-400 mb-0.5">{label}</span>
            <div className="flex items-center gap-0.5 bg-white rounded-lg border border-gray-200 p-0.5">
                <button onClick={() => onChange(-1)} className="p-0.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded"><Minus className="w-3 h-3" /></button>
                <span className={`font-bold text-sm w-6 text-center ${color}`}>{value}</span>
                <button onClick={() => onChange(1)} className="p-0.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded"><Plus className="w-3 h-3" /></button>
            </div>
        </div>
    );
}
