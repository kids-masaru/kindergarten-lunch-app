
import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
    currentUrl?: string;
    onUpload: (url: string) => void;
    className?: string;
}

export default function ImageUploader({ currentUrl, onUpload, className = "" }: ImageUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(currentUrl || null);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const file = files[0];
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください');
            return;
        }

        // Preview
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);

        // Upload
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            // Dynamically determine API base URL if needed, or assume relative proxy/CORS
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

            const res = await fetch(`${API_BASE}/upload-icon`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const data = await res.json();
            if (data.status === 'success' && data.url) {
                onUpload(data.url);
            } else {
                throw new Error('Invalid response');
            }
        } catch (e) {
            console.error(e);
            alert('アップロードに失敗しました');
            setPreview(currentUrl || null); // Revert
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    return (
        <div className={`w-full ${className}`}>
            <div
                className={`relative group rounded-2xl border-2 border-dashed transition-all overflow-hidden aspect-video flex items-center justify-center cursor-pointer
                    ${dragActive ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50 hover:border-orange-200 hover:bg-white'}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleFiles(e.target.files)}
                />

                {isUploading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                        <span className="text-xs font-bold text-gray-400">Uploading...</span>
                    </div>
                ) : null}

                {preview ? (
                    <div className="relative w-full h-full">
                        <img src={preview} alt="Preview" className="w-full h-full object-contain p-2" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 bg-white/90 px-4 py-2 rounded-xl text-xs font-bold shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                                変更する
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-6">
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-3 text-orange-200 group-hover:text-orange-400 transition-colors">
                            <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold text-gray-400">
                            画像を選択<br />またはドラッグ＆ドロップ
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
