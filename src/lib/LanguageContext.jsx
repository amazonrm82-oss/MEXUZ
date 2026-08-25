import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { translate, translateStatus } from "./i18n";

const LanguageContext = createContext(null);
const STORAGE_KEY = "crm-lang";

// Wraps the whole app (including the pre-login screens) so language works before a profile
// exists — localStorage is the source of truth until a profile loads, at which point the
// account's saved preference (synced across devices) takes over.
export function LanguageProvider({ profile, children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem(STORAGE_KEY) || "he");

  useEffect(() => {
    if (profile?.language && profile.language !== lang) setLangState(profile.language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.language]);

  useEffect(() => {
    document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(async (next) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
    if (profile?.id) await supabase.from("profiles").update({ language: next }).eq("id", profile.id);
  }, [profile?.id]);

  const t = useCallback((text) => translate(lang, text), [lang]);
  const tStatus = useCallback((text) => translateStatus(lang, text), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tStatus, dir: lang === "en" ? "ltr" : "rtl" }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
