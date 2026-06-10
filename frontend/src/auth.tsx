import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

type User = { id: string; email: string; name: string; role: 'ADMIN' | 'USER' };

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  ready: boolean;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    setReady(true);
  }, []);

  async function login(email: string, password: string) {
    const r = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', r.data.accessToken);
    localStorage.setItem('user', JSON.stringify(r.data.user));
    setToken(r.data.accessToken);
    setUser(r.data.user);
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch { /* token might be expired — still clear local */ }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, token, login, logout, ready }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
