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

            <div className="p-2 overflow-y-auto flex-1">
                <div className="text-xs text-gray-500 mb-2 bg-gray-50 p-2 rounded border border-gray-100">
                    ※来月の初期値設定
                </div>

                <div className="space-y-1">
                    {/* Header Row */}
                    <div className="flex text-[10px] text-gray-400 px-2">
                        <div className="w-20">クラス</div>
                        <div className="flex-1 text-center">園児</div>
                        <div className="flex-1 text-center">アレ</div>
                        <div className="flex-1 text-center">先生</div>
                    </div>

                    {classes.map(cls => (
                        <div key={cls.class_name} className="bg-white p-1.5 rounded border border-gray-200 shadow-sm flex items-center gap-1">
                            {/* Class Name */}
                            <div className="w-20 flex flex-col leading-none">
                                <span className="text-sm font-bold text-blue-800 truncate">{cls.class_name}</span>
                                <span className="text-[9px] text-gray-400">{cls.grade}</span>
                            </div>

                            {/* Counters Row */}
                            <div className="flex-1 flex justify-between gap-1">
                                <MiniCounter
                                    value={edits[cls.class_name]?.default_student_count || 0}
                                    onChange={(d) => updateCount(cls.class_name, 'default_student_count', d)}
                                />
                                <MiniCounter
                                    value={edits[cls.class_name]?.default_allergy_count || 0}
                                    onChange={(d) => updateCount(cls.class_name, 'default_allergy_count', d)}
                                    color="text-red-600 bg-red-50"
                                />
                                <MiniCounter
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

function MiniCounter({ value, onChange, color = "text-gray-800 bg-gray-50" }: { value: number, onChange: (d: number) => void, color?: string }) {
    return (
        <div className={`flex items-center justify-between flex-1 rounded border border-gray-100 p-0.5 h-8 ${color}`}>
            <button onClick={() => onChange(-1)} className="w-5 h-full flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded"><Minus className="w-3 h-3" /></button>
            <span className="font-bold text-sm lg:text-base">{value}</span>
            <button onClick={() => onChange(1)} className="w-5 h-full flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-black/5 rounded"><Plus className="w-3 h-3" /></button>
        </div>
    );
}
