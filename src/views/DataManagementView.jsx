import React, { useRef, useState } from 'react';
import { Download, Upload, FileSpreadsheet, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { escapeCSV, parseCSVRow, triggerDownload } from '../utils/helpers';

export const DataManagementView = () => {
    const { inventory, setInventory, setCategoryMap, showConfirm, refreshData } = useInventory();
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const downloadTemplate = () => {
        const headers = ['Name', 'Category', 'Unit', 'Price', 'Quantity', 'Threshold'];
        const csvContent = headers.join(',') + '\n"Amoxicillin 500mg","Antibiotics","Capsules","50.00","500","100"\n"Panadol","Pain Relievers","Tablets","5.00","200","50"';
        triggerDownload(csvContent, 'MNHC_Inventory_Template.csv');
    };

    const exportInventory = () => {
        const headers = ['ID', 'Name', 'Category', 'Unit', 'Price', 'Quantity', 'Threshold'];
        const rows = inventory.map(item => [
            escapeCSV(item.id), escapeCSV(item.name), escapeCSV(item.category),
            escapeCSV(item.unit), item.price, item.quantity, item.threshold
        ].join(','));
        const csvContent = [headers.join(','), ...rows].join('\n');
        triggerDownload(csvContent, `MNHC_Inventory_Backup_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const importInventory = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        setMessage({ text: '', type: '' });

        // Minimal delay to ensure React commits the "Loading" UI state
        // before we potentially lock the main thread with heavy CSV parsing
        setTimeout(() => {
            const reader = new FileReader();
            
            reader.onload = async (evt) => {
                try {
                    const text = evt.target.result;
                    const lines = text.split(/\r?\n/).filter(line => line.trim());

                    if (lines.length <= 1) {
                        setMessage({ text: "The selected file is empty or contains no data rows to import.", type: 'error' });
                        setIsImporting(false);
                        return;
                    }

                    const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
                    const newItems = [];
                    const newItemsMap = new Map();
                    const existingInventoryMap = new Map(inventory.map(inv => [inv.name.toLowerCase(), inv]));
                    
                    const idIdx = headers.indexOf('id');
                    const nameIdx = headers.indexOf('name');
                    const catIdx = headers.indexOf('category');
                    const unitIdx = headers.indexOf('unit');
                    const priceIdx = headers.indexOf('price');
                    const qtyIdx = headers.indexOf('quantity');
                    const threshIdx = headers.indexOf('threshold');

                    if (nameIdx === -1) {
                        setMessage({ text: "Invalid file format. The 'Name' column is securely required in your CSV.", type: 'error' });
                        setIsImporting(false);
                        return;
                    }

                    for (let i = 1; i < lines.length; i++) {
                        const row = parseCSVRow(lines[i]);
                        // Completely ignore empty trailing lines 
                        if (!row || row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

                        let name = nameIdx > -1 ? row[nameIdx] : '';
                        if (!name) name = `Imported Product - Row ${i}`;
                        
                        const nameLower = name.toLowerCase();
                        
                        // Parse quantity explicitly for this row
                        const parsedQty = qtyIdx > -1 ? parseInt(row[qtyIdx], 10) : NaN;
                        const quantityToAdd = !isNaN(parsedQty) ? parsedQty : 0;

                        // Parse price and threshold so we can potentially update existing items
                        const parsedPrice = priceIdx > -1 ? parseFloat(row[priceIdx]) : NaN;
                        const parsedThresh = threshIdx > -1 ? parseInt(row[threshIdx], 10) : NaN;

                        // 1. If we have already seen this name in the current CSV, we don't create a new row!
                        //    Instead, we merge them together and SUM their quantities.
                        if (newItemsMap.has(nameLower)) {
                            const existingInCSV = newItemsMap.get(nameLower);
                            existingInCSV.quantity += quantityToAdd;
                            if (!isNaN(parsedPrice)) existingInCSV.price = parsedPrice; // keep latest price
                            if (!isNaN(parsedThresh)) existingInCSV.threshold = parsedThresh; // keep latest threshold
                            continue;
                        }

                        // 2. If it's a new item in the CSV, check if it already exists in the database!
                        const existingInventoryItem = existingInventoryMap.get(nameLower);
                        
                        let id = idIdx > -1 && row[idIdx] ? row[idIdx] : '';
                        // If no ID is provided in CSV, intelligently map it or generate one
                        if (!id) {
                            if (existingInventoryItem) {
                                // Match the database ID exactly so we update it instead of making a duplicate
                                id = existingInventoryItem.id;
                            } else {
                                // High entropy unique ID combining timestamp, random string, and loop index
                                id = `#MED${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${i}`;
                            }
                        }

                        const category = catIdx > -1 && row[catIdx] ? row[catIdx] : (existingInventoryItem ? existingInventoryItem.category : 'Others');
                        const unit = unitIdx > -1 && row[unitIdx] ? row[unitIdx] : (existingInventoryItem ? existingInventoryItem.unit : 'Tablets');

                        const price = !isNaN(parsedPrice) ? parsedPrice : (existingInventoryItem ? existingInventoryItem.price : 0);
                        const threshold = !isNaN(parsedThresh) ? parsedThresh : (existingInventoryItem ? existingInventoryItem.threshold : 50);

                        // For the first time we see it, we could add to DB quantity or overwrite. 
                        // Standard CSV bulk import sets the quantity (overwrites). But if they wipe inventory, existing is 0 anyway.
                        const quantity = quantityToAdd;

                        const newItem = { id, name, category, unit, price, quantity, threshold };
                        newItemsMap.set(nameLower, newItem);
                    }

                    const inventoryInsertions = Array.from(newItemsMap.values());

                    if (inventoryInsertions.length > 0) {
                        // Optimistic UI Update: Instantly inject data into memory state and close loading modal
                        setInventory(prev => {
                            const newInv = [...prev];
                            inventoryInsertions.forEach(item => {
                                const idx = newInv.findIndex(i => i.id === item.id);
                                if (idx > -1) newInv[idx] = { ...newInv[idx], ...item };
                                else newInv.unshift({ ...item, created_at: new Date().toISOString() });
                            });
                            return newInv;
                        });

                        setMessage({ text: `Success! Formatted and securely merged ${inventoryInsertions.length} unique inventory items.`, type: 'success' });
                        setIsImporting(false); // Make it instantly disappear!

                        // Background Network Sync
                        setTimeout(async () => {
                            try {
                                const { supabase } = await import('../lib/supabase');
                                const categoriesToEnsure = [...new Set(newItems.map(i => i.category))];
                                const catInsertions = categoriesToEnsure.map(cat => ({ name: cat, icon: 'Package' }));
                                
                                await supabase.from('categories').upsert(catInsertions, { onConflict: 'name', ignoreDuplicates: true });
                                await supabase.from('inventory').upsert(inventoryInsertions, { onConflict: 'id' });
                                
                                refreshData(); // Silent background real-sync
                            } catch (e) {
                                console.error('Background Sync Error:', e);
                            }
                        }, 50);

                    } else {
                        setIsImporting(false);
                    }
                } catch (err) {
                    console.error("Critical Import Error:", err);
                    setMessage({ text: "A critical error occurred while parsing the CSV data.", type: 'error' });
                    setIsImporting(false);
                }
            };
            
            reader.readAsText(file);
        }, 30);

        e.target.value = null;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 relative">
            
            {/* Full-Screen Premium Loading Overlay */}
            {isImporting && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
                    <div className="flex flex-col items-center animate-in zoom-in-95 duration-700 ease-out relative">
                        {/* Soft background glow */}
                        <div className="absolute inset-0 bg-[#08834c] rounded-full blur-[100px] opacity-40 animate-pulse" />
                        
                        <div className="relative bg-white/10 border border-white/20 p-8 rounded-[2rem] shadow-2xl flex flex-col items-center text-center">
                             <div className="relative flex items-center justify-center mb-6">
                                <div className="absolute inset-0 border-4 border-[#08834c]/30 rounded-full animate-ping opacity-75" />
                                <div className="bg-gradient-to-tr from-[#08834c] to-[#0a9e5b] text-white p-4 rounded-full shadow-lg">
                                    <Activity size={32} className="animate-spin" strokeWidth={2} />
                                </div>
                             </div>
                             <h3 className="font-bold text-2xl text-white tracking-tight mb-2 drop-shadow-md">Syncing Database</h3>
                             <p className="text-sm text-slate-200 max-w-[260px] leading-relaxed drop-shadow-sm opacity-90">Parsing your CSV and updating inventory records in real-time. Please wait...</p>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <h2 className="text-2xl font-bold text-slate-800">Data Management</h2>
                <p className="text-sm text-slate-500 mt-1">Import or export your inventory data securely via CSV files.</p>
            </div>

            {/* Inline Message Notifications */}
            {message.text && (
                <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-4 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-[#edf6f1] text-[#08834c] border border-[#c4e6d2]'}`}>
                    {message.type === 'error' ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Export Backup Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center h-full">
                    <div className="w-16 h-16 bg-[#edf6f1] text-[#08834c] rounded-full flex items-center justify-center mb-4">
                        <Download size={32} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Export Data Backup</h3>
                    <p className="text-sm text-slate-500 mb-6 flex-1">Download a full snapshot of your current inventory data in CSV format, ready to be viewed in Excel.</p>
                    <button onClick={exportInventory} className="w-full py-3 bg-[#08834c] text-white font-bold rounded-xl shadow-md hover:bg-[#076c3e] transition-colors flex items-center justify-center gap-2">
                        Export Backup (CSV)
                    </button>
                </div>

                {/* Import CSV Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center h-full">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                        <Upload size={32} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Import Inventory</h3>
                    <p className="text-sm text-slate-500 mb-6 flex-1">Upload an Excel (CSV) file to bulk-add new items or update existing stock quantities matching by name.</p>

                    <input
                        type="file"
                        accept=".csv"
                        onChange={importInventory}
                        ref={fileInputRef}
                        className="hidden"
                    />
                    <button disabled={isImporting} onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                        {isImporting ? 'Processing...' : 'Upload CSV File'}
                    </button>
                </div>

                {/* Download Template Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center h-full">
                    <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-4">
                        <FileSpreadsheet size={32} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Excel Template</h3>
                    <p className="text-sm text-slate-500 mb-6 flex-1">Download a blank CSV template with the correct column formatting to ensure a flawless import process.</p>
                    <button onClick={downloadTemplate} className="w-full py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                        Download Template
                    </button>
                </div>

            </div>
        </div>
    );
};
