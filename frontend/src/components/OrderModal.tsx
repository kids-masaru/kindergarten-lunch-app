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
    const [mealType, setMealType] = useState('通常');
    const [classOrders, setClassOrders] = useState<Record<string, { student: number, allergy: number, teacher: number, memo: string }>>({});
    const [loading, setLoading] = useState(false);

    // Initial State Setup
    useEffect(() => {
        if (isOpen) {
            const initialOrders: any = {};
            // Determine meal type from first order if exists, otherwise "通常"
            const firstOrder = existingOrders[0];
            if (firstOrder) setMealType(firstOrder.meal_type);
            else setMealType('通常');

            classes.forEach(cls => {
                const order = existingOrders.find(o => o.class_name === cls.class_name);
                initialOrders[cls.class_name] = {
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
    const dateStr = date.toISOString().split('T')[0];

    // Filter Meal Types based on Settings
    const mealOptions = [
        { value: '通常', label: '通常給食' },
        ...(user.settings.has_curry_day ? [{ value: 'カレー', label: 'カレー給食' }] : []),
        ...(user.settings.has_bread_day ? [{ value: 'パン', label: 'パン給食' }] : []),
        ...(user.settings.has_birthday_party ? [{ value: '誕生会', label: '誕生会' }] : []),
        { value: 'ピクニック', label: 'ピクニック' },
        { value: '飯なし', label: '給食なし' }
    ];

    const updateCount = (clsName: string, field: 'student' | 'allergy' | 'teacher', diff: number) => {
        setClassOrders(prev => {
            const current = prev[clsName] || { student: 0, allergy: 0, teacher: 0, memo: "" };
            const newVal = Math.max(0, current[field] + diff);
            return { ...prev, [clsName]: { ...current, [field]: newVal } };
        });
    };

    const updateMemo = (clsName: string, val: string) => {
        setClassOrders(prev => ({ ...prev, [clsName]: { ...prev[clsName], memo: val } }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Save order for each class
            const promises = classes.map(cls => {
                const data = classOrders[cls.class_name];
                const orderData: Order = {
                    kindergarten_id: user.kindergarten_id,
                    date: dateStr,
                    class_name: cls.class_name,
                    meal_type: mealType,
                    student_count: data.student,
                    allergy_count: data.allergy,
                    teacher_count: data.teacher,
                    memo: data.memo
                };
                // If update logic requires order_id, we'd need to map it. 
                // For MVP append-only/simple, straightforward save.
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
            <div className="bg-white w-full sm:max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
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
                    {/* Meal Type Selector */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-700 mb-2">本日の給食区分</label>
                        <div className="grid grid-cols-3 gap-2">
                            {mealOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setMealType(opt.value)}
                                    className={`py-2 px-1 text-sm rounded-lg border font-medium transition-colors ${mealType === opt.value
                                        ? 'bg-orange-500 text-white border-orange-600'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Class List */}
                    <div className="space-y-6">
                        {classes.map(cls => (
                            <div key={cls.class_name} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <h3 className="font-bold text-gray-800 mb-3 flex items-center justify-between">
                                    <span>{cls.class_name} <span className="text-xs font-normal text-gray-500">({cls.grade})</span></span>
                                </h3>

                                <div className="grid grid-cols-3 gap-4 mb-3">
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
                                    className="w-full text-sm border border-gray-300 rounded-lg p-2"
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
