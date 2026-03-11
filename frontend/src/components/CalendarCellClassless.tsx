"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, Minus, Plus } from 'lucide-react';

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
    submitted_by?: string;
}

interface CalendarCellClasslessProps {
    day: number;
    year: number;
    month: number;
    kindergartenId: string;
    existingOrder?: OrderData;
    isServiceDay: boolean;
    isLocked: boolean;
    isGraceLocked: boolean;
    mealOptions?: string[];
    onSave: (order: OrderData) => Promise<void>;
}

export default function CalendarCellClassless({
    day, year, month, kindergartenId, existingOrder, isServiceDay, isLocked, isGraceLocked, mealOptions = [], onSave
}: CalendarCellClasslessProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    const buttonRef = useRef<HTMLButtonElement>(null);

    const [mealType, setMealType] = useState(
        existingOrder?.meal_type === '飯なし' ? '通常' : (existingOrder?.meal_type || '通常')
    );
    const [studentCount, setStudentCount] = useState(existingOrder?.student_count || 0);
    const [allergyCount, setAllergyCount] = useState(existingOrder?.allergy_count || 0);
    const [teacherCount, setTeacherCount] = useState(existingOrder?.teacher_count || 0);
    const [memo, setMemo] = useState(existingOrder?.memo || '');
    const [isSaving, setIsSaving] = useState(false);
    const [submittedBy, setSubmittedBy] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('submitted_by_name') || '' : ''
    );

    useEffect(() => {
        if (existingOrder) {
            setMealType(existingOrder.meal_type === '飯なし' ? '通常' : existingOrder.meal_type);
            setStudentCount(existingOrder.student_count);
            setAllergyCount(existingOrder.allergy_count);
            setTeacherCount(existingOrder.teacher_count);
            setMemo(existingOrder.memo || '');
        }
    }, [existingOrder]);

    const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const displayOptions = mealOptions.length > 0 ? mealOptions : ['通常'];

    const handleOpen = () => {
        if (!isServiceDay || isLocked) return;
        if (isGraceLocked) {
            if (!confirm("3日前を過ぎた変更です。電話連絡が必要な場合があります。続けますか？")) return;
        }
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const popoverWidth = 280;
            const popoverHeight = 360;
            const margin = 8;

            // Horizontal: center on cell, clamp to viewport
            let left = rect.left + rect.width / 2 - popoverWidth / 2;
            left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

            // Vertical: prefer below, flip to above if not enough space
            let top: number;
            if (rect.bottom + popoverHeight + margin < window.innerHeight) {
                top = rect.bottom + margin;
            } else {
                top = rect.top - popoverHeight - margin;
            }
            top = Math.max(margin, top);

            setPopoverStyle({ position: 'fixed', top, left, width: popoverWidth, zIndex: 50 });
        }
        setIsOpen(true);
    };

    const handleSubmit = async () => {
        localStorage.setItem('submitted_by_name', submittedBy);
        setIsSaving(true);
        try {
            await onSave({
                order_id: existingOrder?.order_id,
                kindergarten_id: kindergartenId,
                date: dateStr,
                class_name: '共通',
                meal_type: mealType,
                student_count: studentCount,
                allergy_count: allergyCount,
                teacher_count: teacherCount,
                memo,
                submitted_by: submittedBy,
            });
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

    const hasOrder = !!existingOrder;
    const isSpecialMeal = mealType !== '通常' && mealType !== '飯なし';

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
                        <>
                            {mealType === '飯なし' ? (
                                <span className="text-[9px] font-black text-gray-400">飯なし</span>
                            ) : (
                                <>
                                    {isSpecialMeal && (
                                        <span className="text-[9px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-1 py-0.5 rounded leading-none">{mealType}</span>
                                    )}
                                    <span className="text-[10px] font-black text-gray-600 leading-none">児{studentCount}</span>
                                    {allergyCount > 0 && (
                                        <span className="text-[9px] font-bold text-red-400 leading-none">ア{allergyCount}</span>
                                    )}
                                    <span className="text-[9px] font-bold text-gray-400 leading-none">先{teacherCount}</span>
                                </>
                            )}
                        </>
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
                    {/* Transparent backdrop — click to close */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    {/* Popover card */}
                    <div
                        style={popoverStyle}
                        onClick={e => e.stopPropagation()}
                        className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                            <h2 className="font-bold text-gray-800 text-sm">{month}月{day}日 の注文</h2>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 bg-white rounded-full text-gray-400 hover:bg-gray-100">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-3 space-y-3">
                            {/* Meal type */}
                            <div>
                                <p className="text-[10px] font-black text-gray-400 mb-1.5 uppercase">給食タイプ</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {displayOptions.map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => setMealType(opt)}
                                            className={`py-1 px-2.5 text-xs rounded-full border font-medium transition-colors ${mealType === opt
                                                ? 'bg-orange-500 text-white border-orange-600'
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Counters */}
                            <div className="grid grid-cols-3 gap-2">
                                <MiniCounter label="園児" value={studentCount} onChange={d => setStudentCount(v => Math.max(0, v + d))} />
                                <MiniCounter label="アレルギー" value={allergyCount} onChange={d => setAllergyCount(v => Math.max(0, v + d))} color="text-red-600" />
                                <MiniCounter label="先生" value={teacherCount} onChange={d => setTeacherCount(v => Math.max(0, v + d))} />
                            </div>

                            <input
                                type="text"
                                placeholder="備考"
                                value={memo}
                                onChange={e => setMemo(e.target.value)}
                                className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-100"
                            />
                            <input
                                type="text"
                                placeholder="担当者名（任意）"
                                value={submittedBy}
                                onChange={e => setSubmittedBy(e.target.value)}
                                className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-orange-100"
                            />
                        </div>

                        <div className="px-3 pb-3">
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

function MiniCounter({ label, value, onChange, color = "text-gray-900" }: { label: string, value: number, onChange: (d: number) => void, color?: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-[10px] text-gray-500 mb-1">{label}</span>
            <div className="flex items-center gap-0.5 bg-white rounded-lg border border-gray-200 p-0.5">
                <button onClick={() => onChange(-1)} className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded"><Minus className="w-3 h-3" /></button>
                <span className={`font-bold text-base w-7 text-center ${color}`}>{value}</span>
                <button onClick={() => onChange(1)} className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded"><Plus className="w-3 h-3" /></button>
            </div>
        </div>
    );
}
