"use client";

import { useState, useEffect } from 'react';
import { Save, Minus, Plus, Edit3, Calendar } from 'lucide-react';
import { updateClassMaster, getPendingClassSnapshots } from '@/lib/api';
import { ClassMaster, LoginUser } from '@/types';

interface ClassReportPanelProps {
    user: LoginUser;
    classes: ClassMaster[];
    onSaved: () => void; // Callback to refresh data
    onOpenChangeRequest: () => void;
}

export default function ClassReportPanel({ user, classes, onSaved, onOpenChangeRequest }: ClassReportPanelProps) {
    const [edits, setEdits] = useState<Record<string, ClassMaster>>({});
    const [saving, setSaving] = useState(false);
    const [pendingSnapshots, setPendingSnapshots] = useState<{ date: string, classes: any[] }[]>([]);

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

    // Fetch pending future snapshots
    useEffect(() => {
        if (user.kindergarten_id) {
            getPendingClassSnapshots(user.kindergarten_id)
                .then(res => setPendingSnapshots(res.pending_snapshots || []))
                .catch(() => setPendingSnapshots([]));
        }
    }, [user.kindergarten_id, classes]);

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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                    登録クラス情報
                </h2>
                <button
                    onClick={onOpenChangeRequest}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-black border border-blue-100 hover:bg-blue-100 transition-colors"
                >
                    <Edit3 className="w-3.5 h-3.5" /> 変更の申請
                </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-white">
                <div className="text-[10px] font-bold text-gray-400 mb-4 uppercase tracking-widest bg-gray-50/50 p-2 rounded">
                    ※登録されている基本の人数設定
                </div>

                <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex text-[10px] font-black text-gray-300 px-2 uppercase tracking-tighter">
                        <div className="w-24">クラス名</div>
                        <div className="flex-1 text-center">園児</div>
                        <div className="flex-1 text-center">アレルギー</div>
                        <div className="flex-1 text-center">先生</div>
                    </div>

                    {classes.map(cls => (
                        <div key={cls.class_name} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 hover:border-orange-100 transition-colors">
                            {/* Class Name */}
                            <div className="w-24 flex flex-col leading-tight">
                                <span className="text-sm font-bold text-gray-800 truncate">{cls.class_name}</span>
                                <span className="text-[10px] font-bold text-gray-400">{cls.grade || '---'}</span>
                            </div>

                            {/* Info Row */}
                            <div className="flex-1 flex justify-between gap-1">
                                <MiniCounter
                                    value={edits[cls.class_name]?.default_student_count || 0}
                                    onChange={(d) => updateCount(cls.class_name, 'default_student_count', d)}
                                />
                                <MiniCounter
                                    value={edits[cls.class_name]?.default_allergy_count || 0}
                                    onChange={(d) => updateCount(cls.class_name, 'default_allergy_count', d)}
                                    color="text-red-500 bg-red-50/50 border-red-100"
                                />
                                <MiniCounter
                                    value={edits[cls.class_name]?.default_teacher_count || 0}
                                    onChange={(d) => updateCount(cls.class_name, 'default_teacher_count', d)}
                                />
                            </div>
                        </div>
                    ))}

                    {classes.length === 0 && (
                        <div className="py-20 text-center space-y-2">
                            <p className="text-gray-300 font-bold text-sm">クラス情報がありません</p>
                        </div>
                    )}
                </div>

                {/* Pending Changes Indicator */}
                {pendingSnapshots.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {pendingSnapshots.map(snap => (
                            <div key={snap.date} className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                    <span className="text-xs font-black text-blue-600">
                                        📅 {snap.date} から新設定が適用されます
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {snap.classes.map((c: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-[10px] text-blue-700">
                                            <span className="font-bold">{c.class_name}</span>
                                            <span>園児{c.default_student_count} / アレルギー{c.default_allergy_count} / 先生{c.default_teacher_count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/20">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-orange-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-600 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                    {saving ? '保存中...' : <><Save className="w-5 h-5" /> 設定を送信</>}
                </button>
            </div>
        </div>
    );
}

function MiniCounter({ value, onChange, color = "text-gray-600 bg-gray-50 border-gray-100" }: { value: number, onChange: (d: number) => void, color?: string }) {
    return (
        <div className={`flex items-center justify-between flex-1 rounded-lg border p-1 min-w-[32px] ${color}`}>
            <button onClick={() => onChange(-1)} className="p-1 hover:bg-black/5 rounded text-gray-400"><Minus className="w-3 h-3" /></button>
            <span className="font-bold text-sm">{value}</span>
            <button onClick={() => onChange(1)} className="p-1 hover:bg-black/5 rounded text-gray-400"><Plus className="w-3 h-3" /></button>
        </div>
    );
}
