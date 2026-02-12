'use client';

import { useState, useEffect } from 'react';
import { uploadMenu, getKindergartens, generateMenu, getSystemInfo } from '@/lib/api'; // Import new function
import { FileDown, Upload, Loader2, AlertCircle, CheckCircle, Copy } from 'lucide-react';
// Import icons

export default function AdminMenuPage() {
    // ... existing state ...
    const [file, setFile] = useState<File | null>(null);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth() + 2);
    const [status, setStatus] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const [kindergartens, setKindergartens] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // New System Info State
    const [systemInfo, setSystemInfo] = useState<any>(null);

    useEffect(() => {
        // Fetch Kindergartens
        getKindergartens().then(res => {
            setKindergartens(res.kindergartens);
            setLoadingList(false);
        }).catch(err => {
            console.error(err);
            setLoadingList(false);
        });

        // Fetch System Info
        getSystemInfo().then(res => {
            setSystemInfo(res);
        }).catch(err => console.error("SysInfo Error:", err));
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

    return (
        <div className="min-h-screen bg-orange-50/50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header Card */}
                <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-lg border border-orange-100 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl shadow-orange-200 shadow-lg text-2xl">
                            🍱
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-800 tracking-tight">
                                メニュー管理・<span className="text-orange-600">設定</span>
                            </h1>
                            <p className="text-gray-500 text-sm font-medium italic">Mamameal Admin Portal</p>
                        </div>
                    </div>
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
                                <div className="text-[10px] text-gray-400 font-bold">
                                    Drive API: {systemInfo.drive_folder_config.includes("Configured") ? "CONNECTED" : "OFFLINE"}
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
                                <span className="text-2xl">🍱</span>
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
                                        <th className="px-4 py-4 text-xs font-bold text-gray-600">幼稚園名</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-600 text-center">稼働日</th>
                                        <th className="px-4 py-4 text-xs font-bold text-gray-600">設定済みメニュー</th>
                                        <th className="px-8 py-4 text-xs font-bold text-gray-600 text-right">アクション</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingList ? (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center">
                                                <Loader2 className="animate-spin w-8 h-8 mx-auto text-orange-400" />
                                                <p className="mt-2 text-xs font-bold text-gray-400">データを読み込み中...</p>
                                            </td>
                                        </tr>
                                    ) : kindergartens.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center">
                                                <AlertCircle className="w-12 h-12 mx-auto text-gray-100 mb-2" />
                                                <p className="text-gray-400 font-bold">幼稚園が見つかりません</p>
                                            </td>
                                        </tr>
                                    ) : kindergartens.map(k => (
                                        <tr key={k.kindergarten_id} className="border-b border-gray-50 hover:bg-orange-50/10 transition-colors group">
                                            <td className="px-8 py-5">
                                                <span className="text-[10px] font-black text-orange-200 group-hover:text-orange-400 transition-colors tracking-widest">{k.kindergarten_id}</span>
                                            </td>
                                            <td className="px-4 py-5 font-bold text-gray-800">
                                                {k.name || '---'}
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
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleDownload(k)}
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

                {kindergartens.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-gray-200" />
                        </div>
                        <p className="text-gray-400 font-bold">No kindergartens found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
