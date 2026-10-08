
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, pass: string) => User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Nueva clave de sesión v5 para forzar la "limpia" de todos los usuarios
const SESSION_KEY = 'master_padel_auth_v5';

const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD = 'Mingo';
const FINANZAS_USERNAME = 'Administrador';
const FINANZAS_PASSWORD = 'Finanzas2026';
const STAFF_USERNAME = 'Master padel';
const STAFF_PASSWORD = 'MP2026';
const GUEST_USERNAME = 'Invitado';
const GUEST_PASSWORD = '123456';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Limpieza de cualquier rastro de sesiones antiguas
      const oldKeys = ['user', 'master_padel_auth_v2', 'master_padel_auth_v3', 'master_padel_auth_v4'];
      oldKeys.forEach(k => localStorage.removeItem(k));
      
      const storedUser = localStorage.getItem(SESSION_KEY);
       if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } else {
        setUser({ username: GUEST_USERNAME, role: 'guest' });
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem(SESSION_KEY);
      setUser({ username: GUEST_USERNAME, role: 'guest' });
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (username: string, pass: string): User | null => {
    let authenticatedUser: User | null = null;
    const u = username.trim();
    
    if (u.toLowerCase() === ADMIN_USERNAME.toLowerCase() && pass === ADMIN_PASSWORD) {
        authenticatedUser = { username: ADMIN_USERNAME, role: 'admin' };
    } else if (u.toLowerCase() === STAFF_USERNAME.toLowerCase() && pass === STAFF_PASSWORD) {
        authenticatedUser = { username: STAFF_USERNAME, role: 'admin' };
    } else if (u.toLowerCase() === FINANZAS_USERNAME.toLowerCase() && pass === FINANZAS_PASSWORD) {
        authenticatedUser = { username: FINANZAS_USERNAME, role: 'admin' };
    } else if (u.toLowerCase() === GUEST_USERNAME.toLowerCase() && pass === GUEST_PASSWORD) {
        authenticatedUser = { username: GUEST_USERNAME, role: 'guest' };
    }

    if (authenticatedUser) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      return authenticatedUser;
    }
    return null;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser({ username: GUEST_USERNAME, role: 'guest' });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
