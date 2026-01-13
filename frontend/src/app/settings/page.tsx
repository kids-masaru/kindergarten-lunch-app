"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
import { getMasters } from '@/lib/api';
import { LoginUser } from '@/types';

export default function SettingsPage() {
    const router = useRouter();
    const [user, setUser] = useState<LoginUser | null>(null);
    const [serviceDays, setServiceDays] = useState({
        mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false
    });

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            router.push('/login');
            return;
        }
        setUser(JSON.parse(userData));
        // TODO: Load actual settings from API
    }, [router]);

    const handleSave = () => {
        alert("設定保存機能は現在開発中です🙇‍♂️");
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-2">
                <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                </button>
                <h1 className="font-bold text-gray-800 text-lg">設定</h1>
            </div>

            <div className="max-w-2xl mx-auto p-4 space-y-6">

                {/* Service Days */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span>📅 給食提供日の設定</span>
                    </h2>
                    <div className="grid grid-cols-4 gap-3">
                        {['月', '火', '水', '木', '金', '土', '日'].map((day, i) => {
                            const key = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][i];
                            // @ts-ignore
                            const isActive = serviceDays[key];
                            return (
                                <button
                                    key={day}
                                    // @ts-ignore
                                    onClick={() => setServiceDays(prev => ({ ...prev, [key]: !isActive }))}
                                    className={`p-3 rounded-xl border font-bold transition-all ${isActive
                                        ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                                        : 'bg-white text-gray-400 border-gray-200'
                                        }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                        ※ここで選択した曜日が、カレンダー上で強調表示されます（開発中）
                    </p>
                </div>

                {/* Master Edit Placeholder */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 opacity-50">
                    <h2 className="font-bold text-gray-800 mb-4">🏫 園情報の編集 (開発中)</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">園名</label>
                            <input type="text" value={user.name} disabled className="w-full border rounded-lg p-3 bg-gray-50" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 opacity-50">
                    <h2 className="font-bold text-gray-800 mb-4">📋 クラス設定 (開発中)</h2>
                    <p className="text-sm text-gray-500">クラスの追加・削除・名称変更はこちらから行えるようになります。</p>
                </div>

                <button
                    onClick={handleSave}
                    className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg"
                >
                    設定を保存する
                </button>

            </div>
        </div>
    );
}
