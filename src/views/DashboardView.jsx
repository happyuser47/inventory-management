import React, { useState, useMemo } from 'react';
import { Pill, Banknote, Package, Eye } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { getCustomWeekStart, getCustomMonthStart } from '../utils/helpers';
import { AVAILABLE_ICONS } from '../utils/data';

export const DashboardView = () => {
    const { historyRecords, settings, categoryMap } = useInventory();
    const { isAdmin } = useAuth();

    const chartType = settings.chartType || 'bar';

    const [salesTimeframe, setSalesTimeframe] = useState('daily');
    const [salesMetric, setSalesMetric] = useState('value');
    const [topMedTimeframe, setTopMedTimeframe] = useState('monthly');
    const [valueTimeframe, setValueTimeframe] = useState('today');

    const now = new Date();
    const todayStr = now.toLocaleDateString();

    const currentWeekStart = getCustomWeekStart(now, settings.weekStartDay);
    const currentMonthStart = getCustomMonthStart(now, settings.monthStartDate);

    // DYNAMIC TOTAL VALUE
    const dynamicRevenue = useMemo(() => {
        return historyRecords.reduce((sum, r) => {
            const d = new Date(r.timestamp);
            if (isNaN(d.getTime())) return sum;
            let include = false;
            if (valueTimeframe === 'today') include = d.toLocaleDateString() === todayStr;
            else if (valueTimeframe === 'weekly') include = d >= currentWeekStart;
            else if (valueTimeframe === 'monthly') include = d >= currentMonthStart;
            else if (valueTimeframe === 'all') include = true;
            return include ? sum + r.totalAmount : sum;
        }, 0);
    }, [historyRecords, valueTimeframe, todayStr, currentWeekStart, currentMonthStart]);

    // TODAY STATS
    const todaysStats = useMemo(() => {
        let items = 0, units = 0;
        historyRecords.forEach(r => {
            const d = new Date(r.timestamp);
            if (!isNaN(d.getTime()) && d.toLocaleDateString() === todayStr) {
                items += r.items.length;
                units += r.items.reduce((sum, i) => sum + (parseInt(i.dispenseQty) || 0), 0);
            }
        });
        return { items, units };
    }, [historyRecords, todayStr]);

    // SALES CHART DATA
    const salesChartData = useMemo(() => {
        let labels = [], data = [];
        const getMetricValue = (r) => {
            if (salesMetric === 'value') return r.totalAmount;
            if (salesMetric === 'items') return r.items.length;
            if (salesMetric === 'units') return r.items.reduce((sum, item) => sum + (parseInt(item.dispenseQty) || 0), 0);
            return 0;
        };
        if (salesTimeframe === 'daily') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now); d.setDate(d.getDate() - i);
                labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
                const dayStart = new Date(d.setHours(0, 0, 0, 0));
                const dayEnd = new Date(d.setHours(23, 59, 59, 999));
                data.push(historyRecords.filter(r => { const rDate = new Date(r.timestamp); return rDate >= dayStart && rDate <= dayEnd; }).reduce((sum, r) => sum + getMetricValue(r), 0));
            }
        } else if (salesTimeframe === 'monthly') {
            for (let i = 5; i >= 0; i--) {
                const monthStart = new Date(currentMonthStart);
                monthStart.setMonth(monthStart.getMonth() - i);
                labels.push(monthStart.toLocaleDateString('en-US', { month: 'short' }));
                const monthEnd = new Date(monthStart); monthEnd.setMonth(monthEnd.getMonth() + 1); monthEnd.setDate(monthEnd.getDate() - 1); monthEnd.setHours(23, 59, 59, 999);
                data.push(historyRecords.filter(r => { const rDate = new Date(r.timestamp); return rDate >= monthStart && rDate <= monthEnd; }).reduce((sum, r) => sum + getMetricValue(r), 0));
            }
        } else if (salesTimeframe === 'weekly') {
            for (let i = 3; i >= 0; i--) {
                labels.push(`W-${i}`);
                const weekStart = new Date(currentWeekStart); weekStart.setDate(weekStart.getDate() - (i * 7));
                const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);
                data.push(historyRecords.filter(r => { const rDate = new Date(r.timestamp); return rDate >= weekStart && rDate <= weekEnd; }).reduce((sum, r) => sum + getMetricValue(r), 0));
            }
        }

        const rechartsData = labels.map((label, index) => ({
            name: label,
            value: data[index]
        }));

        const maxData = Math.max(...data, 10);
        return { labels, data, maxData, rechartsData };
    }, [historyRecords, salesTimeframe, salesMetric, currentWeekStart, currentMonthStart]);

    // TOP MEDICINES
    const topMedicines = useMemo(() => {
        const filteredRecords = historyRecords.filter(r => {
            const rDate = new Date(r.timestamp);
            if (topMedTimeframe === 'monthly') return rDate >= currentMonthStart;
            if (topMedTimeframe === 'weekly') return rDate >= currentWeekStart;
            return true;
        });
        const counts = {};
        filteredRecords.forEach(record => {
            record.items.forEach(item => {
                if (!counts[item.id]) counts[item.id] = { name: item.name, qty: 0, revenue: 0 };
                counts[item.id].qty += parseInt(item.dispenseQty) || 0;
                counts[item.id].revenue += (item.dispenseQty * item.price);
            });
        });
        const sorted = Object.values(counts).sort((a, b) => b.qty - a.qty).slice(0, 3);
        const colors = ['bg-[#f97316]', 'bg-slate-900', 'bg-[#a3e635]'];
        return sorted.map((item, idx) => ({ ...item, color: colors[idx % colors.length] }));
    }, [historyRecords, topMedTimeframe, currentWeekStart, currentMonthStart]);

    const displayMedicines = topMedicines.length > 0 ? topMedicines : [
        { name: 'No data', qty: 0, revenue: 0, color: 'bg-[#f97316]' },
        { name: 'No data', qty: 0, revenue: 0, color: 'bg-slate-900' },
        { name: 'No data', qty: 0, revenue: 0, color: 'bg-[#a3e635]' }
    ];
    const maxQty = Math.max(...displayMedicines.map(m => m.qty), 10);

    // TOP CATEGORIES
    const topCategoriesData = useMemo(() => {
        const counts = {};
        historyRecords.forEach(record => {
            record.items.forEach(item => {
                if (!counts[item.category]) counts[item.category] = { revenue: 0, items: 0, units: 0 };
                counts[item.category].revenue += (item.dispenseQty * item.price);
                counts[item.category].items += 1;
                counts[item.category].units += (parseInt(item.dispenseQty) || 0);
            });
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6).map(([name, data]) => ({ name, ...data }));
        const maxRev = Math.max(...sorted.map(c => c.revenue), 10);
        return { categories: sorted, maxRev };
    }, [historyRecords]);



    return (
        <div className="animate-in fade-in duration-300 space-y-6 pb-12">

            {/* Read-only banner for staff */}
            {!isAdmin && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl p-3 text-sm font-medium">
                    <Eye size={18} className="shrink-0 text-blue-500" />
                    <span>You are viewing the dashboard in <strong>read-only</strong> mode. Contact your administrator to make changes.</span>
                </div>
            )}

            {/* ROW 1: Key Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Dispensed Today</p>
                        <div className="flex items-end gap-3 mt-1">
                            <div><span className="text-3xl font-bold text-slate-800">{todaysStats.items}</span> <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Items</span></div>
                            <div className="w-px h-6 bg-slate-200 mb-1"></div>
                            <div><span className="text-3xl font-bold text-slate-800">{todaysStats.units}</span> <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Units</span></div>
                        </div>
                    </div>
                    <div className="bg-[#edf6f1] p-4 rounded-xl text-[#08834c]"><Pill size={28} /></div>
                </div>

                <div className="bg-slate-900 p-6 rounded-2xl shadow-sm flex items-center justify-between text-white relative">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <p className="text-sm text-slate-300 font-medium">Total Dispensed Value</p>
                            <select value={valueTimeframe} onChange={e => setValueTimeframe(e.target.value)} className="bg-slate-800 border-none text-xs text-slate-300 py-1 px-2 rounded-lg outline-none cursor-pointer focus:ring-1 focus:ring-slate-600 appearance-none">
                                <option value="today">Today</option>
                                <option value="weekly">This Week</option>
                                <option value="monthly">This Month</option>
                                <option value="all">All Time</option>
                            </select>
                        </div>
                        <h2 className="text-3xl font-bold text-white">Rs. {dynamicRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl text-[#a3e635]"><Banknote size={28} /></div>
                </div>
            </div>

            {/* ROW 2: Primary Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Sales Analytics Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-96">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">Dispensing Analytics</h3>
                            <p className="text-xs text-slate-500">Overview of your dispensing trends</p>
                        </div>
                        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto">
                            <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto no-scrollbar">
                                <button onClick={() => setSalesMetric('items')} className={`whitespace-nowrap flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-all ${salesMetric === 'items' ? 'bg-white shadow-sm text-[#08834c]' : 'text-slate-500 hover:text-slate-700'}`}>Items</button>
                                <button onClick={() => setSalesMetric('units')} className={`whitespace-nowrap flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-all ${salesMetric === 'units' ? 'bg-white shadow-sm text-[#08834c]' : 'text-slate-500 hover:text-slate-700'}`}>Units</button>
                                <button onClick={() => setSalesMetric('value')} className={`whitespace-nowrap flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-all ${salesMetric === 'value' ? 'bg-white shadow-sm text-[#08834c]' : 'text-slate-500 hover:text-slate-700'}`}>Value</button>
                            </div>
                            <select value={salesTimeframe} onChange={e => setSalesTimeframe(e.target.value)} className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#08834c] text-slate-600 outline-none cursor-pointer w-full sm:w-auto">
                                <option value="daily">Last 7 Days</option>
                                <option value="weekly">Last 4 Weeks</option>
                                <option value="monthly">Last 6 Months</option>
                            </select>
                        </div>
                    </div>

                    {/* ── RECHARTS RENDERING ─────────────────────────────────── */}
                    <div className="flex-1 w-full h-full min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'line' ? (
                                <LineChart data={salesChartData.rechartsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="lineColor" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#08834c" />
                                            <stop offset="100%" stopColor="#0ea5e9" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => value > 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => [salesMetric === 'value' ? `Rs. ${value.toLocaleString()}` : `${value.toLocaleString()}`, salesMetric.charAt(0).toUpperCase() + salesMetric.slice(1)]}
                                        labelStyle={{ color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}
                                    />
                                    <Line type="monotone" dataKey="value" stroke="url(#lineColor)" strokeWidth={4} dot={{ fill: '#fff', stroke: '#08834c', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#08834c', stroke: '#fff', strokeWidth: 2 }} />
                                </LineChart>
                            ) : chartType === 'area' ? (
                                <AreaChart data={salesChartData.rechartsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#08834c" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#08834c" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => value > 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => [salesMetric === 'value' ? `Rs. ${value.toLocaleString()}` : `${value.toLocaleString()}`, salesMetric.charAt(0).toUpperCase() + salesMetric.slice(1)]}
                                        labelStyle={{ color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#08834c" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" activeDot={{ r: 6, fill: '#08834c', stroke: '#fff', strokeWidth: 2 }} />
                                </AreaChart>
                            ) : (
                                <BarChart data={salesChartData.rechartsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="barColor" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#08834c" />
                                            <stop offset="100%" stopColor="#22c55e" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => value > 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value) => [salesMetric === 'value' ? `Rs. ${value.toLocaleString()}` : `${value.toLocaleString()}`, salesMetric.charAt(0).toUpperCase() + salesMetric.slice(1)]}
                                        labelStyle={{ color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}
                                    />
                                    <Bar dataKey="value" fill="url(#barColor)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Selling Medicine */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-96">
                    <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
                        <h3 className="font-bold text-lg text-slate-800 whitespace-nowrap">Top Dispensed</h3>
                        <select value={topMedTimeframe} onChange={e => setTopMedTimeframe(e.target.value)} className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#08834c] text-slate-600 outline-none cursor-pointer flex-1 min-w-[110px] max-w-full">
                            <option value="monthly">This Month</option>
                            <option value="weekly">This Week</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                    <div className="flex-1 flex justify-around items-end gap-2 relative">
                        {displayMedicines.map((med, idx) => (
                            <div key={idx} className="flex flex-col items-center w-1/3 h-full justify-end group relative pb-10">
                                <div className="absolute top-0 text-xs text-slate-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap">{med.qty} units</div>
                                <div className="w-full flex items-end justify-center h-full">
                                    <div className={`w-full max-w-[3.5rem] ${med.color} rounded-t-full rounded-b-full relative flex justify-center items-end pb-3 transition-all duration-700 hover:-translate-y-1 shadow-sm`}
                                        style={{ height: `${Math.max((med.qty / maxQty) * 100, 25)}%` }}>
                                        <div className="bg-white w-8 h-8 rounded-full flex items-center justify-center shadow-sm absolute bottom-2">
                                            <Pill size={14} className={idx === 0 ? 'text-[#f97316]' : idx === 1 ? 'text-slate-900' : 'text-[#a3e635]'} />
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-0 w-full text-center">
                                    <p className="text-xs font-bold text-slate-800 truncate px-1" title={med.name}>{med.name.split(' ')[0]}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Rs. {med.revenue.toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ROW 3: Top Categories */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg text-slate-800 mb-6">Top Categories <span className="text-sm font-normal text-slate-400 ml-2">By Value, Items & Units</span></h3>
                {topCategoriesData.categories.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <Package size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-lg">No revenue data yet.</p>
                        <p className="text-sm mt-1">Dispense items to populate categories.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-12 gap-y-8">
                        {topCategoriesData.categories.map((cat, idx) => {
                            const iconName = categoryMap[cat.name] || 'Package';
                            const Icon = AVAILABLE_ICONS[iconName] || Package;
                            return (
                                <div key={idx} className="group">
                                    <div className="flex justify-between items-end text-sm mb-1">
                                        <span className="font-medium text-slate-700 flex items-center gap-2"><Icon size={16} className="text-slate-400 group-hover:text-[#08834c] transition-colors" /> {cat.name}</span>
                                        <span className="font-bold text-slate-800">Rs. {cat.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                                        <span className="ml-6">{cat.items} items / {cat.units} units</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className="bg-[#08834c] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.max((cat.revenue / topCategoriesData.maxRev) * 100, 2)}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
