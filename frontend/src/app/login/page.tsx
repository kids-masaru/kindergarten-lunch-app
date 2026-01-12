"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { Lock, User } from 'lucide-react';

export default function LoginPage() {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            console.log("Attempting login with:", loginId, password);
            const user = await login(loginId, password);
            console.log("Login success:", user);
            localStorage.setItem('user', JSON.stringify(user));
            router.push('/');
        } catch (err: any) {
            console.error("Login error:", err);
            if (err.response) {
                // Server responded with error code
                if (err.response.status === 401) {
                    setError('IDまたはパスワードが間違っています。');
                } else {
                    setError(`サーバーエラーが発生しました (${err.response.status})`);
                }
            } else if (err.request) {
                // No response received (Network error)
                setError('サーバーに接続できません。バックエンドが起動しているか確認してください。');
            } else {
                setError('予期せぬエラーが発生しました。');
            }
        }
    };

    return (
        <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">給食注文システム</h1>
                    <p className="text-sm text-gray-500 mt-2">先生用ログイン</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ログインID</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={loginId}
                                onChange={(e) => setLoginId(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-orange-500 focus:border-orange-500"
                                placeholder="K001"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-orange-500 focus:border-orange-500"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-orange-600 transition-colors shadow-md"
                    >
                        ログイン
                    </button>

                    {/* Debug Info */}
                    <div className="mt-4 text-xs text-gray-400 text-center">
                        API Endpoint (v2): {process.env.NEXT_PUBLIC_API_URL || '/api'}
                    </div>
                </form>
            </div>
        </div>
    );
}
