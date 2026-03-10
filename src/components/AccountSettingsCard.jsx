import React, { useState } from 'react';
import { User, Mail, Lock, ShieldCheck, AlertTriangle, Key, Activity, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const AccountSettingsCard = () => {
    const { userFullName, userRole, user, logout } = useAuth();
    const [isLoadingPwd, setIsLoadingPwd] = useState(false);
    const [isLoadingEmail, setIsLoadingEmail] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [passwordForm, setPasswordForm] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    const [emailForm, setEmailForm] = useState({
        newEmail: user?.email || '',
    });

    const handlePasswordChange = (e) => setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
    const handleEmailChange = (e) => setEmailForm({ ...emailForm, [e.target.name]: e.target.value });

    const updatePassword = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setMessage({ text: 'Passwords do not match.', type: 'error' });
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            setMessage({ text: 'Password must be at least 6 characters.', type: 'error' });
            return;
        }

        setIsLoadingPwd(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordForm.newPassword
            });

            if (error) throw error;

            setMessage({ text: 'Password updated successfully! Next time you log in, please use your new password.', type: 'success' });
            setPasswordForm({ newPassword: '', confirmPassword: '' });
        } catch (error) {
            setMessage({ text: error.message || 'Failed to update password.', type: 'error' });
        } finally {
            setIsLoadingPwd(false);
        }
    };

    const updateEmail = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });

        if (!emailForm.newEmail || emailForm.newEmail.trim() === user?.email) {
            setMessage({ text: 'Please enter a different email address.', type: 'error' });
            return;
        }

        setIsLoadingEmail(true);
        try {
            // Use the admin edge function to update email WITHOUT requiring confirmation
            const { data, error } = await supabase.functions.invoke('admin-user-manager', {
                body: { action: 'update_email', newEmail: emailForm.newEmail.trim() }
            });

            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            setMessage({ text: `Email updated to "${emailForm.newEmail.trim()}". You will use this to log in next time.`, type: 'success' });
        } catch (error) {
            setMessage({ text: error.message || 'Failed to update email.', type: 'error' });
        } finally {
            setIsLoadingEmail(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 w-full max-w-2xl">
            <div className="flex justify-between items-start sm:items-center mb-6 gap-3">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <User size={20} className="text-[#08834c] shrink-0" />
                        My Account Settings
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Manage your personal credentials securely</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[#08834c] text-white flex items-center justify-center font-bold shadow-sm text-xs">
                        {userFullName?.charAt(0) || 'U'}
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-bold text-slate-800 leading-tight">{userFullName || 'User'}</p>
                        <p className="text-[10px] text-slate-500 capitalize leading-tight">{userRole || 'Staff'}</p>
                    </div>
                </div>
            </div>

            {message.text && (
                <div className={`p-3 sm:p-4 rounded-xl mb-6 text-sm font-bold flex items-start sm:items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-[#edf6f1] text-[#08834c] border border-[#c4e6d2]'}`}>
                    <span className="shrink-0 mt-0.5 sm:mt-0">{message.type === 'error' ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}</span>
                    {message.text}
                </div>
            )}

            <div className="space-y-5">
                {/* Email Update Section */}
                <div className="p-4 sm:p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-colors">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                        <Mail size={16} className="text-slate-500" /> Professional Email
                    </h4>
                    <form onSubmit={updateEmail} className="flex flex-col sm:flex-row gap-3 sm:items-end">
                        <div className="flex-1">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1 ml-1 uppercase tracking-wider">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <Mail size={16} />
                                </div>
                                <input
                                    type="email" name="newEmail" required value={emailForm.newEmail} onChange={handleEmailChange}
                                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#08834c] outline-none text-sm text-slate-800"
                                    placeholder="Enter new email..."
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoadingEmail || !emailForm.newEmail || emailForm.newEmail.trim() === user?.email}
                            className="w-full sm:w-auto h-[42px] px-5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                            {isLoadingEmail ? <Activity size={16} className="animate-spin" /> : 'Update Email'}
                        </button>
                    </form>
                </div>

                {/* Password Update Section */}
                <div className="p-4 sm:p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-colors">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                        <Key size={16} className="text-slate-500" /> Security Credentials
                    </h4>
                    <form onSubmit={updatePassword} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-1 ml-1 uppercase tracking-wider">New Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type="password" name="newPassword" required value={passwordForm.newPassword} onChange={handlePasswordChange} minLength={6}
                                        autoComplete="new-password"
                                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#08834c] outline-none text-sm text-slate-800"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-1 ml-1 uppercase tracking-wider">Confirm Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <ShieldCheck size={16} />
                                    </div>
                                    <input
                                        type="password" name="confirmPassword" required value={passwordForm.confirmPassword} onChange={handlePasswordChange} minLength={6}
                                        autoComplete="new-password"
                                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#08834c] outline-none text-sm text-slate-800"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={isLoadingPwd || !passwordForm.newPassword}
                                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 text-white font-bold rounded-lg shadow-sm hover:bg-slate-900 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 text-sm"
                            >
                                {isLoadingPwd ? <Activity size={16} className="animate-spin" /> : <>Update Password <ArrowRight size={16} /></>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
