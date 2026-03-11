import React, { useState, useEffect } from 'react';
import { Pill, Search, ShoppingCart, XCircle, MinusCircle, PlusCircle, CheckCircle2, FileText, Clock, Eye, Pencil, Trash2, Lock } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { formatDisplayDate } from '../utils/helpers';

export const DispenseView = () => {
    const { isAdmin } = useAuth();
    const {
        inventory, setInventory,
        historyRecords, setHistoryRecords,
        cart, setCart,
        dispenseTab, setDispenseTab,
        dispenseSearch, setDispenseSearch,
        recordSearch, setRecordSearch,
        setViewingRecord, setEditingRecord, setRecordToDelete,
        showConfirm,
        refreshData
    } = useInventory();

    const dispenseFiltered = React.useMemo(() => {
        return inventory.filter(item => {
            const searchLower = dispenseSearch.trim().toLowerCase();
            return searchLower === '' ||
                item.name.toLowerCase().includes(searchLower) ||
                item.category.toLowerCase().includes(searchLower);
        });
    }, [inventory, dispenseSearch]);

    const filteredHistoryRecords = React.useMemo(() => {
        return historyRecords.filter(record => {
            if (!recordSearch) return true;
            return record.recordId.toString().includes(recordSearch);
        });
    }, [historyRecords, recordSearch]);

    const cartTotal = cart.reduce((sum, item) => {
        const qty = item.dispenseQty === '' ? 0 : parseInt(item.dispenseQty);
        return sum + (item.price * qty);
    }, 0);

    const addToCart = (product) => {
        if (product.quantity === 0) return;
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.dispenseQty >= product.quantity) return prev;
                return prev.map(item => item.id === product.id ? { ...item, dispenseQty: item.dispenseQty + 1 } : item);
            }
            return [...prev, { ...product, dispenseQty: 1 }];
        });
    };

    const updateCartQty = (id, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const currentQty = item.dispenseQty === '' ? 0 : parseInt(item.dispenseQty);
                const newQty = currentQty + delta;
                if (newQty < 1) return { ...item, dispenseQty: 1 };
                const stockProduct = inventory.find(i => i.id === id);
                if (newQty > stockProduct.quantity) return { ...item, dispenseQty: stockProduct.quantity };
                return { ...item, dispenseQty: newQty };
            }
            return item;
        }));
    };

    const handleQtyInputChange = (id, rawValue) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                if (rawValue === '') return { ...item, dispenseQty: '' };
                let newQty = parseInt(rawValue);
                if (isNaN(newQty)) return item;
                const stockProduct = inventory.find(i => i.id === id);
                if (newQty > stockProduct.quantity) newQty = stockProduct.quantity;
                return { ...item, dispenseQty: newQty };
            }
            return item;
        }));
    };

    const handleQtyBlur = (id) => {
        setCart(prev => prev.map(item => {
            if (item.id === id && (item.dispenseQty === '' || item.dispenseQty < 1)) {
                return { ...item, dispenseQty: 1 };
            }
            return item;
        }));
    };

    const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

    const processDispensing = async () => {
        if (cart.length === 0) return;
        const currentCartTotal = cart.reduce((sum, item) => {
            const qty = item.dispenseQty === '' ? 0 : parseInt(item.dispenseQty);
            return sum + (item.price * qty);
        }, 0);

        const recordId = Date.now().toString();
        const cartSnapshot = [...cart];

        // Optimistic: update local inventory immediately (reduce stock)
        setInventory(prev => prev.map(item => {
            const cartItem = cartSnapshot.find(c => c.id === item.id);
            if (cartItem) {
                const qty = cartItem.dispenseQty === '' ? 0 : parseInt(cartItem.dispenseQty);
                return { ...item, quantity: item.quantity - qty };
            }
            return item;
        }));

        // Optimistic: add to local history immediately
        setHistoryRecords(prev => [{
            recordId,
            timestamp: new Date().toISOString(),
            totalAmount: currentCartTotal,
            items: cartSnapshot.map(i => ({
                id: i.id,
                name: i.name,
                dispenseQty: i.dispenseQty === '' ? 0 : parseInt(i.dispenseQty),
                price: i.price
            }))
        }, ...prev]);

        // Clear cart instantly
        setCart([]);

        // Background sync
        import('../utils/supabaseActions').then(async ({ processDispensingSupabase }) => {
            await processDispensingSupabase(recordId, cartSnapshot, currentCartTotal);
            refreshData();
        }).catch(err => {
            console.error(err);
            refreshData();
        });
    };

    const openEditRecordModal = (record) => {
        const d = new Date(record.timestamp);
        let editTimestamp = "";
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            editTimestamp = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        setEditingRecord({ ...record, editTimestamp });
    };

    const handleClearAllHistory = () => {
        showConfirm(
            "Clear History",
            "Are you sure you want to permanently delete ALL dispensing records? This action cannot be undone.",
            () => {
                // Optimistic: Clear local history
                setHistoryRecords([]);

                // Background sync
                import('../utils/supabaseActions').then(async ({ deleteAllDispensingRecordsSupabase }) => {
                    await deleteAllDispensingRecordsSupabase();
                    refreshData();
                }).catch(err => {
                    console.error(err);
                    refreshData();
                });
            }
        );
    };

    const confirmDeleteRecord = (record) => {
        showConfirm(
            "Delete Record",
            "Are you sure you want to delete this dispensing record? The dispensed items will be restored to your inventory.",
            () => {
                // Optimistic: remove from local state
                setHistoryRecords(prev => prev.filter(r => r.recordId !== record.recordId));
                // Optimistic: restore stock
                setInventory(prev => prev.map(item => {
                    const dispensedItem = record.items.find(i => i.id === item.id);
                    if (dispensedItem) {
                        return { ...item, quantity: item.quantity + (parseInt(dispensedItem.dispenseQty) || 0) };
                    }
                    return item;
                }));

                // Background sync
                import('../utils/supabaseActions').then(({ deleteDispensingRecordSupabase }) => {
                    deleteDispensingRecordSupabase(record.recordId, record.items).catch(err => { 
                        console.error("Delete failed, restoring data:", err); 
                        refreshData(); 
                    });
                });
            }
        );
    };

    // --- PAGINATION ---
    const [historyPage, setHistoryPage] = useState(1);
    const historyItemsPerPage = 50;
    
    useEffect(() => {
        setHistoryPage(1);
    }, [recordSearch]);

    const totalHistoryPages = Math.ceil(filteredHistoryRecords.length / historyItemsPerPage);
    const paginatedHistory = filteredHistoryRecords.slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage);

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-12">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Dispense & Records</h2>
                <p className="text-sm text-slate-500 mt-1">Dispense medications to patients and manage your billing history</p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-4 border-b border-slate-200">
                <button onClick={() => setDispenseTab('create')} className={`pb-3 font-bold px-2 transition-colors ${dispenseTab === 'create' ? 'text-[#08834c] border-b-2 border-[#08834c]' : 'text-slate-500 hover:text-slate-800'}`}>New Dispense</button>
                <button onClick={() => setDispenseTab('history')} className={`pb-3 font-bold px-2 transition-colors ${dispenseTab === 'history' ? 'text-[#08834c] border-b-2 border-[#08834c]' : 'text-slate-500 hover:text-slate-800'}`}>Dispensing History</button>
            </div>

            {dispenseTab === 'create' ? (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[500px] lg:h-[calc(100vh-16rem)] h-auto">
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Pill className="text-[#08834c]" size={20} />Select Medication</h2>
                            <div className="relative">
                                <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Search medication..." value={dispenseSearch} onChange={(e) => setDispenseSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#08834c] shadow-sm" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-max custom-scrollbar">
                            {dispenseFiltered.slice(0, 60).map(item => (
                                <div key={item.id} onClick={() => addToCart(item)} className={`border ${item.quantity === 0 ? 'border-red-100 bg-red-50/30 opacity-60 cursor-not-allowed' : 'border-slate-100 hover:border-[#08834c] hover:shadow-md cursor-pointer'} p-4 rounded-xl transition-all flex justify-between items-center group`}>
                                    <div className="flex-1 min-w-0 pr-3">
                                        <h4 className="font-bold text-slate-800 truncate">{item.name}</h4>
                                        <p className="text-xs text-slate-500 truncate">{item.category}</p>
                                        <p className={`text-sm font-medium mt-1 ${item.quantity === 0 ? 'text-red-500' : 'text-slate-700'}`}>
                                            Stock: {item.quantity} {item.unit}
                                        </p>
                                    </div>
                                    <button className={`shrink-0 p-2 rounded-full ${item.quantity === 0 ? 'bg-red-100 text-red-500' : 'bg-[#edf6f1] text-[#08834c]'} transition-colors`}><PlusCircle size={20} /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full lg:w-[380px] xl:w-[450px] bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden shrink-0">
                        <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Pill size={20} /> Dispensing Panel</h2>
                            <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-medium">{cart.length} items</span>
                        </div>
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 custom-scrollbar bg-slate-50/30">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 p-8 text-center"><ShoppingCart size={48} className="mb-4" /><p>Cart is empty.</p></div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group">
                                        <button onClick={() => removeFromCart(item.id)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-md z-10" title="Remove from order">
                                            <XCircle size={18} />
                                        </button>
                                        <div className="pr-7 min-w-0">
                                            <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                                            <p className="text-xs text-slate-500 mb-3 truncate">Rs. {item.price.toFixed(2)} / {item.unit}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 gap-2">
                                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
                                                <button onClick={() => updateCartQty(item.id, -1)} className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"><MinusCircle size={18} /></button>
                                                <input type="number" min="1" value={item.dispenseQty} onChange={(e) => handleQtyInputChange(item.id, e.target.value)} onBlur={() => handleQtyBlur(item.id)} className="font-bold text-slate-800 w-12 sm:w-16 text-center focus:outline-none bg-transparent" />
                                                <button onClick={() => updateCartQty(item.id, 1)} className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"><PlusCircle size={18} /></button>
                                            </div>
                                            <span className="font-bold text-slate-800">Rs. {(item.price * (item.dispenseQty === '' ? 0 : item.dispenseQty)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-white shrink-0">
                            <div className="flex justify-between items-center mb-4"><span className="text-slate-500">Total Amount</span><span className="text-2xl font-bold text-slate-800">Rs. {cartTotal.toFixed(2)}</span></div>
                            <button onClick={processDispensing} disabled={cart.length === 0} className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${cart.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#08834c] text-white hover:bg-[#076c3e] hover:shadow-md'}`}><CheckCircle2 size={20} />Dispense & Bill</button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <h3 className="font-bold text-lg text-slate-800">Order History</h3>
                            {historyRecords.length > 0 && isAdmin && (
                                <button
                                    onClick={handleClearAllHistory}
                                    className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors px-3 py-1 bg-red-50 rounded-lg hover:bg-red-100"
                                >
                                    <Trash2 size={14} /> Clear All History
                                </button>
                            )}
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by Record ID..."
                                value={recordSearch}
                                onChange={(e) => setRecordSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#08834c] shadow-sm"
                            />
                        </div>
                    </div>

                    {filteredHistoryRecords.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-slate-400">
                            <FileText size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="text-lg">No matching dispensing records found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 text-slate-500 text-sm border-b border-slate-100">
                                        <th className="p-4 font-medium">Record ID</th>
                                        <th className="p-4 font-medium">Date & Time</th>
                                        <th className="p-4 font-medium">Items & Units</th>
                                        <th className="p-4 font-medium">Total Billed</th>
                                        <th className="p-4 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedHistory.map(record => (
                                        <tr key={record.recordId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-sm font-bold text-slate-800">#{record.recordId.toString().slice(-6)}</td>
                                            <td className="p-4 text-sm text-slate-600 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Clock size={14} className="text-slate-400" />
                                                    {formatDisplayDate(record.timestamp)}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-600">
                                                {record.items.length} items <span className="text-slate-400 text-xs ml-1">({record.items.reduce((s, i) => s + (parseInt(i.dispenseQty) || 0), 0)} units)</span>
                                            </td>
                                            <td className="p-4 font-bold text-[#08834c]">Rs. {record.totalAmount.toFixed(2)}</td>
                                            <td className="p-4 text-right flex items-center justify-end gap-2">
                                                <button onClick={() => setViewingRecord(record)} className="p-2 text-slate-400 hover:text-[#08834c] hover:bg-[#edf6f1] rounded-lg transition-colors" title="View Details"><Eye size={18} /></button>
                                                {isAdmin && (
                                                    <button onClick={() => openEditRecordModal(record)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Record"><Pencil size={18} /></button>
                                                )}
                                                {isAdmin && (
                                                    <button onClick={() => confirmDeleteRecord(record)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Record"><Trash2 size={18} /></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {/* Pagination Controls */}
                    {totalHistoryPages > 1 && (
                        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-2xl">
                            <span className="text-sm text-slate-500 font-medium">
                                Showing {((historyPage - 1) * historyItemsPerPage) + 1} to {Math.min(historyPage * historyItemsPerPage, filteredHistoryRecords.length)} of {filteredHistoryRecords.length} entries
                            </span>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))} 
                                    disabled={historyPage === 1} 
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-sm font-bold text-slate-700 mx-2">
                                    Page {historyPage} of {totalHistoryPages}
                                </span>
                                <button 
                                    onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))} 
                                    disabled={historyPage === totalHistoryPages || totalHistoryPages === 0} 
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
