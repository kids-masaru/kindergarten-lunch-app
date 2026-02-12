'use client';

import { useState, useEffect } from 'react';
import { uploadMenu, getKindergartens, generateMenu } from '@/lib/api';
import { FileDown, Upload, Loader2, Building, AlertCircle, CheckCircle } from 'lucide-react';

export default function AdminMenuPage() {
    const [file, setFile] = useState<File | null>(null);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth() + 2); // Default to next month
    const [status, setStatus] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const [kindergartens, setKindergartens] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        getKindergartens().then(res => {
            setKindergartens(res.kindergartens);
            setLoadingList(false);
        }).catch(err => {
            console.error(err);
            setLoadingList(false);
        });
    }, []);

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
        <div className="min-h-screen bg-orange-50 p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <Building className="w-8 h-8 text-orange-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        Admin Console <span className="text-orange-600">Mamameal</span>
                    </h1>
                </div>

                {/* Upload Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-orange-500" />
                        Menu Master Upload
                    </h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-2">Target Period</label>
                            <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                                <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="bg-transparent w-20 font-bold text-center outline-none" />
                                <span className="text-gray-400">/</span>
                                <input type="number" value={month} onChange={e => setMonth(parseInt(e.target.value))} className="bg-transparent w-16 font-bold text-center outline-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-2">Excel File</label>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-sm file:font-bold
                                    file:bg-orange-100 file:text-orange-700
                                    hover:file:bg-orange-200 cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-all
                                ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 hover:shadow-lg active:scale-[0.98]'}`}
                        >
                            {isUploading ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> Processing...</span> : 'Upload & Parse Menu'}
                        </button>
                    </div>

                    {status && (
                        <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 ${status.includes('Failed') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                            {status.includes('Failed') ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
                            <div>{status}</div>
                        </div>
                    )}
                </div>

                {/* Kindergarten List Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <FileDown className="w-5 h-5 text-orange-500" />
                        Kindergarten Menu Download
                    </h2>

                    {loadingList ? (
                        <div className="flex justify-center p-8 text-orange-400">
                            <Loader2 className="animate-spin w-8 h-8" />
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {kindergartens.map(k => (
                                <div key={k.kindergarten_id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-colors group">
                                    <div>
                                        <div className="font-bold text-gray-800">{k.name}</div>
                                        <div className="text-xs text-gray-400">ID: {k.kindergarten_id}</div>
                                    </div>
                                    <button
                                        onClick={() => handleDownload(k)}
                                        disabled={!!downloadingId}
                                        className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-bold shadow-sm group-hover:border-orange-300 group-hover:text-orange-600 transition-all flex items-center gap-2"
                                    >
                                        {downloadingId === k.kindergarten_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                                        Download
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
