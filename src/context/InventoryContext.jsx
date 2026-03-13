import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
    const { user, authLoading, isAdmin, userFullName } = useAuth();
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleTheme = () => setIsDarkMode(prev => !prev);

    const [activeTab, setActiveTab] = useState('dashboard');
    const [inventory, setInventory] = useState([]);
    const [historyRecords, setHistoryRecords] = useState([]);
    const [categoryMap, setCategoryMap] = useState({});
    const [hiddenCategories, setHiddenCategories] = useState([]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 768);

    // SEPARATED SEARCH STATES
    const [dashboardSearch, setDashboardSearch] = useState('');
    const [dispenseSearch, setDispenseSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [categoryViewMode, setCategoryViewMode] = useState('products');

    // Cart State for Dispensing
    const [cart, setCart] = useState([]);
    const [dispenseTab, setDispenseTab] = useState('create');
    const [recordSearch, setRecordSearch] = useState('');

    // Purchase Order State
    const [poDraft, setPoDraft] = useState([]);
    const [poSearch, setPoSearch] = useState('');
    const [poFilter, setPoFilter] = useState('low');
    const [poHistory, setPoHistory] = useState([]);
    const [poHistorySearch, setPoHistorySearch] = useState('');
    const [poTab, setPoTab] = useState('create');
    const [receivingPO, setReceivingPO] = useState(null);
    const [viewingPO, setViewingPO] = useState(null);

    // Modals & Settings State
    const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
    const [receiveMode, setReceiveMode] = useState('existing');
    const [viewingProduct, setViewingProduct] = useState(null);
    const [editingProduct, setEditingProduct] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [viewingRecord, setViewingRecord] = useState(null);
    const [editingRecord, setEditingRecord] = useState(null);
    const [settings, setSettings] = useState({ weekStartDay: 1, monthStartDate: 1, chartType: 'bar' });

    const [receiveForm, setReceiveForm] = useState({ id: '', name: '', category: 'Antibiotics', quantity: '', price: '', unit: 'Tablets', threshold: '50' });

    // Settings & Category Modals
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [categoryModalMode, setCategoryModalMode] = useState('add');
    const [categoryForm, setCategoryForm] = useState({ name: '', icon: 'Package', oldName: '' });

    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' });

    const showConfirm = (title, message, onConfirm, type = 'danger') => {
        setConfirmModal({ isOpen: true, title, message, onConfirm, type });
    };

    const closeConfirm = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    // Dispense Notifications (admin only, persisted to localStorage for 24h)
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const [dispenseNotifications, setDispenseNotifications] = useState(() => {
        try {
            const stored = localStorage.getItem('dispenseNotifications');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Filter out notifications older than 24 hours
                const cutoff = Date.now() - ONE_DAY_MS;
                return parsed.filter(n => new Date(n.timestamp).getTime() > cutoff);
            }
        } catch (e) { /* ignore parse errors */ }
        return [];
    });
    const [showNotifications, setShowNotifications] = useState(false);
    const unreadNotificationCount = dispenseNotifications.filter(n => !n.read).length;

    // Persist notifications to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('dispenseNotifications', JSON.stringify(dispenseNotifications));
    }, [dispenseNotifications]);

    const addDispenseNotification = useCallback((notification) => {
        setDispenseNotifications(prev => [notification, ...prev].slice(0, 50));
    }, []);

    const markAllNotificationsRead = useCallback(() => {
        setDispenseNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearNotifications = useCallback(() => {
        setDispenseNotifications([]);
    }, []);

    // Supabase Sync
    const refreshData = async () => {
        try {
            // Fetch Categories
            const { data: catData } = await supabase.from('categories').select('*');
            if (catData) {
                const cMap = {};
                catData.forEach(c => { cMap[c.name] = c.icon; });
                setCategoryMap(cMap);
            }

            // Fetch Settings
            const { data: settsData } = await supabase.from('settings').select('*').limit(1).single();
            if (settsData) {
                setSettings({ weekStartDay: settsData.week_start_day, monthStartDate: settsData.month_start_date, chartType: settsData.chart_type || 'bar' });
            }

            // Fetch Inventory
            const { data: invData } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
            if (invData) {
                setInventory(invData.map(i => ({
                    ...i,
                    price: Number(i.price) // map decimal to number
                })));
            }

            // Fetch Purchase Orders
            const { data: poData } = await supabase.from('purchase_orders').select(`
                *,
                purchase_order_items (*)
            `).order('date', { ascending: false });

            if (poData) {
                setPoHistory(poData.map(po => ({
                    poId: po.po_id,
                    status: po.status,
                    date: po.date,
                    completionDate: po.completion_date,
                    items: (po.purchase_order_items || []).map(poi => ({
                        id: poi.item_id,
                        name: poi.item_name,
                        unit: poi.item_unit,
                        orderQty: poi.order_qty,
                        receivedQty: poi.received_qty,
                        price: Number(poi.price)
                    }))
                })));
            }

            // Fetch Dispense History
            const { data: dispData } = await supabase.from('dispense_history').select(`
                *,
                dispense_history_items (*)
            `).order('timestamp', { ascending: false });

            if (dispData) {
                setHistoryRecords(dispData.map(d => ({
                    recordId: d.record_id,
                    timestamp: d.timestamp,
                    totalAmount: Number(d.total_amount),
                    dispensedBy: d.dispensed_by || null,
                    items: d.dispense_history_items.map(di => ({
                        id: di.item_id,
                        name: di.item_name,
                        dispenseQty: di.dispense_qty,
                        price: Number(di.price)
                    }))
                })));
            }

        } catch (error) {
            console.error("Error fetching data from Supabase:", error);
        } finally {
            setIsInitialLoad(false);
        }
    };

    useEffect(() => {
        if (authLoading) return; // wait for auth to resolve first

        let subscription;
        if (user) {
            refreshData();

            subscription = supabase
                .channel('public-db-changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public' },
                    (payload) => {
                        console.log('Real-time sync triggered by:', payload.table);

                        // Detect dispense by another user → notify admin
                        if (
                            payload.eventType === 'INSERT' &&
                            payload.table === 'dispense_history' &&
                            payload.new?.dispensed_by
                        ) {
                            const dispensedByName = payload.new.dispensed_by;
                            if (isAdmin && dispensedByName !== userFullName) {
                                addDispenseNotification({
                                    id: payload.new.record_id || Date.now().toString(),
                                    dispensedBy: dispensedByName,
                                    totalAmount: Number(payload.new.total_amount),
                                    timestamp: payload.new.timestamp,
                                    read: false,
                                });
                            }
                        }

                        refreshData();
                    }
                )
                .subscribe();

        } else {
            // Not logged in, skip data fetch and clear loading
            setIsInitialLoad(false);
        }

        return () => {
            if (subscription) {
                supabase.removeChannel(subscription);
            }
        };
    }, [user, authLoading, isAdmin, userFullName, addDispenseNotification]);

    // Enrich notifications with item counts after data refresh
    useEffect(() => {
        if (dispenseNotifications.some(n => !n.itemCount)) {
            setDispenseNotifications(prev => prev.map(n => {
                if (!n.itemCount) {
                    const record = historyRecords.find(r => r.recordId === n.id);
                    if (record) {
                        return {
                            ...n,
                            itemCount: record.items.length,
                            totalUnits: record.items.reduce((s, i) => s + (parseInt(i.dispenseQty) || 0), 0)
                        };
                    }
                }
                return n;
            }));
        }
    }, [historyRecords, dispenseNotifications]);

    const contextValue = {
        isInitialLoad, refreshData,
        isDarkMode, toggleTheme,
        activeTab, setActiveTab,
        inventory, setInventory,
        historyRecords, setHistoryRecords,
        categoryMap, setCategoryMap,
        hiddenCategories, setHiddenCategories,
        isSidebarCollapsed, setIsSidebarCollapsed,
        dashboardSearch, setDashboardSearch,
        dispenseSearch, setDispenseSearch,
        statusFilter, setStatusFilter,
        categoryFilter, setCategoryFilter,
        categoryViewMode, setCategoryViewMode,
        cart, setCart,
        dispenseTab, setDispenseTab,
        recordSearch, setRecordSearch,
        poDraft, setPoDraft,
        poSearch, setPoSearch,
        poFilter, setPoFilter,
        poHistory, setPoHistory,
        poHistorySearch, setPoHistorySearch,
        poTab, setPoTab,
        receivingPO, setReceivingPO,
        viewingPO, setViewingPO,
        isReceivingModalOpen, setIsReceivingModalOpen,
        receiveMode, setReceiveMode,
        viewingProduct, setViewingProduct,
        editingProduct, setEditingProduct,
        editForm, setEditForm,
        viewingRecord, setViewingRecord,
        editingRecord, setEditingRecord,
        receiveForm, setReceiveForm,
        settings, setSettings,
        categoryForm, setCategoryForm,
        isCategoryModalOpen, setIsCategoryModalOpen,
        categoryModalMode, setCategoryModalMode,
        confirmModal, showConfirm, closeConfirm,
        dispenseNotifications, showNotifications, setShowNotifications,
        unreadNotificationCount, markAllNotificationsRead, clearNotifications
    };

    return (
        <InventoryContext.Provider value={contextValue}>
            {children}
        </InventoryContext.Provider>
    );
};
