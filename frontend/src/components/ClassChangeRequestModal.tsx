"use client";

import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Save, Loader2, Minus, Plus } from 'lucide-react';
import { ClassMaster, LoginUser } from '@/types';
import { updateKindergartenClasses } from '@/lib/api';

interface ClassChangeRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: LoginUser;
    currentClasses: ClassMaster[];
    onSaved: () => void;
}

export default function ClassChangeRequestModal({ isOpen, onClose, user, currentClasses, onSaved }: ClassChangeRequestModalProps) {
    const [effectiveDate, setEffectiveDate] = useState<string>('');
    const [edits, setEdits] = useState<ClassMaster[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Set default effective date to tomorrow or 1st of next month
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setEffectiveDate(tomorrow.toISOString().split('T')[0]);
            setEdits(currentClasses.map(c => ({ ...c })));
        }
    }, [isOpen, currentClasses]);

    if (!isOpen) return null;

    const handleCountChange = (index: number, field: keyof ClassMaster, delta: number) => {
        const newEdits = [...edits];
        const val = (newEdits[index][field] as number || 0) + delta;
        // @ts-ignore
        newEdits[index][field] = Math.max(0, val);
        setEdits(newEdits);
    };

    const handleSave = async () => {
        if (!effectiveDate) {
            alert("適用開始日を選択してください");
            return;
        }
        setLoading(true);
        try {
            // Add effective_from to each class data
            const dataToSave = edits.map(c => ({
                ...c,
                effective_from: effectiveDate
            }));
            await updateKindergartenClasses(user.kindergarten_id, dataToSave);
            alert(`${effectiveDate} からの設定を保存しました。`);
            onSaved();
            onClose();
        } catch (e) {
            alert("保存に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-50/50">
                    <h2 className="font-black text-xl text-gray-800 flex items-center gap-2">
                        <CalendarIcon className="w-6 h-6 text-orange-500" />
                        <span>変更の申請 (適用開始日の指定)</span>
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-sm text-blue-800">
                        <p className="font-bold flex items-center gap-2 mb-1">
                            💡 いつから変更しますか？
                        </p>
                        <p>ここで指定した日付以降の注文に、新しい人数が自動で反映されます。過去のデータは上書きされません。</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 ml-1 uppercase">適用開始日</label>
                        <input
                            type="date"
                            value={effectiveDate}
                            onChange={(e) => setEffectiveDate(e.target.value)}
                            className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-4">
                        <label className="text-xs font-black text-gray-400 ml-1 uppercase">クラス別人数設定</label>
                        {edits.map((cls, idx) => (
                            <div key={cls.class_name} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                <div className="w-1/3">
                                    <p className="font-black text-gray-800">{cls.class_name}</p>
                                    <p className="text-[10px] text-gray-400 font-bold">{cls.grade}</p>
                                </div>
                                <div className="flex gap-4">
                                    <Counter label="園児" value={cls.default_student_count} onChange={(d) => handleCountChange(idx, 'default_student_count', d)} />
                                    <Counter label="アレルギー" value={cls.default_allergy_count || 0} onChange={(d) => handleCountChange(idx, 'default_allergy_count', d)} color="text-red-500" />
                                    <Counter label="先生" value={cls.default_teacher_count} onChange={(d) => handleCountChange(idx, 'default_teacher_count', d)} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 shadow-xl shadow-orange-100 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> 指定日に設定を反映する</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Counter({ label, value, onChange, color = "text-gray-800" }: { label: string, value: number, onChange: (d: number) => void, color?: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-gray-300 uppercase mb-1">{label}</span>
            <div className="flex items-center gap-1 bg-gray-50 rounded-xl border border-gray-200 p-1">
                <button onClick={() => onChange(-1)} className="p-1 hover:bg-white rounded shadow-sm text-gray-400"><Minus className="w-3 h-3" /></button>
                <span className={`font-black text-sm w-6 text-center ${color}`}>{value}</span>
                <button onClick={() => onChange(1)} className="p-1 hover:bg-white rounded shadow-sm text-gray-400"><Plus className="w-3 h-3" /></button>
            </div>
        </div>
    );
}
