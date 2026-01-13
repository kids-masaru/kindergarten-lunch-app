"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMasters, updateClassMaster } from '@/lib/api';
import { LoginUser, ClassMaster } from '@/types';
import { ChevronLeft, Save, Loader2, Minus, Plus } from 'lucide-react';

export default function ReportPage() {
    const router = useRouter();
    const [user, setUser] = useState<LoginUser | null>(null);
    const [classes, setClasses] = useState<ClassMaster[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [edits, setEdits] = useState<Record<string, ClassMaster>>({});

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            router.push('/login');
            return;
        }
        const u = JSON.parse(userData);
        setUser(u);

        getMasters(u.kindergarten_id).then(res => {
            setClasses(res.classes);
            // Initialize edits state with fetched data
            const initialEdits: Record<string, ClassMaster> = {};
            res.classes.forEach((c: ClassMaster) => {
                initialEdits[c.class_name] = { ...c };
            });
            setEdits(initialEdits);
            setLoading(false);
        });
    }, [router]);

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
        if (!user) return;
        setSaving(true);
        try {
            const promises = Object.values(edits).map(cls => {
                // Only verify against dirty state if we had one, but for now save all to be safe or just map
                return updateClassMaster({
                    kindergarten_id: user.kindergarten_id,
                    class_name: cls.class_name,
                    default_student_count: cls.default_student_count,
                    default_allergy_count: cls.default_allergy_count || 0,
                    default_teacher_count: cls.default_teacher_count
                });
            });
            await Promise.all(promises);
            alert('クラス情報を更新しました！');
            router.push('/');
        } catch (e) {
            console.error(e);
            alert('更新に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !user) return <div className="flex h-screen items-center justify-center text-orange-500"><Loader2 className="animate-spin w-10 h-10" /></div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                </button>
                <h1 className="font-bold text-lg text-gray-800">クラス報告 (人数設定)</h1>
            </div>

            <div className="p-4 space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 mb-6">
                    <p className="font-bold mb-1">💡 月次報告</p>
                    ここで人数を変更すると、来月分の注文入力時の初期値として反映されます。
                </div>

                {classes.map(cls => (
                    <div key={cls.class_name} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-lg text-gray-800 mb-4 flex justify-between items-center">
                            {cls.class_name}
                            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">{cls.grade}</span>
                        </h3>

                        <div className="grid grid-cols-3 gap-4">
                            {/* Reusing the Counter Logic visually */}
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

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                    {saving ? '保存中...' : <><Save className="w-5 h-5" /> 変更を保存する</>}
                </button>
            </div>
        </div>
    );
}

function EditCounter({ label, value, onChange, color = "text-gray-900" }: { label: string, value: number, onChange: (d: number) => void, color?: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500 mb-1">{label}</span>
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
                <button onClick={() => onChange(-1)} className="p-2 bg-white shadow-sm rounded-md text-gray-400 hover:text-blue-500"><Minus className="w-4 h-4" /></button>
                <span className={`font-bold text-xl w-10 text-center ${color}`}>{value}</span>
                <button onClick={() => onChange(1)} className="p-2 bg-white shadow-sm rounded-md text-gray-400 hover:text-blue-500"><Plus className="w-4 h-4" /></button>
            </div>
        </div>
    );
}
