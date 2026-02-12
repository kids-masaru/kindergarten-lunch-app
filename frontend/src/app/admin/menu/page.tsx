'use client';

import { useState, useEffect } from 'react';
import { uploadMenu, getKindergartens, generateMenu, getSystemInfo } from '@/lib/api'; // Import new function
import { FileDown, Upload, Loader2, Building, AlertCircle, CheckCircle, Info, Copy } from 'lucide-react'; // Import icons

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
                        <div className="p-4 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl shadow-orange-200 shadow-lg">
                            <Building className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-800 tracking-tight">
                                ADMIN <span className="text-orange-600">CONSOLE</span>
                            </h1>
                            <p className="text-gray-500 text-sm font-medium">Mamameal Menu Management</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        SYSTEM OPERATIONAL
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left Column: Config & Upload */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* System Status Card */}
                        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 overflow-hidden">
                            <div className="bg-blue-50/50 px-6 py-4 border-b border-blue-50">
                                <h2 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                                    <Info className="w-4 h-4" />
                                    DRIVE CONFIGURATION
                                </h2>
                            </div>
                            <div className="p-6 space-y-4">
                                {systemInfo ? (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Service Account Email</p>
                                            <div className="flex items-center justify-between gap-1 overflow-hidden">
                                                <code className="text-xs text-blue-600 font-mono truncate select-all">
                                                    {systemInfo.service_account_email}
                                                </code>
                                                <button onClick={() => copyToClipboard(systemInfo.service_account_email)} className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-400" title="Copy">
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-xs font-bold text-gray-500">Cloud Folder Status</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${systemInfo.drive_folder_config.includes("Configured") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                                {systemInfo.drive_folder_config.includes("Configured") ? "ONLINE" : "OFFLINE"}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-gray-400 py-4 justify-center">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Upload Card */}
                        <div className="bg-white rounded-3xl shadow-sm border border-orange-100 overflow-hidden">
                            <div className="bg-orange-50/50 px-6 py-4 border-b border-orange-50">
                                <h2 className="text-sm font-bold text-orange-700 flex items-center gap-2">
                                    <Upload className="w-4 h-4" />
                                    MENU MASTER UPLOAD
                                </h2>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-2 block">Target Period</label>
                                    <div className="flex gap-2 items-center bg-gray-50 p-3 rounded-2xl border border-gray-100 focus-within:ring-2 ring-orange-100 transition-all">
                                        <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="bg-transparent w-16 font-bold text-gray-700 outline-none text-center" />
                                        <span className="text-gray-300">/</span>
                                        <input type="number" value={month} onChange={e => setMonth(parseInt(e.target.value))} className="bg-transparent w-12 font-bold text-gray-700 outline-none text-center" />
                                    </div>
                                </div>

                                <div className="relative group">
                                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-2 block">Excel File</label>
                                    <div className="relative h-32 w-full border-2 border-dashed border-orange-100 rounded-3xl group-hover:border-orange-300 transition-colors flex flex-col items-center justify-center p-4 bg-orange-50/20">
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <Upload className={`w-8 h-8 mb-2 ${file ? 'text-green-500' : 'text-orange-300 group-hover:scale-110 transition-transform'}`} />
                                        <span className="text-xs font-bold text-gray-500 text-center truncate w-full px-2">
                                            {file ? file.name : "Drag & Drop or Click"}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading || !file}
                                    className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-[0.98]
                                        ${isUploading || !file ? 'bg-gray-200 cursor-not-allowed text-gray-400 shadow-none' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-200'}`}
                                >
                                    {isUploading ? <Loader2 className="animate-spin mx-auto" /> : 'Start Processing'}
                                </button>

                                {status && (
                                    <div className={`p-4 rounded-2xl flex items-start gap-3 text-xs leading-relaxed ${status.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                        <div className="shrink-0 mt-0.5">{status.includes('Failed') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}</div>
                                        <div className="break-words font-medium">{status}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Kindergarten List */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px] flex flex-col">
                            <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                                    <div className="p-2 bg-orange-100 rounded-xl">
                                        <FileDown className="w-5 h-5 text-orange-600" />
                                    </div>
                                    Kindergarten Dashboard
                                </h2>
                                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                                    Total: {kindergartens.length}
                                </span>
                            </div>

                            <div className="p-4 md:p-8 flex-1">
                                {loadingList ? (
                                    <div className="flex flex-col items-center justify-center p-20 text-orange-400 space-y-4">
                                        <Loader2 className="animate-spin w-10 h-10" />
                                        <p className="text-sm font-bold text-gray-400 animate-pulse">Syncing data...</p>
                                    </div>
                                ) : (
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {kindergartens.map(k => (
                                            <div key={k.kindergarten_id} className="group relative bg-white p-5 rounded-3xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all hover:shadow-xl hover:shadow-orange-100/30">
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="space-y-1">
                                                            <div className="text-xs font-black text-orange-300 uppercase tracking-widest">{k.kindergarten_id}</div>
                                                            <div className="font-bold text-gray-800 text-lg group-hover:text-orange-700 transition-colors">{k.name}</div>
                                                        </div>
                                                        <div className="p-2 bg-gray-50 rounded-xl group-hover:bg-white transition-colors">
                                                            <Building className="w-4 h-4 text-gray-300 group-hover:text-orange-400" />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                                                        <button
                                                            onClick={() => handleDownload(k)}
                                                            disabled={!!downloadingId}
                                                            className="flex-1 py-3 px-4 bg-white border border-gray-200 hover:border-orange-500 hover:text-orange-600 rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 group/btn active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {downloadingId === k.kindergarten_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3 group-hover/btn:-translate-y-0.5 transition-transform" />}
                                                            EXCEL MENU
                                                        </button>
                                                        <button
                                                            disabled
                                                            className="w-12 py-3 bg-gray-50 text-gray-300 rounded-2xl text-[10px] font-bold border border-gray-100 flex items-center justify-center cursor-not-allowed"
                                                            title="PDF Support Coming Soon"
                                                        >
                                                            PDF
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {kindergartens.length === 0 && (
                                            <div className="col-span-full py-20 text-center space-y-4">
                                                <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                                                    <AlertCircle className="w-8 h-8 text-gray-200" />
                                                </div>
                                                <p className="text-gray-400 font-bold">No kindergartens found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
