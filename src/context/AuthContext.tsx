import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  userRole: 'admin' | 'cashier' | 'customer' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'cashier' | 'customer' | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[Auth] Error fetching user profile role:', error.message);
        setUserRole(null);
        return;
      }

      if (data && data.role) {
        setUserRole(data.role as 'admin' | 'cashier' | 'customer');
      } else {
        // Default role if not found
        setUserRole('customer');
      }
    } catch (err) {
      console.warn('[Auth] Could not fetch profile role:', err);
      setUserRole(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    }
  }, [user?.id, fetchUserProfile]);

  useEffect(() => {
    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session: initSession }, error }) => {
      if (!error && initSession) {
        setSession(initSession);
        setUser(initSession.user);
        if (initSession.user) {
          fetchUserProfile(initSession.user.id);
        }
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    // 2. Realtime auth listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user || null);

      if (currentSession?.user) {
        await fetchUserProfile(currentSession.user.id);
      } else {
        setUserRole(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw new Error(error.message || 'Credenciales incorrectas');
      }

      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        await fetchUserProfile(data.user.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setUserRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = userRole === 'admin';
  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        userRole,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
