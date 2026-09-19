import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface User {
  username: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: zustandUser, login: zustandLogin, logout: zustandLogout, isAuthenticated } = useAuthStore();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (zustandUser && isAuthenticated) {
      setUser({
        username: zustandUser.username,
        role: zustandUser.role,
      });
    } else {
      setUser(null);
    }
  }, [zustandUser, isAuthenticated]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      await zustandLogin(username, password);
      // State will be updated via useEffect
      return true;
    } catch (error) {
      return false;
    }
  };

  const logout = () => {
    zustandLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
