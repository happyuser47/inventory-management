import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Package, AlertTriangle, XCircle, Banknote, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { AVAILABLE_ICONS } from '../utils/data';

export const InventoryView = () => {
    const {
        inventory,
        categoryMap,
        hiddenCategories,
        statusFilter, setStatusFilter,
        categoryFilter, setCategoryFilter,
        categoryViewMode, setCategoryViewMode,
        dashboardSearch, setDashboardSearch,
        setIsReceivingModalOpen,
        setViewingProduct,
        setEditingProduct,
        setEditForm,
        showConfirm,
        setInventory, setCart, refreshData
    } = useInventory();

    const confirmDelete = (item) => {
        showConfirm(
            "Delete Product",
            `Are you sure you want to delete ${item.name}? This action cannot be undone.`,
            () => {
                // Optimistic: remove from local state IMMEDIATELY
                setInventory(prev => prev.filter(i => i.id !== item.id));
                setCart(prev => prev.filter(i => i.id !== item.id));

                import('../utils/supabaseActions').then(({ deleteStockFromSupabase }) => {
                    // Background sync (do not refresh data on success to prevent UI bounce)
                    deleteStockFromSupabase(item.id).catch(err => { 
                        console.error("Delete failed, restoring data:", err); 
                        refreshData(); // Only refresh if it failed to restore state
                    });
                });
            }
        );
    };

    const totalProducts = inventory.length;
    const lowStockCount = useMemo(() => inventory.filter(i => i.quantity > 0 && i.quantity <= i.threshold).length, [inventory]);
    const outOfStockCount = useMemo(() => inventory.filter(i => i.quantity === 0).length, [inventory]);

    const getStatus = (item) => {
        if (item.quantity === 0) return { label: 'Out of stock', color: 'bg-red-100 text-red-700' };
        if (item.quantity <= item.threshold) return { label: 'Low stock', color: 'bg-yellow-100 text-yellow-700' };
        return { label: 'In stock', color: 'bg-green-100 text-green-700' };
    };

    const dashboardFiltered = useMemo(() => {
        return inventory.filter(item => {
            const searchLower = dashboardSearch.trim().toLowerCase();
            const matchesSearch = searchLower === '' ||
                item.name.toLowerCase().includes(searchLower) ||
                item.category.toLowerCase().includes(searchLower);

            let matchesStatus = true;
            if (statusFilter === 'low') matchesStatus = item.quantity > 0 && item.quantity <= item.threshold;
            if (statusFilter === 'out') matchesStatus = item.quantity === 0;
            if (statusFilter === 'in') matchesStatus = item.quantity > item.threshold;

            let matchesCategory = true;
            if (categoryFilter !== 'All') {
                matchesCategory = item.category === categoryFilter;
            }

            return matchesSearch && matchesStatus && matchesCategory;
        });
    }, [inventory, dashboardSearch, statusFilter, categoryFilter]);

    const categoryStats = useMemo(() => {
        const stats = {};
        Object.keys(categoryMap).forEach(cat => {
            stats[cat] = { units: 0, products: 0, value: 0 };
        });
        inventory.forEach(item => {
            if (!stats[item.category]) {
                stats[item.category] = { units: 0, products: 0, value: 0 };
            }
            stats[item.category].units += item.quantity;
            stats[item.category].products += 1;
            stats[item.category].value += (item.quantity * item.price);
        });
        return stats;
    }, [inventory, categoryMap]);

    const totalInventoryValue = useMemo(() => {
        return inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    }, [inventory]);

    const handleEditClick = (item) => {
        setEditingProduct(item);
        setEditForm({ ...item });
    };

    // --- PAGINATION ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    
    useEffect(() => {
        setCurrentPage(1);
    }, [dashboardSearch, statusFilter, categoryFilter, categoryViewMode]);

    const totalPages = Math.ceil(dashboardFiltered.length / itemsPerPage);
    const paginatedInventory = dashboardFiltered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="space-y-8 animate-in fade-in duration-300 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Inventory Management</h2>
                    <p className="text-sm text-slate-500 mt-1">Manage and track your clinic's stock</p>
                </div>
                <button onClick={() => setIsReceivingModalOpen(true)} className="w-full sm:w-auto bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"><Plus size={20} />Receive New Stock</button>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                <div onClick={() => setStatusFilter('all')} className={`p-5 lg:p-6 rounded-2xl shadow-sm border flex items-center justify-between cursor-pointer transition-all ${statusFilter === 'all' ? 'bg-[#edf6f1] border-[#acdabb] ring-2 ring-[#d3ebd9]' : 'bg-white border-slate-100 hover:border-[#acdabb]'}`}>
                    <div className="min-w-0 pr-3"><p className="text-sm text-slate-500 font-medium mb-1 truncate">Total Items</p><h2 className="text-2xl xl:text-3xl font-bold text-slate-800 truncate">{totalProducts}</h2></div>
                    <div className="bg-slate-50 p-3 lg:p-4 rounded-full text-slate-600 shrink-0"><Package size={24} className="lg:w-7 lg:h-7" /></div>
                </div>
                <div onClick={() => setStatusFilter('low')} className={`p-5 lg:p-6 rounded-2xl shadow-sm border flex items-center justify-between cursor-pointer transition-all ${statusFilter === 'low' ? 'bg-yellow-50 border-yellow-200 ring-2 ring-yellow-100' : 'bg-white border-slate-100 hover:border-yellow-200'}`}>
                    <div className="min-w-0 pr-3"><p className="text-sm text-slate-500 font-medium mb-1 truncate">Low Stock Items</p><h2 className="text-2xl xl:text-3xl font-bold text-yellow-600 truncate">{lowStockCount}</h2></div>
                    <div className="bg-yellow-50 p-3 lg:p-4 rounded-full text-yellow-600 shrink-0"><AlertTriangle size={24} className="lg:w-7 lg:h-7" /></div>
                </div>
                <div onClick={() => setStatusFilter('out')} className={`p-5 lg:p-6 rounded-2xl shadow-sm border flex items-center justify-between cursor-pointer transition-all ${statusFilter === 'out' ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : 'bg-white border-slate-100 hover:border-red-200'}`}>
                    <div className="min-w-0 pr-3"><p className="text-sm text-slate-500 font-medium mb-1 truncate">Out of Stock</p><h2 className="text-2xl xl:text-3xl font-bold text-red-600 truncate">{outOfStockCount}</h2></div>
                    <div className="bg-red-50 p-3 lg:p-4 rounded-full text-red-600 shrink-0"><XCircle size={24} className="lg:w-7 lg:h-7" /></div>
                </div>
                <div className="p-5 lg:p-6 rounded-2xl shadow-sm border flex items-center justify-between bg-white border-slate-100">
                    <div className="flex-1 min-w-0 pr-3"><p className="text-sm text-slate-500 font-medium mb-1 truncate">Total Stock Value</p><h2 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#08834c] truncate" title={`Rs. ${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>Rs. {totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2></div>
                    <div className="bg-[#edf6f1] p-3 lg:p-4 rounded-full text-[#08834c] shrink-0"><Banknote size={24} className="lg:w-7 lg:h-7" /></div>
                </div>
            </div>

            {/* Therapeutic Categories */}
            <div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Therapeutic Categories</h3>
                    <div className="flex bg-slate-200/50 p-1 rounded-lg w-full md:w-auto overflow-x-auto custom-scrollbar">
                        <button onClick={() => setCategoryViewMode('products')} className={`whitespace-nowrap px-4 py-1.5 text-sm font-medium rounded-md transition-all ${categoryViewMode === 'products' ? 'bg-white shadow-sm text-[#08834c]' : 'text-slate-500 hover:text-slate-700'}`}>Products</button>
                        <button onClick={() => setCategoryViewMode('units')} className={`whitespace-nowrap px-4 py-1.5 text-sm font-medium rounded-md transition-all ${categoryViewMode === 'units' ? 'bg-white shadow-sm text-[#08834c]' : 'text-slate-500 hover:text-slate-700'}`}>Total Units</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
                    {Object.entries(categoryStats).filter(([cat]) => !hiddenCategories.includes(cat)).map(([cat, stats], idx) => {
                        const iconName = categoryMap[cat] || 'Package';
                        const Icon = AVAILABLE_ICONS[iconName] || Package;
                        const isPrimary = categoryFilter === cat;

                        let displayValue = stats.products;
                        let displayLabel = 'products';
                        if (categoryViewMode === 'units') {
                            displayValue = stats.units;
                            displayLabel = 'total units';
                        }

                        return (
                            <div key={cat} onClick={() => setCategoryFilter(prev => prev === cat ? 'All' : cat)} className={`${isPrimary ? 'bg-[#08834c] text-white shadow-md ring-2 ring-[#08834c] ring-offset-1' : 'bg-white text-slate-800 border border-slate-100 hover:border-[#08834c]'} p-5 rounded-2xl shadow-sm relative overflow-hidden group cursor-pointer transition-all duration-200 flex flex-col justify-between h-full`}>
                                <div className="flex justify-between items-start mb-4 gap-2">
                                    <h4 className={`font-medium leading-tight ${isPrimary ? 'text-[#edf6f1]' : 'text-slate-600'}`}>{cat}</h4>
                                    <div className={`${isPrimary ? 'bg-white/20' : 'bg-slate-50'} p-2 rounded-full shrink-0`}><Icon size={18} className={isPrimary ? 'text-white' : 'text-slate-400'} /></div>
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-xl xl:text-2xl font-bold truncate mb-0.5" title={displayValue}>{displayValue}</h2>
                                    <span className={`text-xs xl:text-sm font-normal ${isPrimary ? 'text-[#acdabb]' : 'text-slate-400'}`}>{displayLabel}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Product List Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">Product List {categoryFilter !== 'All' && <span className="text-sm font-medium bg-[#edf6f1] text-[#08834c] px-3 py-1 rounded-lg">{categoryFilter}<button onClick={() => setCategoryFilter('All')} className="ml-2 hover:text-red-500"><XCircle size={14} className="inline mb-0.5" /></button></span>}</h3>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#08834c] text-slate-600 outline-none w-full sm:w-auto">
                            <option value="all">All Status</option>
                            <option value="in">In Stock</option>
                            <option value="low">Low Stock</option>
                            <option value="out">Out of Stock</option>
                        </select>
                        <div className="relative w-full sm:w-auto">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Search product..." value={dashboardSearch} onChange={(e) => setDashboardSearch(e.target.value)} className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#08834c]" />
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-500 text-sm border-b border-slate-100">
                                <th className="p-4 font-medium">Product Name</th>
                                <th className="p-4 font-medium">Quantity</th>
                                <th className="p-4 font-medium">Price/Unit</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedInventory.map(item => {
                                const status = getStatus(item);
                                return (
                                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-sm font-medium text-slate-800">{item.name}</td>
                                        <td className="p-4 text-sm text-slate-600">{item.quantity} <span className="text-slate-400 text-xs">{item.unit}</span></td>
                                        <td className="p-4 text-sm text-slate-600">Rs. {item.price.toFixed(2)}</td>
                                        <td className="p-4"><span className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span></td>
                                        <td className="p-4 flex items-center justify-end gap-2">
                                            <button onClick={() => setViewingProduct(item)} className="p-2 text-slate-400 hover:text-[#08834c] rounded-lg hover:bg-[#edf6f1]" title="View Details"><Eye size={16} /></button>
                                            <button onClick={() => handleEditClick(item)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="Edit Product"><Pencil size={16} /></button>
                                            <button onClick={() => confirmDelete(item)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete Product"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-2xl">
                        <span className="text-sm text-slate-500 font-medium">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, dashboardFiltered.length)} of {dashboardFiltered.length} entries
                        </span>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                disabled={currentPage === 1} 
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-sm font-bold text-slate-700 mx-2">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                disabled={currentPage === totalPages || totalPages === 0} 
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
