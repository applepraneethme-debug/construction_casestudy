import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState('');
  const [error, setError] = useState(null);

  // Fetch CSRF token for state-changing requests
  const fetchCsrfToken = async () => {
    try {
      const res = await fetch('/api/auth/csrf-token', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setCsrfToken(data.csrfToken);
        return data.csrfToken;
      }
    } catch (err) {
      console.warn('Failed to fetch CSRF token:', err.message);
    }
    return '';
  };

  // Check if user is currently logged in via active HttpOnly cookie
  const checkAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        await fetchCsrfToken();
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Login action
  const login = async (email, password) => {
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    setUser(data.user);
    if (data.csrfToken) {
      setCsrfToken(data.csrfToken);
    } else {
      await fetchCsrfToken();
    }
    return data.user;
  };

  // Logout action
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setCsrfToken('');
    }
  };

  // Centralized authenticated fetch helper with automatic CSRF token inclusion
  const authFetch = async (url, options = {}) => {
    const headers = { ...options.headers };

    // Attach CSRF token on mutating requests
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      let activeCsrf = csrfToken;
      if (!activeCsrf) {
        activeCsrf = await fetchCsrfToken();
      }
      if (activeCsrf) {
        headers['X-CSRF-Token'] = activeCsrf;
      }
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        csrfToken,
        login,
        logout,
        checkAuth,
        authFetch
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
