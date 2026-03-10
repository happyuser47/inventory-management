import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, ShieldCheck, User, Mail, Lock, AlertTriangle, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useInventory } from '../context/InventoryContext';

export const StaffManagementCard = () => {
    const { showConfirm } = useInventory();
    const [staff, setStaff] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [form, setForm] = useState({
        fullName: '',
        email: '',
        password: '',
        role: 'user'
    });

    const fetchStaff = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
            if (data) setStaff(data);
            if (error) console.error(error);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleAddStaff = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        setIsSubmitting(true);

        try {
            const { data, error } = await supabase.functions.invoke('admin-user-manager', {
                body: { action: 'create', email: form.email, password: form.password, fullName: form.fullName, role: form.role }
            });

            if (error) throw new Error(error.message || 'Failed to communicate with secure Edge Function');
            if (data?.error) throw new Error(data.error);

            setMessage({ text: 'Staff account created successfully!', type: 'success' });
            setForm({ fullName: '', email: '', password: '', role: 'user' });
            setIsAdding(false);
            fetchStaff();

        } catch (error) {
            console.error("Add staff error:", error);
            setMessage({ text: error.message || 'An error occurred', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDeleteStaff = (userId, userName, role) => {
        if (role === 'admin') {
            alert("Deleting an admin account is currently restricted for safety.");
            return;
        }

        showConfirm(
            "Revoke Staff Access?",
            `Are you sure you want to permanently delete the account for ${userName}? They will lose all access immediately.`,
            async () => {
                try {
                    const { data, error } = await supabase.functions.invoke('admin-user-manager', {
                        body: { action: 'delete', userId: userId }
                    });

                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);

                    fetchStaff();
                } catch (err) {
                    console.error("Delete staff error:", err);
                    alert("Failed to delete user: " + err.message);
                }
            }
        );
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 w-full max-w-2xl">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-[#08834c]" />
                        Staff Management
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Manage hospital access and system permissions</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => { setIsAdding(true); setMessage({ text: '', type: '' }); }}
                        className="text-sm bg-[#08834c] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#076c3e] transition-colors flex items-center gap-2 shadow-md shadow-green-600/20"
                    >
                        <UserPlus size={16} /> Add Staff
                    </button>
                )}
            </div>

            {message.text && (
                <div className={`p-4 rounded-xl mb-6 text-sm font-bold flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-[#edf6f1] text-[#08834c] border border-[#c4e6d2]'}`}>
                    {message.type === 'error' ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                    {message.text}
                </div>
            )}

            {isAdding && (
                <div className="mb-8 p-5 rounded-2xl border border-[#c4e6d2] bg-[#f8fbf9]">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ShieldCheck size={18} className="text-[#08834c]" /> Secure Account Creation
                    </h4>
                    <form onSubmit={handleAddStaff} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <User size={16} />
                                    </div>
                                    <input
                                        type="text" name="fullName" required value={form.fullName} onChange={handleChange}
                                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#08834c] outline-none text-sm text-slate-800"
                                        placeholder="Dr. Ali Khan"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Mail size={16} />
                                    </div>
                                    <input
                                        type="email" name="email" required value={form.email} onChange={handleChange}
                                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#08834c] outline-none text-sm text-slate-800"
                                        placeholder="ali@mnhc.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">Temporary Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type="password" name="password" required value={form.password} onChange={handleChange} minLength={6}
                                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#08834c] outline-none text-sm text-slate-800"
                                        placeholder="••••••••"
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">Access Level</label>
                                <select
                                    name="role" value={form.role} onChange={handleChange}
                                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#08834c] outline-none text-sm text-slate-800"
                                >
                                    <option value="user">Staff Member (Dispense Only)</option>
                                    <option value="admin">Administrator (Full Access)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2.5 text-slate-500 font-bold hover:bg-slate-200 rounded-lg transition-colors text-sm">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-[#08834c] text-white font-bold rounded-lg shadow-sm hover:bg-[#076c3e] transition-colors disabled:opacity-70 flex items-center justify-center gap-2 text-sm">
                                {isSubmitting ? <Activity size={16} className="animate-spin" /> : 'Create Account'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-3">
                {isLoading ? (
                    <div className="py-8 text-center text-slate-500 flex flex-col items-center">
                        <Activity size={24} className="animate-spin text-[#08834c] mb-2" />
                        <p className="text-sm font-medium">Loading system accounts...</p>
                    </div>
                ) : staff.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100">No staff members found.</div>
                ) : (
                    staff.map((member) => (
                        <div key={member.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-green-200 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm shrink-0 border-2 ${member.role === 'admin' ? 'bg-purple-600 border-purple-200' : 'bg-blue-600 border-blue-200'}`}>
                                    <span className="font-bold text-sm uppercase">{member.full_name?.charAt(0) || 'U'}</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{member.full_name || 'Unnamed Staff'}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {member.role === 'admin' ? 'Administrator' : 'Staff'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => confirmDeleteStaff(member.id, member.full_name, member.role)}
                                className={`p-2 rounded-lg transition-colors ${member.role === 'admin' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                title={member.role === 'admin' ? "Admins cannot be deleted directly here" : "Revoke Access"}
                                disabled={member.role === 'admin'}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
