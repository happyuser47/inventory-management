import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Activity, Stethoscope, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import pdfLogo from '../assets/pdf.png';

export const AuthView = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [form, setForm] = useState({
        email: '',
        password: '',
        fullName: '',
        role: 'user' // default, 'admin' or 'user'
    });

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: form.email,
                password: form.password,
            });
            if (error) throw error;
        } catch (error) {
            setMessage({ text: error.message || 'An error occurred', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center bg-slate-50 overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#e3f4ea] rounded-full blur-3xl opacity-60 animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#e0f1eb] rounded-full blur-3xl opacity-60"></div>
                <div className="absolute top-[30%] right-[10%] w-[20%] h-[20%] bg-blue-50 rounded-full blur-3xl opacity-50"></div>
            </div>

            <div className="relative z-10 w-full max-w-5xl flex flex-col md:flex-row bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] overflow-hidden m-4 min-h-[600px] border border-slate-100">

                {/* Visual Side */}
                <div className="hidden md:flex flex-col flex-1 bg-gradient-to-br from-[#08834c] to-[#056038] text-white p-12 justify-between relative overflow-hidden">
                    <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-black/10 rounded-full blur-2xl"></div>

                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 shadow-lg border border-white/20 text-white">
                            <Activity size={32} />
                        </div>
                        <h1 className="text-4xl font-bold mb-4 tracking-tight leading-tight">
                            MNHC<br />System Access
                        </h1>
                        <p className="text-[#a8dec2] text-lg font-medium max-w-sm">
                            Secure, intelligent, and professional hospital management for the modern clinic.
                        </p>
                    </div>

                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-4 bg-black/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                            <ShieldCheck size={28} className="text-[#86e0ad]" />
                            <div>
                                <h4 className="font-bold text-sm">Role-Based Security</h4>
                                <p className="text-xs text-white/70">Admin & Staff designated access levels</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-black/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                            <Stethoscope size={28} className="text-[#86e0ad]" />
                            <div>
                                <h4 className="font-bold text-sm">Clinical Exellence</h4>
                                <p className="text-xs text-white/70">Precision inventory & dispensing</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Side */}
                <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center bg-white relative">

                    <div className="max-w-md w-full mx-auto">
                        <div className="mb-10 text-center md:text-left flex flex-col items-center md:items-start">
                            {/* Highly Professional Logo Placement */}
                            <div className="mb-8 p-3 bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)] inline-flex justify-center items-center transition-transform hover:scale-105 duration-300">
                                <img src={pdfLogo} alt="MNHC Logo" className="h-16 md:h-20 w-auto object-contain drop-shadow-sm" />
                            </div>

                            <h2 className="text-3xl font-bold text-slate-800 mb-2">
                                Welcome Back
                            </h2>
                            <p className="text-slate-500 font-medium">
                                Enter your clinical credentials to proceed
                            </p>
                        </div>

                        {message.text && (
                            <div className={`p-4 rounded-xl mb-6 text-sm font-bold flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-[#edf6f1] text-[#08834c] border border-[#c4e6d2]'}`}>
                                {message.type === 'error' ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        value={form.email}
                                        onChange={handleChange}
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none text-slate-800 font-medium transition-all"
                                        placeholder="user@mnhc.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        name="password"
                                        required
                                        value={form.password}
                                        onChange={handleChange}
                                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#08834c] outline-none text-slate-800 font-medium transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 bg-[#08834c] text-white font-bold rounded-xl shadow-lg shadow-green-600/20 hover:bg-[#076c3e] hover:shadow-green-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-6 md:mt-8 disabled:opacity-70 disabled:pointer-events-none"
                            >
                                {isLoading ? (
                                    <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <>
                                        Access System
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
