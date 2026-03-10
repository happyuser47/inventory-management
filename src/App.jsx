import React from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Modals } from './components/Modals';
import { DashboardView } from './views/DashboardView';
import { DispenseView } from './views/DispenseView';
import { PurchaseOrderView } from './views/PurchaseOrderView';
import { InventoryView } from './views/InventoryView';
import { DataManagementView } from './views/DataManagementView';
import { SettingsView } from './views/SettingsView';
import { AuthView } from './views/AuthView';
import { Menu } from 'lucide-react';
import mobileClinicLogo from './assets/pdf.png';
import './App.css';

const AppContent = () => {
  const { isInitialLoad, isDarkMode, activeTab, setActiveTab, isSidebarCollapsed, setIsSidebarCollapsed } = useInventory();
  const { user, authLoading, isAdmin } = useAuth();


  if (isInitialLoad || authLoading) {
    return (
      <div className={`flex h-screen w-screen items-center justify-center transition-colors duration-500 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className="relative flex justify-center items-center">
          <div className="absolute animate-ping w-16 h-16 rounded-full bg-[#08834c] opacity-20"></div>
          <div className="absolute w-20 h-20 rounded-full border-t-4 border-b-4 border-[#08834c] animate-spin"></div>
          <div className="w-10 h-10 bg-[#08834c] text-white font-bold rounded-xl flex justify-center items-center text-lg shadow-lg z-10 animate-pulse">
            M
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans w-full">
      <Sidebar />
      <div className={`flex-1 min-w-0 transition-all duration-300 ml-0 relative flex flex-col h-screen w-full`}>
        {/* Mobile Nav Toggle */}
        <div className="md:hidden bg-white border-b border-slate-200 p-3 flex items-center justify-between shrink-0">
          <img src={mobileClinicLogo} alt="MNHC" className="h-9 w-auto object-contain" />
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 bg-slate-100 rounded-lg text-slate-600">
            <Menu size={20} />
          </button>
        </div>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'dispense' && <DispenseView />}
            {activeTab === 'purchase' && isAdmin && <PurchaseOrderView />}
            {activeTab === 'inventory' && isAdmin && <InventoryView />}
            {activeTab === 'data' && isAdmin && <DataManagementView />}
            {activeTab === 'settings' && isAdmin && <SettingsView />}
          </div>
        </div>
      </div>
      <Modals />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <InventoryProvider>
        <AppContent />
      </InventoryProvider>
    </AuthProvider>
  );
}
