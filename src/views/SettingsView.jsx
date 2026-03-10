import React, { useState } from 'react';
import { Plus, Eye, EyeOff, Pencil, Trash2, Package, Sun, Moon, User, Users, BarChart2, Tag, ChevronRight, TrendingUp, Activity, CheckCircle } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { AVAILABLE_ICONS } from '../utils/data';
import { StaffManagementCard } from '../components/StaffManagementCard';
import { AccountSettingsCard } from '../components/AccountSettingsCard';

// ─── Tab definitions ───────────────────────────────────────────────────────────
const ALL_TABS = [
    { id: 'account', label: 'My Account', icon: User, adminOnly: false },
    { id: 'appearance', label: 'Appearance', icon: Sun, adminOnly: false },
    { id: 'charts', label: 'Charts', icon: BarChart2, adminOnly: true },
    { id: 'staff', label: 'Staff', icon: Users, adminOnly: true },
    { id: 'analytics', label: 'Analytics', icon: Activity, adminOnly: true },
    { id: 'categories', label: 'Categories', icon: Tag, adminOnly: true },
];

export const SettingsView = () => {
    const { isAdmin } = useAuth();
    const {
        settings,
        setSettings,
        categoryMap,
        hiddenCategories,
        setHiddenCategories,
        categoryFilter,
        setCategoryFilter,
        setCategoryModalMode,
        setCategoryForm,
        setIsCategoryModalOpen,
        showConfirm,
        setCategoryMap,
        refreshData,
        isDarkMode,
        toggleTheme,
    } = useInventory();

    // Default: 'account' for all users; filter tabs by role
    const availableTabs = ALL_TABS.filter(t => !t.adminOnly || isAdmin);
    const [activeTab, setActiveTab] = useState(availableTabs[0].id);

    // ── Category helpers ────────────────────────────────────────────────────
    const confirmDeleteCategory = (catName) => {
        showConfirm(
            'Delete Category',
            `Are you sure you want to delete ${catName}? All inventory items and past records using this category will be automatically moved to "Others".`,
            () => {
                import('../utils/supabaseActions').then(({ deleteCategoryFromSupabase }) => {
                    setCategoryMap(prev => { const n = { ...prev }; delete n[catName]; return n; });
                    setCategoryFilter(prev => prev === catName ? 'All' : prev);
                    setHiddenCategories(prev => prev.filter(c => c !== catName));
                    deleteCategoryFromSupabase(catName).then(() => refreshData()).catch(err => { console.error(err); refreshData(); });
                });
            }
        );
    };

    const handleSettingChange = async (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings); // Optimistically update state instantly UI feedback
        const { saveSettingsToSupabase } = await import('../utils/supabaseActions');
        saveSettingsToSupabase(newSettings).catch(err => console.error('Failed to save settings:', err));
    };

    const toggleCategoryVisibility = (catName) => {
        setHiddenCategories(prev => {
            if (prev.includes(catName)) return prev.filter(c => c !== catName);
            if (categoryFilter === catName) setCategoryFilter('All');
            return [...prev, catName];
        });
    };

    const openAddCategoryModal = () => {
        setCategoryModalMode('add');
        setCategoryForm({ oldName: '', name: '', icon: 'Pill' });
        setIsCategoryModalOpen(true);
    };

    const openEditCategoryModal = (catName, iconName) => {
        setCategoryModalMode('edit');
        setCategoryForm({ oldName: catName, name: catName, icon: iconName });
        setIsCategoryModalOpen(true);
    };

    // ── Tab Content Panels ──────────────────────────────────────────────────
    const CHART_OPTIONS = [
        {
            id: 'bar',
            label: 'Bar Chart',
            desc: 'Classic columns — best for comparing values across time periods.',
            icon: BarChart2,
            preview: (
                <svg viewBox="0 0 80 48" className="w-full h-full">
                    {[30, 60, 45, 80, 55, 70, 40].map((h, i) => (
                        <rect key={i} x={i * 11 + 2} y={48 - h * 0.46} width="8" rx="2" height={h * 0.46} fill="currentColor" opacity={0.85 - i * 0.05} />
                    ))}
                </svg>
            ),
        },
        {
            id: 'line',
            label: 'Line Chart',
            desc: 'Smooth trend line — best for showing continuous change over time.',
            icon: TrendingUp,
            preview: (
                <svg viewBox="0 0 80 48" className="w-full h-full">
                    <polyline points="2,38 13,24 24,30 35,12 46,20 57,8 68,16 79,10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {[2, 13, 24, 35, 46, 57, 68, 79].map((x, i) => {
                        const ys = [38, 24, 30, 12, 20, 8, 16, 10];
                        return <circle key={i} cx={x} cy={ys[i]} r="3" fill="white" stroke="currentColor" strokeWidth="2" />;
                    })}
                </svg>
            ),
        },
        {
            id: 'area',
            label: 'Area Chart',
            desc: 'Filled trend area — best for visualizing volume and magnitude of change.',
            icon: Activity,
            preview: (
                <svg viewBox="0 0 80 48" className="w-full h-full">
                    <defs>
                        <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
                        </linearGradient>
                    </defs>
                    <path d="M2,38 C13,30 24,28 35,14 C46,18 57,10 68,14 L79,10 L79,48 L2,48 Z" fill="url(#prevGrad)" />
                    <path d="M2,38 C13,30 24,28 35,14 C46,18 57,10 68,14 L79,10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
            ),
        },
    ];

    const panels = {
        account: <AccountSettingsCard />,

        charts: (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6 w-full">
                <div className="mb-6">
                    <h3 className="font-bold text-base text-slate-800">Dashboard Chart Style</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Choose how analytics data is visualized on the main dashboard.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {CHART_OPTIONS.map(opt => {
                        const isActive = (settings.chartType || 'bar') === opt.id;
                        return (
                            <button
                                key={opt.id}
                                onClick={() => handleSettingChange('chartType', opt.id)}
                                className={`relative group text-left rounded-2xl border-2 p-4 transition-all duration-200 focus:outline-none
                                    ${isActive
                                        ? 'border-[#08834c] bg-[#f0fdf7] shadow-md shadow-green-200/50'
                                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white hover:shadow-sm'
                                    }`}
                            >
                                {/* Active checkmark */}
                                {isActive && (
                                    <span className="absolute top-3 right-3">
                                        <CheckCircle size={18} className="text-[#08834c]" />
                                    </span>
                                )}

                                {/* Mini chart preview */}
                                <div className={`h-16 mb-4 rounded-xl p-2 transition-colors ${isActive ? 'text-[#08834c] bg-white shadow-sm' : 'text-slate-300 bg-white group-hover:text-slate-400'}`}>
                                    {opt.preview}
                                </div>

                                {/* Label + icon */}
                                <div className="flex items-center gap-2 mb-1">
                                    <opt.icon size={15} className={isActive ? 'text-[#08834c]' : 'text-slate-400'} />
                                    <span className={`font-bold text-sm ${isActive ? 'text-[#08834c]' : 'text-slate-700'}`}>{opt.label}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                            </button>
                        );
                    })}
                </div>
                <p className="text-xs text-slate-400 mt-5">The selected chart style is applied to the Dispensing Analytics graph on the Dashboard.</p>
            </div>
        ),

        appearance: (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6 w-full">
                <div className="mb-6">
                    <h3 className="font-bold text-base text-slate-800">Appearance</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Customize how the application looks on your device.</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg shadow-sm transition-colors ${isDarkMode ? 'bg-slate-700 text-yellow-400' : 'bg-white text-slate-500'}`}>
                            {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800 text-sm">Interface Theme</p>
                            <p className="text-xs text-slate-500 mt-0.5">{isDarkMode ? 'Dark mode is active' : 'Light mode is active'}</p>
                        </div>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none ${isDarkMode ? 'bg-[#08834c]' : 'bg-slate-200'}`}
                    >
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transform transition-transform duration-300 ${isDarkMode ? 'translate-x-8' : 'translate-x-1'}`}>
                            {isDarkMode ? <Moon size={11} className="text-[#08834c]" /> : <Sun size={11} className="text-yellow-500" />}
                        </span>
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-3">Your preference is saved automatically across sessions.</p>
            </div>
        ),

        staff: <StaffManagementCard />,

        analytics: (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6 w-full">
                <div className="mb-6">
                    <h3 className="font-bold text-base text-slate-800">Analytics Reporting Periods</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Configure the time boundaries used in your dashboard charts.</p>
                </div>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">First Day of the Week</label>
                        <p className="text-xs text-slate-400 mb-3">Used to correctly calculate "This Week" in dashboard charts.</p>
                        <select
                            value={settings.weekStartDay}
                            onChange={e => handleSettingChange('weekStartDay', parseInt(e.target.value))}
                            className="w-full sm:w-72 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none cursor-pointer text-slate-700 text-sm"
                        >
                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                                <option key={d} value={i}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full h-px bg-slate-100" />
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Start Date of the Month</label>
                        <p className="text-xs text-slate-400 mb-3">Used to calculate "This Month" for revenue and stock sold (1st–28th).</p>
                        <select
                            value={settings.monthStartDate}
                            onChange={e => handleSettingChange('monthStartDate', parseInt(e.target.value))}
                            className="w-full sm:w-72 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none cursor-pointer text-slate-700 text-sm"
                        >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                <option key={day} value={day}>{day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of the month</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        ),

        categories: (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6 w-full">
                <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
                    <div>
                        <h3 className="font-bold text-base text-slate-800">Therapeutic Categories</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Manage medicine categories shown across the system.</p>
                    </div>
                    <button onClick={openAddCategoryModal} className="text-sm bg-[#08834c] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#076c3e] transition-colors flex items-center gap-1.5 shadow-sm shadow-green-700/20">
                        <Plus size={15} /> Add Category
                    </button>
                </div>
                <div className="space-y-2.5">
                    {Object.entries(categoryMap).map(([catName, iconName]) => {
                        const Icon = AVAILABLE_ICONS[iconName] || Package;
                        const isHidden = hiddenCategories.includes(catName);
                        return (
                            <div key={catName} className={`flex justify-between items-center p-3 border rounded-xl transition-all ${isHidden ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-slate-50 border-slate-100 hover:border-[#acdabb] hover:bg-white'}`}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-2 rounded-lg shadow-sm shrink-0 ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-white text-[#08834c]'}`}>
                                        <Icon size={18} />
                                    </div>
                                    <span className={`font-bold text-sm truncate ${isHidden ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{catName}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <button onClick={() => toggleCategoryVisibility(catName)} className={`p-2 rounded-lg transition-colors ${isHidden ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:text-[#08834c] hover:bg-[#edf6f1]'}`} title={isHidden ? 'Show' : 'Hide'}>
                                        {isHidden ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                    <button onClick={() => openEditCategoryModal(catName, iconName)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                        <Pencil size={17} />
                                    </button>
                                    <button onClick={() => confirmDeleteCategory(catName)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                        <Trash2 size={17} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ),
    };

    const activeTabMeta = availableTabs.find(t => t.id === activeTab);

    return (
        <div className="animate-in fade-in duration-300 pb-12">
            {/* Page header */}
            <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Settings</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage your account, appearance and system configuration</p>
            </div>

            {/* ── Layout: sidebar + content ─────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">

                {/* ── Sidebar (desktop) / Horizontal pills (mobile) ── */}
                {/* Mobile: horizontal scrollable pills */}
                <div className="lg:hidden w-full">
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {availableTabs.map(tab => {
                            const Icon = tab.icon;
                            const active = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all shrink-0
                                        ${active
                                            ? 'bg-[#08834c] text-white shadow-md shadow-green-700/20'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:border-[#08834c] hover:text-[#08834c]'
                                        }`}
                                >
                                    <Icon size={15} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Desktop: vertical sidebar */}
                <nav className="hidden lg:flex flex-col w-52 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-100 p-2 sticky top-4">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest px-3 pt-2 pb-1">Navigation</p>
                    {availableTabs.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all text-left w-full group
                                    ${active
                                        ? 'bg-[#edf6f1] text-[#08834c]'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                                    }`}
                            >
                                <Icon size={17} className={active ? 'text-[#08834c]' : 'text-slate-400 group-hover:text-slate-600'} />
                                <span className="flex-1 text-left">{tab.label}</span>
                                {active && <ChevronRight size={14} className="text-[#08834c]" />}
                            </button>
                        );
                    })}
                </nav>

                {/* ── Content panel ── */}
                <div className="flex-1 min-w-0">
                    {/* Section title (desktop) */}
                    <div className="hidden lg:flex items-center gap-2 mb-4">
                        {activeTabMeta && <activeTabMeta.icon size={18} className="text-[#08834c]" />}
                        <h3 className="font-bold text-slate-800">{activeTabMeta?.label}</h3>
                    </div>

                    {/* Animated panel swap */}
                    <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                        {panels[activeTab]}
                    </div>
                </div>
            </div>
        </div>
    );
};
