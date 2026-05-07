import React, { createContext, useContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { API } from '@/lib/constants';
import { extractMediaUrl } from '@/lib/upload';

interface Profile {
  id: string;
  full_name?: string;
  phone?: string;
  email?: string;
  avatar?: {
    url?: string | null;
    public_id?: string | null;
    format?: string | null;
  };
  avatar_url?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
  role?: 'customer' | 'worker' | 'thekedar' | 'admin';
  preferred_language?: string;
  city?: string;
  areaId?: string;
  area_id?: string;
  state?: string;
  pincode?: string;
  address?: string;
  is_verified?: boolean;
}

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string, role: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ data?: any, error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  hasCompletedOnboarding: (userId: string) => Promise<boolean>;
  signInWithOTP: (phone: string) => Promise<{ error: Error | null }>;
  verifyOTP: (email: string, otp: string, shouldLogin?: boolean) => Promise<{ data: any; error: Error | null }>;
  login?: (provider: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthContext] Using API URL:', API);
  }, []);

  const revalidateSession = useCallback(async (options?: { initial?: boolean }) => {
    const token = localStorage.getItem('token');
    if (!token) {
      if (options?.initial) setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const { user } = await res.json();
        setUser({ ...user, id: user.id || user._id });
        // Normalize ID handling
        const userId = user.id || user._id;
        if (userId) localStorage.setItem('userId', userId);
        setProfile({
          id: userId,
          full_name: user.full_name,
          email: user.email,
          avatar: user.avatar,
          avatar_url: extractMediaUrl(user.avatar) || user.avatar_url,
          role: user.role,
          // Preserve other fields
          phone: user.phone,
          socials: user.socials,
          preferred_language: user.preferred_language,
          city: user.city,
          state: user.state,
          pincode: user.pincode,
          is_verified: user.is_verified
        });
      } else if (res.status === 401 || res.status === 403) {
        // Only clear token on auth errors
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        setUser(null);
        setProfile(null);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      // Do not remove token on network errors
    } finally {
      if (options?.initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    revalidateSession({ initial: true });
  }, [revalidateSession]);

  useEffect(() => {
    const recoverSession = () => {
      if (!document.hidden) {
        revalidateSession();
      }
    };

    window.addEventListener('online', recoverSession);
    window.addEventListener('focus', recoverSession);
    document.addEventListener('visibilitychange', recoverSession);

    return () => {
      window.removeEventListener('online', recoverSession);
      window.removeEventListener('focus', recoverSession);
      document.removeEventListener('visibilitychange', recoverSession);
    };
  }, [revalidateSession]);

  const signUp = async (email: string, password: string, fullName: string, phone: string, role: string) => {
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, phone, role })
      });
      if (!res.ok) {
        const err = await res.json();
        return { error: new Error(err.message || 'Registration failed') };
      }
      // Registration now sends OTP, does not return token/user immediately
      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      console.log(`[Auth] Login status: ${res.status}`);
      const contentType = res.headers.get("content-type");
      
      if (!res.ok) {
        if (contentType && contentType.includes("application/json")) {
           const err = await res.json();
           return { error: new Error(err.message || 'Login failed') };
        } else {
           const text = await res.text();
           console.error("[Auth] Non-JSON error response:", text);
           return { error: new Error(`Login failed with status ${res.status}`) };
        }
      }

      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        // If 2FA is required, we don't set user/token yet
        if (data.requireOtp) {
          return { data, error: null };
        }
        
        if (data.token) {
          if (data.role === 'admin') {
            localStorage.setItem('adminToken', data.token);
            window.location.href = '/admin-portal-2026';
            return { data, error: null };
          }
          localStorage.setItem('token', data.token);
          setUser(data.user ? { ...data.user, id: data.user.id || data.user._id } : data.user);
          const userId = data.user?.id || data.user?._id;
          if (userId) {
            localStorage.setItem('userId', userId);
            setProfile({ id: userId, full_name: data.user.full_name, email: data.user.email, role: data.user.role });
          }
        }
        return { data, error: null };
      } else {
        const text = await res.text();
        console.error("[Auth] Success status but non-JSON response:", text);
        return { error: new Error("Server returned non-JSON response") };
      }
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  // OTP / provider helpers (minimal implementations to satisfy components)
  const signInWithOTP = async (phone: string) => {
    try {
      const res = await fetch(`${API}/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'OTP send failed' }));
        return { error: new Error(err.message || 'OTP send failed') };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const verifyOTP = async (email: string, otp: string, shouldLogin: boolean = true) => {
    try {
      const res = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      if (!res.ok) {
        const err = await res.json();
        return { data: null, error: new Error(err.message || 'OTP verification failed') };
      }
      const data = await res.json();

      if (shouldLogin) {
        if (data?.token) localStorage.setItem('token', data.token);
        if (data?.user) {
          const normalizedUser = { ...data.user, id: data.user.id || data.user._id };
          setUser(normalizedUser);
          if (normalizedUser.id) localStorage.setItem('userId', normalizedUser.id);
          setProfile({
            id: normalizedUser.id,
            full_name: data.user.full_name,
            email: data.user.email,
            phone: data.user.phone,
            avatar: data.user.avatar,
            avatar_url: extractMediaUrl(data.user.avatar) || data.user.avatar_url,
            socials: data.user.socials,
            role: data.user.role,
            preferred_language: data.user.preferred_language,
            city: data.user.city,
            state: data.user.state,
            pincode: data.user.pincode,
            is_verified: data.user.is_verified ?? true,
          });
        }
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err as Error };
    }
  };

  const login = async (provider: string) => {
    // Provider-based login is app-specific (e.g., Google OAuth). Expose a helper that UI can use to redirect.
    try {
      // For now return not implemented (the UI can handle redirect flow)
      return { error: new Error('Not implemented') };
    } catch (err: any) {
      return { error: err as Error };
    }
  };


  const signOut = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/users/${user.id || user._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const err = await res.json();
        return { error: new Error(err.message || 'Update failed') };
      }
      const updated = await res.json();
      setProfile((prev) => prev ? { ...prev, ...updates } : null);
      setUser(updated);
      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const hasCompletedOnboarding = async (userId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API}/worker-profiles/user/${userId}`);
      return res.ok;
    } catch (err) {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        hasCompletedOnboarding,
        signInWithOTP,
        verifyOTP,
        login,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
