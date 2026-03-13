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
import { ReportsView } from './views/ReportsView';
import { AuthView } from './views/AuthView';
import { Menu, BellRing, Pill } from 'lucide-react';
import mobileClinicLogo from './assets/pdf.png';
import './App.css';

const timeAgo = (timestamp) => {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const LoadingScreen = ({ title, subtitle, isDarkMode }) => (
  <div className={`flex h-screen items-center justify-center transition-colors duration-500 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-t-2 border-[#08834c] animate-spin"></div>
        <div className="absolute inset-2 rounded-full border-t-2 border-[#08834c]/60 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
      </div>
      <h2 className="mt-6 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#08834c] to-emerald-500">{title}</h2>
      <p className={`text-sm mt-2 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
    </div>
  </div>
);

const AppContent = () => {
  const {
    isInitialLoad, isDarkMode, activeTab, setActiveTab, isSidebarCollapsed, setIsSidebarCollapsed,
    dispenseNotifications, showNotifications, setShowNotifications,
    unreadNotificationCount, markAllNotificationsRead, clearNotifications
  } = useInventory();
  const { user, authLoading, isAdmin } = useAuth();
  const [showProgressiveLoader, setShowProgressiveLoader] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowProgressiveLoader(true), 200);
    return () => clearTimeout(timer);
  }, []);

  if (authLoading) {
    if (!showProgressiveLoader) return null;
    return <LoadingScreen title="Inventory Pro" subtitle="Verifying session..." isDarkMode={isDarkMode} />;
  }

  if (!user) {
    return <AuthView />;
  }

  if (isInitialLoad) {
    return <LoadingScreen title="Establishing Secure Connection" subtitle="Synchronizing inventory data and records..." isDarkMode={isDarkMode} />;
  }

  const NotificationBell = () => {
    if (!isAdmin) return null;
    return (
      <div className="relative">
        <button
          onClick={() => {
            setShowNotifications(!showNotifications);
            if (!showNotifications && unreadNotificationCount > 0) markAllNotificationsRead();
          }}
          className={`relative p-2.5 transition-all rounded-xl ${showNotifications ? 'bg-[#edf6f1] text-[#08834c]' : 'text-slate-400 hover:text-[#08834c] hover:bg-slate-50'}`}
        >
          <BellRing size={20} />
          {unreadNotificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
          )}
        </button>

        {showNotifications && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-[#edf6f1] to-white flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-[#08834c]/10 rounded-lg">
                    <Pill size={16} className="text-[#08834c]" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">Dispense Activity</h3>
                  {dispenseNotifications.length > 0 && (
                    <span className="bg-[#08834c] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {dispenseNotifications.length}
                    </span>
                  )}
                </div>
                {dispenseNotifications.length > 0 && (
                  <button onClick={clearNotifications} className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-wider transition-colors">
                    Clear
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {dispenseNotifications.length === 0 ? (
                  <div className="py-12 px-6 text-center">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Pill size={24} className="text-slate-200" />
                    </div>
                    <p className="text-sm font-medium text-slate-400">No recent dispense activity</p>
                    <p className="text-xs text-slate-300 mt-1">Notifications appear when staff dispenses</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {dispenseNotifications.map(notif => (
                      <li
                        key={notif.id}
                        onClick={() => { setActiveTab('dispense'); setShowNotifications(false); }}
                        className={`px-5 py-4 hover:bg-slate-50 transition-all cursor-pointer group ${!notif.read ? 'bg-[#edf6f1]/40 border-l-2 border-l-[#08834c]' : ''}`}
                      >
                        <div className="flex justify-between items-start gap-3 mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#08834c] to-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {notif.dispensedBy?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="font-bold text-sm text-slate-800">{notif.dispensedBy}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 mt-1">{timeAgo(notif.timestamp)}</span>
                        </div>
                        <div className="ml-[42px]">
                          <p className="text-xs text-slate-500">
                            Dispensed{notif.itemCount ? ` ${notif.itemCount} item${notif.itemCount > 1 ? 's' : ''}` : ''}{notif.totalUnits ? ` (${notif.totalUnits} units)` : ''}
                          </p>
                          <p className="text-sm font-bold text-[#08834c] mt-0.5">Rs. {notif.totalAmount?.toFixed(2) || '0.00'}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans w-full">
      <Sidebar />
      <div className={`flex-1 min-w-0 transition-all duration-300 ml-0 relative flex flex-col h-screen w-full`}>
        {/* Mobile Nav Toggle */}
        <div className="md:hidden bg-white border-b border-slate-200 p-3 flex items-center justify-between shrink-0">
          <img src={mobileClinicLogo} alt="MNHC" className="h-9 w-auto object-contain" />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Menu size={20} />
            </button>
          </div>
        </div>

        {/* Desktop Top Bar (admin only, for notifications) */}
        {isAdmin && (
          <div className="hidden md:flex items-center justify-end bg-white border-b border-slate-200 px-6 py-2 shrink-0">
            <NotificationBell />
          </div>
        )}

        <div className="p-4 md:p-8 flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-7xl mx-auto h-full">
            <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}><DashboardView /></div>
            <div className={activeTab === 'dispense' ? 'block' : 'hidden'}><DispenseView /></div>
            {isAdmin && (
              <>
                <div className={activeTab === 'purchase' ? 'block' : 'hidden'}><PurchaseOrderView /></div>
                <div className={activeTab === 'inventory' ? 'block' : 'hidden'}><InventoryView /></div>
                <div className={activeTab === 'data' ? 'block' : 'hidden'}><DataManagementView /></div>
                <div className={activeTab === 'reports' ? 'block' : 'hidden'}><ReportsView /></div>
                <div className={activeTab === 'settings' ? 'block' : 'hidden'}><SettingsView /></div>
              </>
            )}
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
