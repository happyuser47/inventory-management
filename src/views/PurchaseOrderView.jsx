import React from 'react';
import { Clock, CheckCircle2, ClipboardList, Search, PackageSearch, PackagePlus, XCircle, MinusCircle, PlusCircle, Download, FileText, Eye, Pencil, ClipboardCheck, Trash2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatDisplayDate } from '../utils/helpers';
import { CLINIC_LOGO_BASE64 } from '../utils/clinicLogo';

export const PurchaseOrderView = () => {
    const {
        inventory,
        poHistory, setPoHistory,
        poDraft, setPoDraft,
        poSearch, setPoSearch,
        poFilter, setPoFilter,
        poHistorySearch, setPoHistorySearch,
        poTab, setPoTab,
        setReceivingPO,
        setViewingPO,
        showConfirm,
        refreshData
    } = useInventory();


    const pendingOrdersCount = poHistory.filter(po => po.status === 'Pending').length;
    const completedOrdersCount = poHistory.filter(po => po.status === 'Completed').length;

    const poDraftTotal = poDraft.reduce((sum, item) => {
        const qty = item.orderQty === '' ? 0 : parseInt(item.orderQty);
        const price = item.price === '' || isNaN(item.price) ? 0 : parseFloat(item.price);
        return sum + (price * qty);
    }, 0);

    const poFilteredInventory = inventory.filter(item => {
        const searchLower = poSearch.trim().toLowerCase();
        const matchesSearch = searchLower === '' ||
            item.name.toLowerCase().includes(searchLower) ||
            item.category.toLowerCase().includes(searchLower);

        let matchesStatus = true;
        if (poFilter === 'low') matchesStatus = item.quantity > 0 && item.quantity <= item.threshold;
        if (poFilter === 'out') matchesStatus = item.quantity === 0;

        return matchesSearch && matchesStatus;
    });

    const filteredPoHistory = poHistory.filter(po => {
        if (!poHistorySearch) return true;
        return po.poId.toLowerCase().includes(poHistorySearch.toLowerCase());
    });

    const addToPO = (item) => {
        setPoDraft(prev => {
            if (prev.some(p => p.id === item.id)) return prev;
            const suggestedQty = item.threshold > 0 ? Math.max((item.threshold * 2) - item.quantity, 50) : 50;
            return [...prev, { ...item, orderQty: suggestedQty }];
        });
    };

    const updatePOQty = (id, delta) => {
        setPoDraft(prev => prev.map(item => {
            if (item.id === id) {
                const currentQty = item.orderQty === '' ? 0 : parseInt(item.orderQty);
                const newQty = Math.max(1, currentQty + delta);
                return { ...item, orderQty: newQty };
            }
            return item;
        }));
    };

    const handlePOQtyInputChange = (id, rawValue) => {
        setPoDraft(prev => prev.map(item => {
            if (item.id === id) {
                if (rawValue === '') return { ...item, orderQty: '' };
                let newQty = parseInt(rawValue);
                if (isNaN(newQty)) return item;
                return { ...item, orderQty: newQty };
            }
            return item;
        }));
    };

    const handlePOPriceChange = (id, rawValue) => {
        setPoDraft(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, price: rawValue === '' ? '' : parseFloat(rawValue) };
            }
            return item;
        }));
    };

    const handlePOQtyBlur = (id) => {
        setPoDraft(prev => prev.map(item => {
            if (item.id === id && (item.orderQty === '' || item.orderQty < 1)) {
                return { ...item, orderQty: 1 };
            }
            if (item.id === id && (item.price === '' || isNaN(item.price))) {
                return { ...item, price: 0 };
            }
            return item;
        }));
    };

    const removeFromPO = (id) => setPoDraft(prev => prev.filter(i => i.id !== id));

    const generatePDF = (targetPO) => {
        if (!targetPO || targetPO.items.length === 0) return;

        const printWindow = window.open('', '_blank');
        const dateStr = formatDisplayDate(targetPO.date);
        const poNumber = targetPO.poId;

        const html = `
        <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Order ${poNumber}</title>
          <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.6; max-width: 900px; margin: auto; padding: 0 40px 40px; }
            
            /* Logo Banner */
            .logo-banner {
              text-align: center;
              padding: 30px 0 15px;
              border-bottom: 3px solid #08834c;
              margin-bottom: 0;
            }
            .logo-banner img {
              max-width: 320px;
              height: auto;
            }
            .logo-banner .subtitle {
              font-size: 12px;
              color: #64748b;
              letter-spacing: 3px;
              text-transform: uppercase;
              margin-top: 6px;
            }
            
            /* PO Header Info */
            .po-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding: 20px 0;
              border-bottom: 1px solid #e2e8f0;
            }
            .po-header .po-title {
              font-size: 22px;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: 2px;
              text-transform: uppercase;
            }
            .po-header .po-meta {
              text-align: right;
            }
            .po-header .po-meta p {
              margin: 3px 0;
              font-size: 13px;
              color: #64748b;
              font-weight: 500;
            }
            .po-header .po-meta .po-number {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
            }
            .po-header .po-meta .status-badge {
              display: inline-block;
              padding: 3px 12px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-top: 4px;
            }
            .status-completed {
              background: #dcfce7;
              color: #15803d;
            }
            .status-pending {
              background: #fef3c7;
              color: #b45309;
            }
            
            /* Table */
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th { 
              background-color: #08834c; 
              color: white; 
              font-weight: 600; 
              font-size: 12px; 
              text-transform: uppercase; 
              letter-spacing: 1px;
              padding: 12px 16px;
              text-align: left;
            }
            td { 
              padding: 12px 16px; 
              font-size: 14px; 
              color: #334155;
              border-bottom: 1px solid #e2e8f0;
            }
            tr:nth-child(even) td { background-color: #f8fafc; }
            tr:hover td { background-color: #f1f5f9; }
            .qty-col { font-weight: 700; color: #0f172a; text-align: center; }
            .idx-col { color: #94a3b8; text-align: center; font-weight: 600; font-size: 12px; }
            .name-col { font-weight: 600; color: #0f172a; }
            
            /* Footer */
            .footer {
              margin-top: 50px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
            }
            .footer-note {
              color: #94a3b8;
              font-size: 12px;
              max-width: 300px;
              line-height: 1.6;
            }
            .signature-block {
              width: 240px;
              text-align: center;
            }
            .signature-name {
              font-family: 'Great Vibes', 'Brush Script MT', cursive;
              font-size: 36px;
              color: #0f172a;
              line-height: 1;
              margin-bottom: 6px;
            }
            .signature-line {
              border-top: 1.5px solid #cbd5e1;
              padding-top: 8px;
              color: #64748b;
              font-size: 12px;
              font-weight: 500;
            }
            
            @media print {
              body { padding: 0 20px 20px; }
            }
          </style>
        </head>
        <body>
          <!-- Logo Banner -->
          <div class="logo-banner">
            <img src="${CLINIC_LOGO_BASE64}" alt="Maryam Nawaz Health Clinic" />
            <div class="subtitle">Bakhri Ahmad Khan, Layyah — Phone: 0300-0000000</div>
          </div>
          
          <!-- PO Header -->
          <div class="po-header">
            <div>
              <div class="po-title">Purchase Order</div>
            </div>
            <div class="po-meta">
              <p class="po-number">${poNumber}</p>
              <p>Date: ${dateStr}</p>
              ${targetPO.status === 'Completed'
                ? `<span class="status-badge status-completed">✓ Received</span>`
                : `<span class="status-badge status-pending">● Pending</span>`}
            </div>
          </div>
          
          <!-- Items Table -->
          <table>
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: ${targetPO.status === 'Completed' ? '55%' : '75%'}">Product Name</th>
                <th style="width: 20%; text-align: center;">Order Qty</th>
                ${targetPO.status === 'Completed' ? `<th style="width: 20%; text-align: center;">Received</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${targetPO.items.map((item, index) => `
                <tr>
                  <td class="idx-col">${index + 1}</td>
                  <td class="name-col">${item.name}</td>
                  <td class="qty-col">${item.orderQty} ${item.unit}</td>
                  ${targetPO.status === 'Completed' ? `<td class="qty-col" style="color: #08834c;">${item.receivedQty || 0} ${item.unit}</td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <!-- Footer -->
          <div class="footer">
            <div class="footer-note">
              Please supply the items listed above as per the requested quantities.<br>
              <span style="color: #cbd5e1; font-size: 10px;">Generated on ${new Date().toLocaleString()}</span>
            </div>
            <div class="signature-block">
              <div class="signature-name">Dr. Usama Akram</div>
              <div class="signature-line">Authorized Signature</div>
            </div>
          </div>
        </body> 
      </html> 
    `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 300);
    };

    const savePO = async (downloadPdf = false) => {
        if (poDraft.length === 0) return;
        const poNumber = `#PO-${Date.now().toString().slice(-6)}`;
        const draftSnapshot = [...poDraft];

        // Build a new PO object for optimistic update
        const newPO = {
            poId: poNumber,
            status: 'Pending',
            date: new Date().toISOString(),
            completionDate: null,
            items: draftSnapshot.map(item => ({
                id: item.id,
                name: item.name,
                unit: item.unit,
                orderQty: item.orderQty === '' ? 0 : parseInt(item.orderQty),
                receivedQty: 0,
                price: item.price === '' || isNaN(item.price) ? 0 : parseFloat(item.price)
            }))
        };

        // Optimistic: add to local history and clear draft instantly
        setPoHistory(prev => [newPO, ...prev]);
        setPoDraft([]);
        setPoTab('history');

        // Generate PDF immediately if requested
        if (downloadPdf) {
            generatePDF(newPO);
        }

        // Background sync
        import('../utils/supabaseActions').then(async ({ createPOSupabase }) => {
            await createPOSupabase(poNumber, draftSnapshot);
            refreshData();
        }).catch(err => { console.error(err); refreshData(); });
    };

    const editPendingPO = async (po) => {
        // Optimistic: move items to draft, remove from history
        setPoDraft(po.items);
        setPoHistory(prev => prev.filter(p => p.poId !== po.poId));
        setPoTab('create');

        // Background sync
        import('../lib/supabase').then(async ({ supabase }) => {
            await supabase.from('purchase_orders').delete().eq('po_id', po.poId);
            refreshData();
        }).catch(err => { console.error(err); refreshData(); });
    };

    const deletePendingPO = async (poId) => {
        showConfirm(
            "Delete Purchase Order",
            "Are you sure you want to delete this Pending Purchase Order?",
            () => {
                // Optimistic: remove from local history instantly
                setPoHistory(prev => prev.filter(p => p.poId !== poId));

                // Background sync
                import('../lib/supabase').then(async ({ supabase }) => {
                    await supabase.from('purchase_orders').delete().eq('po_id', poId);
                    refreshData();
                }).catch(err => { console.error(err); refreshData(); });
            }
        );
    };

    const openReceivePOModal = (po) => {
        const poWithRecQty = {
            ...po,
            items: po.items.map(item => ({
                ...item,
                receivedQty: item.receivedQty !== undefined ? item.receivedQty : item.orderQty
            }))
        };
        setReceivingPO(poWithRecQty);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-12">
            {/* Header & Stats */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Purchase Orders</h2>
                <p className="text-sm text-slate-500 mt-1">Manage vendor orders and receive inventory stock</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div><p className="text-sm text-slate-500 font-medium mb-1">Pending Orders</p><h2 className="text-3xl font-bold text-yellow-600">{pendingOrdersCount}</h2></div>
                    <div className="bg-yellow-50 p-4 rounded-xl text-yellow-600"><Clock size={28} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div><p className="text-sm text-slate-500 font-medium mb-1">Completed Orders</p><h2 className="text-3xl font-bold text-[#08834c]">{completedOrdersCount}</h2></div>
                    <div className="bg-[#edf6f1] p-4 rounded-xl text-[#08834c]"><CheckCircle2 size={28} /></div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-4 border-b border-slate-200">
                <button onClick={() => setPoTab('create')} className={`pb-3 font-bold px-2 transition-colors ${poTab === 'create' ? 'text-[#08834c] border-b-2 border-[#08834c]' : 'text-slate-500 hover:text-slate-800'}`}>Create New Order</button>
                <button onClick={() => setPoTab('history')} className={`pb-3 font-bold px-2 transition-colors ${poTab === 'history' ? 'text-[#08834c] border-b-2 border-[#08834c]' : 'text-slate-500 hover:text-slate-800'}`}>Order History</button>
            </div>

            {poTab === 'create' ? (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[500px] lg:h-[calc(100vh-16rem)] h-auto">
                    {/* Left Pane - Inventory Selection */}
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                            <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
                                    <ClipboardList className="text-[#08834c]" size={20} /> Select Items to Order
                                </h2>
                                <select
                                    value={poFilter}
                                    onChange={(e) => setPoFilter(e.target.value)}
                                    className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#08834c] text-slate-600 outline-none cursor-pointer flex-1 min-w-[120px] max-w-full sm:max-w-[150px]"
                                >
                                    <option value="all">All Items</option>
                                    <option value="low">Low Stock</option>
                                    <option value="out">Out of Stock</option>
                                </select>
                            </div>
                            <div className="relative">
                                <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Search inventory..." value={poSearch} onChange={(e) => setPoSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#08834c] shadow-sm" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-max custom-scrollbar">
                            {poFilteredInventory.map(item => {
                                const isOut = item.quantity === 0;
                                const isLow = item.quantity > 0 && item.quantity <= item.threshold;
                                const isDrafted = poDraft.some(p => p.id === item.id);

                                return (
                                    <div key={item.id} onClick={() => !isDrafted && addToPO(item)} className={`border ${isDrafted ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed' : isOut ? 'border-red-200 bg-red-50/30 hover:border-red-300 cursor-pointer' : isLow ? 'border-yellow-200 bg-yellow-50/30 hover:border-yellow-300 cursor-pointer' : 'border-slate-100 hover:border-[#08834c] cursor-pointer bg-white'} p-4 rounded-xl transition-all flex justify-between items-center group shadow-sm hover:shadow-md`}>
                                        <div className="flex-1 min-w-0 pr-3">
                                            <h4 className="font-bold text-slate-800 truncate">{item.name}</h4>
                                            <p className="text-xs text-slate-500 truncate">{item.category}</p>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className={`text-sm font-medium ${isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-green-600'}`}>
                                                    Stock: {item.quantity} {item.unit}
                                                </span>
                                                <span className="text-xs text-slate-400">(Min: {item.threshold})</span>
                                            </div>
                                        </div>
                                        <button disabled={isDrafted} className={`shrink-0 p-2 rounded-full ${isDrafted ? 'bg-slate-200 text-slate-400' : 'bg-[#edf6f1] text-[#08834c]'} transition-colors`}>
                                            {isDrafted ? <CheckCircle2 size={20} /> : <PlusCircle size={20} />}
                                        </button>
                                    </div>
                                );
                            })}
                            {poFilteredInventory.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-400">
                                    <PackageSearch size={40} className="mx-auto mb-3 opacity-20" />
                                    <p>No items found matching the current filter.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Pane - Order Draft */}
                    <div className="w-full lg:w-[380px] xl:w-[450px] bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden shrink-0">
                        <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <h2 className="text-lg font-bold flex items-center gap-2"><PackagePlus size={20} /> Order Draft</h2>
                            <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-medium">{poDraft.length} items</span>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 custom-scrollbar bg-slate-50/30">
                            {poDraft.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 p-8 text-center">
                                    <ClipboardList size={48} className="mb-4" />
                                    <p>Order draft is empty.<br /><span className="text-sm mt-1 block">Select items from the left to build your purchase order.</span></p>
                                </div>
                            ) : (
                                poDraft.map(item => (
                                    <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group">
                                        <button onClick={() => removeFromPO(item.id)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-md z-10" title="Remove from order">
                                            <XCircle size={18} />
                                        </button>
                                        <div className="pr-7 min-w-0">
                                            <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 mb-3 mt-1">
                                                <span className="truncate bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                                                    Current Price: Rs. {(inventory.find(i => i.id === item.id)?.price || 0).toFixed(2)}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-medium text-slate-600">Est. Price: Rs.</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={item.price}
                                                        onChange={(e) => handlePOPriceChange(item.id, e.target.value)}
                                                        onBlur={() => handlePOQtyBlur(item.id)}
                                                        className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#08834c] text-slate-800 font-medium"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 gap-2">
                                            <span className="text-sm font-medium text-slate-600">Order Qty:</span>
                                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
                                                <button onClick={() => updatePOQty(item.id, -10)} className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors" title="Decrease by 10"><MinusCircle size={18} /></button>
                                                <input type="number" min="1" value={item.orderQty} onChange={(e) => handlePOQtyInputChange(item.id, e.target.value)} onBlur={() => handlePOQtyBlur(item.id)} className="font-bold text-slate-800 w-12 sm:w-16 text-center focus:outline-none bg-transparent" />
                                                <button onClick={() => updatePOQty(item.id, 10)} className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors" title="Increase by 10"><PlusCircle size={18} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-white shrink-0 space-y-3">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                <span className="text-sm font-medium text-slate-500">Est. Order Value</span>
                                <span className="text-xl font-bold text-[#08834c]">Rs. {poDraftTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <button onClick={() => savePO(true)} disabled={poDraft.length === 0} className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${poDraft.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#08834c] text-white hover:bg-[#076c3e] hover:shadow-md'}`}>
                                <Download size={20} /> Save & Download PDF
                            </button>
                            <button onClick={() => savePO(false)} disabled={poDraft.length === 0} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${poDraft.length === 0 ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-[#08834c]'}`}>
                                <CheckCircle2 size={18} /> Save Order Only
                            </button>
                            {poDraft.length > 0 && (
                                <button onClick={() => setPoDraft([])} className="w-full mt-2 py-1 text-sm text-slate-500 font-medium hover:text-red-500 transition-colors">
                                    Clear Order Draft
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                // Order History Tab
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h3 className="font-bold text-lg text-slate-800">Order History</h3>
                        <div className="relative w-full sm:w-64">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by Order ID..."
                                value={poHistorySearch}
                                onChange={(e) => setPoHistorySearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#08834c] shadow-sm"
                            />
                        </div>
                    </div>

                    {filteredPoHistory.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-slate-400">
                            <FileText size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="text-lg">No matching purchase orders found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 text-slate-500 text-sm border-b border-slate-100">
                                        <th className="p-4 font-medium">Order ID</th>
                                        <th className="p-4 font-medium">Created Date</th>
                                        <th className="p-4 font-medium">Completed On</th>
                                        <th className="p-4 font-medium">Items & Units</th>
                                        <th className="p-4 font-medium">Order Value</th>
                                        <th className="p-4 font-medium">Status</th>
                                        <th className="p-4 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPoHistory.map(po => {
                                        const poTotalValue = po.items.reduce((sum, i) => sum + ((i.price || 0) * (po.status === 'Completed' ? (i.receivedQty || 0) : i.orderQty)), 0);
                                        const poTotalUnits = po.items.reduce((sum, i) => sum + ((po.status === 'Completed' ? (i.receivedQty || 0) : parseInt(i.orderQty)) || 0), 0);

                                        return (
                                            <tr key={po.poId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <td className="p-4 text-sm font-bold text-slate-800">{po.poId}</td>
                                                <td className="p-4 text-sm text-slate-600">{formatDisplayDate(po.date)}</td>
                                                <td className="p-4 text-sm text-slate-600 font-medium">{po.completionDate ? formatDisplayDate(po.completionDate) : '-'}</td>
                                                <td className="p-4 text-sm text-slate-600">
                                                    {po.items.length} items <span className="text-slate-400 text-xs ml-1">({poTotalUnits} units)</span>
                                                </td>
                                                <td className="p-4 text-sm font-bold text-slate-800">Rs. {poTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-md text-xs font-medium ${po.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {po.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right flex items-center justify-end gap-2">
                                                    <button onClick={() => setViewingPO(po)} className="p-2 text-slate-400 hover:text-[#08834c] hover:bg-[#edf6f1] rounded-lg transition-colors" title="View Details"><Eye size={18} /></button>
                                                    <button onClick={() => generatePDF(po)} className="p-2 text-slate-400 hover:text-[#08834c] hover:bg-[#edf6f1] rounded-lg transition-colors" title="Download PDF"><Download size={18} /></button>

                                                    {po.status === 'Pending' ? (
                                                        <>
                                                            <button onClick={() => editPendingPO(po)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Draft"><Pencil size={18} /></button>
                                                            <button onClick={() => openReceivePOModal(po)} className="p-2 text-slate-400 hover:text-[#08834c] hover:bg-[#edf6f1] rounded-lg transition-colors" title="Mark as Received"><ClipboardCheck size={18} /></button>
                                                            <button onClick={() => deletePendingPO(po.poId)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Order"><Trash2 size={18} /></button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => openReceivePOModal(po)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Received Quantities"><Pencil size={18} /></button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
