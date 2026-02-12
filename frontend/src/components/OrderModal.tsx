"use client";

import { useState, useEffect } from 'react';
import { X, Minus, Plus, Save } from 'lucide-react';
import { ClassMaster, Order, LoginUser } from '@/types';
import { saveOrder } from '@/lib/api';

interface OrderModalProps {
    date: Date;
    isOpen: boolean;
    onClose: () => void;
    user: LoginUser;
    classes: ClassMaster[];
    existingOrders: Order[];
    onSave: () => void;
}

export default function OrderModal({ date, isOpen, onClose, user, classes, existingOrders, onSave }: OrderModalProps) {
    const [mealType, setMealType] = useState('通常'); // Used for Bulk Apply
    // Include order_id and meal_type in state to track per-class orders
    const [classOrders, setClassOrders] = useState<Record<string, { order_id?: string, meal_type: string, student: number, allergy: number, teacher: number, memo: string }>>({});
    const [loading, setLoading] = useState(false);

    // Initial State Setup
    useEffect(() => {
        if (isOpen) {
            const initialOrders: any = {};
            // Determine bulk meal type from first order if exists, otherwise "通常"
            const firstOrder = existingOrders[0];
            if (firstOrder) setMealType(firstOrder.meal_type); // This is just for initial UI state of bulk selector
            else setMealType('通常');

            classes.forEach(cls => {
                const order = existingOrders.find(o => o.class_name === cls.class_name);
                initialOrders[cls.class_name] = {
                    order_id: order?.order_id,
                    meal_type: order ? order.meal_type : '通常',
                    student: order ? order.student_count : cls.default_student_count,
                    allergy: order ? order.allergy_count : (cls.default_allergy_count || 0),
                    teacher: order ? order.teacher_count : cls.default_teacher_count,
                    memo: order ? (order.memo || "") : ""
                };
            });
            setClassOrders(initialOrders);
        }
    }, [isOpen, classes, existingOrders]);

    if (!isOpen) return null;

    const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    // Fix: Use local time construction to avoid UTC shift
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Filter Meal Types based on dynamic Kindergarten Services (Triggers)
    const mealOptions = [
        ...(user.services || []).map(s => ({ value: s, label: s })),
        { value: '飯なし', label: 'なし' }
    ];

    const updateCount = (clsName: string, field: 'student' | 'allergy' | 'teacher', diff: number) => {
        setClassOrders(prev => {
            const current = prev[clsName];
            if (!current) return prev;
            const newVal = Math.max(0, current[field] + diff);
            return { ...prev, [clsName]: { ...current, [field]: newVal } };
        });
    };

    const updateMealType = (clsName: string, type: string) => {
        setClassOrders(prev => ({ ...prev, [clsName]: { ...prev[clsName], meal_type: type } }));
    };

    const updateMemo = (clsName: string, val: string) => {
        setClassOrders(prev => ({ ...prev, [clsName]: { ...prev[clsName], memo: val } }));
    };

    const applyBulkMealType = (type: string) => {
        setMealType(type);
        setClassOrders(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                next[key] = { ...next[key], meal_type: type };
            });
            return next;
        });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Save order for each class
            const promises = classes.map(cls => {
                const data = classOrders[cls.class_name];
                const orderData: Order = {
                    order_id: data.order_id, // include ID if exists
                    kindergarten_id: user.kindergarten_id,
                    date: dateStr,
                    class_name: cls.class_name,
                    meal_type: data.meal_type, // Use per-class meal type
                    student_count: data.student,
                    allergy_count: data.allergy,
                    teacher_count: data.teacher,
                    memo: data.memo
                };
                return saveOrder(orderData);
            });
            await Promise.all(promises);
            onSave();
            onClose();
        } catch (e) {
            alert('保存に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-xl">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-orange-50 rounded-t-2xl">
                    <div>
                        <h2 className="font-bold text-lg text-gray-800">{formattedDate} の注文</h2>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white rounded-full text-gray-500 hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    {/* Bulk Meal Type Selector */}
                    <div className="mb-6 bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                        <label className="block text-xs font-bold text-orange-800 mb-2">まとめて設定 (本日の給食)</label>
                        <div className="flex flex-wrap gap-2">
                            {mealOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => applyBulkMealType(opt.value)}
                                    className={`py-1.5 px-3 text-xs rounded-full border font-medium transition-colors ${mealType === opt.value
                                        ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Class List */}
                    <div className="space-y-4">
                        {classes.map(cls => (
                            <div key={cls.class_name} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-1 sm:mb-0">
                                        {cls.class_name}
                                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{cls.grade}</span>
                                    </h3>

                                    {/* Per-Class Meal Type Selector (Scrollable Buttons) */}
                                    <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar scroll-smooth w-full sm:w-auto mt-2 sm:mt-0">
                                        {mealOptions.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => updateMealType(cls.class_name, opt.value)}
                                                className={`whitespace-nowrap py-1 px-2.5 text-xs rounded-full border font-medium transition-colors flex-shrink-0 ${(classOrders[cls.class_name]?.meal_type || '通常') === opt.value
                                                    ? 'bg-orange-500 text-white border-orange-600 shadow-sm ring-1 ring-orange-200'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    {/* Student Count */}
                                    <Counter
                                        label="園児"
                                        value={classOrders[cls.class_name]?.student || 0}
                                        onChange={(d) => updateCount(cls.class_name, 'student', d)}
                                    />
                                    {/* Allergy Count */}
                                    <Counter
                                        label="アレルギー"
                                        value={classOrders[cls.class_name]?.allergy || 0}
                                        onChange={(d) => updateCount(cls.class_name, 'allergy', d)}
                                        color="text-red-600"
                                    />
                                    {/* Teacher Count */}
                                    <Counter
                                        label="先生"
                                        value={classOrders[cls.class_name]?.teacher || 0}
                                        onChange={(d) => updateCount(cls.class_name, 'teacher', d)}
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="備考 (例: 10:20納品)"
                                    value={classOrders[cls.class_name]?.memo || ""}
                                    onChange={(e) => updateMemo(cls.class_name, e.target.value)}
                                    className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-gray-50 focus:bg-white transition-colors"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-white sm:rounded-b-2xl">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                        {loading ? '保存中...' : <><Save className="w-5 h-5" /> 保存する</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Counter({ label, value, onChange, color = "text-gray-900" }: { label: string, value: number, onChange: (d: number) => void, color?: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500 mb-1">{label}</span>
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
                <button onClick={() => onChange(-1)} className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded"><Minus className="w-4 h-4" /></button>
                <span className={`font-bold text-lg w-8 text-center ${color}`}>{value}</span>
                <button onClick={() => onChange(1)} className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded"><Plus className="w-4 h-4" /></button>
            </div>
        </div>
    );
}
