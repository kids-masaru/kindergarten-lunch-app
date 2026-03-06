"use client";

import { useState, useEffect } from 'react';
import { Send, Minus, Plus, Calendar, Loader2 } from 'lucide-react';
import { updateKindergartenClasses, getPendingClassSnapshots } from '@/lib/api';
import { ClassMaster, LoginUser } from '@/types';

interface ClassReportPanelProps {
    user: LoginUser;
    classes: ClassMaster[];
    onSaved: () => void;
}

export default function ClassReportPanel({ user, classes, onSaved }: ClassReportPanelProps) {
    const [edits, setEdits] = useState<Record<string, ClassMaster>>({});
    const [saving, setSaving] = useState(false);
    const [effectiveDate, setEffectiveDate] = useState<string>('');
    const [pendingSnapshots, setPendingSnapshots] = useState<{ date: string, classes: any[] }[]>([]);

    useEffect(() => {
        if (classes.length > 0) {
            const initialEdits: Record<string, ClassMaster> = {};
            classes.forEach(c => { initialEdits[c.class_name] = { ...c }; });
            setEdits(initialEdits);
        }
    }, [classes]);

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
            return { ...prev, [className]: { ...cls, [field]: newVal } };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const dataToSave = Object.values(edits).map(cls => ({
                ...cls,
                effective_from: effectiveDate || undefined,
            }));
            await updateKindergartenClasses(user.kindergarten_id, dataToSave);
            const msg = effectiveDate
                ? `${effectiveDate} 以降の基本人数を申請しました`
                : '基本人数の変更を申請しました';
            alert(msg);
            setEffectiveDate('');
            onSaved();
        } catch (e) {
            alert('更新に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-bold text-gray-800 text-base">登録クラス情報</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">※ 基本の人数設定（カレンダーから日ごとの変更が可能です）</p>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
                {/* Column headers */}
                <div className="flex text-[10px] font-black text-gray-300 px-2 uppercase tracking-tighter mb-2">
                    <div className="w-24">クラス名</div>
                    <div className="flex-1 text-center">園児</div>
                    <div className="flex-1 text-center">アレルギー</div>
                    <div className="flex-1 text-center">先生</div>
                </div>

                <div className="space-y-2">
                    {classes.map(cls => (
                        <div key={cls.class_name} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 hover:border-orange-100 transition-colors">
                            <div className="w-24 flex flex-col leading-tight">
                                <span className="text-sm font-bold text-gray-800 truncate">{cls.class_name}</span>
                                <span className="text-[10px] font-bold text-gray-400">{cls.grade || '---'}</span>
                            </div>
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
                        <div className="py-12 text-center">
                            <p className="text-gray-300 font-bold text-sm">クラス情報がありません</p>
                        </div>
                    )}
                </div>

                {/* Pending scheduled changes */}
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

            {/* Footer: date picker + submit */}
            <div className="p-4 border-t border-gray-100 space-y-3">
                <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> 変更の適用開始日（任意）
                    </label>
                    <input
                        type="date"
                        value={effectiveDate}
                        onChange={e => setEffectiveDate(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm font-bold focus:ring-2 focus:ring-orange-100 outline-none"
                    />
                    <p className="text-[9px] text-gray-400 mt-1">
                        {effectiveDate ? `${effectiveDate} 以降の注文に反映されます` : '空白の場合は申請後すぐに反映されます'}
                    </p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold text-base hover:bg-orange-600 flex items-center justify-center gap-2 shadow-lg ring-4 ring-orange-100 active:scale-95 transition-all"
                >
                    {saving
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : <><Send className="w-4 h-4" /> 変更を申請する</>
                    }
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
