"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Loader2 } from 'lucide-react';
import { getMasters, updateKindergartenSettings, updateKindergartenClasses } from '@/lib/api';
import { ClassMaster, LoginUser } from '@/types';

export default function SettingsPage() {
    const router = useRouter();
    const [user, setUser] = useState<LoginUser | null>(null);
    const [loading, setLoading] = useState(false);
    const [serviceDays, setServiceDays] = useState({
        mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false
    });
    const [kindergartenName, setKindergartenName] = useState("");
    const [courseType, setCourseType] = useState("通常");
    const [hasCurry, setHasCurry] = useState(false);
    const [hasBread, setHasBread] = useState(false);

    // Class Editing State
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [editingClassIndex, setEditingClassIndex] = useState<number | null>(null);
    const [editingClass, setEditingClass] = useState<ClassMaster | null>(null);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            router.push('/login');
            return;
        }
        const u = JSON.parse(userData);
        setUser(u);
        setKindergartenName(u.name || "");

        // Initialize service days from user settings if available
        if (u.settings) {
            setServiceDays({
                mon: u.settings.service_mon !== false,
                tue: u.settings.service_tue !== false,
                wed: u.settings.service_wed !== false,
                thu: u.settings.service_thu !== false,
                fri: u.settings.service_fri !== false,
                sat: u.settings.service_sat === true,
                sun: u.settings.service_sun === true,
            });
            setCourseType(u.settings.course_type || "通常");
            setHasCurry(!!u.settings.has_curry_day);
            setHasBread(!!u.settings.has_bread_day);
        }
    }, [router]);

    const toggleDay = (dayKey: keyof typeof serviceDays) => {
        setServiceDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }));
    };

    // Class Handlers
    const openClassModal = (cls?: ClassMaster, index?: number) => {
        if (cls && index !== undefined) {
            setEditingClassIndex(index);
            setEditingClass({ ...cls });
        } else {
            setEditingClassIndex(null);
            setEditingClass({ class_name: '', grade: '', default_student_count: 0, default_teacher_count: 0, default_allergy_count: 0 });
        }
        setIsClassModalOpen(true);
    };

    const handleSaveClass = async () => {
        if (!user || !user.classes || !editingClass) return;

        // Validation
        if (!editingClass.class_name.trim()) {
            alert("クラス名を入力してください");
            return;
        }

        const updatedClasses = [...user.classes];
        if (editingClassIndex !== null) {
            // Edit existing
            updatedClasses[editingClassIndex] = editingClass;
        } else {
            // Add new
            updatedClasses.push(editingClass);
        }

        try {
            setLoading(true);
            await updateKindergartenClasses(user.kindergarten_id, updatedClasses);

            // Local Update
            const updatedUser = { ...user, classes: updatedClasses };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            setIsClassModalOpen(false);
            alert("クラス情報を保存しました！");
        } catch (e: any) {
            console.error(e);
            const msg = e.response?.data?.detail || e.message || "Unknown error";
            alert(`保存に失敗しました: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClass = async (index: number) => {
        if (!user || !user.classes || !confirm("本当にこのクラスを削除しますか？")) return;

        const updatedClasses = user.classes.filter((_, i) => i !== index);

        try {
            setLoading(true);
            await updateKindergartenClasses(user.kindergarten_id, updatedClasses);

            // Local Update
            const updatedUser = { ...user, classes: updatedClasses };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            alert("クラスを削除しました");
        } catch (e: any) {
            console.error(e);
            const msg = e.response?.data?.detail || e.message || "Unknown error";
            alert(`削除に失敗しました: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const newSettings = {
                kindergarten_id: user.kindergarten_id,
                name: kindergartenName,
                service_mon: serviceDays.mon,
                service_tue: serviceDays.tue,
                service_wed: serviceDays.wed,
                service_thu: serviceDays.thu,
                service_fri: serviceDays.fri,
                service_sat: serviceDays.sat,
                service_sun: serviceDays.sun,
                course_type: courseType,
                has_curry_day: hasCurry,
                has_bread_day: hasBread,
            };

            await updateKindergartenSettings(newSettings);

            // Update local state and localStorage so other pages see changes immediately
            const updatedUser = {
                ...user,
                name: kindergartenName,
                settings: {
                    ...user.settings,
                    ...newSettings
                }
            };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            alert("設定を保存しました！");
        } catch (e) {
            console.error(e);
            alert("保存に失敗しました。");
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-0 z-10 p-3 mb-6">
                <div className="max-w-xl mx-auto flex items-center gap-2">
                    <button onClick={() => router.back()} className="p-1 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="font-bold text-lg text-gray-800">設定</h1>
                </div>
            </div>

            <div className="max-w-xl mx-auto px-4 space-y-6">

                {/* Service Days Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span>🗓️</span> 給食提供日の設定
                    </h2>
                    <div className="grid grid-cols-7 gap-1">
                        {['月', '火', '水', '木', '金', '土', '日'].map((day, i) => {
                            const key = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][i] as keyof typeof serviceDays;
                            return (
                                <button
                                    key={key}
                                    onClick={() => toggleDay(key)}
                                    className={`p-2 rounded-lg font-bold text-sm transition-all ${serviceDays[key]
                                        ? 'bg-blue-500 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-400'
                                        }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">※ここで選択した曜日が、カレンダー上で有効になります</p>
                </div>

                {/* Course & Options Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span>🍱</span> コース・オプション設定
                    </h2>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-2">コース種別</label>
                            <div className="flex gap-2">
                                {["通常", "配膳"].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setCourseType(type)}
                                        className={`flex-1 py-3 rounded-xl font-bold transition-all border ${courseType === type
                                            ? 'bg-orange-500 text-white border-orange-600 shadow-md'
                                            : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">※「配膳」は外部委託等の配膳のみのコースです</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50 mt-4">
                            <button
                                onClick={() => setHasCurry(!hasCurry)}
                                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${hasCurry ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-gray-100 text-gray-400'}`}
                            >
                                <span className="font-bold">カレーの日</span>
                                <div className={`w-10 h-6 rounded-full relative transition-colors ${hasCurry ? 'bg-orange-500' : 'bg-gray-200'}`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hasCurry ? 'left-5' : 'left-1'}`} />
                                </div>
                            </button>

                            <button
                                onClick={() => setHasBread(!hasBread)}
                                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${hasBread ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-100 text-gray-400'}`}
                            >
                                <span className="font-bold">パンの日</span>
                                <div className={`w-10 h-6 rounded-full relative transition-colors ${hasBread ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hasBread ? 'left-5' : 'left-1'}`} />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
                {/* Class Settings Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-gray-800 flex items-center gap-2">
                            <span>📋</span> クラス設定
                        </h2>
                        <button
                            onClick={() => openClassModal()}
                            className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition-colors"
                        >
                            + クラスを追加
                        </button>
                    </div>

                    <div className="space-y-3">
                        {user.classes && user.classes.map((cls, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50/50">
                                <div>
                                    <div className="font-bold text-gray-800">{cls.class_name}</div>
                                    <div className="text-xs text-gray-500">{cls.grade || '学年未設定'}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openClassModal(cls, index)}
                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center">✏️</div>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClass(index)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center">🗑️</div>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {user.classes && user.classes.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-4">クラスが登録されていません</p>
                        )}
                    </div>

                    {/* DEBUG INFO - REMOVE AFTER FIX */}
                    <div className="mt-8 p-4 bg-gray-800 text-green-400 rounded-lg text-xs font-mono overflow-auto max-h-60">
                        <p className="font-bold border-b border-gray-600 mb-2 pb-1">Debug Info</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>ID: {user.kindergarten_id}</div>
                            <div>Count: {user.classes ? user.classes.length : 'undefined'}</div>
                        </div>
                        <pre className="mt-2 text-[10px] leading-tight opacity-80">
                            {JSON.stringify(user.classes, null, 2)}
                        </pre>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                    設定を保存する
                </button>

            </div >
        </div >
    );
}
