import React, { useState, useEffect, useMemo } from 'react';
import { 
    XCircle, Copy, Search, CheckCircle2, AlertTriangle, 
    ArrowRight, Trash2, Plus, Minus, Tag, Package, Sparkles
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatDisplayDate } from '../utils/helpers';

export const DuplicateOrderModal = () => {
    const { 
        duplicatingPO, 
        setDuplicatingPO, 
        inventory, 
        poDraft, 
        setPoDraft, 
        setPoTab 
    } = useInventory();

    const [useCurrentPrices, setUseCurrentPrices] = useState(true);
    const [draftMode, setDraftMode] = useState('replace'); // 'replace' | 'merge'
    const [itemSearch, setItemSearch] = useState('');
    const [itemsList, setItemsList] = useState([]);

    // Initialize items when duplicatingPO changes
    useEffect(() => {
        if (!duplicatingPO || !Array.isArray(duplicatingPO.items)) {
            setItemsList([]);
            return;
        }

        // Map items with current inventory data
        const initial = duplicatingPO.items.map((item, index) => {
            const safeName = (item.name || '').trim().toLowerCase();
            const matched = inventory.find(inv => 
                inv.id === item.id || 
                (inv.name && inv.name.trim().toLowerCase() === safeName)
            );

            const initialQty = parseInt(item.orderQty) || parseInt(item.receivedQty) || 50;
            const originalPrice = parseFloat(item.price) || 0;
            const currentCatalogPrice = matched ? parseFloat(matched.price) || 0 : originalPrice;

            return {
                tempKey: `${item.id || index}-${Date.now()}-${index}`,
                originalId: item.id,
                currentId: matched ? matched.id : (item.id || `#MED-${Date.now()}-${index}`),
                name: matched ? matched.name : item.name,
                category: matched ? matched.category : (item.category || 'General'),
                unit: matched ? matched.unit : (item.unit || 'Units'),
                currentStock: matched ? matched.quantity : 0,
                threshold: matched ? matched.threshold : 50,
                isMatched: !!matched,
                orderQty: Math.max(1, initialQty),
                originalPrice,
                currentCatalogPrice,
                // price will be computed dynamically based on useCurrentPrices
            };
        });

        setItemsList(initial);
        setUseCurrentPrices(true);
        setDraftMode(poDraft.length > 0 ? 'replace' : 'replace');
        setItemSearch('');
    }, [duplicatingPO, inventory, poDraft.length]);

    if (!duplicatingPO) return null;

    // Filter items by search query
    const filteredItems = itemsList.filter(item => {
        if (!itemSearch.trim()) return true;
        const q = itemSearch.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
    });

    const updateItemQty = (tempKey, newQty) => {
        const val = Math.max(1, parseInt(newQty) || 1);
        setItemsList(prev => prev.map(i => i.tempKey === tempKey ? { ...i, orderQty: val } : i));
    };

    const removeItem = (tempKey) => {
        setItemsList(prev => prev.filter(i => i.tempKey !== tempKey));
    };

    // Summary calculations
    const totalItemsCount = itemsList.length;
    const totalUnitsCount = itemsList.reduce((sum, i) => sum + (parseInt(i.orderQty) || 0), 0);
    const matchedCount = itemsList.filter(i => i.isMatched).length;
    const priceChangedCount = itemsList.filter(i => i.isMatched && i.currentCatalogPrice !== i.originalPrice).length;

    const totalEstimatedValue = itemsList.reduce((sum, i) => {
        const activePrice = useCurrentPrices ? i.currentCatalogPrice : i.originalPrice;
        return sum + (activePrice * (parseInt(i.orderQty) || 0));
    }, 0);

    const handleConfirmDuplicate = () => {
        if (itemsList.length === 0) return;

        // Build new draft items formatted for poDraft
        const newDraftItems = itemsList.map(item => {
            const activePrice = useCurrentPrices ? item.currentCatalogPrice : item.originalPrice;
            return {
                id: item.currentId,
                name: item.name,
                category: item.category,
                unit: item.unit,
                price: activePrice,
                quantity: item.currentStock,
                threshold: item.threshold,
                orderQty: item.orderQty
            };
        });

        if (draftMode === 'merge' && poDraft.length > 0) {
            // Merge into existing draft
            setPoDraft(prev => {
                const draftCopy = [...prev];
                newDraftItems.forEach(newItem => {
                    const existingIdx = draftCopy.findIndex(d => d.id === newItem.id);
                    if (existingIdx > -1) {
                        draftCopy[existingIdx] = {
                            ...draftCopy[existingIdx],
                            orderQty: (parseInt(draftCopy[existingIdx].orderQty) || 0) + newItem.orderQty,
                            price: newItem.price // update to latest active price
                        };
                    } else {
                        draftCopy.push(newItem);
                    }
                });
                return draftCopy;
            });
        } else {
            // Replace existing draft
            setPoDraft(newDraftItems);
        }

        // Close modal and navigate directly to the Create PO Draft view
        setDuplicatingPO(null);
        setPoTab('create');
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] border border-slate-100">
                
                {/* Header */}
                <div className="p-5 md:px-7 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50/60 to-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#08834c]/10 text-[#08834c] flex items-center justify-center shrink-0">
                            <Copy size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h3 className="font-bold text-lg text-slate-800">Duplicate Purchase Order</h3>
                                <span className="bg-[#edf6f1] text-[#08834c] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#08834c]/20">
                                    {duplicatingPO.poId}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Reorder items with current inventory catalog pricing and on-hand stock data
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setDuplicatingPO(null)} 
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Close"
                    >
                        <XCircle size={22} />
                    </button>
                </div>

                {/* Subheader: Metrics & Settings */}
                <div className="p-5 md:px-7 bg-slate-50/70 border-b border-slate-100 space-y-4 shrink-0">
                    {/* Insights Chips */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-3 py-1 bg-white rounded-lg border border-slate-200 font-semibold text-slate-700 shadow-2xs">
                            {totalItemsCount} Total Items
                        </span>
                        <span className="px-3 py-1 bg-white rounded-lg border border-slate-200 font-semibold text-slate-700 shadow-2xs">
                            {totalUnitsCount.toLocaleString()} Total Units
                        </span>
                        <span className="px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-200 font-semibold text-emerald-700 flex items-center gap-1 shadow-2xs">
                            <CheckCircle2 size={13} /> {matchedCount} Matched in Catalog
                        </span>
                        {priceChangedCount > 0 && useCurrentPrices && (
                            <span className="px-3 py-1 bg-blue-50 rounded-lg border border-blue-200 font-semibold text-blue-700 flex items-center gap-1 shadow-2xs">
                                <Sparkles size={13} /> {priceChangedCount} Prices Updated to Current
                            </span>
                        )}
                        {duplicatingPO.date && (
                            <span className="text-slate-400 ml-auto hidden sm:inline">
                                Originally placed on: {formatDisplayDate(duplicatingPO.date)}
                            </span>
                        )}
                    </div>

                    {/* Controls Grid: Price Selection + Draft Behavior */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Price Strategy Option */}
                        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                            <label className="text-xs font-bold text-slate-700 block mb-2">Price Calculation Strategy</label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setUseCurrentPrices(true)}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        useCurrentPrices 
                                            ? 'bg-[#08834c] text-white shadow-xs' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    <Sparkles size={14} /> Current Catalog Prices
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUseCurrentPrices(false)}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        !useCurrentPrices 
                                            ? 'bg-slate-800 text-white shadow-xs' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Original PO Prices
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-2">
                                {useCurrentPrices 
                                    ? "Recommended: Uses the current price saved in your inventory catalog." 
                                    : "Uses the historical prices saved on this past purchase order."}
                            </p>
                        </div>

                        {/* Existing Draft Handling (if draft is not empty) */}
                        {poDraft.length > 0 ? (
                            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                        <AlertTriangle size={14} className="text-amber-600" /> Draft Contains {poDraft.length} Item(s)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setDraftMode('replace')}
                                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                            draftMode === 'replace'
                                                ? 'bg-amber-600 text-white shadow-xs'
                                                : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100/50'
                                        }`}
                                    >
                                        Replace Draft
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDraftMode('merge')}
                                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                            draftMode === 'merge'
                                                ? 'bg-amber-600 text-white shadow-xs'
                                                : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100/50'
                                        }`}
                                    >
                                        Merge with Draft
                                    </button>
                                </div>
                                <p className="text-[11px] text-amber-700 mt-2">
                                    {draftMode === 'replace' 
                                        ? "Current draft items will be overwritten with this order." 
                                        : "Items will be merged; existing item quantities will be combined."}
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-center">
                                <span className="text-xs font-bold text-slate-700 block mb-1">Destination</span>
                                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                                    <CheckCircle2 size={15} className="text-[#08834c]" />
                                    Your order draft is currently empty and ready for these items.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="px-5 md:px-7 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
                    <div className="relative flex-1 max-w-sm">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter items in this order..."
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#08834c]"
                        />
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                        Showing {filteredItems.length} of {itemsList.length} items
                    </span>
                </div>

                {/* Items Table / List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:px-7">
                    {filteredItems.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <Package size={40} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-medium">No items found matching "{itemSearch}"</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[620px]">
                                <thead>
                                    <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-400 tracking-wider">
                                        <th className="py-2.5 pr-4 font-bold">Product Details</th>
                                        <th className="py-2.5 px-3 text-center font-bold">Current Stock</th>
                                        <th className="py-2.5 px-3 text-center font-bold">Order Qty</th>
                                        <th className="py-2.5 px-3 text-right font-bold">Unit Price</th>
                                        <th className="py-2.5 px-3 text-right font-bold">Line Total</th>
                                        <th className="py-2.5 pl-3 text-center font-bold w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredItems.map(item => {
                                        const activePrice = useCurrentPrices ? item.currentCatalogPrice : item.originalPrice;
                                        const lineTotal = activePrice * (parseInt(item.orderQty) || 0);
                                        const hasPriceDiff = item.isMatched && item.currentCatalogPrice !== item.originalPrice;

                                        return (
                                            <tr key={item.tempKey} className="hover:bg-slate-50/80 transition-colors group">
                                                {/* Product Info */}
                                                <td className="py-3 pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <div>
                                                            <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                                                                    {item.category}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    Unit: {item.unit}
                                                                </span>
                                                                {!item.isMatched && (
                                                                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-semibold">
                                                                        Unmatched
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Current Stock */}
                                                <td className="py-3 px-3 text-center">
                                                    {item.isMatched ? (
                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                                                            item.currentStock === 0 
                                                                ? 'bg-red-100 text-red-700' 
                                                                : item.currentStock <= item.threshold 
                                                                    ? 'bg-yellow-100 text-yellow-700' 
                                                                    : 'bg-emerald-50 text-emerald-700'
                                                        }`}>
                                                            {item.currentStock} {item.unit}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 font-medium">-</span>
                                                    )}
                                                </td>

                                                {/* Order Quantity Stepper */}
                                                <td className="py-3 px-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => updateItemQty(item.tempKey, item.orderQty - 10)}
                                                            className="p-1 hover:bg-slate-200 text-slate-500 rounded transition-colors"
                                                            title="Decrease by 10"
                                                        >
                                                            <Minus size={13} />
                                                        </button>
                                                        <input 
                                                            type="number"
                                                            min="1"
                                                            value={item.orderQty}
                                                            onChange={(e) => updateItemQty(item.tempKey, e.target.value)}
                                                            className="w-16 py-1 px-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-[#08834c] outline-none"
                                                        />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => updateItemQty(item.tempKey, item.orderQty + 10)}
                                                            className="p-1 hover:bg-slate-200 text-slate-500 rounded transition-colors"
                                                            title="Increase by 10"
                                                        >
                                                            <Plus size={13} />
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Unit Price */}
                                                <td className="py-3 px-3 text-right">
                                                    <div className="font-bold text-slate-800 text-sm">
                                                        Rs. {activePrice.toFixed(2)}
                                                    </div>
                                                    {hasPriceDiff && (
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            {useCurrentPrices ? (
                                                                <span>Original: Rs. {item.originalPrice.toFixed(2)}</span>
                                                            ) : (
                                                                <span className="text-[#08834c]">Catalog: Rs. {item.currentCatalogPrice.toFixed(2)}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Line Total */}
                                                <td className="py-3 px-3 text-right font-bold text-slate-800 text-sm">
                                                    Rs. {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>

                                                {/* Remove from duplicate list */}
                                                <td className="py-3 pl-3 text-center">
                                                    <button 
                                                        onClick={() => removeItem(item.tempKey)} 
                                                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                        title="Exclude item from duplicate draft"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 md:px-7 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 shrink-0 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.04)]">
                    <div>
                        <span className="text-xs text-slate-400 font-medium block">
                            Estimated New Order Value ({totalItemsCount} items)
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl md:text-3xl font-bold text-[#08834c]">
                                Rs. {totalEstimatedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {useCurrentPrices && (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    Current Catalog Rates
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setDuplicatingPO(null)}
                            className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmDuplicate}
                            disabled={itemsList.length === 0}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                                itemsList.length === 0
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-[#08834c] hover:bg-[#076c3e] text-white hover:shadow-lg active:scale-98'
                            }`}
                        >
                            <Copy size={16} /> Load into Order Draft
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

