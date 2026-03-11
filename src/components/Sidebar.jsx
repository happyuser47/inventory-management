import React from 'react';
import { LayoutDashboard, PackageSearch, Pill, Settings, Database, ClipboardList, ChevronRight, ChevronLeft, X, LogOut, User as UserIcon, FileBarChart } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import clinicLogo from '../assets/main.png';

export const Sidebar = () => {
    const { activeTab, setActiveTab, isSidebarCollapsed, setIsSidebarCollapsed } = useInventory();
    const { userFullName, userRole, isAdmin, logout } = useAuth();

    // Auto-collapse sidebar on mobile after selecting a tab
    const handleTabSelect = (tabId) => {
        setActiveTab(tabId);
        if (window.innerWidth < 768) {
            setIsSidebarCollapsed(true);
        }
    };

    const allNavItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', adminOnly: false },
        { id: 'dispense', icon: Pill, label: 'Dispense', adminOnly: false },
        { id: 'purchase', icon: ClipboardList, label: 'Purchase Order', adminOnly: true },
        { id: 'inventory', icon: PackageSearch, label: 'Inventory / Stock', adminOnly: true },
        { id: 'data', icon: Database, label: 'Data Management', adminOnly: true },
        { id: 'reports', icon: FileBarChart, label: 'Reports', adminOnly: true },
    ];

    const visibleNavItems = allNavItems.filter(nav => isAdmin || !nav.adminOnly);

    return (
        <>
            {/* Mobile Overlay Background */}
            {!isSidebarCollapsed && (
                <div
                    className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
                    onClick={() => setIsSidebarCollapsed(true)}
                ></div>
            )}

            <div className={`bg-slate-900 text-slate-300 flex flex-col h-screen transition-all duration-300 z-50 fixed md:relative shrink-0 shadow-2xl md:shadow-none
                ${isSidebarCollapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0 w-72 md:w-64'}`}>

                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="md:hidden absolute right-4 top-4 p-2 bg-slate-800 text-slate-300 rounded-lg hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Desktop Toggle Button */}
                <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="hidden md:block absolute -right-3 top-8 bg-[#08834c] text-white p-1.5 rounded-full shadow-md hover:bg-[#076c3e] transition-colors z-50 border-2 border-white"
                    title={isSidebarCollapsed ? "Expand Menu" : "Collapse Menu"}
                >
                    {isSidebarCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
                </button>

                <div className="p-4 flex justify-center items-center border-b border-slate-800/50 mb-2 h-24 overflow-hidden shrink-0">
                    {!isSidebarCollapsed ? (
                        <div className="flex flex-col items-center gap-2">
                            <img
                                src={clinicLogo}
                                alt="Maryam Nawaz Health Clinic"
                                className="max-h-12 w-auto object-contain drop-shadow-md"
                            />
                            <span className="text-[10px] uppercase font-bold tracking-widest text-[#86e0ad]">System Access</span>
                        </div>
                    ) : (
                        <div className="w-10 h-10 bg-[#08834c] text-white font-bold rounded-xl flex justify-center items-center text-lg animate-in zoom-in shadow-md">
                            M
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    {visibleNavItems.map(nav => {
                        const Icon = nav.icon;
                        return (
                            <button
                                key={nav.id}
                                onClick={() => handleTabSelect(nav.id)}
                                title={isSidebarCollapsed ? nav.label : ''}
                                className={`w-full flex items-center ${isSidebarCollapsed ? 'md:justify-center px-0' : 'justify-start px-4'} py-3.5 rounded-xl transition-all duration-200 active:scale-95 origin-left ${activeTab === nav.id ? 'bg-[#08834c] text-white shadow-lg ring-1 ring-white/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                            >
                                <Icon size={22} className="shrink-0" />
                                <span className={`font-medium ml-3 truncate ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>{nav.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-slate-800 shrink-0 space-y-2 bg-slate-950/30">
                    {isAdmin && (
                        <button
                            onClick={() => handleTabSelect('settings')}
                            title={isSidebarCollapsed ? 'Settings' : ''}
                            className={`w-full flex items-center ${isSidebarCollapsed ? 'md:justify-center px-0' : 'justify-start px-4'} py-3.5 rounded-xl transition-all duration-200 active:scale-95 origin-left ${activeTab === 'settings' ? 'bg-[#08834c] text-white shadow-lg ring-1 ring-white/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                        >
                            <Settings size={22} className="shrink-0" />
                            <span className={`font-medium ml-3 truncate ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Settings</span>
                        </button>
                    )}

                    {/* User Profile & Logout */}
                    <div className={`mt-2 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} p-3 rounded-xl bg-slate-800/50 border border-slate-700/50`}>
                        {!isSidebarCollapsed && (
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 shrink-0 border border-slate-600">
                                    <UserIcon size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{userFullName || 'Staff Member'}</p>
                                    <p className={`text-xs capitalize font-medium ${isAdmin ? 'text-[#86e0ad]' : 'text-blue-400'}`}>{userRole || 'User'}</p>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={logout}
                            title="Log out"
                            className="p-2.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors shrink-0"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
