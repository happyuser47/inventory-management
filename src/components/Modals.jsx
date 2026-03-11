import React from 'react';
import { XCircle, ClipboardCheck, Trash2, PlusCircle, MinusCircle, Package, AlertTriangle, Search, CheckCircle } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatDisplayDate } from '../utils/helpers';
import { AVAILABLE_ICONS } from '../utils/data';
import {
    receivePOSupabase, addCategoryToSupabase, updateCategoryToSupabase,
    updateStockQuantityToSupabase, deleteDispensingRecordSupabase,
    updateStockToSupabase, addStockToSupabase
} from '../utils/supabaseActions';

export const Modals = () => {
    const {
        inventory, setInventory,
        historyRecords, setHistoryRecords,
        poHistory, setPoHistory,
        categoryMap, setCategoryMap,
        setCart,
        setCategoryFilter,
        hiddenCategories, setHiddenCategories,
        receivingPO, setReceivingPO,
        viewingPO, setViewingPO,
        isCategoryModalOpen, setIsCategoryModalOpen,
        categoryModalMode, setCategoryModalMode,
        categoryForm, setCategoryForm,
        editingRecord, setEditingRecord,
        viewingRecord, setViewingRecord,
        viewingProduct, setViewingProduct,
        editingProduct, setEditingProduct,
        editForm, setEditForm,
        isReceivingModalOpen, setIsReceivingModalOpen,
        receiveMode, setReceiveMode,
        receiveForm, setReceiveForm,
        confirmModal, showConfirm, closeConfirm,
        refreshData
    } = useInventory();

    const [searchQuery, setSearchQuery] = React.useState(''); // Used for receiving stock modal dropdown filter

    // --- HANDLERS ---
    const handleReceivingQtyChange = (itemId, val) => {
        setReceivingPO(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id === itemId) {
                    let newQty = parseInt(val);
                    if (isNaN(newQty)) newQty = 0;
                    return { ...item, receivedQty: newQty };
                }
                return item;
            })
        }));
    };

    const confirmReceivePO = async (e) => {
        e.preventDefault();
        if (!receivingPO) return;
        const po = receivingPO;

        // Optimistic: update local inventory immediately
        setInventory(prev => prev.map(item => {
            const poItem = po.items.find(i => i.id === item.id);
            if (poItem && poItem.receivedQty > 0) {
                return { ...item, quantity: item.quantity + poItem.receivedQty };
            }
            return item;
        }));
        // Optimistic: update PO status in local history
        setPoHistory(prev => prev.map(p =>
            p.poId === po.poId ? { ...p, status: 'Completed', completionDate: new Date().toISOString(), items: po.items } : p
        ));
        setReceivingPO(null);

        // Background sync
        receivePOSupabase(po.poId, po.items)
            .then(() => refreshData())
            .catch(err => { console.error(err); refreshData(); });
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        const { oldName, name, icon } = categoryForm;
        const trimmedName = name.trim();
        if (!trimmedName) return;

        if (categoryModalMode === 'add') {
            if (categoryMap[trimmedName]) { alert("Category name already exists!"); return; }
            // Optimistic
            setCategoryMap(prev => ({ ...prev, [trimmedName]: icon }));
            setIsCategoryModalOpen(false);
            addCategoryToSupabase(trimmedName, icon).then(() => refreshData()).catch(err => { console.error(err); refreshData(); });
        } else {
            if (oldName !== trimmedName && categoryMap[trimmedName]) {
                showConfirm("Category Exists", "This category name already exists. Please choose a different name.", null, 'amber');
                return;
            }
            // Optimistic
            setCategoryMap(prev => {
                const newMap = { ...prev };
                delete newMap[oldName];
                newMap[trimmedName] = icon;
                return newMap;
            });
            setIsCategoryModalOpen(false);
            updateCategoryToSupabase(oldName, trimmedName, icon).then(() => refreshData()).catch(err => { console.error(err); refreshData(); });
        }
    };

    const handleEditRecordQty = (itemId, delta) => {
        setEditingRecord(prev => {
            const updatedItems = prev.items.map(item => {
                if (item.id === itemId) {
                    const currentQty = parseInt(item.dispenseQty) || 0;
                    const newQty = Math.max(1, currentQty + delta);
                    return { ...item, dispenseQty: newQty };
                }
                return item;
            });
            const newTotal = updatedItems.reduce((sum, i) => sum + (i.price * i.dispenseQty), 0);
            return { ...prev, items: updatedItems, totalAmount: newTotal };
        });
    };

    const handleRemoveItemFromRecord = (itemId) => {
        setEditingRecord(prev => {
            const updatedItems = prev.items.filter(item => item.id !== itemId);
            const newTotal = updatedItems.reduce((sum, i) => sum + (i.price * i.dispenseQty), 0);
            return { ...prev, items: updatedItems, totalAmount: newTotal };
        });
    };

    const handleAddItemToRecord = (e) => {
        const productId = e.target.value;
        if (!productId) return;

        const productToAdd = inventory.find(p => p.id === productId);
        if (!productToAdd) return;

        setEditingRecord(prev => {
            if (prev.items.some(i => i.id === productId)) return prev;

            const newItem = { ...productToAdd, dispenseQty: 1 };
            const updatedItems = [...prev.items, newItem];
            const newTotal = updatedItems.reduce((sum, i) => sum + (i.price * i.dispenseQty), 0);

            return { ...prev, items: updatedItems, totalAmount: newTotal };
        });
    };

    const saveRecordEdits = async () => {
        if (editingRecord.items.length === 0) {
            showConfirm("Record Error", "A record cannot have 0 items. Please delete the record instead if needed.", null, 'amber');
            return;
        }

        const record = editingRecord;
        const newTotal = record.items.reduce((sum, i) => sum + (i.price * i.dispenseQty), 0);

        // Optimistic: update local history
        setHistoryRecords(prev => prev.map(r =>
            r.recordId === record.recordId ? { ...r, items: record.items, totalAmount: newTotal, timestamp: new Date(record.editTimestamp).toISOString() } : r
        ));
        setEditingRecord(null);

        // Background sync
        const oldItems = historyRecords.find(r => r.recordId === record.recordId)?.items || [];
        deleteDispensingRecordSupabase(record.recordId, oldItems).then(async () => {
            const { processDispensingSupabase } = await import('../utils/supabaseActions');
            await processDispensingSupabase(record.recordId, record.items, newTotal, record.editTimestamp);
            refreshData();
        }).catch(err => { console.error(err); refreshData(); });
    };

    const handleUpdateProduct = async (e) => {
        e.preventDefault();
        const updatedItem = {
            ...editForm,
            quantity: parseInt(editForm.quantity),
            price: parseFloat(editForm.price),
            threshold: parseInt(editForm.threshold)
        };

        // Optimistic: update local state immediately
        setInventory(prev => prev.map(i =>
            i.id === updatedItem.id ? { ...i, ...updatedItem } : i
        ));
        setCart(prev => prev.map(item =>
            item.id === editForm.id ? { ...item, name: editForm.name, category: editForm.category, unit: editForm.unit, price: parseFloat(editForm.price) } : item
        ));
        setEditingProduct(null);
        setEditForm(null);

        // Background sync
        updateStockToSupabase(updatedItem).then(() => refreshData()).catch(err => { console.error(err); refreshData(); });
    };

    const handleReceiveStock = async (e) => {
        e.preventDefault();

        let qty = parseInt(receiveForm.quantity);
        let price = parseFloat(receiveForm.price);

        if (receiveMode === 'existing') {
            const currentItem = inventory.find(i => i.id === receiveForm.id);
            if (currentItem) {
                // Optimistic: update quantity immediately
                setInventory(prev => prev.map(i =>
                    i.id === receiveForm.id ? { ...i, quantity: i.quantity + qty } : i
                ));
                setIsReceivingModalOpen(false);
                setReceiveForm({ id: '', name: '', category: Object.keys(categoryMap)[0] || 'Others', quantity: '', price: '', unit: 'Tablets', threshold: '50' });
                setReceiveMode('existing');

                // Background sync
                updateStockQuantityToSupabase(receiveForm.id, currentItem.quantity + qty).then(() => refreshData()).catch(err => { console.error(err); refreshData(); });
            }
        } else {
            // Anti-duplicate protection: Error out if name already exists
            const trimmedName = receiveForm.name.trim();
            const existingItem = inventory.find(i => i.name.toLowerCase() === trimmedName.toLowerCase());
            
            if (existingItem) {
                 showConfirm(
                    "Duplicate Medicine",
                    `A medicine named "${existingItem.name}" already exists. Please use the 'Existing' tab to securely add stock to it.`,
                    null,
                    'amber'
                );
                return;
            }

            const newId = `#MED${Math.floor(1000 + Math.random() * 9000)}`;
            const newItem = {
                id: newId,
                name: trimmedName,
                category: receiveForm.category,
                quantity: qty,
                price: price,
                unit: receiveForm.unit,
                threshold: parseInt(receiveForm.threshold),
                created_at: new Date().toISOString()
            };

            // Optimistic: add to local inventory immediately
            setInventory(prev => [newItem, ...prev]);
            setIsReceivingModalOpen(false);
            setReceiveForm({ id: '', name: '', category: Object.keys(categoryMap)[0] || 'Others', quantity: '', price: '', unit: 'Tablets', threshold: '50' });
            setReceiveMode('existing');

            // Background sync
            addStockToSupabase(newItem).then(() => refreshData()).catch(err => { console.error(err); refreshData(); });
        }
    };

    // --- RENDERING MODALS ---
    return (
        <>
            {receivingPO && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">
                                    {receivingPO.status === 'Completed' ? 'Edit Received Order' : 'Receive Order'}: {receivingPO.poId}
                                </h3>
                                <p className="text-sm text-slate-500">Confirm or edit the actual received quantities before updating stock.</p>
                            </div>
                            <button onClick={() => setReceivingPO(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
                        </div>

                        <form onSubmit={confirmReceivePO}>
                            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
                                <div className="grid grid-cols-12 gap-4 px-4 pb-2 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    <div className="col-span-6">Product</div>
                                    <div className="col-span-3 text-center">Ordered</div>
                                    <div className="col-span-3 text-center">Actual Received</div>
                                </div>

                                {receivingPO.items.map(item => (
                                    <div key={item.id} className="grid grid-cols-12 gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="col-span-6 pr-4">
                                            <p className="text-sm font-bold text-slate-800">{item.name}</p>
                                            <p className="text-xs text-slate-500">Stock: {inventory.find(i => i.id === item.id)?.quantity || 0} {item.unit}</p>
                                        </div>
                                        <div className="col-span-3 text-center">
                                            <span className="font-bold text-slate-500">{item.orderQty}</span>
                                        </div>
                                        <div className="col-span-3">
                                            <div className="bg-white border border-slate-200 rounded-lg p-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.receivedQty}
                                                    onChange={(e) => handleReceivingQtyChange(item.id, e.target.value)}
                                                    className="font-bold text-[#08834c] w-full text-center focus:outline-none"
                                                />
                                            </div>
                                            {item.receivedQty !== item.orderQty && (
                                                <p className="text-[10px] text-yellow-600 text-center mt-1">Edited</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                                <p className="text-sm text-slate-500">Items with 0 received will not update stock.</p>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setReceivingPO(null)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                                    <button type="submit" className="px-6 py-2.5 bg-[#08834c] text-white font-bold rounded-xl shadow-md hover:bg-[#076c3e] flex items-center gap-2">
                                        <ClipboardCheck size={18} /> {receivingPO.status === 'Completed' ? 'Update Inventory' : 'Confirm Delivery'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewingPO && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Purchase Order Details</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-sm text-slate-500 font-medium">{viewingPO.poId}</p>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${viewingPO.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {viewingPO.status}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setViewingPO(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="flex flex-col sm:flex-row justify-between text-sm text-slate-500 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 gap-4">
                                <div><span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Created Date</span>{formatDisplayDate(viewingPO.date)}</div>
                                {viewingPO.completionDate && <div><span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Completed Date</span>{formatDisplayDate(viewingPO.completionDate)}</div>}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-xs uppercase text-slate-400 tracking-wider">
                                            <th className="py-3 pr-4 font-bold">Product</th>
                                            <th className="py-3 px-3 text-center font-bold">Ordered</th>
                                            {viewingPO.status === 'Completed' && <th className="py-3 px-3 text-center font-bold">Received</th>}
                                            <th className="py-3 px-3 text-right font-bold">Unit Price</th>
                                            <th className="py-3 pl-4 text-right font-bold">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewingPO.items.map(item => {
                                            const effectiveQty = viewingPO.status === 'Completed' ? (item.receivedQty || 0) : item.orderQty;
                                            const itemTotal = effectiveQty * (item.price || 0);
                                            return (
                                                <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                                    <td className="py-4 pr-4">
                                                        <p className="font-bold text-slate-800">{item.name}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{item.category}</p>
                                                    </td>
                                                    <td className="py-4 px-3 text-center font-medium text-slate-600 bg-slate-50/50">{item.orderQty} {item.unit}</td>
                                                    {viewingPO.status === 'Completed' && (
                                                        <td className="py-4 px-3 text-center font-bold text-[#08834c] bg-[#edf6f1]/50">
                                                            {item.receivedQty} {item.unit}
                                                        </td>
                                                    )}
                                                    <td className="py-4 px-3 text-right text-slate-600 font-medium">Rs. {(item.price || 0).toFixed(2)}</td>
                                                    <td className="py-4 pl-4 text-right font-bold text-slate-800">Rs. {itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative z-10">
                            <span className="text-slate-500 font-medium">{viewingPO.status === 'Completed' ? 'Final Order Value' : 'Estimated Order Value'}</span>
                            <span className="text-2xl sm:text-3xl font-bold text-[#08834c]">
                                Rs. {viewingPO.items.reduce((sum, i) => sum + ((i.price || 0) * (viewingPO.status === 'Completed' ? (i.receivedQty || 0) : i.orderQty)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">{categoryModalMode === 'add' ? 'Add New Category' : 'Edit Category'}</h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
                        </div>
                        <form onSubmit={handleSaveCategory} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Category Name</label>
                                <input
                                    type="text"
                                    required
                                    value={categoryForm.name}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                    placeholder="e.g., Diagnostics"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                                    Select Icon
                                    {categoryModalMode === 'edit' && <span className="text-xs font-normal text-slate-400 font-normal">Renaming updates all matching items</span>}
                                </label>
                                <div className="grid grid-cols-5 gap-2 max-h-[180px] overflow-y-auto custom-scrollbar p-1">
                                    {Object.keys(AVAILABLE_ICONS).map(iconKey => {
                                        const IconComp = AVAILABLE_ICONS[iconKey];
                                        const isSelected = categoryForm.icon === iconKey;
                                        return (
                                            <button
                                                key={iconKey}
                                                type="button"
                                                onClick={() => setCategoryForm({ ...categoryForm, icon: iconKey })}
                                                className={`p-3 rounded-xl flex items-center justify-center border transition-all ${isSelected ? 'border-[#08834c] bg-[#edf6f1] text-[#08834c] ring-2 ring-[#08834c]/20' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                <IconComp size={20} />
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-[#08834c] text-white font-bold rounded-xl shadow-lg hover:bg-[#076c3e]">Save Category</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingRecord && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 mb-1">Edit Dispensing Record</h3>
                                <input
                                    type="datetime-local"
                                    value={editingRecord.editTimestamp}
                                    onChange={(e) => setEditingRecord({ ...editingRecord, editTimestamp: e.target.value })}
                                    className="text-sm text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#08834c]"
                                />
                            </div>
                            <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
                        </div>

                        <div className="p-6">
                            <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <PlusCircle size={14} className="text-[#08834c]" /> Add missing item
                                </label>
                                <select
                                    onChange={handleAddItemToRecord}
                                    value=""
                                    className="w-full bg-white border border-slate-200 rounded-lg text-sm px-3 py-2.5 focus:ring-2 focus:ring-[#08834c] outline-none"
                                >
                                    <option value="">Select a medication to add to this record...</option>
                                    {inventory.map(inv => {
                                        if (editingRecord.items.some(i => i.id === inv.id)) return null;
                                        return <option key={inv.id} value={inv.id}>{inv.name} - Rs. {inv.price.toFixed(2)} / {inv.unit}</option>
                                    })}
                                </select>
                            </div>

                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {editingRecord.items.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{item.name}</p>
                                            <p className="text-xs text-slate-500">Rs. {item.price.toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
                                                <button onClick={() => handleEditRecordQty(item.id, -1)} className="p-1 hover:bg-slate-100 rounded text-slate-600"><MinusCircle size={18} /></button>
                                                <span className="font-bold text-slate-800 w-8 text-center">{item.dispenseQty}</span>
                                                <button onClick={() => handleEditRecordQty(item.id, 1)} className="p-1 hover:bg-slate-100 rounded text-slate-600"><PlusCircle size={18} /></button>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveItemFromRecord(item.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                                                title="Remove this item from record"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 flex justify-between items-center p-4 bg-[#edf6f1] rounded-xl border border-[#acdabb]">
                                <span className="font-medium text-slate-600">Corrected Total Billed</span>
                                <span className="text-2xl font-bold text-[#08834c]">Rs. {editingRecord.totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button onClick={() => setEditingRecord(null)} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-xl border border-slate-200">Cancel</button>
                            <button onClick={saveRecordEdits} className="flex-1 py-3 bg-[#08834c] text-white font-bold rounded-xl shadow-lg hover:bg-[#076c3e]">Save Corrections</button>
                        </div>
                    </div>
                </div>
            )}

            {viewingRecord && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">Record Summary</h3>
                            <button onClick={() => setViewingRecord(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
                        </div>
                        <div className="p-6">
                            <div className="mb-4 text-sm text-slate-500 font-medium">Dispensed on: {formatDisplayDate(viewingRecord.timestamp)}</div>
                            <div className="space-y-2">
                                {viewingRecord.items.map(item => (
                                    <div key={item.id} className="flex justify-between text-sm py-2 border-b border-slate-50">
                                        <span className="text-slate-600">{item.name} x {item.dispenseQty}</span>
                                        <span className="font-bold text-slate-800">Rs. {(item.price * item.dispenseQty).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 flex justify-between text-lg font-bold">
                                <span>Total Amount</span>
                                <span className="text-[#08834c]">Rs. {viewingRecord.totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="p-4 flex justify-end">
                            <button onClick={() => setViewingRecord(null)} className="px-6 py-2 bg-slate-200 text-slate-800 font-medium rounded-xl">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {viewingProduct && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-lg text-slate-800">Product Details</h3><button onClick={() => setViewingProduct(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button></div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4 border-b border-slate-100 pb-4"><div className="bg-[#edf6f1] p-3 rounded-full text-[#08834c]"><Package size={32} /></div><div><h2 className="text-xl font-bold text-slate-800">{viewingProduct.name}</h2><p className="text-sm text-slate-500">{viewingProduct.id}</p></div></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><p className="text-sm text-slate-500 mb-1">Category</p><p className="font-medium text-slate-800">{viewingProduct.category}</p></div>
                                <div><p className="text-sm text-slate-500 mb-1">Unit Type</p><p className="font-medium text-slate-800">{viewingProduct.unit}</p></div>
                                <div><p className="text-sm text-slate-500 mb-1">Current Stock</p><p className={`font-medium ${viewingProduct.quantity === 0 ? 'text-red-600' : viewingProduct.quantity <= viewingProduct.threshold ? 'text-yellow-600' : 'text-green-600'}`}>{viewingProduct.quantity}</p></div>
                                <div><p className="text-sm text-slate-500 mb-1">Alert Threshold</p><p className="font-medium text-slate-800">{viewingProduct.threshold}</p></div>
                                <div><p className="text-sm text-slate-500 mb-1">Price</p><p className="font-medium text-slate-800">Rs. {viewingProduct.price.toFixed(2)}</p></div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end"><button onClick={() => setViewingProduct(null)} className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-xl">Close</button></div>
                    </div>
                </div>
            )}

            {editingProduct && editForm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-lg text-slate-800">Edit Product</h3><button onClick={() => { setEditingProduct(null); setEditForm(null); }} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button></div>
                        <form onSubmit={handleUpdateProduct} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label><input type="text" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label><select required value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none">{Object.keys(categoryMap).map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit Type</label>
                                    <select required value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none">
                                        <option value="Tablets">Tablets</option>
                                        <option value="Capsules">Capsules</option>
                                        <option value="Vials">Vials</option>
                                        <option value="Syrups">Syrups</option>
                                        <option value="Inhalers">Inhalers</option>
                                        <option value="Tubes">Tubes (Creams)</option>
                                        <option value="Pcs">Pieces</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Price/Unit (Rs.)</label><input type="number" step="0.01" min="0" required value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none" /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-1">Low Alert Threshold</label><input type="number" min="1" required value={editForm.threshold} onChange={(e) => setEditForm({ ...editForm, threshold: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none" /></div>
                            </div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Stock Level</label><input type="number" min="0" required value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none" /></div>
                            <div className="pt-4 flex gap-3"><button type="button" onClick={() => { setEditingProduct(null); setEditForm(null); }} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors">Cancel</button><button type="submit" className="flex-1 py-3 bg-[#08834c] text-white font-bold rounded-xl shadow-lg hover:bg-[#076c3e]">Save Changes</button></div>
                        </form>
                    </div>
                </div>
            )}

            {isReceivingModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-lg text-slate-800">Receive Stock</h3><button onClick={() => setIsReceivingModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button></div>
                        <div className="px-6 pt-4"><div className="flex bg-slate-100 p-1 rounded-lg"><button onClick={() => setReceiveMode('existing')} className={`flex-1 py-2 text-sm font-medium rounded-md ${receiveMode === 'existing' ? 'bg-white shadow-sm text-[#08834c]' : 'text-slate-500'}`}>Existing</button><button onClick={() => setReceiveMode('new')} className={`flex-1 py-2 text-sm font-medium rounded-md ${receiveMode === 'new' ? 'bg-white shadow-sm text-[#08834c]' : 'text-slate-500'}`}>New</button></div></div>
                        <form onSubmit={handleReceiveStock} className="p-6 space-y-4">
                            {receiveMode === 'existing' ? (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="flex flex-col gap-2 relative">
                                        <label className="block text-sm font-bold text-slate-700">Search & Select Product</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                                <Search size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Search by name or category..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none text-sm transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-xl overflow-y-auto custom-scrollbar shadow-sm max-h-[160px] flex flex-col mt-1">
                                            {inventory.filter(i => {
                                                const sq = searchQuery.toLowerCase();
                                                return i.name.toLowerCase().includes(sq) || i.category.toLowerCase().includes(sq);
                                            }).length === 0 ? (
                                                <div className="p-5 flex flex-col items-center justify-center text-slate-400">
                                                    <Package size={24} className="mb-2 text-slate-300" />
                                                    <p className="text-xs font-medium">No system products match your search.</p>
                                                </div>
                                            ) : (
                                                inventory.filter(i => {
                                                    const sq = searchQuery.toLowerCase();
                                                    return i.name.toLowerCase().includes(sq) || i.category.toLowerCase().includes(sq);
                                                }).map(item => (
                                                    <div 
                                                        key={item.id} 
                                                        onClick={() => setReceiveForm({ ...receiveForm, id: item.id })}
                                                        className={`p-3 border-b border-slate-50 last:border-0 cursor-pointer transition-all flex justify-between items-center group ${receiveForm.id === item.id ? 'bg-[#edf6f1] border-l-4 border-l-[#08834c]' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                                                    >
                                                        <div className="min-w-0 pr-3">
                                                            <p className={`font-bold text-sm truncate ${receiveForm.id === item.id ? 'text-[#08834c]' : 'text-slate-800'}`}>{item.name}</p>
                                                            <p className="text-[11px] text-slate-500 font-bold mt-0.5 tracking-wide uppercase">
                                                                {item.category} <span className="text-slate-300 mx-1">•</span> <span className="text-blue-600">Stock: {item.quantity}</span>
                                                            </p>
                                                        </div>
                                                        {receiveForm.id === item.id && <CheckCircle size={18} className="text-[#08834c] shrink-0" />}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    {receiveForm.id && (
                                        <div className="animate-in slide-in-from-top-2 duration-300">
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Quantity Received</label>
                                            <div className="relative">
                                                <input 
                                                    type="number" min="1" required 
                                                    value={receiveForm.quantity} 
                                                    onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} 
                                                    className="w-full pl-4 pr-16 py-3 bg-white border border-[#08834c]/30 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none shadow-[0_0_15px_rgba(8,131,76,0.06)] transition-all font-bold text-slate-800" 
                                                    placeholder="Enter stock amount..." 
                                                />
                                                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                                                    <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-100 uppercase tracking-wide">
                                                        {inventory.find(i => i.id === receiveForm.id)?.unit}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label><input type="text" required value={receiveForm.name} onChange={(e) => setReceiveForm({ ...receiveForm, name: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none" /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label><select required value={receiveForm.category} onChange={(e) => setReceiveForm({ ...receiveForm, category: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none">{Object.keys(categoryMap).map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Unit Type</label>
                                            <select required value={receiveForm.unit} onChange={(e) => setReceiveForm({ ...receiveForm, unit: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none">
                                                <option value="Tablets">Tablets</option>
                                                <option value="Capsules">Capsules</option>
                                                <option value="Vials">Vials</option>
                                                <option value="Syrups">Syrups</option>
                                                <option value="Inhalers">Inhalers</option>
                                                <option value="Tubes">Tubes (Creams)</option>
                                                <option value="Pcs">Pieces</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Price (Rs.)</label><input type="number" step="0.01" required value={receiveForm.price} onChange={(e) => setReceiveForm({ ...receiveForm, price: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none" /></div>
                                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Low Alert Threshold</label><input type="number" min="1" required value={receiveForm.threshold} onChange={(e) => setReceiveForm({ ...receiveForm, threshold: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none" /></div>
                                    </div>
                                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Initial Qty</label><input type="number" required value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none" /></div>
                                </div>
                            )}
                            <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsReceivingModalOpen(false)} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors">Cancel</button><button type="submit" className="flex-1 py-3 bg-[#08834c] text-white font-bold rounded-xl shadow-lg hover:bg-[#076c3e]">Add Stock</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Confirmation Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                        <div className="p-6 text-center">
                            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${confirmModal.type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmModal.title}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                {confirmModal.message}
                            </p>
                            <div className="flex gap-3">
                                {confirmModal.onConfirm && (
                                    <button
                                        onClick={closeConfirm}
                                        className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    onClick={async () => {
                                        if (confirmModal.onConfirm) {
                                            await confirmModal.onConfirm();
                                        }
                                        closeConfirm();
                                    }}
                                    className={`flex-1 py-3 px-4 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 ${confirmModal.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-[#08834c] hover:bg-[#076c3e] shadow-green-200'}`}
                                >
                                    {confirmModal.onConfirm ? 'Confirm' : 'Got it'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
