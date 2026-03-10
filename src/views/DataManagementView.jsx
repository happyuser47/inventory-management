import React, { useRef } from 'react';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { escapeCSV, parseCSVRow, triggerDownload } from '../utils/helpers';

export const DataManagementView = () => {
    const { inventory, setInventory, setCategoryMap, showConfirm } = useInventory();
    const fileInputRef = useRef(null);

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

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            const lines = text.split(/\r?\n/).filter(line => line.trim());

            if (lines.length <= 1) {
                showConfirm("Import Failed", "The selected file is empty or contains no data rows to import.", null, 'amber');
                return;
            }

            const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
            const newItems = [];
            let importedCount = 0;
            let mergedCount = 0;

            const idIdx = headers.indexOf('id');
            const nameIdx = headers.indexOf('name');
            const catIdx = headers.indexOf('category');
            const unitIdx = headers.indexOf('unit');
            const priceIdx = headers.indexOf('price');
            const qtyIdx = headers.indexOf('quantity');
            const threshIdx = headers.indexOf('threshold');

            if (nameIdx === -1) {
                showConfirm("Invalid Format", "Invalid file format. The 'Name' column is required.", null, 'amber');
                return;
            }

            for (let i = 1; i < lines.length; i++) {
                const row = parseCSVRow(lines[i]);
                if (row.length < headers.length && row.length <= 1) continue;

                const name = row[nameIdx] || '';
                if (!name) continue;

                let id = idIdx > -1 ? row[idIdx] : '';
                const category = catIdx > -1 && row[catIdx] ? row[catIdx] : 'Others';
                const unit = unitIdx > -1 && row[unitIdx] ? row[unitIdx] : 'Tablets';
                const price = priceIdx > -1 ? parseFloat(row[priceIdx]) || 0 : 0;
                const quantity = qtyIdx > -1 ? parseInt(row[qtyIdx]) || 0 : 0;
                const threshold = threshIdx > -1 ? parseInt(row[threshIdx]) || 50 : 50;

                if (!id) id = `#MED${Math.floor(1000 + Math.random() * 9000)}`;

                newItems.push({ id, name, category, unit, price, quantity, threshold });
            }

            if (newItems.length > 0) {
                // Bulk Process with Supabase
                import('../lib/supabase').then(async ({ supabase }) => {
                    const { refreshData } = await import('../context/InventoryContext').then(m => window.inventoryRefreshData);

                    // Handle missing categories
                    const categoriesToEnsure = [...new Set(newItems.map(i => i.category))];
                    const catInsertions = categoriesToEnsure.map(cat => ({ name: cat, icon: 'Package' }));
                    await supabase.from('categories').upsert(catInsertions, { onConflict: 'name', ignoreDuplicates: true });

                    // Handle inventory upsert
                    // Mapping local field names to match schema if necessary. In our schema, names are identical.
                    const inventoryInsertions = newItems.map(item => ({
                        id: item.id,
                        name: item.name,
                        category: item.category,
                        unit: item.unit,
                        price: item.price,
                        quantity: item.quantity,
                        threshold: item.threshold
                    }));

                    const { error } = await supabase.from('inventory').upsert(inventoryInsertions, { onConflict: 'id' });

                    if (error) {
                        console.error(error);
                        showConfirm("Import Error", "Error importing to backend database. Please check your data and try again.", null, 'danger');
                    } else {
                        await window.inventoryRefreshData?.();
                        showConfirm("Success", `File processed successfully. Attempted to import/update ${inventoryInsertions.length} items.`, null, 'amber');
                    }
                });
            }
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Data Management</h2>
                <p className="text-sm text-slate-500 mt-1">Import or export your inventory data securely via CSV files.</p>
            </div>

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
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                        Upload CSV File
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
