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

        // setTimeout with a solid 300ms delay perfectly gives the browser 
        // the required time to animate and paint the React Loading UI
        // before we initiate heavy synchronous parsing scripts that lock the system thread.
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
                        if (row.length < headers.length && row.length <= 1) continue;

                        const name = row[nameIdx] || '';
                        if (!name) continue;
                        
                        const nameLower = name.toLowerCase();
                        let id = idIdx > -1 ? row[idIdx] : '';

                        const existingItem = existingInventoryMap.get(nameLower);
                        const alreadyParsedItem = newItemsMap.get(nameLower);
                        
                        if (existingItem) {
                            id = existingItem.id; 
                        } else if (alreadyParsedItem) {
                            id = alreadyParsedItem.id; 
                        } else if (!id) {
                            id = `#MED${Math.floor(1000 + Math.random() * 9000)}`;
                        }

                        const category = catIdx > -1 && row[catIdx] ? row[catIdx] : (existingItem ? existingItem.category : 'Others');
                        const unit = unitIdx > -1 && row[unitIdx] ? row[unitIdx] : (existingItem ? existingItem.unit : 'Tablets');

                        const parsedPrice = priceIdx > -1 ? parseFloat(row[priceIdx]) : NaN;
                        const price = !isNaN(parsedPrice) ? parsedPrice : (existingItem ? existingItem.price : 0);

                        const parsedQty = qtyIdx > -1 ? parseInt(row[qtyIdx], 10) : NaN;
                        const quantity = !isNaN(parsedQty) ? parsedQty : (existingItem ? existingItem.quantity : 0);

                        const parsedThresh = threshIdx > -1 ? parseInt(row[threshIdx], 10) : NaN;
                        const threshold = !isNaN(parsedThresh) ? parsedThresh : (existingItem ? existingItem.threshold : 50);

                        const newItem = { id, name, category, unit, price, quantity, threshold };
                        newItems.push(newItem);
                        newItemsMap.set(nameLower, newItem);
                    }

                    if (newItems.length > 0) {
                        const { supabase } = await import('../lib/supabase');

                        const categoriesToEnsure = [...new Set(newItems.map(i => i.category))];
                        const catInsertions = categoriesToEnsure.map(cat => ({ name: cat, icon: 'Package' }));
                        const { error: catError } = await supabase.from('categories').upsert(catInsertions, { onConflict: 'name', ignoreDuplicates: true });
                        
                        if (catError) {
                            console.error('Cat Error:', catError);
                            setMessage({ text: `Failed to setup categories: ${catError.message || catError.details}`, type: 'error' });
                            setIsImporting(false);
                            return;
                        }

                        const inventoryMap = {};
                        newItems.forEach(item => {
                            inventoryMap[item.id] = {
                                id: item.id,
                                name: item.name,
                                category: item.category,
                                unit: item.unit,
                                price: item.price,
                                quantity: item.quantity,
                                threshold: item.threshold
                            };
                        });
                        const inventoryInsertions = Object.values(inventoryMap);

                        const { error } = await supabase.from('inventory').upsert(inventoryInsertions, { onConflict: 'id' });

                        if (error) {
                            console.error('Inv Error:', error);
                            setMessage({ text: `Database rejected payload. Reason: ${error.message || error.details}`, type: 'error' });
                        } else {
                            await refreshData();
                            setMessage({ text: `Success! Formatted and perfectly updated ${inventoryInsertions.length} inventory items.`, type: 'success' });
                        }
                    } else {
                        setIsImporting(false);
                    }
                } catch (err) {
                    console.error("Critical Import Error:", err);
                    setMessage({ text: "A critical error occurred while parsing the CSV data.", type: 'error' });
                } finally {
                    setIsImporting(false);
                }
            };
            
            reader.readAsText(file);
        }, 300);

        e.target.value = null;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 relative">
            
            {/* Loading Overlay */}
            {isImporting && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 rounded-3xl flex flex-col items-center justify-center -m-6">
                    <div className="bg-white px-8 py-6 rounded-2xl shadow-xl shadow-[#08834c]/10 border border-[#08834c]/20 flex flex-col items-center max-w-sm animate-in zoom-in-95 duration-200">
                         <Activity size={48} className="animate-spin text-[#08834c] mb-4" />
                         <h3 className="font-bold text-lg text-slate-800 mb-1">Importing Inventory</h3>
                         <p className="text-sm text-slate-500 text-center leading-relaxed">Reading your CSV file and securely syncing with the database...</p>
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
