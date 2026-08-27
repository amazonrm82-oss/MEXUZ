import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data || null);
  }, []);

  // A verified TOTP factor puts the session at aal1 right after password login — currentLevel
  // stays below nextLevel until the 6-digit code challenge succeeds. That gap is exactly what
  // gates access in Root (App.jsx) via mfaRequired.
  const refreshMfaStatus = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setMfaRequired(!!data && data.currentLevel !== data.nextLevel);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await loadProfile(session?.user?.id);
      if (session) await refreshMfaStatus(); else setMfaRequired(false);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      await loadProfile(session?.user?.id);
      if (session) await refreshMfaStatus(); else setMfaRequired(false);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadProfile, refreshMfaStatus]);

  const login = useCallback(async (username, password, t = (s) => s) => {
    const { data: lockout } = await supabase.rpc("check_login_lockout", { p_username: username });
    if (lockout?.locked) {
      const mins = Math.ceil(lockout.retry_after_seconds / 60);
      const unit = mins >= 60 ? `${Math.ceil(mins / 60)} ${t("שעות")}` : `${mins} ${t("דקות")}`;
      return { error: `${t("יותר מדי ניסיונות כושלים. נסי שוב בעוד")} ${unit}.` };
    }

    // Same generic error either way — a distinct "username not found" message would let anyone
    // probe which usernames exist in the system before even trying a password.
    const invalidCreds = t("שם משתמש או סיסמה שגויים");
    const { data: email, error: lookupErr } = await supabase.rpc("email_for_username", { p_username: username });
    if (lookupErr || !email) {
      await supabase.rpc("record_login_failure", { p_username: username });
      return { error: invalidCreds };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await supabase.rpc("record_login_failure", { p_username: username });
      return { error: invalidCreds };
    }
    await supabase.rpc("record_login_success", { p_username: username });
    return { error: null };
  }, []);

  const logout = useCallback(() => supabase.auth.signOut(), []);

  return (
    <AuthContext.Provider value={{
      session, profile, loading, login, logout, mfaRequired, refreshMfaStatus,
      reloadProfile: () => loadProfile(session?.user?.id),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
