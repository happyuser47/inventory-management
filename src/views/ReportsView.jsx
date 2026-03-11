import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { FileBarChart, Download, Calendar, FileText, Table, AlertCircle } from 'lucide-react';
import { formatDisplayDate } from '../utils/helpers';
import { CLINIC_LOGO_BASE64 } from '../utils/clinicLogo';

export const ReportsView = () => {
    const { historyRecords, poHistory, inventory } = useInventory();

    // Default to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    const [reportFormat, setReportFormat] = useState('pdf'); // 'pdf' or 'excel'
    const [includePO, setIncludePO] = useState(true);
    const [includeDispense, setIncludeDispense] = useState(true);

    // Filter Logic
    const reportData = useMemo(() => {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Process Dispense History (Sales)
        const filteredDispense = includeDispense ? historyRecords.filter(record => {
            const recordDate = new Date(record.timestamp);
            return recordDate >= start && recordDate <= end;
        }) : [];

        const dispenseItemsMap = {};
        let totalDispenseValue = 0;
        let totalDispenseUnits = 0;

        filteredDispense.forEach(record => {
            totalDispenseValue += Number(record.totalAmount || 0);
            record.items.forEach(item => {
                totalDispenseUnits += Number(item.dispenseQty);
                if (!dispenseItemsMap[item.id]) {
                    const invItem = inventory.find(inv => inv.id === item.id);
                    dispenseItemsMap[item.id] = { name: item.name, qty: 0, value: 0, left: invItem ? invItem.quantity : 0 };
                }
                dispenseItemsMap[item.id].qty += Number(item.dispenseQty);
                dispenseItemsMap[item.id].value += (Number(item.price) * Number(item.dispenseQty));
            });
        });

        // Process Purchase Orders (Coming in)
        const filteredPO = includePO ? poHistory.filter(po => {
            const poDate = new Date(po.date);
            return poDate >= start && poDate <= end && po.status === 'Completed';
        }) : [];

        const purchaseItemsMap = {};
        let totalPurchaseValue = 0;
        let totalPurchaseUnits = 0;

        filteredPO.forEach(po => {
            po.items.forEach(item => {
                // Focus on received qty instead of order qty for what "came in"
                const received = Number(item.receivedQty || 0);
                if (received > 0) {
                    const lineTotal = received * Number(item.price || 0);
                    totalPurchaseValue += lineTotal;
                    totalPurchaseUnits += received;

                    if (!purchaseItemsMap[item.id]) {
                        const invItem = inventory.find(inv => inv.id === item.id);
                        purchaseItemsMap[item.id] = { name: item.name, qty: 0, value: 0, left: invItem ? invItem.quantity : 0 };
                    }
                    purchaseItemsMap[item.id].qty += received;
                    purchaseItemsMap[item.id].value += lineTotal;
                }
            });
        });

        const topDispensed = Object.values(dispenseItemsMap).sort((a, b) => b.qty - a.qty);
        const topPurchased = Object.values(purchaseItemsMap).sort((a, b) => b.qty - a.qty);

        return {
            totalDispenseValue,
            totalDispenseUnits,
            topDispensed,
            totalPurchaseValue,
            totalPurchaseUnits,
            topPurchased,
            dispenseCount: filteredDispense.length,
            poCount: filteredPO.length
        };
    }, [historyRecords, poHistory, inventory, startDate, endDate, includePO, includeDispense]);

    const generatePDF = () => {
        const printWindow = window.open('', '_blank');
        const startStr = formatDisplayDate(new Date(startDate));
        const endStr = formatDisplayDate(new Date(endDate));

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Comprehensive Inventory Report</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.6; max-width: 900px; margin: auto; padding: 40px; }
            
            .logo-banner { text-align: center; padding-bottom: 20px; border-bottom: 3px solid #08834c; margin-bottom: 30px; }
            .logo-banner img { max-width: 300px; height: auto; }
            .logo-banner h1 { margin-top: 15px; color: #08834c; font-size: 24px; }
            .logo-banner p { color: #64748b; font-size: 14px; }
            
            .summary-cards { display: flex; gap: 20px; margin-bottom: 40px; }
            .card { flex: 1; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center; }
            .card-title { color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
            .card-value { color: #0f172a; font-size: 28px; font-weight: bold; }
            .card-value.green { color: #08834c; }
            .card-value.blue { color: #0284c7; }
            .card-sub { color: #94a3b8; font-size: 13px; margin-top: 5px; }

            .section-title { font-size: 18px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; margin-top: 30px; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background-color: #f1f5f9; color: #475569; font-size: 12px; text-align: left; padding: 12px 15px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
            td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; background-color: #f8fafc; }
            
            .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="logo-banner">
            <img src="${CLINIC_LOGO_BASE64}" alt="Clinic Logo" />
            <h1>Comprehensive Inventory Report</h1>
            <p>Date Range: ${startStr} to ${endStr}</p>
            <p>Generated on: ${formatDisplayDate(new Date())}</p>
          </div>

          <div class="summary-cards">
            ${includePO ? `
            <div class="card">
              <div class="card-title">Total Incoming (Purchases)</div>
              <div class="card-value blue">${reportData.totalPurchaseUnits} units</div>
              <div class="card-sub">Rs. ${reportData.totalPurchaseValue.toLocaleString()}</div>
            </div>` : ''}
            ${includeDispense ? `
            <div class="card">
              <div class="card-title">Total Outgoing (Dispenses)</div>
              <div class="card-value green">${reportData.totalDispenseUnits} units</div>
              <div class="card-sub">Rs. ${reportData.totalDispenseValue.toLocaleString()}</div>
            </div>` : ''}
          </div>

          ${includePO ? `
          <div class="section-title">Incoming Items Summary (Completed Purchases)</div>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th class="text-right">Units Received</th>
                <th class="text-right">Total Value (Rs.)</th>
                <th class="text-right">Stock Left</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.topPurchased.length > 0 ? reportData.topPurchased.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td class="text-right">${item.qty}</td>
                  <td class="text-right">${item.value.toFixed(2)}</td>
                  <td class="text-right">${item.left}</td>
                </tr>
              `).join('') : `<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No purchase records found for this period.</td></tr>`}
            </tbody>
          </table>` : ''}

          ${includeDispense ? `
          <div class="section-title">Outgoing Items Summary (Dispenses / Sales)</div>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th class="text-right">Units Dispensed</th>
                <th class="text-right">Total Value (Rs.)</th>
                <th class="text-right">Stock Left</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.topDispensed.length > 0 ? reportData.topDispensed.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td class="text-right">${item.qty}</td>
                  <td class="text-right">${item.value.toFixed(2)}</td>
                  <td class="text-right">${item.left}</td>
                </tr>
              `).join('') : `<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No dispense records found for this period.</td></tr>`}
            </tbody>
          </table>` : ''}

          <div class="footer">
            Generated by Dr Usama Akram • Authorized Record
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const generateExcelCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";

        // Header
        csvContent += "REPORT PERIOD: " + startDate + " to " + endDate + "\n\n";

        // Overview
        csvContent += "OVERVIEW\n";
        csvContent += "Type,Total Units,Total Value (Rs.)\n";
        if (includePO) csvContent += `Purchases (Incoming),${reportData.totalPurchaseUnits},${reportData.totalPurchaseValue}\n`;
        if (includeDispense) csvContent += `Dispenses (Outgoing),${reportData.totalDispenseUnits},${reportData.totalDispenseValue}\n`;
        csvContent += "\n";

        // Purchases Data
        if (includePO) {
            csvContent += "INCOMING ITEMS (Purchases)\n";
            csvContent += "Item Name,Units Received,Total Value (Rs.),Stock Left\n";
            reportData.topPurchased.forEach(item => {
                csvContent += `"${item.name}",${item.qty},${item.value},${item.left}\n`;
            });
            csvContent += "\n";
        }

        // Dispense Data
        if (includeDispense) {
            csvContent += "OUTGOING ITEMS (Dispenses)\n";
            csvContent += "Item Name,Units Dispensed,Total Value (Rs.),Stock Left\n";
            reportData.topDispensed.forEach(item => {
                csvContent += `"${item.name}",${item.qty},${item.value},${item.left}\n`;
            });
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `inventory_report_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGenerate = () => {
        if (reportFormat === 'pdf') {
            generatePDF();
        } else {
            generateExcelCSV();
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 md:px-0 pb-12 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <FileBarChart className="text-[#08834c] shrink-0" size={32} />
                        Reports Portal
                    </h1>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Calendar size={20} className="text-[#08834c]" />
                        Report Configuration
                    </h2>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">From Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#08834c] focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">To Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={startDate}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#08834c] focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">Data to Include</label>
                        <div className="flex flex-col sm:flex-row gap-6">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input 
                                        type="checkbox" 
                                        checked={includePO} 
                                        onChange={(e) => setIncludePO(e.target.checked)}
                                        className="appearance-none w-5 h-5 border-2 border-slate-300 rounded cursor-pointer checked:bg-[#08834c] checked:border-[#08834c] group-hover:border-[#08834c] transition-colors"
                                    />
                                    {includePO && <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <span className="text-sm font-medium text-slate-700 select-none">Purchase Orders (Incoming)</span>
                            </label>
                            
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input 
                                        type="checkbox" 
                                        checked={includeDispense} 
                                        onChange={(e) => setIncludeDispense(e.target.checked)}
                                        className="appearance-none w-5 h-5 border-2 border-slate-300 rounded cursor-pointer checked:bg-[#08834c] checked:border-[#08834c] group-hover:border-[#08834c] transition-colors"
                                    />
                                    {includeDispense && <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <span className="text-sm font-medium text-slate-700 select-none">Dispense History (Outgoing)</span>
                            </label>
                        </div>
                    </div>

                    <div className="mb-8">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">Report Format</label>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => setReportFormat('pdf')}
                                className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-center gap-3 transition-all ${reportFormat === 'pdf' ? 'border-[#08834c] bg-emerald-50 text-[#08834c]' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                            >
                                <FileText size={24} />
                                <span className="font-bold">PDF Document</span>
                            </button>
                            <button
                                onClick={() => setReportFormat('excel')}
                                className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-center gap-3 transition-all ${reportFormat === 'excel' ? 'border-[#08834c] bg-emerald-50 text-[#08834c]' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                            >
                                <Table size={24} />
                                <span className="font-bold">Excel (CSV)</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex pt-6 border-t border-slate-100">
                        <button
                            onClick={handleGenerate}
                            className="w-full sm:w-auto bg-[#08834c] hover:bg-[#076c3e] text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition-all sm:ml-auto"
                        >
                            <Download size={20} />
                            Generate & Download Report
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-blue-100 p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-slate-600">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                    <AlertCircle size={24} />
                </div>
                <div>
                    <h3 className="text-slate-800 font-bold mb-1 text-center sm:text-left">Report Data Summary</h3>
                    <p className="text-sm leading-relaxed text-center sm:text-left">
                        This report fetches Live Cloud Data containing precisely calculated transaction volumes and stock impacts directly from the MNHC databases. Purchases only include "Completed" purchase orders showing received items.
                    </p>
                </div>
            </div>
        </div>
    );
};
