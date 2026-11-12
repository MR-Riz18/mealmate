import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (payload) => {
    const d = await authApi.login(payload);
    setUser(d.user);
    return d;
  };
  const register = async (payload) => {
    const d = await authApi.register(payload);
    setUser(d.user);
    return d;
  };
  const logout = async () => {
    try { await authApi.logout(); } catch { /* already logged out */ }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, isAdmin: user?.role === 'admin', login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
