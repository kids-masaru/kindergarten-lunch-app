'use client';

import { useState } from 'react';
import { uploadMenu } from '@/lib/api';

export default function AdminMenuPage() {
    const [file, setFile] = useState<File | null>(null);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth() + 2); // Default to next month
    const [status, setStatus] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

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

        setIsLoading(true);
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
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Admin: Menu Master Upload</h1>

            <div className="bg-white shadow rounded-lg p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Month</label>
                    <div className="flex gap-4">
                        <input
                            type="number"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="border p-2 rounded w-24"
                        />
                        <span className="self-center">Year</span>
                        <input
                            type="number"
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="border p-2 rounded w-20"
                        />
                        <span className="self-center">Month</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Menu Excel File</label>
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-blue-50 file:text-blue-700
                            hover:file:bg-blue-100"
                    />
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleUpload}
                        disabled={isLoading}
                        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                            ${isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                    >
                        {isLoading ? 'Processing...' : 'Upload & Parse'}
                    </button>
                </div>

                {status && (
                    <div className={`p-4 rounded ${status.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        {status}
                    </div>
                )}

                {result && (
                    <div className="mt-6 border-t pt-4">
                        <h3 className="font-semibold mb-2">Parse Result:</h3>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            <li>Base Menus: {result.base_menus} days</li>
                            <li>Special Menus: {result.special_menus} items</li>
                            <li>Kindergarten Sheets Found: {result.sheets_found.length}</li>
                        </ul>
                        <div className="mt-2 text-xs text-gray-500 break-words">
                            Sheets: {result.sheets_found.join(', ')}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
