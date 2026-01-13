"use client";

import { useState, useEffect } from 'react';
import { Save, Minus, Plus } from 'lucide-react';
import { updateClassMaster } from '@/lib/api';
import { ClassMaster, LoginUser } from '@/types';

interface ClassReportPanelProps {
    user: LoginUser;
    classes: ClassMaster[];
    onSaved: () => void; // Callback to refresh data
}

export default function ClassReportPanel({ user, classes, onSaved }: ClassReportPanelProps) {
    const [edits, setEdits] = useState<Record<string, ClassMaster>>({});
    const [saving, setSaving] = useState(false);

    // Initialize edits when classes change
    useEffect(() => {
        if (classes.length > 0) {
            const initialEdits: Record<string, ClassMaster> = {};
            classes.forEach(c => {
                initialEdits[c.class_name] = { ...c };
            });
            setEdits(initialEdits);
        }
    }, [classes]);

    const updateCount = (className: string, field: keyof ClassMaster, delta: number) => {
        setEdits(prev => {
            const cls = prev[className];
            if (!cls) return prev;
            // @ts-ignore
            const newVal = Math.max(0, (cls[field] as number) + delta);
            return {
                ...prev,
                [className]: { ...cls, [field]: newVal }
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const promises = Object.values(edits).map(cls => {
                return updateClassMaster({
                    kindergarten_id: user.kindergarten_id,
                    class_name: cls.class_name,
                    default_student_count: cls.default_student_count,
                    default_allergy_count: cls.default_allergy_count || 0,
                    default_teacher_count: cls.default_teacher_count
                });
            });
            await Promise.all(promises);
            onSaved();
            alert('設定を保存しました');
        } catch (e) {
            console.error(e);
            alert('更新に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-blue-50 rounded-t-2xl">
                <h2 className="font-bold text-lg text-blue-900 flex items-center gap-2">
                    <span>📊 月次データ設定</span>
                </h2>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
                <div className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100 leading-relaxed">
                    ※ここでの設定値が<strong>来月の初期値</strong>になります。
                </div>

                <div className="space-y-2">
                    {classes.map(cls => (
                        <div key={cls.class_name} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                            {/* Header: Class Name & Grade */}
                            <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-50">
                                <span className="text-sm font-bold text-blue-800">{cls.class_name}</span>
                                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{cls.grade}</span>
                            </div>

                            {/* Counters Grid - Compact */}
                            <div className="grid grid-cols-3 gap-2">
                                <EditCounter
                                    label="園児"
                                    value={edits[cls.class_name]?.default_student_count || 0}
                                    onChange={(d) => updateCount(cls.class_name, 'default_student_count', d)}
                                />
                                <EditCounter
                                    label="アレルギー"
                                    value={edits[cls.class_name]?.default_allergy_count || 0}
                                    onChange={(d) => updateCount(cls.class_name, 'default_allergy_count', d)}
                                    color="text-red-600"
                                />
                                <EditCounter
                                    label="先生"
                                    value={edits[cls.class_name]?.default_teacher_count || 0}
                                    onChange={(d) => updateCount(cls.class_name, 'default_teacher_count', d)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                    {saving ? '保存中...' : <><Save className="w-5 h-5" /> 変更を保存する</>}
                </button>
            </div>
        </div>
    );
}

function EditCounter({ label, value, onChange, color = "text-gray-900" }: { label: string, value: number, onChange: (d: number) => void, color?: string }) {
    return (
        <div className="flex flex-col items-center w-full">
            <span className="text-[10px] text-gray-400 mb-1">{label}</span>
            <div className="flex items-center justify-between w-full bg-white rounded border border-gray-200 p-0.5">
                <button onClick={() => onChange(-1)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Minus className="w-3 h-3" /></button>
                <span className={`font-bold text-base flex-1 text-center ${color}`}>{value}</span>
                <button onClick={() => onChange(1)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Plus className="w-3 h-3" /></button>
            </div>
        </div>
    );
}
