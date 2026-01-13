"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Loader2 } from 'lucide-react';
import { getMasters, updateKindergartenSettings } from '@/lib/api';
import { ClassMaster, LoginUser } from '@/types';

export default function SettingsPage() {
    const router = useRouter();
    const [user, setUser] = useState<LoginUser | null>(null);
    const [loading, setLoading] = useState(false);
    const [serviceDays, setServiceDays] = useState({
        mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false
    });
    const [kindergartenName, setKindergartenName] = useState("");

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
        }
    }, [router]);

    const toggleDay = (dayKey: keyof typeof serviceDays) => {
        setServiceDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }));
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
                service_sun: serviceDays.sun
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
                    <div className="grid grid-cols-4 gap-2 mb-2">
                        {['月', '火', '水', '木'].map((day, i) => {
                            const key = ['mon', 'tue', 'wed', 'thu'][i] as keyof typeof serviceDays;
                            return (
                                <button
                                    key={key}
                                    onClick={() => toggleDay(key)}
                                    className={`p-3 rounded-lg font-bold transition-all ${serviceDays[key]
                                        ? 'bg-blue-500 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-400'
                                        }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {['金', '土', '日'].map((day, i) => {
                            const key = ['fri', 'sat', 'sun'][i] as keyof typeof serviceDays;
                            return (
                                <button
                                    key={key}
                                    onClick={() => toggleDay(key)}
                                    className={`p-3 rounded-lg font-bold transition-all ${serviceDays[key]
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

                {/* Kindergarten Info Section */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span>🏫</span> 園情報の編集
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">園名</label>
                            <input
                                type="text"
                                value={kindergartenName}
                                onChange={(e) => setKindergartenName(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="例：テスト幼稚園"
                            />
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
                </div>

                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                    設定を保存する
                </button>

            </div>
        </div>
    );
}
