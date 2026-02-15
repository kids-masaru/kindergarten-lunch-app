"use client";

import { useState, useEffect } from 'react';
import { uploadMenu, getKindergartens, generateMenu, getSystemInfo, updateAdminKindergarten, getAdminClasses, updateAdminClasses } from '@/lib/api';
import { FileDown, Upload, Loader2, AlertCircle, CheckCircle, Check, Copy, Plus, X, Settings as SettingsIcon, ChevronRight, Save, Trash2 } from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';

// --- Kindergarten Editor Component ---
function KindergartenEditor({ k, onClose, onSave }: { k: any, onClose: () => void, onSave: () => void }) {
    const [formData, setFormData] = useState({ ...k });
    const [classes, setClasses] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [newService, setNewService] = useState('');

    useEffect(() => {
        setIsLoadingClasses(true);
        getAdminClasses(k.kindergarten_id).then(res => {
            setClasses(res.classes);
            setIsLoadingClasses(false);
        }).catch(err => {
            console.error(err);
            setIsLoadingClasses(false);
        });
    }, [k.kindergarten_id]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // 1. Update Basic & Service Days & Triggers
            await updateAdminKindergarten(k.kindergarten_id, formData);
            // 2. Update Classes
            await updateAdminClasses(k.kindergarten_id, classes);
            setIsSaving(false);
            onSave();
        } catch (err) {
            console.error(err);
            alert("保存に失敗しました");
            setIsSaving(false);
        }
    };

    const toggleDay = (day: string) => {
        setFormData({ ...formData, [day]: !formData[day] });
    };

    const addService = () => {
        if (!newService) return;
        const current = formData.services || [];
        if (!current.includes(newService)) {
            setFormData({ ...formData, services: [...current, newService] });
        }
        setNewService('');
    };

    const removeService = (s: string) => {
        setFormData({ ...formData, services: (formData.services || []).filter((item: string) => item !== s) });
    };

    const addClass = () => {
        setClasses([...classes, { class_name: '新クラス', grade: '', default_student_count: 0, default_allergy_count: 0, default_teacher_count: 0 }]);
    };

    const removeClass = (index: number) => {
        setClasses(classes.filter((_, i) => i !== index));
    };

    const updateClass = (index: number, field: string, value: any) => {
        const newClasses = [...classes];
        newClasses[index] = { ...newClasses[index], [field]: value };
        setClasses(newClasses);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col scale-in">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-orange-50/30">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-orange-100 flex items-center justify-center overflow-hidden">
                            <img src={k.icon_url || "/icon-mamamire.png"} className="w-8 h-8 object-contain" alt="Icon" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-800 tracking-tight">{k.name} <span className="text-gray-400 font-medium ml-2">#{k.kindergarten_id}</span></h2>
                            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Master Data Editor</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    {/* Section: Basic Settings */}
                    <div className="grid md:grid-cols-2 gap-8 text-left">
                        <div className="space-y-6">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">基本情報 <div className="h-px flex-1 bg-gray-100"></div></h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 block mb-1">表示名称</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 block mb-1">担当者名</label>
                                        <input
                                            type="text"
                                            value={formData.contact_name || ''}
                                            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                            className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                            placeholder="例：山田 太郎"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 block mb-1">連絡先メール</label>
                                        <input
                                            type="email"
                                            value={formData.contact_email || ''}
                                            onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                            className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                            placeholder="example@mail.com"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 block mb-1">ログインID</label>
                                        <input
                                            type="text"
                                            value={formData.login_id || ''}
                                            onChange={e => setFormData({ ...formData, login_id: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-700 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 block mb-1">パスワード</label>
                                        <input
                                            type="text"
                                            value={formData.password || ''}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-700 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">サービス稼働日 <div className="h-px flex-1 bg-gray-100"></div></h3>
                            <div className="flex flex-wrap gap-2">
                                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
                                    const field = `service_${day}`;
                                    const active = formData[field];
                                    const labels: any = { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日' };
                                    return (
                                        <button
                                            key={day}
                                            onClick={() => toggleDay(field)}
                                            className={`w-10 h-10 rounded-xl font-bold transition-all ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-gray-50 text-gray-400 border border-gray-100 hover:border-orange-200'}`}
                                        >
                                            {labels[day]}
                                        </button>
                                    );
                                })}
                            </div>

                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mt-8">個別献立トリガー <div className="h-px flex-1 bg-gray-100"></div></h3>
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="例: お誕生日会、お楽しみ会"
                                        value={newService}
                                        onChange={e => setNewService(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && addService()}
                                        className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-bold outline-none"
                                    />
                                    <button onClick={addService} className="p-2 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-colors">
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(formData.services || []).filter((s: string) => s !== 'スープ付き').map((s: string) => (
                                        <div key={s} className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-100 flex items-center gap-2">
                                            {s}
                                            <button onClick={() => removeService(s)} className="p-0.5 hover:bg-orange-200 rounded-full">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mt-8">給食詳細設定 <div className="h-px flex-1 bg-gray-100"></div></h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-4">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">スープ設定</h4>
                                    <label className="flex items-center gap-4 cursor-pointer group">
                                        <div className={`w-12 h-6 rounded-full transition-all relative ${formData.has_soup ? 'bg-orange-500' : 'bg-gray-200'}`}>
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.has_soup ? 'left-7' : 'left-1'}`} />
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={formData.has_soup || false}
                                            onChange={e => setFormData({ ...formData, has_soup: e.target.checked })}
                                        />
                                        <span className="font-bold text-gray-700">スープを提供</span>
                                    </label>
                                </div>

                                {formData.services?.includes('カレー') && (
                                    <div className="bg-orange-50/30 p-6 rounded-3xl border border-orange-100 space-y-4 animate-in fade-in zoom-in duration-300">
                                        <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-wider">カレー設定</h4>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 block mb-1">個別メニュー項目</label>
                                            <input
                                                type="text"
                                                placeholder="例: チキンカレー"
                                                value={formData.curry_trigger || ''}
                                                onChange={e => setFormData({ ...formData, curry_trigger: e.target.value })}
                                                className="w-full bg-white border border-orange-100 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 ring-orange-200"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1 ml-1 leading-relaxed">※ カレーの日に通常メニューとは別に一品追加する場合に入力。</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section: Classes */}
                    <div className="space-y-6 text-left">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 flex-1">
                                クラス・人数設定 <div className="h-px flex-1 bg-gray-100 ml-2"></div>
                            </h3>
                            <button onClick={addClass} className="ml-4 flex items-center gap-1 text-[10px] font-black text-orange-600 hover:text-orange-700 uppercase tracking-widest">
                                <Plus className="w-4 h-4" /> クラス追加
                            </button>
                        </div>

                        {isLoadingClasses ? (
                            <div className="py-10 text-center">
                                <Loader2 className="animate-spin w-6 h-6 mx-auto text-gray-200" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {classes.map((cls, idx) => (
                                    <div key={idx} className="bg-gray-50 border border-gray-100 p-4 rounded-2xl space-y-3 relative group/card">
                                        <button
                                            onClick={() => removeClass(idx)}
                                            className="absolute top-2 right-2 p-1.5 bg-white shadow-sm border border-red-50 text-red-400 rounded-lg opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                value={cls.class_name}
                                                onChange={e => updateClass(idx, 'class_name', e.target.value)}
                                                className="col-span-2 bg-white px-3 py-2 rounded-xl text-sm font-bold border border-transparent focus:border-orange-200 outline-none"
                                                placeholder="クラス名"
                                            />
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 ml-1 block">学年</label>
                                                <input
                                                    value={cls.grade}
                                                    onChange={e => updateClass(idx, 'grade', e.target.value)}
                                                    className="w-full bg-white px-3 py-1.5 rounded-xl text-xs font-bold border border-transparent focus:border-orange-200 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 ml-1 block">園児数</label>
                                                <input
                                                    type="number"
                                                    value={cls.default_student_count}
                                                    onChange={e => updateClass(idx, 'default_student_count', parseInt(e.target.value))}
                                                    className="w-full bg-white px-3 py-1.5 rounded-xl text-xs font-bold border border-transparent focus:border-orange-200 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-gray-50 bg-gray-50/20 flex items-center justify-between">
                    <p className="text-xs text-gray-400 font-medium">※ 設定内容はGoogleスプレッドシートに同期されます</p>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-6 py-3 rounded-2xl font-bold text-gray-400 hover:text-gray-600 transition-colors">キャンセル</button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`flex items-center gap-2 px-10 py-3 rounded-2xl font-black text-white shadow-xl transition-all active:scale-[0.98]
                                ${isSaving ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-orange-200'}`}
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            変更内容を保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- System Settings Modal ---
function SystemSettingsModal({ info, onClose, onSave }: { info: any, onClose: () => void, onSave: (data: any) => void }) {
    const [emails, setEmails] = useState(info.admin_emails || '');
    const [days, setDays] = useState(info.reminder_days || '5,3');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({ admin_emails: emails, reminder_days: days });
            onClose();
        } catch (e) {
            alert("保存に失敗しました");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col scale-in">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-orange-50/30">
                    <h2 className="text-xl font-black text-gray-800">システム設定</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
                </div>
                <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                    {/* Admin Emails */}
                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase block mb-2">管理者通知先メールアドレス</label>
                        <div className="space-y-2">
                            {emails.split(',').map((email: string, idx: number) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="email"
                                        value={email.trim()}
                                        onChange={(e) => {
                                            const newEmails = emails.split(',');
                                            newEmails[idx] = e.target.value;
                                            setEmails(newEmails.join(','));
                                        }}
                                        className="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:ring-2 ring-orange-100 outline-none"
                                        placeholder="admin@example.com"
                                    />
                                    <button
                                        onClick={() => {
                                            const newEmails = emails.split(',').filter((_: string, i: number) => i !== idx);
                                            setEmails(newEmails.join(','));
                                        }}
                                        className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => setEmails(emails ? emails + ', ' : ' ')}
                                className="flex items-center gap-2 text-xs font-bold text-orange-600 hover:text-orange-700 px-2 py-1"
                            >
                                <Plus className="w-4 h-4" /> メールアドレスを追加
                            </button>
                        </div>
                    </div>

                    {/* Deadline Settings */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <h4 className="text-xs font-black text-gray-400 uppercase">期限・リマインダー設定</h4>

                        {/* TODO: Add deadline_days_before_service logic in backend first if needed, sticking to reminder_days for now but clarifying UI */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">注文締切日</label>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-gray-600">提供日の</span>
                                <input
                                    type="number"
                                    className="w-16 p-2 bg-gray-50 rounded-xl border border-gray-100 font-bold text-center outline-none"
                                    defaultValue="3"
                                    disabled
                                    title="現在は3日で固定されています（将来的に変更可能になります）"
                                />
                                <span className="text-sm font-bold text-gray-600">日前 15:00 まで</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">※ 現在はシステム固定値です</p>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">リマインダー通知 (締切の何日前)</label>
                            <input
                                type="text"
                                value={days}
                                onChange={e => setDays(e.target.value)}
                                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:ring-2 ring-orange-100 outline-none"
                                placeholder="1, 0"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">※ 「1, 0」の場合、締切の1日前と当日に通知が飛びます</p>
                        </div>
                    </div>
                </div>
                <div className="px-8 py-6 border-t border-gray-100 bg-gray-50 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 px-6 rounded-2xl font-black text-gray-400 hover:bg-gray-200 transition-all">キャンセル</button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 px-6 rounded-2xl bg-orange-500 text-white font-black shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all flex items-center justify-center gap-2">
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> 保存する</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminConsole() {
    const [file, setFile] = useState<File | null>(null);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [status, setStatus] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const [kindergartens, setKindergartens] = useState<any[]>([]);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // Editor State
    const [editingK, setEditingK] = useState<any>(null);
    const [showEditor, setShowEditor] = useState(false);

    // New System Info State
    const [systemInfo, setSystemInfo] = useState<any>(null);
    const [showSettings, setShowSettings] = useState(false);


    const fetchKindergartens = () => {
        getKindergartens().then(res => {
            setKindergartens(res.kindergartens);
        }).catch(err => {
            console.error(err);
        });
    };

    const fetchSystemInfo = () => {
        getSystemInfo().then(res => {
            setSystemInfo(res);
        }).catch(err => console.error("SysInfo Error:", err));
    };

    useEffect(() => {
        fetchKindergartens();
        // Fetch System Info
        fetchSystemInfo();
    }, []);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setStatus('Please select a file.');
            return;
        }

        setIsUploading(true);
        setStatus('Uploading...');
        setResult(null);

        try {
            const res = await uploadMenu(year, month, file);
            setStatus('Upload Successful!');
            setResult(res);
        } catch (error: any) {
            console.error(error);
            setStatus('Upload Failed: ' + (error.response?.data?.detail || error.message));
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownload = async (k: any) => {
        setDownloadingId(k.kindergarten_id);
        try {
            const blob = await generateMenu(k.kindergarten_id, year, month);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${k.name}_献立表_${year}年${month}月.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e: any) {
            alert('Download failed');
            console.error(e);
        } finally {
            setDownloadingId(null);
        }
    };

    const handleUpdateSettings = async (data: any) => {
        try {
            const { updateAdminSettings } = await import('@/lib/api'); // Assuming this import path
            await updateAdminSettings(data);
            alert("設定を保存しました");
            fetchSystemInfo();
        } catch (e) {
            console.error(e);
            alert("保存に失敗しました");
        }
    };

    return (
        <div className="min-h-screen bg-orange-50/50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header Card */}
                <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-lg border border-orange-100 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-white rounded-2xl shadow-orange-200 shadow-md flex items-center justify-center">
                            <img src="/icon-mamamire.png" className="w-16 h-16 object-contain" alt="MamaMiRe" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-800 tracking-tight">
                                <span className="text-orange-600">ママミレ</span> 管理ポータル
                            </h1>
                            <p className="text-gray-500 text-sm font-medium italic">MamaMiRe: Admin Portal</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="flex items-center gap-2 bg-white text-gray-600 px-6 py-3 rounded-2xl font-black text-sm hover:bg-orange-50 transition-all border border-orange-100 shadow-sm"
                    >
                        <SettingsIcon className="w-4 h-4" /> システム設定
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Master Upload (Moved to top level) */}
                    <div className="bg-white rounded-3xl shadow-sm border border-orange-100 overflow-hidden">
                        <div className="bg-orange-50/50 px-6 py-4 border-b border-orange-50 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-orange-700 flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                献立マスターのアップロード
                            </h2>
                            {systemInfo && (
                                <div className="text-[10px] text-gray-400 font-bold flex items-center gap-2">
                                    Drive API:
                                    <span className={systemInfo.drive_folder_config.includes("Configured") ? "text-green-500" : "text-red-400"}>
                                        {systemInfo.drive_folder_config.includes("Configured") ? "CONNECTED" : "OFFLINE"}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row gap-6 items-end">
                                <div className="w-full md:w-32">
                                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-2 block">対象年月</label>
                                    <div className="flex gap-2 items-center bg-gray-50 p-3 rounded-2xl border border-gray-100 focus-within:ring-2 ring-orange-100 transition-all">
                                        <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="bg-transparent w-full font-bold text-gray-700 outline-none text-center" />
                                        <span className="text-gray-300">/</span>
                                        <input type="number" value={month} onChange={e => setMonth(parseInt(e.target.value))} className="bg-transparent w-full font-bold text-gray-700 outline-none text-center" />
                                    </div>
                                </div>

                                <div className="flex-1 w-full relative group">
                                    <div className="relative h-14 w-full border-2 border-dashed border-orange-100 rounded-2xl group-hover:border-orange-300 transition-colors flex items-center justify-center gap-3 px-4 bg-orange-50/20">
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <Upload className={`w-5 h-5 ${file ? 'text-green-500' : 'text-orange-300'}`} />
                                        <span className="text-xs font-bold text-gray-500 truncate">
                                            {file ? file.name : "メニューExcelを選択またはドラッグ＆ドロップ"}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading || !file}
                                    className={`w-full md:w-48 py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-[0.98]
                                        ${isUploading || !file ? 'bg-gray-200 cursor-not-allowed text-gray-400 shadow-none' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-200'}`}
                                >
                                    {isUploading ? <Loader2 className="animate-spin mx-auto w-5 h-5" /> : 'マスター取り込み開始'}
                                </button>
                            </div>

                            {status && (
                                <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 text-xs ${status.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                    {status.includes('Failed') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                    <span className="font-medium">{status}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Kindergarten Master Table */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
                        <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                                <img src="/icon-mamamire.png" className="w-8 h-8 object-contain" alt="Logo" />
                                幼稚園・施設マスター
                            </h2>
                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                                登録数: {kindergartens.length}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">ID</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-600">園名 / 担当者</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-600 text-center">稼働日</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-600 text-center">スープ</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-600">設定済みメニュー</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-600">カレー項目</th>
                                        <th className="px-8 py-4 text-xs font-bold text-gray-600 text-right">アクション</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kindergartens.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-20 text-center">
                                                <AlertCircle className="w-12 h-12 mx-auto text-gray-100 mb-2" />
                                                <p className="text-gray-400 font-bold">幼稚園が見つかりません</p>
                                            </td>
                                        </tr>
                                    ) : kindergartens.map(k => (
                                        <tr
                                            key={k.kindergarten_id}
                                            onClick={() => { setEditingK(k); setShowEditor(true); }}
                                            className="border-b border-gray-50 hover:bg-orange-50/10 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-8 py-5">
                                                <span className="text-[10px] font-black text-orange-200 group-hover:text-orange-400 transition-colors tracking-widest">{k.kindergarten_id}</span>
                                            </td>
                                            <td className="px-4 py-5 font-bold text-gray-800">
                                                <div className="flex flex-col">
                                                    <span>{k.name || '---'}</span>
                                                    <span className="text-[10px] text-gray-400 font-medium">{k.contact_name ? `${k.contact_name} 様` : '担当者未登録'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-5">
                                                <div className="flex justify-center gap-0.5">
                                                    {['月', '火', '水', '木', '金', '土', '日'].map((day, idx) => {
                                                        const field = ['service_mon', 'service_tue', 'service_wed', 'service_thu', 'service_fri', 'service_sat', 'service_sun'][idx];
                                                        const active = k[field] !== false;
                                                        return (
                                                            <div key={day} className={`w-5 h-5 flex items-center justify-center rounded-sm text-[8px] font-bold ${active ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-300'}`}>
                                                                {day}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                {k.has_soup ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black border border-green-100">
                                                        <Check className="w-3 h-3" /> あり
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 text-[10px] font-bold">－</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-5">
                                                <div className="flex flex-wrap gap-1">
                                                    {(k.services || []).map((s: string) => (
                                                        <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">
                                                            {s}
                                                        </span>
                                                    ))}
                                                    {(!k.services || k.services.length === 0) && (
                                                        <span className="text-gray-300 text-[10px]">なし</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-5">
                                                {k.curry_trigger ? (
                                                    <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg text-[10px] font-black border border-orange-100">
                                                        {k.curry_trigger}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-200 text-[10px] font-bold">未設定</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(k); }}
                                                        disabled={!!downloadingId || !result}
                                                        className={`px-4 py-2 border rounded-xl text-[10px] font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-30 disabled:grayscale
                                                            ${result ? 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                                                    >
                                                        {downloadingId === k.kindergarten_id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <FileDown className="w-3 h-3" />
                                                        )}
                                                        献立表(Excel)
                                                    </button>
                                                    <button
                                                        title="PDF (Soon)"
                                                        disabled
                                                        className="p-2 bg-gray-50 border border-gray-100 text-gray-300 rounded-xl cursor-not-allowed"
                                                    >
                                                        <Copy className="w-3 h-3 grayscale" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {showEditor && editingK && (
                    <KindergartenEditor
                        k={editingK}
                        onClose={() => { setShowEditor(false); setEditingK(null); }}
                        onSave={() => {
                            setShowEditor(false);
                            setEditingK(null);
                            fetchKindergartens(); // Refresh list
                        }}
                    />
                )}

                {showSettings && systemInfo && (
                    <SystemSettingsModal
                        info={systemInfo}
                        onClose={() => setShowSettings(false)}
                        onSave={handleUpdateSettings}
                    />
                )}
            </div>
        </div>
    );
}
