/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase/supabaseConfig";

export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
};

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    
    // Periksa status penangguhan (suspend) secara instan saat login
    try {
      const { data: profile, error: profileError } = await supabase
        .from("sipakdesa_users")
        .select("*")
        .eq("id", data.user.id)
        .single();
        
      if (profileError && profileError.code !== "PGRST116") {
        console.error("Gagal memeriksa profil saat login:", profileError);
      }
      
      if (profile && profile.active === false) {
        await supabase.auth.signOut();
        throw new Error("suspended");
      }
    } catch (e) {
      if (e.message === "suspended") throw e;
      console.warn("Gagal memeriksa status penangguhan secara instan saat login:", e);
    }
    
    return data;
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function changePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  }

  async function handleUserSession(user) {
    if (user) {
      try {
        let profile = null;
        let profileFetchFailed = false;
        
        const { data, error } = await supabase
          .from("sipakdesa_users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            profile = null;
          } else {
            console.error("Gagal memuat profil dari Supabase:", error);
            profileFetchFailed = true;
          }
        } else {
          profile = data;
        }

        if (!profileFetchFailed) {
          if (!profile) {
            // Hitung jumlah user untuk otomatis menunjuk super_admin
            const { count, error: countError } = await supabase
              .from("sipakdesa_users")
              .select("*", { count: "exact", head: true });
            
            const totalUsers = countError ? 999 : (count ?? 0);
            const defaultRole = totalUsers === 0 ? USER_ROLES.SUPER_ADMIN : USER_ROLES.ADMIN;

            const profileData = {
              id: user.id,
              fullname: "Pengguna Baru",
              email: user.email,
              role: defaultRole,
              active: true,
            };

            const { error: insertError } = await supabase
              .from("sipakdesa_users")
              .insert([profileData]);

            if (insertError) {
              console.error("Auto-create user profile failed:", insertError);
            } else {
              profile = profileData;
            }
          }
        }

        if (profile && profile.active === false) {
          await supabase.auth.signOut();
          setCurrentUser(null);
          setLoading(false);
          setInitialized(true);
          return;
        }

        setCurrentUser({
          ...user,
          role: profile?.role || USER_ROLES.ADMIN,
          suspended: profile?.active === false,
          name: profile?.fullname || "Pengguna Baru",
          createdAt: profile?.created_at || null,
        });
      } catch (error) {
        console.error("Error handling user session:", error);
        setCurrentUser(user);
      }
    } else {
      setCurrentUser(null);
    }
    setLoading(false);
    setInitialized(true);
  }

  useEffect(() => {
    let active = true;
    
    // Ambil session saat ini dulu secara asinkron
    const initializeAuth = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (active) {
        await handleUserSession(session?.user ?? null);
      }
    };

    initializeAuth();

    // Dengarkan perubahan state auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (active) {
        await handleUserSession(session?.user ?? null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async function sendForgotPasswordLink(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) throw new Error("email-empty");

    const { data: profile, error } = await supabase
      .from("sipakdesa_users")
      .select("*")
      .eq("email", cleanEmail)
      .single();

    if (error || !profile) {
      throw new Error("email-not-registered");
    }

    if (profile.active === false) {
      throw new Error("user-suspended");
    }

    return resetPassword(cleanEmail);
  }

  const value = {
    currentUser,
    login,
    logout,
    changePassword,
    resetPassword,
    sendForgotPasswordLink,
    loading,
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

