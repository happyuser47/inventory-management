import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [userFullName, setUserFullName] = useState('');
    const [authLoading, setAuthLoading] = useState(true);

    const refreshProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', userId)
                .single();
            if (data && !error) {
                setUserRole(data.role);
                setUserFullName(data.full_name);
            } else {
                setUserRole('user'); // fallback
                setUserFullName('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        // Listen for auth changes but never block the callback with await
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser(session.user);
            } else {
                setUser(null);
                setUserRole(null);
                setUserFullName('');
                setAuthLoading(false);
            }
        });

        // Fallback catch for initial load if no session exists
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) setAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Perform database queries completely asynchronously to avoid Supabase auth lock deadlocks
    useEffect(() => {
        if (!user) return;

        let isMounted = true;

        const fetchProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('role, full_name')
                    .eq('id', user.id)
                    .single();

                if (isMounted) {
                    if (data && !error) {
                        setUserRole(data.role);
                        setUserFullName(data.full_name);
                    } else {
                        setUserRole('user');
                        setUserFullName('');
                    }
                }
            } catch (err) {
                console.error("Profile fetch error:", err);
            } finally {
                if (isMounted) setAuthLoading(false);
            }
        };

        fetchProfile();
        return () => { isMounted = false; };
    }, [user]);

    const logout = async () => {
        setAuthLoading(true);
        await supabase.auth.signOut();
        setAuthLoading(false);
    };

    const value = {
        user,
        userRole,
        userFullName,
        authLoading,
        logout,
        isAdmin: userRole === 'admin',
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
