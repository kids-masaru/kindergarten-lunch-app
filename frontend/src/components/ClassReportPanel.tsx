"use client";

import { useState, useEffect } from 'react';
import { Save, Minus, Plus } from 'lucide-react';
import { updateClassMaster } from '@/lib/api';
import { ClassMaster, LoginUser } from '@/types';

interface ClassReportPanelProps {
    user: LoginUser;
    classes: ClassMaster[];
    onSaved: () => void; // Callback to refresh data
}

export default function ClassReportPanel({ user, classes }: ClassReportPanelProps) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                    <img src="/favicon-bento.ico" className="w-6 h-6" alt="" />
                    <span>登録クラス情報</span>
                </h2>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-white">
                <div className="text-[10px] font-bold text-gray-400 mb-4 uppercase tracking-widest bg-gray-50/50 p-2 rounded">
                    ※登録されている基本の人数設定
                </div>

                <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex text-[10px] font-black text-gray-300 px-2 uppercase tracking-tighter">
                        <div className="w-24">クラス名</div>
                        <div className="flex-1 text-center">園児</div>
                        <div className="flex-1 text-center">アレ</div>
                        <div className="flex-1 text-center">先生</div>
                    </div>

                    {classes.map(cls => (
                        <div key={cls.class_name} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 hover:border-orange-100 transition-colors">
                            {/* Class Name */}
                            <div className="w-24 flex flex-col leading-tight">
                                <span className="text-sm font-bold text-gray-800 truncate">{cls.class_name}</span>
                                <span className="text-[10px] font-bold text-gray-400">{cls.grade || '---'}</span>
                            </div>

                            {/* Info Row */}
                            <div className="flex-1 flex justify-between gap-1">
                                <InfoBox value={cls.default_student_count || 0} label="園児" />
                                <InfoBox value={cls.default_allergy_count || 0} label="アレ" color="text-red-500 bg-red-50/50 border-red-100" />
                                <InfoBox value={cls.default_teacher_count || 0} label="先生" />
                            </div>
                        </div>
                    ))}

                    {classes.length === 0 && (
                        <div className="py-20 text-center space-y-2">
                            <p className="text-gray-300 font-bold text-sm">クラス情報がありません</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Tip */}
            <div className="px-6 py-4 bg-orange-50/30 border-t border-orange-50">
                <p className="text-[10px] leading-relaxed text-orange-400 font-bold italic">
                    ※ 人数の変更やクラス名の修正は、お電話または事務局までご連絡ください。
                </p>
            </div>
        </div>
    );
}

function InfoBox({ value, label, color = "text-gray-600 bg-gray-50 border-gray-100" }: { value: number, label: string, color?: string }) {
    return (
        <div className={`flex flex-col items-center justify-center flex-1 rounded-lg border p-1 min-w-[32px] ${color}`}>
            <span className="font-bold text-sm">{value}</span>
        </div>
    );
}
