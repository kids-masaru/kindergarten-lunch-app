"use client";

import { useState, useEffect } from 'react';
import { uploadMenu, getKindergartens, generateMenu, getSystemInfo, updateAdminKindergarten, getAdminClasses, updateAdminClasses, getMonthlyCommon, updateMonthlyCommon, deleteMonthlyCommon, getAdminOrdersForMonth, getCalendar, updateOrderDefaults, getKindergartenPrintData, getDailyOrders } from '@/lib/api';
import { FileDown, Upload, Loader2, AlertCircle, CheckCircle, Check, Copy, Plus, X, Settings as SettingsIcon, ChevronRight, ChevronLeft, ArrowLeft, Save, Trash2, Building2, Search, Filter, Printer, Calendar, ClipboardList } from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';

// --- Single Kindergarten Print View (with month navigation) ---
function SingleKindergartenPrintView({ kindergartenId, kindergartenName, initialYear, initialMonth, onClose }: { kindergartenId: string, kindergartenName: string, initialYear: number, initialMonth: number, onClose: () => void }) {
    const DOW = ['日','月','火','水','木','金','土'];
    const [year, setYear] = useState(initialYear);
    const [month, setMonth] = useState(initialMonth);
    const [kData, setKData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        setKData(null);
        getKindergartenPrintData(kindergartenId, year, month)
            .then(data => setKData(data))
            .catch(() => alert('データの取得に失敗しました'))
            .finally(() => setLoading(false));
    }, [kindergartenId, year, month]);

    const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay();
    const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const getDayOrders = (orders: any[], day: number) => {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        return orders.filter((o: any) => o.date === dateStr);
    };
    const getSpecialMealType = (orders: any[]) => {
        const special = orders.find((o: any) => o.meal_type && o.meal_type !== '通常');
        return special ? special.meal_type : null;
    };

    return (
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 6mm; }
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* ヘッダー（月ナビ付き） */}
            <div className="no-print sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-10">
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-black text-gray-700 text-base">{kindergartenName}</span>
                <div className="flex-1" />
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-xl"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
                <span className="font-black text-gray-800 text-base min-w-[90px] text-center">{year}年{month}月</span>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-xl"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-base font-bold hover:bg-orange-600 ml-2">
                    <Printer className="w-4 h-4" /> 印刷
                </button>
            </div>

            <div className="p-4">
                {loading && <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>}
                {!loading && kData && (() => {
                    const isClassless = !kData.classes || kData.classes.length === 0;
                    const cellHeight = isClassless ? '76px' : '52px';
                    return (
                        <div>
                            <div className="flex items-center mb-3">
                                <span className="font-black text-gray-900 text-lg">{kData.name}</span>
                                <span className="ml-3 text-base text-gray-500">{year}年{month}月</span>
                            </div>
                            <div className="flex gap-5 items-start">
                                {/* 左：カレンダー */}
                                <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                                        {DOW.map((d, i) => (
                                            <div key={d} className={`text-center text-sm font-black py-1.5 border-r border-gray-100 last:border-0 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'}`}>{d}</div>
                                        ))}
                                    </div>
                                    {weeks.map((week, wi) => (
                                        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-0" style={{ minHeight: cellHeight }}>
                                            {week.map((day, di) => {
                                                if (!day) return <div key={di} className="border-r border-gray-100 last:border-0 bg-gray-50/50" />;
                                                const dow = di;
                                                const dayOrders = getDayOrders(kData.orders, day);
                                                const specialType = getSpecialMealType(dayOrders);
                                                const isWeekend = dow === 0 || dow === 6;
                                                const isServiceDay = dayOrders.length > 0;
                                                const classlessOrder = isClassless ? dayOrders.find((o: any) => o.class_name === '共通') : null;
                                                const clTotal = classlessOrder ? (classlessOrder.student_count + classlessOrder.allergy_count) : 0;
                                                return (
                                                    <div key={di} className={`border-r border-gray-100 last:border-0 p-1.5 ${isWeekend ? 'bg-red-50/30' : ''} ${!isServiceDay ? 'bg-gray-50/50' : ''}`} style={{ minHeight: cellHeight }}>
                                                        <div className={`text-sm font-bold ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'}`}>{day}</div>
                                                        {specialType && <div className="mt-0.5 text-xs font-black text-orange-600 bg-orange-50 border border-orange-100 rounded px-1 py-0.5 leading-tight">{specialType}</div>}
                                                        {classlessOrder && (
                                                            <div className="mt-0.5">
                                                                <div className="text-[9px] text-gray-500 leading-none">園児</div>
                                                                <div className="font-black text-gray-800 leading-tight whitespace-nowrap text-xs">
                                                                    <span>{classlessOrder.student_count}</span><span className="text-red-500">+ア{classlessOrder.allergy_count}＝</span><span>{clTotal}</span>
                                                                </div>
                                                                <div className="flex justify-between items-baseline">
                                                                    <span className="text-[9px] text-gray-500">先生</span>
                                                                    <span className="text-xs font-black text-gray-600">{classlessOrder.teacher_count}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                                {/* 右：基本人数 */}
                                <div className="w-96 shrink-0 border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                                        <span className="text-sm font-black text-gray-600">クラス別 基本人数</span>
                                    </div>
                                    {kData.classes && kData.classes.length > 0 ? (
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                                    <th className="text-left px-3 py-1.5 text-sm font-black text-gray-500">クラス</th>
                                                    <th className="text-center px-2 py-1.5 text-sm font-black text-gray-500">園児</th>
                                                    <th className="text-center px-2 py-1.5 text-sm font-black text-red-400">アレ</th>
                                                    <th className="text-center px-2 py-1.5 text-sm font-black text-gray-500">先生</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {kData.classes.map((cls: any, idx: number) => (
                                                    <tr key={idx} className="border-b border-gray-50 last:border-0">
                                                        <td className="px-3 py-2 font-bold text-gray-800 text-sm">{cls.class_name}</td>
                                                        <td className="px-2 py-2 text-center font-bold text-gray-700 text-base">{cls.default_student_count}</td>
                                                        <td className="px-2 py-2 text-center font-bold text-red-500 text-base">{cls.default_allergy_count ?? 0}</td>
                                                        <td className="px-2 py-2 text-center font-bold text-gray-700 text-base">{cls.default_teacher_count}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-3 text-center space-y-2">
                                            <div className="text-xs font-black text-gray-500 border-b border-gray-100 pb-1">基本人数</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div><div className="text-xs text-gray-500">園児</div><div className="text-xl font-black text-gray-800">{kData.classless_student_count ?? 0}</div></div>
                                                <div><div className="text-xs text-red-400">アレルギー</div><div className="text-xl font-black text-red-500">{kData.classless_allergy_count ?? 0}</div></div>
                                                <div><div className="text-xs text-gray-500">先生</div><div className="text-xl font-black text-gray-700">{kData.classless_teacher_count ?? 0}</div></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {kData.orders.length === 0 && (
                                <div className="text-center py-10 text-gray-400 text-base">この月の注文データがありません</div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

// --- Order Print View Component (Calendar style) ---
function OrderPrintView({ data, year, month, onClose }: { data: any[], year: number, month: number, onClose: () => void }) {
    const DOW = ['日','月','火','水','木','金','土'];
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay();

    const cells: (number | null)[] = [
        ...Array(firstDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const getDayOrders = (orders: any[], day: number) => {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        return orders.filter((o: any) => o.date === dateStr);
    };

    // 特別メニューの種別を取得（通常以外）
    const getSpecialMealType = (orders: any[]) => {
        const special = orders.find((o: any) => o.meal_type && o.meal_type !== '通常');
        return special ? special.meal_type : null;
    };

    return (
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 6mm; }
                    .no-print { display: none !important; }
                    .print-page {
                        height: 198mm;
                        width: 100%;
                        overflow: hidden;
                        page-break-after: always;
                        break-after: page;
                        box-sizing: border-box;
                        margin-top: 0 !important;
                    }
                    .print-container { padding: 0 !important; margin: 0 !important; }
                }
            `}</style>

            {/* Screen controls */}
            <div className="no-print sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-10">
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-black text-gray-700 text-base">{year}年{month}月 注文カレンダー</span>
                <div className="flex-1" />
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-base font-bold hover:bg-orange-600">
                    <Printer className="w-4 h-4" /> 全園一括印刷
                </button>
            </div>

            <div className="p-4 space-y-10 print-container">
                {data.filter((k: any) => k.orders && k.orders.length > 0).map((k: any) => (
                    <div key={k.kindergarten_id} className="print-page" data-kid={k.kindergarten_id}>
                        {/* Header */}
                        <div className="flex items-center mb-3">
                            <span className="font-black text-gray-900 text-lg">{k.name}</span>
                            <span className="ml-3 text-base text-gray-500">{year}年{month}月</span>
                        </div>

                        {/* 2カラムレイアウト：左=カレンダー、右=クラス人数表 */}
                        <div className="flex gap-5 items-start">
                            {/* 左：カレンダー（メニュー種別のみ表示） */}
                            <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
                                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                                    {DOW.map((d, i) => (
                                        <div key={d} className={`text-center text-sm font-black py-1.5 border-r border-gray-100 last:border-0
                                            ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'}`}>
                                            {d}
                                        </div>
                                    ))}
                                </div>
                                {(() => {
                                    const isClassless = !k.classes || k.classes.length === 0;
                                    const cellHeight = isClassless ? '76px' : '52px';
                                    return weeks.map((week, wi) => (
                                        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-0" style={{ minHeight: cellHeight }}>
                                            {week.map((day, di) => {
                                                if (!day) return <div key={di} className="border-r border-gray-100 last:border-0 bg-gray-50/50" />;
                                                const dow = di;
                                                const dayOrders = getDayOrders(k.orders, day);
                                                const specialType = getSpecialMealType(dayOrders);
                                                const isWeekend = dow === 0 || dow === 6;
                                                const isServiceDay = dayOrders.length > 0;
                                                const classlessOrder = isClassless ? dayOrders.find((o: any) => o.class_name === '共通') : null;
                                                const clTotal = classlessOrder ? (classlessOrder.student_count + classlessOrder.allergy_count) : 0;
                                                return (
                                                    <div key={di} className={`border-r border-gray-100 last:border-0 p-1.5
                                                        ${isWeekend ? 'bg-red-50/30' : ''}
                                                        ${!isServiceDay ? 'bg-gray-50/50' : ''}`}
                                                        style={{ minHeight: cellHeight }}>
                                                        <div className={`text-sm font-bold ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'}`}>{day}</div>
                                                        {specialType && (
                                                            <div className="mt-0.5 text-xs font-black text-orange-600 bg-orange-50 border border-orange-100 rounded px-1 py-0.5 leading-tight">
                                                                {specialType}
                                                            </div>
                                                        )}
                                                        {classlessOrder && (
                                                            <div className="mt-0.5">
                                                                <div className="text-[9px] text-gray-500 leading-none">園児</div>
                                                                <div className="font-black text-gray-800 leading-tight whitespace-nowrap text-xs">
                                                                    <span>{classlessOrder.student_count}</span>
                                                                    <span className="text-red-500">+ア{classlessOrder.allergy_count}＝</span>
                                                                    <span>{clTotal}</span>
                                                                </div>
                                                                <div className="flex justify-between items-baseline">
                                                                    <span className="text-[9px] text-gray-500">先生</span>
                                                                    <span className="text-xs font-black text-gray-600">{classlessOrder.teacher_count}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ));
                                })()}
                            </div>

                            {/* 右：クラス別 基本人数表 */}
                            <div className="w-96 shrink-0">
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                                        <span className="text-sm font-black text-gray-600">クラス別 基本人数</span>
                                    </div>
                                    {k.classes && k.classes.length > 0 ? (
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                                    <th className="text-left px-3 py-1.5 text-sm font-black text-gray-500">クラス</th>
                                                    <th className="text-center px-2 py-1.5 text-sm font-black text-gray-500">園児</th>
                                                    <th className="text-center px-2 py-1.5 text-sm font-black text-red-400">アレ</th>
                                                    <th className="text-center px-2 py-1.5 text-sm font-black text-gray-500">先生</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {k.classes.map((cls: any, idx: number) => (
                                                    <tr key={idx} className="border-b border-gray-50 last:border-0">
                                                        <td className="px-3 py-2 font-bold text-gray-800 text-sm">{cls.class_name}</td>
                                                        <td className="px-2 py-2 text-center font-bold text-gray-700 text-base">{cls.default_student_count}</td>
                                                        <td className="px-2 py-2 text-center font-bold text-red-500 text-base">{cls.default_allergy_count ?? 0}</td>
                                                        <td className="px-2 py-2 text-center font-bold text-gray-700 text-base">{cls.default_teacher_count}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-3">
                                            <div className="text-center space-y-2">
                                                <div className="text-xs font-black text-gray-500 border-b border-gray-100 pb-1">基本人数</div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div><div className="text-xs text-gray-500">園児</div><div className="text-xl font-black text-gray-800">{k.classless_student_count ?? 0}</div></div>
                                                    <div><div className="text-xs text-red-400">アレルギー</div><div className="text-xl font-black text-red-500">{k.classless_allergy_count ?? 0}</div></div>
                                                    <div><div className="text-xs text-gray-500">先生</div><div className="text-xl font-black text-gray-700">{k.classless_teacher_count ?? 0}</div></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Kindergarten Editor Component ---
function KindergartenEditor({ k, onClose, onSave }: { k: any, onClose: () => void, onSave: () => void }) {
    const [formData, setFormData] = useState({ ...k });
    const [classes, setClasses] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [newService, setNewService] = useState('');

    // クラスなしモード用：基本人数（kindergartenデータから初期値を読む）
    const [classlessStudent, setClasslessStudent] = useState<number>(k.classless_student_count ?? 0);
    const [classlessAllergy, setClasslessAllergy] = useState<number>(k.classless_allergy_count ?? 0);
    const [classlessTeacher, setClasslessTeacher] = useState<number>(k.classless_teacher_count ?? 0);
    const today = new Date().toISOString().slice(0, 10);
    const [classlessFromDate, setClasslessFromDate] = useState(today);
    const [isSavingDefaults, setIsSavingDefaults] = useState(false);
    const [defaultsSaveSuccess, setDefaultsSaveSuccess] = useState(false);

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

    const handleSaveDefaults = async () => {
        if (!classlessFromDate) { alert('適用開始日を選択してください'); return; }
        setIsSavingDefaults(true);
        setDefaultsSaveSuccess(false);
        try {
            // 1. kindergartenシートに永続保存（classlessフィールドのみ送信）
            await updateAdminKindergarten(k.kindergarten_id, {
                classless_student_count: classlessStudent,
                classless_allergy_count: classlessAllergy,
                classless_teacher_count: classlessTeacher,
            });
            // 2. 既存の注文にも適用（注文がなくてもエラーにならない）
            await updateOrderDefaults({
                kindergarten_id: k.kindergarten_id,
                from_date: classlessFromDate,
                student_count: classlessStudent,
                allergy_count: classlessAllergy,
                teacher_count: classlessTeacher,
            }).catch(() => {}); // 注文がなくても無視
            setDefaultsSaveSuccess(true);
            onSave(); // 一覧を更新してk.classless_*を最新化
            setTimeout(() => setDefaultsSaveSuccess(false), 3000);
        } catch (err) {
            console.error(err);
            alert('基本人数の保存に失敗しました');
        } finally {
            setIsSavingDefaults(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            // 1. Update Basic & Service Days & Triggers
            await updateAdminKindergarten(k.kindergarten_id, formData);
            // 2. Update Classes
            await updateAdminClasses(k.kindergarten_id, classes);
            setIsSaving(false);
            setSaveSuccess(true);
            onSave(); // refreshes list in background without closing editor
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-orange-50/30">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl leading-none">{formData.icon_url || '🏫'}</span>
                        <div>
                            <h2 className="text-lg font-black text-gray-800">{k.name} <span className="text-gray-400 font-medium text-sm">#{k.kindergarten_id}</span></h2>
                            <p className="text-sm font-bold text-orange-400 uppercase tracking-widest">Master Data Editor</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                    {/* Section: Basic Settings */}
                    <div className="grid md:grid-cols-2 gap-5 text-left">
                        <div className="space-y-3">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">基本情報 <div className="h-px flex-1 bg-gray-100"></div></h3>
                            <div className="space-y-2">
                                <div>
                                    <label className="text-sm font-bold text-gray-500 uppercase ml-1 block mb-0.5">表示名称</label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 font-bold text-base focus:ring-2 focus:ring-orange-100 outline-none"
                                    />
                                </div>
                                <div className="relative">
                                    <label className="text-sm font-bold text-gray-500 uppercase ml-1 block mb-0.5">アイコン絵文字</label>
                                    <button type="button" onClick={() => setShowEmojiPicker(p => !p)}
                                        className="w-10 h-10 text-2xl rounded-xl bg-gray-50 border border-gray-100 hover:bg-orange-50 hover:border-orange-200 transition-all flex items-center justify-center">
                                        {formData.icon_url || '🏫'}
                                    </button>
                                    {showEmojiPicker && (
                                        <div className="absolute top-full left-0 mt-1 z-10 bg-white rounded-xl shadow-lg border border-gray-100 p-2 flex flex-wrap gap-1 w-56">
                                            {['🏫','🌸','🌻','🌈','⭐','🐣','🦋','🐸','🍀','🎠','🎨','🎵','🌺','🦊','🐧','🐨','🐼','🦁','🐰','🌙','🌼','🦄','🍎','🍊','🌊'].map(emoji => (
                                                <button key={emoji} type="button"
                                                    onClick={() => { setFormData({ ...formData, icon_url: emoji }); setShowEmojiPicker(false); }}
                                                    className={`w-8 h-8 text-lg rounded-lg transition-all ${formData.icon_url === emoji ? 'bg-orange-100 ring-2 ring-orange-400' : 'hover:bg-orange-50'}`}>
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-gray-500 uppercase ml-1 block mb-0.5">住所</label>
                                    <input
                                        type="text"
                                        value={formData.address || ''}
                                        onChange={(e) => {
                                            const addr = e.target.value;
                                            const ku = addr.match(/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]+区/);
                                            const shi = addr.match(/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]+市/);
                                            const cho = addr.match(/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]+[町村]/);
                                            const extracted = ku?.[0] ?? shi?.[0] ?? cho?.[0] ?? '';
                                            setFormData({ ...formData, address: addr, area: extracted || formData.area || '' });
                                        }}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 font-bold text-base focus:ring-2 focus:ring-orange-100 outline-none"
                                        placeholder="例：大阪府大阪市北区梅田1-2-3"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-gray-500 uppercase ml-1 block mb-0.5">エリア <span className="text-orange-400 normal-case font-medium">（住所から自動入力）</span></label>
                                    <input
                                        type="text"
                                        value={formData.area || ''}
                                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                        className="w-full px-3 py-2 bg-orange-50 rounded-xl border border-orange-100 font-bold text-base focus:ring-2 focus:ring-orange-100 outline-none"
                                        placeholder="例：北区"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-sm font-bold text-gray-500 uppercase ml-1 block mb-0.5">ログインID</label>
                                        <input type="text" value={formData.login_id || ''} onChange={e => setFormData({ ...formData, login_id: e.target.value })}
                                            className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 font-bold text-base outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-500 uppercase ml-1 block mb-0.5">パスワード</label>
                                        <input type="text" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 font-bold text-base outline-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">稼働日・設定 <div className="h-px flex-1 bg-gray-100"></div></h3>
                            <div className="flex gap-1.5 flex-wrap">
                                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
                                    const field = `service_${day}`;
                                    const active = formData[field];
                                    const labels: any = { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日' };
                                    return (
                                        <button key={day} onClick={() => toggleDay(field)}
                                            className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${active ? 'bg-orange-500 text-white shadow-md shadow-orange-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                                            {labels[day]}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* 食事タイプ設定 */}
                            <div className="flex items-center gap-3 flex-wrap py-1">
                                {/* 赤 / キャラ */}
                                <select value={formData.plan_type || ''} onChange={e => setFormData({ ...formData, plan_type: e.target.value })}
                                    className="px-3 py-1.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-600 outline-none">
                                    <option value="">タイプ未設定</option>
                                    <option value="赤">赤</option>
                                    <option value="キャラ">キャラ</option>
                                </select>
                                {/* 飯あり / 飯なし */}
                                <select value={formData.has_no_rice ? '飯なし' : '飯あり'} onChange={e => setFormData({ ...formData, has_no_rice: e.target.value === '飯なし' })}
                                    className="px-3 py-1.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-600 outline-none">
                                    <option value="飯あり">飯あり</option>
                                    <option value="飯なし">飯なし</option>
                                </select>
                                {/* スープ有 */}
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={formData.has_soup || false} onChange={e => setFormData({ ...formData, has_soup: e.target.checked })}
                                        className="w-4 h-4 rounded accent-orange-500" />
                                    <span className="text-sm font-bold text-gray-600">スープ有</span>
                                </label>
                                <p className="text-sm text-gray-400 w-full">※ 管理用設定です（先生側には表示されません）</p>
                            </div>

                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 pt-1">個別献立 <div className="h-px flex-1 bg-gray-100"></div></h3>
                            <div className="space-y-2">
                                {/* 登録済みタグ（上に表示） */}
                                <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                                    {(formData.services || []).filter((s: string) => s !== 'スープ付き').map((s: string) => (
                                        <div key={s} className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full text-sm font-bold border border-orange-100 flex items-center gap-1">
                                            {s}
                                            <button onClick={() => removeService(s)} className="hover:bg-orange-200 rounded-full p-0.5"><X className="w-2.5 h-2.5" /></button>
                                        </div>
                                    ))}
                                </div>
                                {/* 入力フォーム */}
                                <div className="flex gap-2">
                                    <input type="text" placeholder="例: お誕生日会" value={newService} onChange={e => setNewService(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && addService()}
                                        className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-base font-bold outline-none" />
                                    <button onClick={addService} className="p-2 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-colors">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {formData.services?.includes('カレー') && (
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-500 uppercase ml-1 block">カレー識別キーワード（この園のメニュー上の文字列）</label>
                                    <input type="text" placeholder="例: 壺漬け" value={formData.curry_trigger || ''}
                                        onChange={e => setFormData({ ...formData, curry_trigger: e.target.value })}
                                        className="w-full bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-base font-bold outline-none focus:ring-2 ring-orange-200" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section: Classes */}
                    <div className="space-y-3 text-left">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 flex-1">
                                クラス・人数 <div className="h-px flex-1 bg-gray-100 ml-2"></div>
                            </h3>
                            <button onClick={addClass} className="ml-4 flex items-center gap-1 text-sm font-black text-orange-600 hover:text-orange-700 uppercase tracking-widest">
                                <Plus className="w-3.5 h-3.5" /> クラス追加
                            </button>
                        </div>

                        {isLoadingClasses ? (
                            <div className="py-6 text-center">
                                <Loader2 className="animate-spin w-5 h-5 mx-auto text-gray-200" />
                            </div>
                        ) : (
                            <>
                            {classes.length === 0 && (
                                <div className="space-y-3">
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700 space-y-1">
                                        <p className="font-black">クラスなしモード（現在の設定）</p>
                                        <p className="font-medium text-blue-500">クラスを追加するとクラス別モードになります。クラスなしの場合、以下で基本人数を設定してください。</p>
                                    </div>
                                    {/* 基本人数設定パネル */}
                                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            基本人数設定 <div className="h-px flex-1 bg-gray-200"></div>
                                        </h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: '園児数', value: classlessStudent, setter: setClasslessStudent },
                                                { label: 'アレルギー', value: classlessAllergy, setter: setClasslessAllergy },
                                                { label: '先生', value: classlessTeacher, setter: setClasslessTeacher },
                                            ].map(({ label, value, setter }) => (
                                                <div key={label}>
                                                    <label className="text-sm font-bold text-gray-500 block mb-1">{label}</label>
                                                    <input
                                                        type="number" min={0} value={value}
                                                        onChange={e => setter(Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="w-full bg-white px-3 py-2 rounded-xl border border-gray-200 text-base font-bold text-center outline-none focus:ring-2 focus:ring-orange-100"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-end gap-3">
                                            <div className="flex-1">
                                                <label className="text-sm font-bold text-gray-500 block mb-1">適用開始日（この日以降の注文を一括更新）</label>
                                                <input
                                                    type="date" value={classlessFromDate}
                                                    onChange={e => setClasslessFromDate(e.target.value)}
                                                    className="w-full bg-white px-3 py-2 rounded-xl border border-gray-200 text-base font-bold outline-none focus:ring-2 focus:ring-orange-100"
                                                />
                                            </div>
                                            <button
                                                onClick={handleSaveDefaults}
                                                disabled={isSavingDefaults}
                                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-base font-black text-white transition-all ${isSavingDefaults ? 'bg-gray-300 cursor-not-allowed' : defaultsSaveSuccess ? 'bg-green-500' : 'bg-orange-500 hover:bg-orange-600'}`}
                                            >
                                                {isSavingDefaults ? <Loader2 className="w-4 h-4 animate-spin" /> : defaultsSaveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                                {defaultsSaveSuccess ? '保存済み' : '適用'}
                                            </button>
                                        </div>
                                        {defaultsSaveSuccess && (
                                            <p className="text-sm font-bold text-green-600">{classlessFromDate} 以降の注文を更新しました</p>
                                        )}
                                        <p className="text-sm text-gray-400">※ 適用開始日以降にすでに入っている注文の人数を上書きします。未来の日付から適用することをお勧めします。</p>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {classes.map((cls, idx) => (
                                    <div key={idx} className="bg-gray-50 border border-gray-100 p-3 rounded-xl space-y-2 relative group/card">
                                        <button onClick={() => removeClass(idx)}
                                            className="absolute top-1.5 right-1.5 p-1 bg-white shadow-sm border border-red-50 text-red-400 rounded-lg opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-50">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                        <input value={cls.class_name} onChange={e => updateClass(idx, 'class_name', e.target.value)}
                                            className="w-full bg-white px-2 py-1.5 rounded-lg text-sm font-bold border border-transparent focus:border-orange-200 outline-none"
                                            placeholder="クラス名" />
                                        <div className="grid grid-cols-2 gap-1">
                                            <div>
                                                <label className="text-sm font-bold text-gray-400 block">学年</label>
                                                <input value={cls.grade} onChange={e => updateClass(idx, 'grade', e.target.value)}
                                                    className="w-full bg-white px-2 py-1 rounded-lg text-sm font-bold border border-transparent focus:border-orange-200 outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-400 block">園児数</label>
                                                <input type="number" value={cls.default_student_count} onChange={e => updateClass(idx, 'default_student_count', parseInt(e.target.value))}
                                                    className="w-full bg-white px-2 py-1 rounded-lg text-sm font-bold border border-transparent focus:border-orange-200 outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-400 block">アレルギー</label>
                                                <input type="number" value={cls.default_allergy_count} onChange={e => updateClass(idx, 'default_allergy_count', parseInt(e.target.value))}
                                                    className="w-full bg-white px-2 py-1 rounded-lg text-sm font-bold border border-transparent focus:border-orange-200 outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-400 block">先生</label>
                                                <input type="number" value={cls.default_teacher_count} onChange={e => updateClass(idx, 'default_teacher_count', parseInt(e.target.value))}
                                                    className="w-full bg-white px-2 py-1 rounded-lg text-sm font-bold border border-transparent focus:border-orange-200 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/20 flex items-center justify-between">
                    <p className="text-sm text-gray-400">※ Googleスプレッドシートに同期されます</p>
                    <div className="flex gap-3 items-center">
                        {saveSuccess && (
                            <span className="text-sm font-bold text-green-600 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> 保存しました
                            </span>
                        )}
                        <button onClick={onClose} className="px-4 py-2 rounded-xl text-base font-bold text-gray-400 hover:text-gray-600 transition-colors">閉じる</button>
                        <button onClick={handleSave} disabled={isSaving}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-base font-black text-white shadow-md transition-all active:scale-[0.98]
                                ${isSaving ? 'bg-gray-300 cursor-not-allowed shadow-none' : saveSuccess ? 'bg-green-500 hover:bg-green-600' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-orange-200'}`}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            {saveSuccess ? '保存済み' : '変更を保存'}
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
    const [adminSubject, setAdminSubject] = useState(info.email_template_admin_subject || '');
    const [adminBody, setAdminBody] = useState(info.email_template_admin_body || '');
    const [customerSubject, setCustomerSubject] = useState(info.email_template_customer_subject || '');
    const [customerBody, setCustomerBody] = useState(info.email_template_customer_body || '');
    const [isSaving, setIsSaving] = useState(false);
    const [templateTab, setTemplateTab] = useState<'admin' | 'customer'>('admin');

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({
                admin_emails: emails,
                reminder_days: days,
                email_template_admin_subject: adminSubject,
                email_template_admin_body: adminBody,
                email_template_customer_subject: customerSubject,
                email_template_customer_body: customerBody,
            });
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
                    <h2 className="text-2xl font-black text-gray-800">システム設定</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
                </div>
                <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                    {/* Admin Emails */}
                    <div>
                        <label className="text-sm font-black text-gray-400 uppercase block mb-2">管理者通知先メールアドレス</label>
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
                                className="flex items-center gap-2 text-sm font-bold text-orange-600 hover:text-orange-700 px-2 py-1"
                            >
                                <Plus className="w-4 h-4" /> メールアドレスを追加
                            </button>
                        </div>
                    </div>

                    {/* Deadline Settings */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-black text-gray-400 uppercase">期限・リマインダー設定</h4>
                        <div>
                            <label className="text-sm font-bold text-gray-500 uppercase block mb-1">注文締切日</label>
                            <div className="flex items-center gap-3">
                                <span className="text-base font-bold text-gray-600">提供日の</span>
                                <input type="number" className="w-16 p-2 bg-gray-50 rounded-xl border border-gray-100 font-bold text-center outline-none" defaultValue="3" disabled />
                                <span className="text-base font-bold text-gray-600">日前 15:00 まで</span>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">※ 現在はシステム固定値です</p>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-500 uppercase block mb-1">リマインダー通知 (締切の何日前)</label>
                            <input type="text" value={days} onChange={e => setDays(e.target.value)}
                                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:ring-2 ring-orange-100 outline-none" placeholder="1, 0" />
                            <p className="text-sm text-gray-400 mt-1">※ 「1, 0」の場合、締切の1日前と当日に通知が飛びます</p>
                        </div>
                    </div>

                    {/* Email Templates */}
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-black text-gray-400 uppercase">メール通知テンプレート</h4>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            使用できる変数: <code className="bg-gray-100 px-1 rounded">{'{kindergarten_name}'}</code> <code className="bg-gray-100 px-1 rounded">{'{class_name}'}</code> <code className="bg-gray-100 px-1 rounded">{'{date}'}</code> <code className="bg-gray-100 px-1 rounded">{'{details}'}</code> <code className="bg-gray-100 px-1 rounded">{'{action}'}</code> <code className="bg-gray-100 px-1 rounded">{'{timestamp}'}</code> <code className="bg-gray-100 px-1 rounded">{'{contact_name}'}</code>
                        </p>
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                            <button onClick={() => setTemplateTab('admin')}
                                className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${templateTab === 'admin' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'}`}>
                                管理者向け
                            </button>
                            <button onClick={() => setTemplateTab('customer')}
                                className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${templateTab === 'customer' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'}`}>
                                園担当者向け
                            </button>
                        </div>

                        {templateTab === 'admin' && (
                            <div className="space-y-2">
                                <div>
                                    <label className="text-sm font-bold text-gray-500 uppercase block mb-1">件名</label>
                                    <input type="text" value={adminSubject} onChange={e => setAdminSubject(e.target.value)}
                                        className="w-full p-2 bg-gray-50 rounded-xl border border-gray-100 font-bold text-sm focus:ring-2 ring-orange-100 outline-none" />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-gray-500 uppercase block mb-1">本文</label>
                                    <textarea rows={6} value={adminBody} onChange={e => setAdminBody(e.target.value)}
                                        className="w-full p-2 bg-gray-50 rounded-xl border border-gray-100 font-mono text-sm focus:ring-2 ring-orange-100 outline-none resize-none" />
                                </div>
                            </div>
                        )}
                        {templateTab === 'customer' && (
                            <div className="space-y-2">
                                <div>
                                    <label className="text-sm font-bold text-gray-500 uppercase block mb-1">件名</label>
                                    <input type="text" value={customerSubject} onChange={e => setCustomerSubject(e.target.value)}
                                        className="w-full p-2 bg-gray-50 rounded-xl border border-gray-100 font-bold text-sm focus:ring-2 ring-orange-100 outline-none" />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-gray-500 uppercase block mb-1">本文</label>
                                    <textarea rows={6} value={customerBody} onChange={e => setCustomerBody(e.target.value)}
                                        className="w-full p-2 bg-gray-50 rounded-xl border border-gray-100 font-mono text-sm focus:ring-2 ring-orange-100 outline-none resize-none" />
                                </div>
                            </div>
                        )}
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

    // Dashboard navigation
    const [activeSection, setActiveSection] = useState<'menu' | 'kindergarten' | 'orders' | 'daily' | null>(null);

    // Orders section
    const [ordersYear, setOrdersYear] = useState<number>(new Date().getFullYear());
    const [ordersMonth, setOrdersMonth] = useState<number>(new Date().getMonth() + 1);
    const [ordersData, setOrdersData] = useState<any[] | null>(null);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [showPrintView, setShowPrintView] = useState(false);
    const [printData, setPrintData] = useState<any[] | null>(null);
    const [showSinglePrint, setShowSinglePrint] = useState(false);
    const [singlePrintKid, setSinglePrintKid] = useState<{ id: string, name: string } | null>(null);

    // Daily orders section
    const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [dailyData, setDailyData] = useState<any | null>(null);
    const [dailyLoading, setDailyLoading] = useState(false);
    const [dailyTab, setDailyTab] = useState<'list' | 'delivery'>('list');
    const [dailyShowAll, setDailyShowAll] = useState(false);

    // Monthly common items (list + new entry form)
    const [monthlyCommonItems, setMonthlyCommonItems] = useState<{ year_month: string, item: string }[]>([]);
    const [newCommon, setNewCommon] = useState({ item: '', year_month: new Date().toISOString().slice(0, 7) });
    const [monthlyCommonSaving, setMonthlyCommonSaving] = useState(false);

    // Kindergarten search & filter
    const [kSearch, setKSearch] = useState('');
    const [kFilterDay, setKFilterDay] = useState('');
    const [kFilterSoup, setKFilterSoup] = useState('');
    const [kFilterService, setKFilterService] = useState('');

    const kAllServices: string[] = Array.from(new Set(
        kindergartens.flatMap((k: any) => k.services || [])
    )).sort() as string[];

    const kFiltered = kindergartens.filter((k: any) => {
        if (kSearch && !k.name?.toLowerCase().includes(kSearch.toLowerCase())) return false;
        if (kFilterDay && !k[kFilterDay]) return false;
        if (kFilterSoup === 'yes' && !k.has_soup) return false;
        if (kFilterSoup === 'no' && k.has_soup) return false;
        if (kFilterService && !(k.services || []).includes(kFilterService)) return false;
        return true;
    });


    const fetchKindergartens = () => {
        getKindergartens().then(res => {
            const list = res.kindergartens ?? [];
            console.log('[Admin] fetchKindergartens:', list.length, '件');
            setKindergartens(list);
        }).catch(err => {
            console.error('[Admin] fetchKindergartens error:', err);
        });
    };

    const fetchSystemInfo = () => {
        getSystemInfo().then(res => {
            setSystemInfo(res);
        }).catch(err => console.error("SysInfo Error:", err));
    };

    useEffect(() => {
        fetchKindergartens();
        fetchSystemInfo();
        getMonthlyCommon().then(res => setMonthlyCommonItems(res.items || [])).catch(console.error);
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
        <div className="min-h-screen bg-orange-50/50 p-4 md:p-6">
            <div className="max-w-4xl mx-auto space-y-5">

                {/* Compact Header */}
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                        {activeSection && (
                            <button
                                onClick={() => setActiveSection(null)}
                                className="p-2 hover:bg-orange-100 rounded-xl transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-orange-500" />
                            </button>
                        )}
                        <img src="/icon-mamamire.png" className="w-7 h-7 object-contain" alt="MamaMiRe" />
                        <div>
                            <h1 className="text-lg font-black text-gray-800 leading-tight">
                                <span className="text-orange-600">ママミレ</span> 管理ポータル
                            </h1>
                            {activeSection === 'menu' && <p className="text-sm text-orange-400 font-bold uppercase tracking-wider">献立作成</p>}
                            {activeSection === 'kindergarten' && <p className="text-sm text-orange-400 font-bold uppercase tracking-wider">幼稚園マスター</p>}
                            {activeSection === 'orders' && <p className="text-sm text-orange-400 font-bold uppercase tracking-wider">注文確認・印刷</p>}
                            {activeSection === 'daily' && <p className="text-sm text-orange-400 font-bold uppercase tracking-wider">今日の注文</p>}
                        </div>
                    </div>

                    {/* クイックナビ（各ページ表示時のみ） */}
                    <div className="flex items-center gap-1.5 flex-1 justify-center">
                    {activeSection && [
                            { key: '_menu',        icon: <Upload        className="w-4 h-4" />, label: '献立作成（製作中）',       enabled: false, active: '', inactive: '' },
                            { key: 'orders',       icon: <Printer       className="w-4 h-4" />, label: '注文確認・印刷',           enabled: true,  active: 'bg-green-500  text-white shadow-green-200',  inactive: 'bg-green-50  text-green-500  border-green-100  hover:bg-green-100'  },
                            { key: 'kindergarten', icon: <Building2     className="w-4 h-4" />, label: '幼稚園マスター',           enabled: true,  active: 'bg-blue-500   text-white shadow-blue-200',   inactive: 'bg-blue-50   text-blue-500   border-blue-100   hover:bg-blue-100'   },
                            { key: 'daily',        icon: <ClipboardList className="w-4 h-4" />, label: '今日の注文',               enabled: true,  active: 'bg-orange-500 text-white shadow-orange-200', inactive: 'bg-orange-50 text-orange-500 border-orange-100 hover:bg-orange-100' },
                            { key: '_filedown',    icon: <FileDown      className="w-4 h-4" />, label: '数出表・納品書（製作中）',  enabled: false, active: '', inactive: '' },
                            { key: '_copy',        icon: <Copy          className="w-4 h-4" />, label: 'シール作成（製作中）',      enabled: false, active: '', inactive: '' },
                        ].map(({ key, icon, label, enabled, active, inactive }) => (
                            <div key={key} className="relative group">
                                <button
                                    onClick={() => enabled && setActiveSection(key as any)}
                                    disabled={!enabled}
                                    className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all shadow-sm
                                        ${!enabled
                                            ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50'
                                            : activeSection === key
                                                ? `${active} shadow-sm`
                                                : inactive
                                        }`}
                                >
                                    {icon}
                                </button>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-gray-800 text-white text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                    {label}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-800" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowSettings(true)}
                        className="flex items-center gap-2 bg-white text-gray-500 px-4 py-2 rounded-xl font-bold text-sm hover:bg-orange-50 transition-all border border-orange-100 shadow-sm"
                    >
                        <SettingsIcon className="w-3.5 h-3.5" /> システム設定
                    </button>
                </div>

                {/* Dashboard */}
                {!activeSection && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* 献立作成 - grayed out */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3 opacity-40 cursor-not-allowed">
                            <div className="p-3 bg-gray-100 rounded-xl">
                                <Upload className="w-6 h-6 text-gray-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-500 text-base">献立作成</p>
                                <p className="text-sm text-gray-400 mt-0.5">マスターアップロード</p>
                            </div>
                            <span className="text-sm font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">製作中</span>
                        </div>

                        {/* 注文確認・印刷 */}
                        <button
                            onClick={() => setActiveSection('orders')}
                            className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6 flex flex-col items-center gap-3 hover:bg-orange-50/50 hover:shadow-md hover:border-orange-200 transition-all group"
                        >
                            <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                                <Printer className="w-6 h-6 text-green-500" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-800 text-base">注文確認・印刷</p>
                                <p className="text-sm text-gray-400 mt-0.5">月別注文カレンダー</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-orange-300 group-hover:text-orange-500 transition-colors" />
                        </button>

                        {/* 幼稚園マスター */}
                        <button
                            onClick={() => setActiveSection('kindergarten')}
                            className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6 flex flex-col items-center gap-3 hover:bg-orange-50/50 hover:shadow-md hover:border-orange-200 transition-all group"
                        >
                            <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                                <Building2 className="w-6 h-6 text-blue-500" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-800 text-base">幼稚園マスター</p>
                                <p className="text-sm text-gray-400 mt-0.5">施設・クラス管理</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-orange-300 group-hover:text-orange-500 transition-colors" />
                        </button>

                        {/* 今日の注文 */}
                        <button
                            onClick={() => setActiveSection('daily')}
                            className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6 flex flex-col items-center gap-3 hover:bg-orange-50/50 hover:shadow-md hover:border-orange-200 transition-all group"
                        >
                            <div className="p-3 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-colors">
                                <ClipboardList className="w-6 h-6 text-orange-500" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-800 text-base">今日の注文</p>
                                <p className="text-sm text-gray-400 mt-0.5">注文確認・配送計画</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-orange-300 group-hover:text-orange-500 transition-colors" />
                        </button>

                        {/* 数出表・納品書 - grayed out */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3 opacity-40 cursor-not-allowed">
                            <div className="p-3 bg-gray-100 rounded-xl">
                                <FileDown className="w-6 h-6 text-gray-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-500 text-base">数出表・納品書</p>
                                <p className="text-sm text-gray-400 mt-0.5">集計・帳票出力</p>
                            </div>
                            <span className="text-sm font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">製作中</span>
                        </div>

                        {/* シール作成 - grayed out */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3 opacity-40 cursor-not-allowed">
                            <div className="p-3 bg-gray-100 rounded-xl">
                                <Copy className="w-6 h-6 text-gray-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-500 text-base">シール作成</p>
                                <p className="text-sm text-gray-400 mt-0.5">ラベル印刷</p>
                            </div>
                            <span className="text-sm font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">製作中</span>
                        </div>
                    </div>
                )}

                {/* 献立作成 Section */}
                {activeSection === 'menu' && (
                    <div className="space-y-4">
                        {/* Upload card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                            <div className="bg-orange-50/50 px-6 py-4 border-b border-orange-50 flex items-center justify-between">
                                <h2 className="text-base font-bold text-orange-700 flex items-center gap-2">
                                    <Upload className="w-4 h-4" />
                                    献立マスターのアップロード
                                </h2>
                                {systemInfo && (
                                    <div className="text-sm text-gray-400 font-bold flex items-center gap-2">
                                        Drive API:
                                        <span className={systemInfo.drive_folder_config.includes("Configured") ? "text-green-500" : "text-red-400"}>
                                            {systemInfo.drive_folder_config.includes("Configured") ? "CONNECTED" : "OFFLINE"}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="p-6">
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="w-full md:w-32">
                                        <label className="text-sm uppercase font-bold text-gray-400 mb-2 block">対象年月</label>
                                        <div className="flex gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-100 focus-within:ring-2 ring-orange-100 transition-all">
                                            <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="bg-transparent w-full font-bold text-gray-700 outline-none text-center" />
                                            <span className="text-gray-300">/</span>
                                            <input type="number" value={month} onChange={e => setMonth(parseInt(e.target.value))} className="bg-transparent w-full font-bold text-gray-700 outline-none text-center" />
                                        </div>
                                    </div>
                                    <div className="flex-1 w-full relative group">
                                        <div className="relative h-14 w-full border-2 border-dashed border-orange-100 rounded-xl group-hover:border-orange-300 transition-colors flex items-center justify-center gap-3 px-4 bg-orange-50/20">
                                            <input
                                                type="file"
                                                accept=".xlsx, .xls"
                                                onChange={handleFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            <Upload className={`w-5 h-5 ${file ? 'text-green-500' : 'text-orange-300'}`} />
                                            <span className="text-sm font-bold text-gray-500 truncate">
                                                {file ? file.name : "メニューExcelを選択またはドラッグ＆ドロップ"}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleUpload}
                                        disabled={isUploading || !file}
                                        className={`w-full md:w-40 py-4 rounded-xl font-bold text-white shadow-md transition-all active:scale-[0.98]
                                            ${isUploading || !file ? 'bg-gray-200 cursor-not-allowed text-gray-400 shadow-none' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'}`}
                                    >
                                        {isUploading ? <Loader2 className="animate-spin mx-auto w-5 h-5" /> : 'マスター取り込み'}
                                    </button>
                                </div>
                                {status && (
                                    <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 text-sm ${status.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                        {status.includes('Failed') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                        <span className="font-medium">{status}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 献立生成 (result) */}
                        {result && (
                            <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6">
                                <h3 className="text-base font-bold text-green-700 mb-4 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" /> 取り込み完了 — 幼稚園別に献立表を生成
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {kindergartens.map(k => (
                                        <button
                                            key={k.kindergarten_id}
                                            onClick={() => handleDownload(k)}
                                            disabled={!!downloadingId}
                                            className="flex items-center gap-3 p-3 rounded-xl border border-orange-100 hover:bg-orange-50 transition-all text-left disabled:opacity-50"
                                        >
                                            <img src={k.icon_url || "/icon-mamamire.png"} className="w-7 h-7 object-contain rounded-lg flex-shrink-0" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-700 truncate">{k.name}</p>
                                                <p className="text-sm text-orange-500 font-bold">献立表(Excel)</p>
                                            </div>
                                            {downloadingId === k.kindergarten_id ? <Loader2 className="w-4 h-4 animate-spin text-orange-400 flex-shrink-0" /> : <FileDown className="w-4 h-4 text-orange-300 flex-shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* その他 開発中 */}
                        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 flex flex-col items-center gap-2 text-center">
                            <p className="text-base font-bold text-gray-300">その他の献立機能</p>
                            <p className="text-sm text-gray-300">開発中</p>
                        </div>
                    </div>
                )}

                {/* 注文確認・印刷 Section */}
                {activeSection === 'orders' && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5">
                            <h2 className="text-base font-black text-gray-700 mb-4 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-orange-500" /> 対象年月を選択
                            </h2>
                            <div className="flex flex-wrap gap-3 items-end">
                                <div className="w-36">
                                    <label className="text-sm font-bold text-gray-400 uppercase block mb-1">年月</label>
                                    <div className="flex gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-100 focus-within:ring-2 ring-orange-100">
                                        <input type="number" value={ordersYear} onChange={e => setOrdersYear(parseInt(e.target.value))} className="bg-transparent w-full font-bold text-gray-700 outline-none text-center text-base" />
                                        <span className="text-gray-300">/</span>
                                        <input type="number" min={1} max={12} value={ordersMonth} onChange={e => setOrdersMonth(parseInt(e.target.value))} className="bg-transparent w-16 font-bold text-gray-700 outline-none text-center text-base" />
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        setOrdersLoading(true);
                                        setOrdersData(null);
                                        try {
                                            const res = await getAdminOrdersForMonth(ordersYear, ordersMonth);
                                            setOrdersData(res.data);
                                        } catch {
                                            alert('データの取得に失敗しました');
                                        } finally {
                                            setOrdersLoading(false);
                                        }
                                    }}
                                    disabled={ordersLoading}
                                    className="px-5 py-3 bg-orange-500 text-white text-base font-black rounded-xl hover:bg-orange-600 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {ordersLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '読み込む'}
                                </button>
                                {ordersData && (
                                    <button
                                        onClick={() => { setPrintData(ordersData); setShowPrintView(true); }}
                                        className="px-5 py-3 bg-green-500 text-white text-base font-black rounded-xl hover:bg-green-600 transition-all flex items-center gap-2"
                                    >
                                        <Printer className="w-4 h-4" /> 全園一括印刷
                                    </button>
                                )}
                            </div>
                        </div>

                        {ordersData && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {ordersData.filter((k: any) => k.orders.length > 0).map((k: any) => {
                                    const totalOrders = k.orders.length;
                                    const orderedDays = new Set(k.orders.map((o: any) => o.date)).size;
                                    return (
                                        <div key={k.kindergarten_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-black text-gray-800 text-base">{k.name}</p>
                                                    <p className="text-sm text-gray-400 mt-0.5">
                                                        {orderedDays}日分 / {totalOrders}件の注文
                                                        {k.classes.length === 0 && <span className="ml-2 text-blue-400">（クラスなし）</span>}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => { setSinglePrintKid({ id: k.kindergarten_id, name: k.name }); setShowSinglePrint(true); }}
                                                    className="flex items-center gap-1.5 text-sm font-bold text-orange-500 hover:text-orange-700 border border-orange-200 px-3 py-1.5 rounded-xl hover:bg-orange-50 transition-all"
                                                >
                                                    <Printer className="w-3.5 h-3.5" /> 印刷
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* 今日の注文 Section */}
                {activeSection === 'daily' && (
                    <div className="space-y-4">
                        {/* 日付選択 */}
                        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5">
                            <h2 className="text-base font-black text-gray-700 mb-4 flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-orange-500" /> 対象日を選択
                            </h2>
                            <div className="flex flex-wrap gap-3 items-center">
                                <input
                                    type="date"
                                    value={dailyDate}
                                    onChange={e => setDailyDate(e.target.value)}
                                    className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 ring-orange-100 text-base"
                                />
                                <button
                                    onClick={async () => {
                                        setDailyLoading(true);
                                        setDailyData(null);
                                        try {
                                            const res = await getDailyOrders(dailyDate);
                                            setDailyData(res);
                                        } catch {
                                            alert('データの取得に失敗しました');
                                        } finally {
                                            setDailyLoading(false);
                                        }
                                    }}
                                    disabled={dailyLoading}
                                    className="px-5 py-2.5 bg-orange-500 text-white text-base font-black rounded-xl hover:bg-orange-600 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {dailyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '読み込む'}
                                </button>
                                {dailyData && (
                                    <span className="text-sm text-gray-500 font-bold">
                                        合計 <span className="text-orange-600 text-base">{dailyData.grand_total}</span> 食
                                    </span>
                                )}
                            </div>
                        </div>

                        {dailyData && (
                            <>
                                {/* タブ切り替え */}
                                <div className="flex gap-2">
                                    <button onClick={() => setDailyTab('list')}
                                        className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${dailyTab === 'list' ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:bg-orange-50'}`}>
                                        注文一覧
                                    </button>
                                    <button onClick={() => setDailyTab('delivery')}
                                        className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${dailyTab === 'delivery' ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:bg-orange-50'}`}>
                                        配送リスト
                                    </button>
                                    <div className="flex-1" />
                                    <button onClick={() => setDailyShowAll(v => !v)}
                                        className="px-3 py-2 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-all">
                                        {dailyShowAll ? '注文あり園のみ表示' : '全園表示'}
                                    </button>
                                </div>

                                {/* 注文一覧タブ */}
                                {dailyTab === 'list' && (() => {
                                    const grouped: Record<string, any[]> = {};
                                    dailyData.kindergartens.forEach((k: any) => {
                                        if (!dailyShowAll && !k.has_orders) return;
                                        const area = k.area || 'エリア未設定';
                                        if (!grouped[area]) grouped[area] = [];
                                        grouped[area].push(k);
                                    });
                                    const areas = Object.keys(grouped).sort((a, b) =>
                                        a === 'エリア未設定' ? 1 : b === 'エリア未設定' ? -1 : a.localeCompare(b)
                                    );
                                    if (areas.length === 0) return (
                                        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 font-bold">この日の注文データがありません</div>
                                    );
                                    return (
                                        <div className="space-y-4">
                                            {areas.map(area => (
                                                <div key={area} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                                    {/* エリアヘッダー */}
                                                    <div className="px-4 py-2.5 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
                                                        <span className="text-sm font-black text-orange-700">{area}</span>
                                                        <span className="text-xs text-orange-400 font-bold">
                                                            {grouped[area].filter((k: any) => k.has_orders).length}園 ／
                                                            {grouped[area].filter((k: any) => k.has_orders).reduce((s: number, k: any) => s + k.totals.grand_total, 0)}食
                                                        </span>
                                                    </div>
                                                    {/* テーブル */}
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                                                <th className="text-left px-4 py-2 font-black text-gray-500">園名</th>
                                                                <th className="text-left px-3 py-2 font-black text-gray-500">クラス</th>
                                                                <th className="text-left px-3 py-2 font-black text-gray-500">タイプ</th>
                                                                <th className="text-center px-2 py-2 font-black text-gray-500">園児</th>
                                                                <th className="text-center px-2 py-2 font-black text-red-400">アレ</th>
                                                                <th className="text-center px-2 py-2 font-black text-gray-500">先生</th>
                                                                <th className="text-center px-2 py-2 font-black text-orange-500">合計</th>
                                                                <th className="text-left px-3 py-2 font-black text-gray-400">メモ</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {grouped[area].map((k: any) => (
                                                                k.has_orders ? (
                                                                    k.orders.map((o: any, idx: number) => (
                                                                        <tr key={`${k.kindergarten_id}-${idx}`} className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors">
                                                                            <td className="px-4 py-2 font-bold text-gray-800">
                                                                                {idx === 0 ? k.name : ''}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-gray-600">{o.class_name}</td>
                                                                            <td className="px-3 py-2">
                                                                                {o.meal_type !== '通常' ? (
                                                                                    <span className="text-xs font-black text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">{o.meal_type}</span>
                                                                                ) : (
                                                                                    <span className="text-xs text-gray-400">通常</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-2 py-2 text-center font-bold text-gray-700">{o.student_count}</td>
                                                                            <td className="px-2 py-2 text-center font-bold text-red-500">{o.allergy_count}</td>
                                                                            <td className="px-2 py-2 text-center font-bold text-gray-600">{o.teacher_count}</td>
                                                                            <td className="px-2 py-2 text-center font-black text-orange-600">
                                                                                {idx === k.orders.length - 1 ? k.totals.grand_total : ''}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-gray-400 text-xs">{o.memo || ''}</td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr key={k.kindergarten_id} className="border-b border-gray-50 opacity-40">
                                                                        <td className="px-4 py-2 font-bold text-gray-500">{k.name}</td>
                                                                        <td colSpan={7} className="px-3 py-2 text-gray-400 text-xs">注文なし</td>
                                                                    </tr>
                                                                )
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {/* 配送リストタブ */}
                                {dailyTab === 'delivery' && (() => {
                                    const deliveryKindergartens = dailyData.kindergartens.filter((k: any) => k.has_orders);
                                    const grouped: Record<string, any[]> = {};
                                    deliveryKindergartens.forEach((k: any) => {
                                        const area = k.area || 'エリア未設定';
                                        if (!grouped[area]) grouped[area] = [];
                                        grouped[area].push(k);
                                    });
                                    const areas = Object.keys(grouped).sort((a, b) =>
                                        a === 'エリア未設定' ? 1 : b === 'エリア未設定' ? -1 : a.localeCompare(b)
                                    );
                                    let seq = 1;

                                    if (deliveryKindergartens.length === 0) return (
                                        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 font-bold">この日の注文データがありません</div>
                                    );

                                    return (
                                        <>
                                            <style>{`
                                                @media print {
                                                    @page { size: A4 portrait; margin: 12mm; }
                                                    .no-print { display: none !important; }
                                                    .delivery-print { background: white !important; }
                                                }
                                            `}</style>
                                            <div className="delivery-print bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                                {/* ヘッダー */}
                                                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                                    <div>
                                                        <h3 className="font-black text-gray-800 text-base">配送リスト</h3>
                                                        <p className="text-sm text-gray-400 mt-0.5">{dailyDate.replace(/-/g, '/')}　計 <span className="font-black text-orange-600">{dailyData.grand_total}</span> 食</p>
                                                    </div>
                                                    <button
                                                        onClick={() => window.print()}
                                                        className="no-print flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-600 transition-all"
                                                    >
                                                        <Printer className="w-4 h-4" /> 印刷
                                                    </button>
                                                </div>

                                                {/* エリア別リスト */}
                                                <div className="divide-y divide-gray-100">
                                                    {areas.map(area => {
                                                        const areaTotal = grouped[area].reduce((s: number, k: any) => s + k.totals.grand_total, 0);
                                                        return (
                                                            <div key={area}>
                                                                {/* エリアヘッダー */}
                                                                <div className="px-5 py-2 bg-gray-50 flex items-center gap-3">
                                                                    <span className="font-black text-gray-700 text-sm">{area}</span>
                                                                    <span className="text-xs text-gray-400 font-bold">{grouped[area].length}園 ／ {areaTotal}食</span>
                                                                </div>
                                                                {/* 園リスト */}
                                                                {grouped[area].map((k: any) => {
                                                                    const num = seq++;
                                                                    const mealTypes = [...new Set(k.orders.map((o: any) => o.meal_type))].filter((t: any) => t !== '通常');
                                                                    return (
                                                                        <div key={k.kindergarten_id} className="px-5 py-3 flex items-center gap-4 border-b border-gray-50 last:border-0 hover:bg-orange-50/20 transition-colors">
                                                                            {/* 番号 */}
                                                                            <span className="text-base font-black text-gray-300 w-6 text-right shrink-0">{num}</span>
                                                                            {/* 園名 */}
                                                                            <span className="font-black text-gray-800 text-base flex-1">{k.name}</span>
                                                                            {/* 特別メニュー */}
                                                                            <div className="flex gap-1 shrink-0">
                                                                                {mealTypes.map((t: any) => (
                                                                                    <span key={t} className="text-xs font-black text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">{t}</span>
                                                                                ))}
                                                                            </div>
                                                                            {/* 内訳 */}
                                                                            <div className="text-sm text-gray-500 font-bold shrink-0 text-right">
                                                                                <span>園児 {k.totals.student + k.totals.allergy}</span>
                                                                                <span className="mx-1.5 text-gray-300">/</span>
                                                                                <span>先生 {k.totals.teacher}</span>
                                                                            </div>
                                                                            {/* 合計 */}
                                                                            <div className="text-right shrink-0 w-16">
                                                                                <span className="text-2xl font-black text-orange-600">{k.totals.grand_total}</span>
                                                                                <span className="text-xs text-gray-400 ml-0.5">食</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* フッター合計 */}
                                                <div className="px-5 py-4 bg-orange-50 border-t border-orange-100 flex items-center justify-end gap-3">
                                                    <span className="font-black text-gray-600 text-base">本日合計</span>
                                                    <span className="text-3xl font-black text-orange-600">{dailyData.grand_total}</span>
                                                    <span className="text-base text-gray-500 font-bold">食</span>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                )}

                {/* 幼稚園マスター Section */}
                {activeSection === 'kindergarten' && (
                    <div className="space-y-3">
                        {/* Monthly Common Item Panel */}
                        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <h3 className="text-sm font-black text-gray-700 uppercase tracking-wide">月別カレー共通項目</h3>
                                <span className="text-sm text-orange-500 font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">全園共通</span>
                            </div>
                            <div className="flex flex-col md:flex-row gap-4">
                                {/* Input form (left) */}
                                <div className="flex flex-col gap-2 md:w-64">
                                    <div>
                                        <label className="text-sm font-bold text-gray-400 uppercase block mb-1">対象年月</label>
                                        <input type="month" value={newCommon.year_month}
                                            onChange={e => setNewCommon(p => ({ ...p, year_month: e.target.value }))}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 ring-orange-100" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-400 uppercase block mb-1">共通項目名（ヤクルト・副菜漬け など）</label>
                                        <input type="text" placeholder="例: ヤクルト"
                                            value={newCommon.item}
                                            onChange={e => setNewCommon(p => ({ ...p, item: e.target.value }))}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 ring-orange-100" />
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!newCommon.year_month || !newCommon.item) return;
                                            setMonthlyCommonSaving(true);
                                            try {
                                                await updateMonthlyCommon(newCommon);
                                                const res = await getMonthlyCommon();
                                                setMonthlyCommonItems(res.items || []);
                                                setNewCommon(p => ({ ...p, item: '' }));
                                            } catch { alert('保存に失敗しました'); }
                                            finally { setMonthlyCommonSaving(false); }
                                        }}
                                        disabled={monthlyCommonSaving || !newCommon.item || !newCommon.year_month}
                                        className="px-4 py-2 bg-orange-500 text-white text-sm font-black rounded-xl hover:bg-orange-600 flex items-center justify-center gap-1.5 disabled:opacity-40"
                                    >
                                        {monthlyCommonSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        保存（同月は上書き）
                                    </button>
                                </div>
                                {/* History list (right) */}
                                <div className="flex-1">
                                    <label className="text-sm font-bold text-gray-400 uppercase block mb-2">登録済み一覧</label>
                                    {monthlyCommonItems.length === 0 ? (
                                        <p className="text-sm text-gray-300 font-bold">まだ登録がありません</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {monthlyCommonItems.map(item => (
                                                <div key={item.year_month} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                                                    <span className="text-sm font-black text-gray-500 w-20 shrink-0">{item.year_month}</span>
                                                    <span className="text-sm font-bold text-gray-700 flex-1">{item.item}</span>
                                                    <button onClick={() => setNewCommon({ year_month: item.year_month, item: item.item })}
                                                        className="text-sm text-orange-500 font-bold hover:text-orange-700 shrink-0">編集</button>
                                                    <button onClick={async () => {
                                                        if (!confirm(`${item.year_month} の登録を削除しますか？`)) return;
                                                        await deleteMonthlyCommon(item.year_month);
                                                        setMonthlyCommonItems(p => p.filter(i => i.year_month !== item.year_month));
                                                    }} className="text-sm text-gray-300 font-bold hover:text-red-500 shrink-0">削除</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Search & Filter bar */}
                        <div className="flex flex-wrap gap-2">
                            <div className="relative flex-1 min-w-40">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={kSearch}
                                    onChange={e => setKSearch(e.target.value)}
                                    placeholder="園名で検索..."
                                    className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 ring-orange-100"
                                />
                            </div>
                            <select value={kFilterDay} onChange={e => setKFilterDay(e.target.value)}
                                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 ring-orange-100 text-gray-600">
                                <option value="">曜日（全て）</option>
                                {[['service_mon','月'],['service_tue','火'],['service_wed','水'],['service_thu','木'],['service_fri','金'],['service_sat','土'],['service_sun','日']].map(([v,l]) => (
                                    <option key={v} value={v}>{l}曜日稼働</option>
                                ))}
                            </select>
                            <select value={kFilterSoup} onChange={e => setKFilterSoup(e.target.value)}
                                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 ring-orange-100 text-gray-600">
                                <option value="">スープ（全て）</option>
                                <option value="yes">スープあり</option>
                                <option value="no">スープなし</option>
                            </select>
                            {kAllServices.length > 0 && (
                                <select value={kFilterService} onChange={e => setKFilterService(e.target.value)}
                                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 ring-orange-100 text-gray-600">
                                    <option value="">個別献立（全て）</option>
                                    {kAllServices.map((s: string) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            )}
                            <p className="self-center text-sm font-bold text-gray-400 ml-1">{kFiltered.length}件</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {kFiltered.length === 0 ? (
                                <div className="col-span-2 py-12 text-center">
                                    <AlertCircle className="w-8 h-8 mx-auto text-gray-200 mb-2" />
                                    <p className="text-base text-gray-300 font-bold">該当する施設が見つかりません</p>
                                </div>
                            ) : kFiltered.map((k: any) => {
                                const activeDays = (['mon','tue','wed','thu','fri','sat','sun'] as const)
                                    .map((d, i) => k[`service_${d}`] ? ['月','火','水','木','金','土','日'][i] : null)
                                    .filter(Boolean).join('');
                                return (
                                <button
                                    key={k.kindergarten_id}
                                    onClick={() => { setEditingK(k); setShowEditor(true); }}
                                    className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2 flex items-center gap-2.5 hover:border-orange-200 hover:shadow-md transition-all text-left group"
                                >
                                    <span className="text-xl leading-none flex-shrink-0">{k.icon_url || '🏫'}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="font-black text-gray-800 text-sm truncate">{k.name || '---'}</p>
                                            {activeDays && <span className="text-xs text-gray-300 font-medium flex-shrink-0">{activeDays}</span>}
                                            {k.area && <span className="text-xs text-gray-400 font-medium flex-shrink-0">{k.area}</span>}
                                        </div>
                                        <div className="flex gap-1 mt-0.5 flex-wrap items-center">
                                            {k.plan_type && <span className="px-1.5 py-0 bg-orange-50 text-orange-500 rounded text-xs font-bold">{k.plan_type}</span>}
                                            {k.has_soup && <span className="px-1.5 py-0 bg-green-50 text-green-600 rounded text-xs font-bold">スープ</span>}
                                            {(k.services || []).map((s: string) => (
                                                <span key={s} className="px-1.5 py-0 bg-blue-50 text-blue-500 rounded text-xs font-bold">{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-orange-400 transition-colors flex-shrink-0" />
                                </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Modals */}
                {showEditor && editingK && (
                    <KindergartenEditor
                        k={editingK}
                        onClose={() => { setShowEditor(false); setEditingK(null); }}
                        onSave={() => {
                            fetchKindergartens(); // refresh list in background, editor stays open
                        }}
                    />
                )}

                {showPrintView && printData && (
                    <OrderPrintView
                        data={printData}
                        year={ordersYear}
                        month={ordersMonth}
                        onClose={() => setShowPrintView(false)}
                    />
                )}

                {showSinglePrint && singlePrintKid && (
                    <SingleKindergartenPrintView
                        kindergartenId={singlePrintKid.id}
                        kindergartenName={singlePrintKid.name}
                        initialYear={ordersYear}
                        initialMonth={ordersMonth}
                        onClose={() => { setShowSinglePrint(false); setSinglePrintKid(null); }}
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
