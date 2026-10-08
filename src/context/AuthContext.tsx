
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
      const storedUser = localStorage.getItem('user');
       if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } else {
        setUser({ username: GUEST_USERNAME, role: 'guest' });
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('user');
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
      localStorage.setItem('user', JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      return authenticatedUser;
    }
    
    return null;
  };

  const logout = () => {
    localStorage.removeItem('user');
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
