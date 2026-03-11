"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Loader2, Minus, Plus } from 'lucide-react';

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
    isPending?: boolean;
    onSave: (order: OrderData) => Promise<void>;
}

export default function CalendarCellClassless({
    day, year, month, kindergartenId, existingOrder, isServiceDay, isLocked, isGraceLocked, mealOptions = [], isPending, onSave
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
            const popoverWidth = 420;
            const popoverHeight = 460;
            const margin = 8;
            let left = rect.left + rect.width / 2 - popoverWidth / 2;
            left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
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
                <span className="text-base font-black">{day}</span>
            </div>
        );
    }

    const hasOrder = !!existingOrder;
    const isSpecialMeal = mealType !== '通常' && mealType !== '飯なし';
    const total = studentCount + allergyCount;

    // セルの境界線スタイル
    const borderStyle = isPending
        ? 'bg-blue-50 border-blue-400 border-2'
        : isLocked
            ? 'bg-gray-100 border-gray-200 opacity-40 grayscale cursor-not-allowed'
            : isGraceLocked
                ? 'bg-amber-50 border-amber-200'
                : isToday
                    ? 'bg-orange-50 border-orange-300'
                    : 'bg-white border-gray-200';

    return (
        <>
            <button
                ref={buttonRef}
                onClick={handleOpen}
                disabled={isLocked}
                className={`h-full w-full rounded-xl flex flex-col items-start justify-start p-1.5 relative border transition-all shadow-sm active:scale-95 ${borderStyle}`}
            >
                {/* 日付 */}
                <div className="flex items-center justify-between w-full mb-0.5">
                    <span className={`text-sm font-black leading-none ${isToday ? 'text-orange-600' : 'text-gray-600'}`}>{day}</span>
                    {isPending && <span className="text-[9px] font-black text-blue-500 bg-blue-100 px-1 rounded">未送信</span>}
                </div>

                {hasOrder ? (
                    <div className="flex-1 flex flex-col justify-center items-start w-full gap-0">
                        {/* 特別メニュー */}
                        {isSpecialMeal && (
                            <span className="text-xs font-black text-orange-600 bg-orange-50 border border-orange-200 px-1 rounded leading-none self-start mb-0.5">{mealType}</span>
                        )}
                        {/* 園児ラベル */}
                        <span className="text-xs font-bold text-gray-500 leading-tight">園児</span>
                        {/* 数値：左揃え・改行なし */}
                        <span className="font-black text-gray-800 leading-tight whitespace-nowrap">
                            <span className="text-2xl">{studentCount}</span><span className="text-sm text-red-500">+ア{allergyCount}＝</span><span className="text-2xl">{total}</span>
                        </span>
                        {/* 区切り線 */}
                        <div className="w-full border-t border-gray-200 my-0.5" />
                        {/* 先生：左ラベル・右数値・同じ行 */}
                        <div className="flex justify-between items-baseline w-full">
                            <span className="text-xs font-bold text-gray-500 leading-tight">先生</span>
                            <span className="text-2xl font-black text-gray-600 leading-tight">{teacherCount}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center w-full">
                        <span className="text-sm text-gray-300 font-bold">未入力</span>
                    </div>
                )}

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
                        className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
                    >
                        {/* ヘッダー */}
                        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="font-black text-gray-800 text-base">{month}月{day}日</h2>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 bg-white rounded-full text-gray-400 hover:bg-gray-100">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* 給食タイプ */}
                            <div>
                                <p className="text-xs font-black text-gray-500 mb-2">給食タイプ</p>
                                <div className="flex flex-wrap gap-2">
                                    {displayOptions.map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => setMealType(opt)}
                                            className={`py-2 px-3 text-sm rounded-xl border font-bold transition-colors ${mealType === opt
                                                ? 'bg-orange-500 text-white border-orange-600'
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* カウンター */}
                            <div className="grid grid-cols-3 gap-3">
                                <BigCounter label="園児" value={studentCount} onChange={d => setStudentCount(v => Math.max(0, v + d))} />
                                <BigCounter label="アレルギー" value={allergyCount} onChange={d => setAllergyCount(v => Math.max(0, v + d))} color="text-red-600" />
                                <BigCounter label="先生" value={teacherCount} onChange={d => setTeacherCount(v => Math.max(0, v + d))} />
                            </div>

                            <input
                                type="text"
                                placeholder="担当者名（任意）"
                                value={submittedBy}
                                onChange={e => setSubmittedBy(e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-100"
                            />
                            <input
                                type="text"
                                placeholder="備考（任意）"
                                value={memo}
                                onChange={e => setMemo(e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div className="px-4 pb-4">
                            <button
                                onClick={handleSubmit}
                                disabled={isSaving}
                                className="w-full bg-gray-700 text-white py-3.5 rounded-xl font-black text-base hover:bg-gray-800 flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> 保存</>}
                            </button>
                            <p className="text-xs text-gray-400 text-center mt-2">※ 保存後、上部の「申請」ボタンで送信</p>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
}

function BigCounter({ label, value, onChange, color = "text-gray-900" }: { label: string, value: number, onChange: (d: number) => void, color?: string }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-black text-gray-500">{label}</span>
            <div className="flex items-center gap-1 bg-white rounded-xl border-2 border-gray-200 p-1">
                <button onClick={() => onChange(-1)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg font-black shrink-0"><Minus className="w-3.5 h-3.5" /></button>
                <span className={`font-black text-base min-w-[2rem] text-center ${color}`}>{value}</span>
                <button onClick={() => onChange(1)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg font-black shrink-0"><Plus className="w-3.5 h-3.5" /></button>
            </div>
        </div>
    );
}
